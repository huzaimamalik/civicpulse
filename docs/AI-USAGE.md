# AI Usage Disclosure

This project used AI assistance throughout. Per course policy, disclosure
carries no penalty — what matters is that every line in this repo can be
explained and defended by the person who committed it, regardless of what
tool helped write it.

## Muhammad Hamza Atif, 24I-3160 (Backend, Data layer, Cache layer, AI layer)

### Claude (Anthropic) — planning, coordination, and documentation

Used for work that precedes and wraps the code, not for writing
application code directly:

- Broke the assignment's PDF spec into a two-person task split designed to
  minimize cross-dependency (server-side track vs. frontend/infra track),
  and produced a day-by-day roadmap for the compressed timeline.
- Wrote the shared contract document (`agent-briefs/00-shared-contract.md`)
  consolidating the assignment's fixed API/schema/network requirements
  into a single reference both partners' coding agents work against.
- Wrote the per-segment agent-brief files (`agent-briefs/01-*` through
  `agent-briefs/08-*`) translating each rubric section into concrete
  acceptance checklists for a coding agent to follow.
- Wrote `agent-briefs/MASTER-PROMPT.md`, a reusable session-kickoff prompt
  template, and drafted the actual per-segment prompts given to GitHub
  Copilot for each sprint (backend-core, data-layer, cache-layer, AI layer).
- Reviewed Copilot's output at each stage (working-tree accounting, commit
  plans, verification results) before commits were made, and flagged
  issues for follow-up: a stray in-memory fallback risk, an unenabled
  Redis AOF flag, a leftover test row in seed data, and an exposed API key
  needing rotation.
- Researched Groq's current data-retention and training-use terms (web
  search against Groq's own documentation, dated 2026-09-28) to inform
  `docs/adr/0004-pii-and-data-governance.md`, since this could not be
  answered reliably from training data alone.
- Drafted this file and `docs/RUNBOOK.md`.

Claude did not write application code, run tests, or perform any git
operations — all of that was done by GitHub Copilot (writing/testing) and
by Hamza directly (all git add/commit/push/PR actions, per
`agent-briefs/GIT-WORKFLOW.md`, which prohibits coding agents from
performing git operations).

### GitHub Copilot (agent mode, VS Code) — implementation

Given `agent-briefs/00-shared-contract.md` plus the relevant segment file
for each sprint, and a specific prompt naming the sprint's scope:

- **Backend core**: FastAPI app structure (routes/services/repositories
  layering), all contract endpoints, the explicit status state-machine
  transition table, structured JSON logging with propagated request IDs,
  SIGTERM handling.
- **Data layer**: Alembic migration for the `complaints` table (native
  Postgres enums, CHECK constraints, indexes), removal of
  `Base.metadata.create_all()` from app startup, the idempotent seed
  script, and migration/constraint tests run against a real PostgreSQL
  container (not SQLite).
- **Cache layer**: Redis read-through caching for `/api/stats` (TTL,
  `X-Cache` header, write invalidation), a Redis-backed distributed rate
  limiter for `POST /api/complaints`, and integration tests run against a
  real Redis container. Also updated the local dev scripts to enable
  Redis AOF persistence after a review step identified it was missing.
- **AI layer**: in progress at time of writing — `TriageProvider`
  implementations, structured-output validation, timeout/retry/fallback
  logic, content-hash caching, and the prompt-injection guardrail test.

Every sprint's output was verified against real local infrastructure
(actual Postgres and Redis containers, not stubs) before being accepted,
and Copilot was explicitly instructed not to leave silent in-memory
fallbacks active outside an explicit test mode. Commit messages and file
groupings were proposed by Copilot but reviewed and executed manually.

## Muhammad Huzaima, 24I-3014 (Frontend, Docker/Compose, Kubernetes, CI/CD)

*To be filled in by [Partner B] following the same format as above:
which tool(s) were used for which segment, what was AI-generated vs.
manually written, and what was changed after review and why.*
