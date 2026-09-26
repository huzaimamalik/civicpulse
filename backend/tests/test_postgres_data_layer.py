import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.settings import get_settings


DATABASE_URL = os.getenv("DATABASE_URL") or get_settings().database_url
pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith("postgresql"),
    reason="requires a real PostgreSQL DATABASE_URL",
)


def migrate() -> None:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")


def test_migration_and_database_constraints_against_real_postgres():
    migrate()
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with engine.begin() as connection:
        table = connection.execute(
            text("SELECT to_regclass('public.complaints')")
        ).scalar_one()
        assert table == "complaints"
        indexes = {
            row[0]
            for row in connection.execute(
                text(
                    """
                    SELECT indexname FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = 'complaints'
                    """
                )
            )
        }
        assert "ix_complaints_status_priority" in indexes
        assert "ix_complaints_created_at" in indexes

    invalid_values = (
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "text": "too short",
            "location": "Valid location",
            "category": "water",
            "priority": "normal",
            "status": "open",
            "triaged_by": "rules",
        },
        {
            "id": "00000000-0000-0000-0000-000000000002",
            "text": "A valid complaint text for the database constraint",
            "location": "x",
            "category": "water",
            "priority": "normal",
            "status": "open",
            "triaged_by": "rules",
        },
        {
            "id": "00000000-0000-0000-0000-000000000003",
            "text": "A valid complaint text for enum verification",
            "location": "Valid location",
            "category": "invalid_category",
            "priority": "normal",
            "status": "open",
            "triaged_by": "rules",
        },
        {
            "id": "00000000-0000-0000-0000-000000000004",
            "text": "A valid complaint text for provider verification",
            "location": "Valid location",
            "category": "water",
            "priority": "normal",
            "status": "open",
            "triaged_by": "unknown",
        },
    )
    statement = text(
        """
        INSERT INTO complaints
            (id, text, location, category, priority, status, ai_summary,
             triaged_by, triage_latency_ms, created_at, updated_at)
        VALUES
            (:id, :text, :location, :category, :priority, :status, NULL,
             :triaged_by, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """
    )
    for values in invalid_values:
        with pytest.raises((IntegrityError, DBAPIError)):
            with engine.begin() as connection:
                connection.execute(statement, values)

    engine.dispose()
