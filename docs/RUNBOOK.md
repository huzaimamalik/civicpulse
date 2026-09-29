# CivicPulse Runbook

How to deploy, roll back, read logs, and respond when triage starts failing.

## Local development

### Start/stop dependencies

```bash
./scripts/dev-services-up.sh     # Postgres 16 + Redis 7 containers, AOF enabled
./scripts/dev-services-down.sh   # stop and remove containers, keep volumes
./scripts/dev-services-down.sh --wipe   # also delete volumes (full reset)
```

`dev-services-up.sh` prints the `DATABASE_URL`/`REDIS_URL` values to put
in `.env` (already done for this repo's `.env`).

### Apply migrations / seed data

From the repository root, apply the schema to the Compose backend:

```bash
docker compose --env-file .env.example exec -T backend alembic upgrade head
```

For direct local development, run from `backend/`:

```bash
uv run --with-requirements requirements.txt alembic upgrade head
uv run --with-requirements requirements.txt python scripts/seed.py
```

The seed script uses fixed UUIDs and is safe to run repeatedly.

### Run the backend locally

From `backend/`, run:

```bash
uv run --with-requirements requirements.txt uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API serves on `http://127.0.0.1:8000`. The process reads `backend/.env`;
use `TRIAGE_PROVIDER=simulated` for deterministic local runs or
`TRIAGE_PROVIDER=llm` with a valid `GROQ_API_KEY` for live triage.

### Run the test suite

From `backend/`, run:

```bash
uv run --with-requirements requirements.txt pytest --cov=app --cov-report=term-missing --cov-fail-under=65
```

`backend/tests/conftest.py` forces `TESTING=true` and
`TRIAGE_PROVIDER=simulated` before application imports, so the default suite
cannot call Groq. To include the live PostgreSQL/Redis tests, also set
`RUN_REAL_REDIS_TESTS=1`.

## Configuration

| Variable | Purpose | Where it's read |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | backend startup |
| `REDIS_URL` | Redis connection string | backend startup, cache, rate limiter |
| `GROQ_API_KEY` | Groq API key for live triage | `LLMTriage` provider |
| `GROQ_MODEL` | Which Groq model to call | `LLMTriage` provider |
| `TRIAGE_PROVIDER` | `llm` \| `rules` \| `simulated` — selects the active `TriageProvider` | provider factory |
| `TESTING` | When `true`, allows in-memory repository/cache fallback; **must never be true in production** | app startup / dependency wiring |
| `RATE_LIMIT_PER_MIN` | Fixed-window complaint submission limit per client IP | backend settings / Redis rate limiter |
| `POSTGRES_DB` | Compose/scripts PostgreSQL database name | Compose and `dev-services-up.sh` |
| `POSTGRES_USER` | Compose/scripts PostgreSQL user | Compose and `dev-services-up.sh` |
| `POSTGRES_PASSWORD` | Compose/scripts PostgreSQL password | Compose and `dev-services-up.sh` |
| `BACKEND_IMAGE` | Production backend image repository | `compose.prod.yaml` |
| `FRONTEND_IMAGE` | Production frontend image repository | `compose.prod.yaml` |
| `IMAGE_TAG` | Immutable production image tag, normally a commit SHA | `compose.prod.yaml` / production overlay |

### Rotating the Groq API key

1. Generate a new key at console.groq.com.
2. Update `GROQ_API_KEY` in `.env` (local) and in the corresponding
   GitHub/Kubernetes secret for production.
3. Revoke the old key in the Groq console once the new one is confirmed working.

## Deploying

### Local (Docker Compose)

For the development stack, from the repository root:

```bash
docker compose --env-file .env.example up --build -d --wait
docker compose --env-file .env.example exec -T backend alembic upgrade head
```

The frontend is available on port `8080`; the backend is available on port
`8000`. `compose.yaml` starts PostgreSQL, Redis with AOF, Ollama, backend, and
frontend on the declared `edge` and `internal` networks.

For the standalone production file, set `BACKEND_IMAGE`, `FRONTEND_IMAGE`,
`IMAGE_TAG`, database credentials, and API configuration, then run:

```bash
docker compose --env-file .env.prod -f compose.prod.yaml up -d --wait
```

`compose.prod.yaml` must be used on its own, not merged with `compose.yaml`,
and `IMAGE_TAG` must be an immutable commit SHA rather than `latest`.

### Kubernetes (production)

The production overlay is `k8s/overlays/prod`. Before applying it, replace the
placeholder image tags in that overlay, inject real values into the Secret,
and replace the placeholder Ingress host in `k8s/base/ingress.yaml`.

From the repository root:

```bash
kubectl apply -k k8s/overlays/prod
kubectl rollout status -n civicpulse statefulset/postgres --timeout=180s
kubectl rollout status -n civicpulse deployment/redis --timeout=180s
kubectl rollout status -n civicpulse deployment/backend --timeout=180s
kubectl rollout status -n civicpulse deployment/frontend --timeout=180s
kubectl exec -n civicpulse deployment/backend -- alembic upgrade head
kubectl get ingress -n civicpulse
```

The backend readiness probe checks `/ready`; liveness checks `/health`.

## Rolling back

Use the deployment names defined in `k8s/base/`:

1. **Fast/imperative:**
   `kubectl rollout undo deployment/backend -n civicpulse` and, if needed,
   `kubectl rollout undo deployment/frontend -n civicpulse`. Use this to
   restore the previous ReplicaSet quickly.
2. **Declarative/auditable:** check out the previous known-good revision,
   ensure `k8s/overlays/prod/kustomization.yaml` uses its image SHA, and run
   `kubectl apply -k k8s/overlays/prod` again. Use this to make the desired
   state and image version explicit after the incident.

## Reading logs

- Backend logs are structured JSON to stdout, one line per request,
  carrying a `request_id` (propagated from the `X-Request-ID` header, or
  generated if absent). Use the `request_id` to correlate a specific
  failed request across log lines.
- Locally: logs go to your terminal (or `docker compose logs backend`
  once the Compose stack is running the built image rather than a bare
  local process).
- Compose logs can be followed with `docker compose logs -f backend`.
- Kubernetes logs can be followed with
  `kubectl logs -n civicpulse deployment/backend -f --all-containers=true`.
- The JSON formatter emits fields such as:
  `{"level":"INFO","message":"request complete","logger":"civicpulse","request_id":"<uuid>"}`.
  Fallback warnings additionally contain `complaint_id`, `provider`, and
  `error_class`.
- One `WARNING`-level line is emitted per triage fallback, containing the
   complaint id, the provider name, and the error class that triggered the
   fallback — grep for `"level":"WARNING"` to find these.

## When triage starts failing

1. **Check `GET /api/meta/providers`** — shows the active provider and
   the last 20 triage outcomes (provider, latency, fallback y/n). If
   `fallback: true` is showing up frequently, the LLM path is degraded,
   not down entirely.
2. **Check the fallback counter on `GET /metrics`** — a sudden jump
   indicates the Groq call is failing broadly (expired/rate-limited key,
   Groq outage, or a schema/model change breaking structured-output
   validation).
3. **Confirm `GROQ_API_KEY` is valid and unexpired** — a revoked or
   rotated-but-not-updated key will cause every live call to fail and
   fall back to `RuleBasedTriage`. This is expected behavior (no user
   sees a 500), but it degrades triage quality until fixed.
4. **Check Groq's status/rate limits** — free-tier rate limits are
   per-organization and per-model; a burst of traffic (or the rate
   limiter's own retry behavior) can exhaust the quota.
5. **`RuleBasedTriage` is always available and never fails** — if you
   need to stop relying on the LLM entirely while investigating, set
   `TRIAGE_PROVIDER=rules` and redeploy/restart. Complaints will still be
   triaged (less accurately) and the system stays available.
6. **Never** treat a triage failure as a reason to accept malformed data —
   the schema validation should already be rejecting bad LLM output
   safely; if you see a malformed `category`/`priority` actually persisted,
   that's a validation bug, not a provider problem, and should be treated
   as more urgent than a fallback rate spike.

---

## Finishing this runbook

All repository-specific runbook items have been filled
using the current scripts, backend configuration, Compose files, Kubernetes
manifests, and CI/CD workflows. Recheck image tags, secrets, and the Ingress
host before any production deployment because those values are intentionally
placeholders in tracked configuration.
