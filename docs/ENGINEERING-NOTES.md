# Engineering Notes

## Data layer indexes

- `ix_complaints_status_priority` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the operator dashboard's default filtered query, such as `GET /api/complaints?status=open&priority=high`.
- `ix_complaints_created_at` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the recency-sorted complaint list used by the dashboard and recent-complaints view.

## Seed data

`backend/scripts/seed.py` uses fixed UUIDv5 identifiers and PostgreSQL `ON CONFLICT DO NOTHING`. Seed values are hardcoded with plausible triage results so the seed is deterministic and does not require an external AI provider.
