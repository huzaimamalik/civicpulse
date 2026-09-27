from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class Category(StrEnum):
    WATER = "water"
    ELECTRICITY = "electricity"
    SANITATION = "sanitation"
    ROADS = "roads"
    STREETLIGHTS = "streetlights"
    OTHER = "other"


class Priority(StrEnum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class Status(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ComplaintCreate(BaseModel):
    text: str = Field(min_length=10, max_length=2000)
    location: str = Field(min_length=3, max_length=200)
    reporter_contact: str | None = None


class StatusUpdate(BaseModel):
    status: Status


class TriageResult(BaseModel):
    category: Category
    priority: Priority
    summary: str = Field(max_length=140)
    confidence: float = Field(ge=0.0, le=1.0)


class Complaint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    location: str
    reporter_contact: str | None
    category: Category
    priority: Priority
    status: Status
    ai_summary: str | None
    triaged_by: str
    triage_latency_ms: int
    created_at: datetime
    updated_at: datetime


class ComplaintList(BaseModel):
    complaints: list[Complaint]
    total: int


class Stats(BaseModel):
    byCategory: dict[Category, int]
    byPriority: dict[Priority, int]


class ProviderOutcome(BaseModel):
    provider: str
    latency_ms: int
    fallback: bool


class ProviderMeta(BaseModel):
    active_provider: str
    outcomes: list[ProviderOutcome]


def new_complaint(data: ComplaintCreate, triage: TriageResult, triaged_by: str, latency_ms: int) -> Complaint:
    now = datetime.now(timezone.utc)
    return Complaint(
        id=uuid4(),
        text=data.text,
        location=data.location,
        reporter_contact=data.reporter_contact,
        category=triage.category,
        priority=triage.priority,
        status=Status.OPEN,
        ai_summary=triage.summary,
        triaged_by=triaged_by,
        triage_latency_ms=latency_ms,
        created_at=now,
        updated_at=now,
    )
