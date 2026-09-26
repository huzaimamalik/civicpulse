#!/usr/bin/env bash
# Usage: ./scripts/dev-services-up.sh [POSTGRES_PASSWORD=... POSTGRES_DB=...]


# This script does the following:-
# - Run a postgres:16 container named civicpulse-pg-dev, with POSTGRES_PASSWORD
#   and POSTGRES_DB read from environment variables (with sane dev defaults if
#   unset), port 5432 published, and a named volume civicpulse_pgdata_dev for
#   persistence.
# - Run a redis:7 container named civicpulse-redis-dev, port 6379 published,
#   with AOF persistence backed by the civicpulse_redisdata_dev named volume.
# - Be idempotent: if the containers already exist, start them instead of
#   failing; don't error out on repeated runs.
# - Print the DATABASE_URL and REDIS_URL values to use in .env once both
#   containers are healthy.

set -euo pipefail

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-civicpulse_dev}"
POSTGRES_DB="${POSTGRES_DB:-civicpulse}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
PG_CONTAINER="civicpulse-pg-dev"
REDIS_CONTAINER="civicpulse-redis-dev"
PG_VOLUME="civicpulse_pgdata_dev"
REDIS_VOLUME="civicpulse_redisdata_dev"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found on PATH." >&2
  exit 1
fi

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

ensure_postgres() {
  if container_exists "$PG_CONTAINER"; then
    docker start "$PG_CONTAINER" >/dev/null
  else
    docker run -d \
      --name "$PG_CONTAINER" \
      -e "POSTGRES_USER=$POSTGRES_USER" \
      -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
      -e "POSTGRES_DB=$POSTGRES_DB" \
      -p 5432:5432 \
      -v "$PG_VOLUME:/var/lib/postgresql/data" \
      postgres:16 >/dev/null
  fi
}

ensure_redis() {
  if container_exists "$REDIS_CONTAINER"; then
    docker start "$REDIS_CONTAINER" >/dev/null
  else
    docker run -d \
      --name "$REDIS_CONTAINER" \
      -p 6379:6379 \
      -v "$REDIS_VOLUME:/data" \
      redis:7 redis-server --appendonly yes >/dev/null
  fi
}

wait_for_postgres() {
  for attempt in $(seq 1 60); do
    if docker exec "$PG_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
done
  echo "PostgreSQL did not become ready in 60 seconds." >&2
  return 1
}

wait_for_redis() {
  for attempt in $(seq 1 60); do
    if [ "$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null || true)" = "PONG" ]; then
      return 0
    fi
    sleep 1
done
  echo "Redis did not become ready in 60 seconds." >&2
  return 1
}

ensure_postgres
ensure_redis
wait_for_postgres
wait_for_redis

cat <<EOF
Local development services are healthy.

DATABASE_URL=postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}
REDIS_URL=redis://localhost:6379/0
EOF
