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

## Muhammad Huzaima Malik, 24I-3014 (Frontend, Docker/Compose, Kubernetes, CI/CD)

### Astra — implementation, infrastructure work, and repository review

Astra was used as the main coding agent for my assigned parts of the project. It was given the existing repository context and the relevant assignment requirements, then used to inspect, implement, verify, and refine changes within a tightly defined scope. Astra was explicitly instructed not to perform Git operations, so all branching, commits, pushes, pull requests, conflict resolution, reviews, and merges were done manually by me.

- **Frontend and integration**: reviewed and refined the React frontend integration with the backend API, including runtime use of relative `/api` routes, nginx proxy behavior, frontend/backend container communication, and the existing frontend test setup.
- **Docker and Compose**: worked on the multi-stage frontend and backend images, `.dockerignore` configuration, health checks, network separation, named volumes, production Compose configuration, and service-to-service communication. It also helped verify that the frontend could not directly reach PostgreSQL while the backend remained able to communicate with internal services.
- **Local inference infrastructure**: helped integrate and validate the Ollama container setup used for local inference, including its persistent model volume, internal networking, and backend connectivity, without exposing the Ollama service directly to the host.
- **Kubernetes**: implemented and reviewed the Kubernetes base resources and overlays, including Deployments, the PostgreSQL StatefulSet and PVC, ClusterIP Services, Ingress, ConfigMap/Secret separation, resource requests and limits, startup/liveness/readiness probes, PDB, HPA, and VPA in recommender mode.
- **CI/CD**: worked on the GitHub Actions workflows for linting, typing, tests, Docker image builds, Trivy scanning, manifest validation, Compose integration testing, GHCR publishing, SHA-based deployment, SBOM generation, and deployment to an ephemeral k3d cluster. Deterministic CI behavior was preserved by using the simulated triage provider in automated tests.
- **Load testing and autoscaling validation**: helped prepare and refine the k6 load test used to drive the HPA, including routing requests through the local Ingress host. The resulting HPA timelines, VPA recommendations, and before/after scaling behavior were then reviewed manually before being documented.
- **Submission tooling and evidence**: created the read-only `scripts/check_submission.py` checker near the end of the project to catch missing submission files and obvious deployment mistakes without altering the application. It was also used to help review the final documentation and evidence set before submission.

Astra’s changes were not accepted blindly. I reviewed the affected files, ran or inspected the relevant tests and runtime checks, and corrected issues when they appeared. For example, I manually investigated a Ruff import-order failure after introducing `Literal` validation in `backend/app/settings.py`, verified the real HPA/VPA behavior under load, and resolved the deliberate merge conflict by keeping the stricter deterministic provider configuration.

### ChatGPT — technical consultation, troubleshooting, and submission review

ChatGPT was used mainly as a consultation and review tool rather than as the primary coding agent. It was used to interpret detailed assignment requirements, check whether implemented behavior matched the rubric, troubleshoot infrastructure and CI failures, plan the required evidence, and review the final submission sequence.

Specific uses included:

- reviewing Docker, Kubernetes, HPA/VPA, CI/CD, and collaboration requirements against the assignment;
- troubleshooting Docker networking, local Ollama connectivity, Kubernetes persistence, HPA scaling, VPA recommendations, and GitHub Actions failures;
- helping interpret measured results from the k6 and autoscaling experiments instead of assuming expected behavior;
- planning and checking the deliberate merge-conflict demonstration and required screenshots;
- reviewing branch-protection, PR/Issue linkage, substantive review, cache, AI fallback, persistence, and autoscaling evidence;
- helping organize the final submission checklist, including `git shortlog -sn`, the CD run, GHCR SHA-tagged images, the HPA evidence, and `scripts/check_submission.py`.

All repository changes, Git operations, pull requests, evidence captures, and final decisions were performed manually by me after reviewing the outputs and confirming that they matched the actual repository state.
