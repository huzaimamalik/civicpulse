from collections import deque
from contextlib import asynccontextmanager
from logging import getLogger
from time import perf_counter
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from .cache import Cache, RedisRateLimiter
from .logging_config import configure_logging
from .models import (
    Category,
    Complaint,
    ComplaintCreate,
    ComplaintList,
    Priority,
    ProviderMeta,
    Stats,
    Status,
    StatusUpdate,
)
from .providers.triage import RuleBasedTriage, create_provider
from .repositories import ComplaintRepository, ComplaintRepositoryProtocol
from .services import (
    ComplaintService,
    InvalidTransition,
    RateLimiter,
    TriageService,
)
from .settings import get_settings
from .sql_repository import SqlAlchemyComplaintRepository

logger = getLogger("civicpulse")
REQUESTS = Counter("civicpulse_requests_total", "HTTP requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("civicpulse_request_latency_seconds", "HTTP request latency", ["path"])
TRIAGE_LATENCY = Histogram("civicpulse_triage_latency_seconds", "Triage latency")
FALLBACKS = Counter("civicpulse_triage_fallback_total", "Triage fallbacks")
STATS_CACHE_KEY = "civicpulse:stats"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    if settings.testing:
        repository: ComplaintRepositoryProtocol = ComplaintRepository()
    else:
        if not settings.database_url.startswith("postgresql"):
            raise RuntimeError("DATABASE_URL must point to PostgreSQL outside test mode")
        repository = SqlAlchemyComplaintRepository(settings.database_url)
    app.state.repository = repository
    app.state.cache = Cache(settings.redis_url, allow_in_memory=settings.testing)
    provider = create_provider(
        settings.triage_provider,
        groq_api_key=settings.groq_api_key,
        groq_model=settings.groq_model,
        ollama_base_url=settings.ollama_base_url,
        ollama_model=settings.ollama_model,
    )
    triage = TriageService(
        provider=provider,
        fallback=RuleBasedTriage(),
        outcomes=deque(maxlen=20),
        cache=app.state.cache,
    )
    app.state.service = ComplaintService(repository, triage)
    app.state.rate_limiter = (
        RateLimiter(settings.rate_limit_per_min)
        if settings.testing
        else RedisRateLimiter(app.state.cache.redis_client, settings.rate_limit_per_min)
    )
    app.state.active_provider = provider.name
    yield
    if hasattr(repository, "engine"):
        repository.engine.dispose()
    app.state.repository = None
    app.state.cache = None


app = FastAPI(title="CivicPulse API", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    started = perf_counter()
    response = await call_next(request)
    elapsed = perf_counter() - started
    response.headers["X-Request-ID"] = request_id
    REQUESTS.labels(request.method, request.url.path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.url.path).observe(elapsed)
    logger.info("request complete", extra={"request_id": request_id})
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"detail": exc.errors()})


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready(request: Request):
    failures = []
    if not request.app.state.repository.healthcheck():
        failures.append("postgres")
    if not request.app.state.cache.healthcheck():
        failures.append("redis")
    if failures:
        return JSONResponse(status_code=503, content={"status": "not_ready", "failed": failures})
    return {"status": "ready"}


@app.post("/api/complaints", response_model=Complaint, status_code=201)
async def create_complaint(request: Request, data: ComplaintCreate, response: Response):
    client_key = request.client.host if request.client else "unknown"
    if not request.app.state.rate_limiter.allow(client_key):
        retry_after = str(request.app.state.rate_limiter.retry_after())
        response.headers["Retry-After"] = retry_after
        raise HTTPException(status_code=429, detail="rate limit exceeded", headers={"Retry-After": retry_after})
    complaint, fallback_used, error_class = request.app.state.service.create(data)
    TRIAGE_LATENCY.observe(complaint.triage_latency_ms / 1000)
    if fallback_used:
        FALLBACKS.inc()
        logger.warning(
            "triage fallback",
            extra={"complaint_id": str(complaint.id), "provider": "rules:fallback", "error_class": error_class},
        )
    request.app.state.cache.delete(STATS_CACHE_KEY)
    return complaint


@app.get("/api/complaints/{complaint_id}", response_model=Complaint)
async def get_complaint(request: Request, complaint_id: UUID):
    complaint = request.app.state.repository.get(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail="complaint not found")
    return complaint


@app.get("/api/complaints", response_model=ComplaintList)
async def list_complaints(
    request: Request,
    category: Category | None = None,
    priority: Priority | None = None,
    status: Status | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    complaints, total = request.app.state.repository.list(category, priority, status, page, page_size)
    return ComplaintList(complaints=complaints, total=total)


@app.patch("/api/complaints/{complaint_id}/status", response_model=Complaint)
async def update_status(request: Request, complaint_id: UUID, data: StatusUpdate):
    try:
        complaint = request.app.state.service.change_status(complaint_id, data.status)
    except InvalidTransition as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if complaint is None:
        raise HTTPException(status_code=404, detail="complaint not found")
    request.app.state.cache.delete(STATS_CACHE_KEY)
    return complaint


@app.get("/api/stats", response_model=Stats)
async def stats(request: Request, response: Response):
    cached = request.app.state.cache.get_json(STATS_CACHE_KEY)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached
    value = request.app.state.repository.stats()
    request.app.state.cache.set_json(STATS_CACHE_KEY, value, 30)
    response.headers["X-Cache"] = "MISS"
    return value


@app.get("/api/meta/providers", response_model=ProviderMeta)
async def provider_meta(request: Request):
    outcomes = list(request.app.state.service.triage.outcomes)
    return ProviderMeta(active_provider=request.app.state.active_provider, outcomes=outcomes)


@app.get("/metrics")
async def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)
