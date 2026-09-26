# civicpulse
CivicPulse - CS4032 Software Construction and Development Assignment 01

## Quickstart

Start the local PostgreSQL and Redis dependencies with `./scripts/dev-services-up.sh`; it is safe to run repeatedly and prints the `DATABASE_URL` and `REDIS_URL` values for your `.env` file. Then, from `backend/`, run `uv run --with-requirements requirements.txt alembic upgrade head` followed by `uv run --with-requirements requirements.txt python scripts/seed.py`. Stop the services with `./scripts/dev-services-down.sh` (use `--wipe` only when you also want to delete the PostgreSQL development volume).
