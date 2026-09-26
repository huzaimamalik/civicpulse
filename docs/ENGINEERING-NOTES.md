# Engineering Notes

## Data layer indexes

- `ix_complaints_status_priority` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the operator dashboard's default filtered query, such as `GET /api/complaints?status=open&priority=high`.
- `ix_complaints_created_at` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the recency-sorted complaint list used by the dashboard and recent-complaints view.

## Seed data

`backend/scripts/seed.py` uses fixed UUIDv5 identifiers and PostgreSQL `ON CONFLICT DO NOTHING`. Seed values are hardcoded with plausible triage results so the seed is deterministic and does not require an external AI provider.

## Cache and Redis persistence

The stats response is cached in Redis for 30 seconds and explicitly invalidated after complaint creation or status changes. Invalidation keeps the dashboard correct immediately after a write; the TTL remains a safety net if a future write path misses invalidation or a process fails between persistence and invalidation.

Redis AOF persistence is enabled because this Redis instance also stores distributed rate-limit counters and, later, triage-result cache entries. Losing those values on every restart would reset abuse protection and force avoidable provider calls. The named volume preserves that operational state while still allowing `dev-services-down.sh --wipe` to perform a deliberate full reset.
