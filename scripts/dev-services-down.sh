#!/usr/bin/env bash
# Usage: ./scripts/dev-services-down.sh [--wipe]


# This script does the following:-
# - Stop and remove both containers (civicpulse-pg-dev, civicpulse-redis-dev).
# - NOT remove the pgdata volume by default (so data survives a down/up
#   cycle), and preserve Redis AOF data too. The --wipe flag removes both
#   volumes for a full reset.

set -euo pipefail

PG_CONTAINER="civicpulse-pg-dev"
REDIS_CONTAINER="civicpulse-redis-dev"
PG_VOLUME="civicpulse_pgdata_dev"
REDIS_VOLUME="civicpulse_redisdata_dev"
WIPE=false

if [ "${1:-}" = "--wipe" ]; then
  WIPE=true
elif [ "$#" -gt 0 ]; then
  echo "Usage: $0 [--wipe]" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found on PATH." >&2
  exit 1
fi

docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true

if [ "$WIPE" = true ]; then
  docker volume rm "$PG_VOLUME" >/dev/null 2>&1 || true
  docker volume rm "$REDIS_VOLUME" >/dev/null 2>&1 || true
  echo "Development services removed and PostgreSQL and Redis volumes wiped."
else
  echo "Development services removed; PostgreSQL volume preserved."
fi
