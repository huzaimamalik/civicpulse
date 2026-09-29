from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Engine,
    Integer,
    String,
    Text,
    create_engine,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from .models import Category, Complaint, Priority, Status


class Base(DeclarativeBase):
    pass


class ComplaintRow(Base):
    __tablename__ = "complaints"

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    reporter_contact: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(
        ENUM("water", "electricity", "sanitation", "roads", "streetlights", "other", name="category_enum", create_type=False),
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        ENUM("high", "normal", "low", name="priority_enum", create_type=False), nullable=False
    )
    status: Mapped[str] = mapped_column(
        ENUM("open", "in_progress", "resolved", "rejected", name="status_enum", create_type=False),
        nullable=False,
    )
    ai_summary: Mapped[str | None] = mapped_column(String(140))
    triaged_by: Mapped[str] = mapped_column(String(30), nullable=False)
    triage_latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def _to_model(row: ComplaintRow) -> Complaint:
    return Complaint(
        id=row.id, text=row.text, location=row.location, reporter_contact=row.reporter_contact,
        category=Category(row.category), priority=Priority(row.priority), status=Status(row.status),
        ai_summary=row.ai_summary, triaged_by=row.triaged_by, triage_latency_ms=row.triage_latency_ms,
        created_at=row.created_at, updated_at=row.updated_at,
    )


class SqlAlchemyComplaintRepository:
    def __init__(self, database_url: str) -> None:
        self.engine: Engine = create_engine(database_url, pool_pre_ping=True)

    def healthcheck(self) -> bool:
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except SQLAlchemyError:
            return False

    def create(self, complaint: Complaint) -> Complaint:
        with Session(self.engine) as session:
            session.add(
                ComplaintRow(
                    id=complaint.id,
                    text=complaint.text,
                    location=complaint.location,
                    reporter_contact=complaint.reporter_contact,
                    category=complaint.category.value,
                    priority=complaint.priority.value,
                    status=complaint.status.value,
                    ai_summary=complaint.ai_summary,
                    triaged_by=complaint.triaged_by,
                    triage_latency_ms=complaint.triage_latency_ms,
                    created_at=complaint.created_at,
                    updated_at=complaint.updated_at,
                )
            )
            session.commit()
        return complaint

    def get(self, complaint_id: UUID) -> Complaint | None:
        with Session(self.engine) as session:
            row = session.get(ComplaintRow, str(complaint_id))
            return _to_model(row) if row else None

    def list(self, category, priority, status, page, page_size):
        with Session(self.engine) as session:
            query = select(ComplaintRow)
            if category:
                query = query.where(ComplaintRow.category == category.value)
            if priority:
                query = query.where(ComplaintRow.priority == priority.value)
            if status:
                query = query.where(ComplaintRow.status == status.value)
            rows = list(session.scalars(query.order_by(ComplaintRow.created_at.desc())))
            start = (page - 1) * page_size
            return [_to_model(row) for row in rows[start : start + page_size]], len(rows)

    def update_status(self, complaint_id: UUID, status: Status) -> Complaint | None:
        with Session(self.engine) as session:
            row = session.get(ComplaintRow, str(complaint_id))
            if row is None:
                return None
            row.status = status.value
            row.updated_at = datetime.now(timezone.utc)
            session.commit()
            return _to_model(row)

    def stats(self):
        with Session(self.engine) as session:
            rows = list(session.scalars(select(ComplaintRow)))
        by_category = {category.value: 0 for category in Category}
        by_priority = {priority.value: 0 for priority in Priority}
        for row in rows:
            by_category[row.category] += 1
            by_priority[row.priority] += 1
        return {"byCategory": by_category, "byPriority": by_priority}
