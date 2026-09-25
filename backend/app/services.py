from collections import deque
from dataclasses import dataclass
from time import monotonic, perf_counter
from typing import Protocol

from .models import (
    Category,
    Complaint,
    ComplaintCreate,
    Priority,
    ProviderOutcome,
    Status,
    TriageResult,
    new_complaint,
)
from .repositories import ComplaintRepository


ALLOWED_TRANSITIONS: dict[Status, set[Status]] = {
    Status.OPEN: {Status.IN_PROGRESS, Status.REJECTED},
    Status.IN_PROGRESS: {Status.RESOLVED, Status.REJECTED},
    Status.RESOLVED: set(),
    Status.REJECTED: set(),
}


class TriageProvider(Protocol):
    name: str

    def triage(self, text: str, location: str) -> TriageResult: ...


class SimulatedTriage:
    name = "rules"

    def triage(self, text: str, location: str) -> TriageResult:
        lowered = text.lower()
        category = Category.OTHER
        for keyword, candidate in (
            ("water", Category.WATER),
            ("electric", Category.ELECTRICITY),
            ("sanitation", Category.SANITATION),
            ("road", Category.ROADS),
            ("streetlight", Category.STREETLIGHTS),
        ):
            if keyword in lowered:
                category = candidate
                break
        priority = Priority.HIGH if any(word in lowered for word in ("urgent", "danger", "emergency")) else Priority.NORMAL
        return TriageResult(category=category, priority=priority, summary=text.strip()[:140], confidence=0.95)


class FailingTriage:
    name = "llm:groq"

    def triage(self, text: str, location: str) -> TriageResult:
        raise RuntimeError("triage provider unavailable")


class RateLimiter:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str) -> bool:
        now = monotonic()
        hits = [stamp for stamp in self._hits.get(key, []) if now - stamp < 60]
        if len(hits) >= self.limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True


@dataclass
class TriageService:
    provider: TriageProvider
    fallback: TriageProvider
    outcomes: deque[ProviderOutcome]

    def triage(self, text: str, location: str) -> tuple[TriageResult, str, int, bool, str | None]:
        started = perf_counter()
        try:
            result = self.provider.triage(text, location)
            provider_name = self.provider.name
            fallback_used = False
            error_class = None
        except Exception as error:
            result = self.fallback.triage(text, location)
            provider_name = "rules:fallback"
            fallback_used = True
            error_class = type(error).__name__
        latency_ms = round((perf_counter() - started) * 1000)
        self.outcomes.append(ProviderOutcome(provider=provider_name, latency_ms=latency_ms, fallback=fallback_used))
        return result, provider_name, latency_ms, fallback_used, error_class


class ComplaintService:
    def __init__(self, repository: ComplaintRepository, triage: TriageService) -> None:
        self.repository = repository
        self.triage = triage

    def create(self, data: ComplaintCreate) -> tuple[Complaint, bool, str | None]:
        result, provider, latency_ms, fallback_used, error_class = self.triage.triage(data.text, data.location)
        complaint = new_complaint(data, result, provider, latency_ms)
        self.repository.create(complaint)
        return complaint, fallback_used, error_class

    def change_status(self, complaint_id, target: Status) -> Complaint | None:
        current = self.repository.get(complaint_id)
        if current is None:
            return None
        if target not in ALLOWED_TRANSITIONS[current.status]:
            raise InvalidTransition(current.status, target)
        return self.repository.update_status(complaint_id, target)


class InvalidTransition(Exception):
    def __init__(self, source: Status, target: Status) -> None:
        self.source = source
        self.target = target
        super().__init__(f"cannot transition from {source.value} to {target.value}")
