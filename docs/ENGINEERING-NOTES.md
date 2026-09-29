# Engineering Notes

## Data layer indexes

- `ix_complaints_status_priority` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the operator dashboard's default filtered query, such as `GET /api/complaints?status=open&priority=high`.
- `ix_complaints_created_at` in `backend/alembic/versions/20260926_0001_create_complaints.py` supports the recency-sorted complaint list used by the dashboard and recent-complaints view.

## Seed data

`backend/scripts/seed.py` uses fixed UUIDv5 identifiers and PostgreSQL `ON CONFLICT DO NOTHING`. Seed values are hardcoded with plausible triage results so the seed is deterministic and does not require an external AI provider.

## Cache and Redis persistence

The stats response is cached in Redis for 30 seconds and explicitly invalidated after complaint creation or status changes. Invalidation keeps the dashboard correct immediately after a write; the TTL remains a safety net if a future write path misses invalidation or a process fails between persistence and invalidation.

Redis AOF persistence is enabled because this Redis instance also stores distributed rate-limit counters and, later, triage-result cache entries. Losing those values on every restart would reset abuse protection and force avoidable provider calls. The named volume preserves that operational state while still allowing `dev-services-down.sh --wipe` to perform a deliberate full reset.

## HPA scaling lag

During the first load test, the HPA first requested additional replicas about 83 seconds after the k6 run began, and the first additional replica became available about 22 seconds after that scaling decision. The backend eventually scaled from 2 to the configured maximum of 10 replicas, while peak reported CPU utilization reached 295%. The delay comes from metrics collection, HPA reconciliation, scheduling, and pod startup rather than from the HPA target alone. Faster startup, more initial capacity, or more aggressive scaling policies could reduce the delay, but autoscaling cannot remove the need for baseline capacity planning.

Evidence: `docs/evidence/hpa-timeline.csv`, `docs/evidence/hpa-watch.png`, `docs/evidence/replicas-vs-load.png`.

## Why VPA runs in Off mode

VPA is configured in `Off` mode because both VPA and the CPU-based HPA act on CPU requests. If VPA automatically changes the CPU request while HPA is using that request as the denominator for utilization, the two controllers can influence the same signal and work against each other. Recommender mode lets us inspect the recommendation and apply it deliberately before measuring HPA behavior again.

The original backend requests were 100m CPU and 128Mi memory. VPA recommended a Target of 49m CPU and 250Mi memory, which we applied before repeating the same k6 load profile. Before the update, the backend reached 10 replicas with peak HPA CPU utilization of 295%; after the update, it peaked at 6 replicas and 90% CPU utilization, with zero failed requests in the second run. Because runtime conditions can vary between runs, we report this as an observed change rather than attributing the full difference solely to VPA.

Evidence: `docs/evidence/vpa-recommendation.png`, `docs/evidence/hpa-vpa-comparison.png`, `docs/evidence/hpa-timeline-after-vpa.csv`.

## Deliberate merge conflict

A deliberate merge conflict was created in `backend/app/settings.py` when one branch changed the default triage provider to Ollama while the competing branch retained simulated as the deterministic default with stricter `Literal` validation. We selected the simulated version because it provides reproducible default behavior and tighter provider validation, while Ollama remains available through environment-based provider selection. The resolution therefore preserved real local inference without requiring Ollama for every normal run.

Evidence: `docs/evidence/merge-conflict-blocked.png`, `docs/evidence/merge-conflict-markers.png`, `docs/evidence/merge-conflict-resolved.png`, `docs/evidence/merge-conflict-merged.png`.