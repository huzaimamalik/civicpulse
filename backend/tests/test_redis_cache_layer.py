import os

import pytest
from fastapi.testclient import TestClient
from redis import Redis

from app.main import app
from app.settings import get_settings

pytestmark = pytest.mark.integration


def _run_real_redis_tests() -> bool:
    return os.getenv("RUN_REAL_REDIS_TESTS") == "1"


@pytest.fixture()
def real_client(monkeypatch):
    if not _run_real_redis_tests():
        pytest.skip("set RUN_REAL_REDIS_TESTS=1 to run against the real Redis container")
    monkeypatch.setenv("TESTING", "false")
    get_settings.cache_clear()
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    redis.delete("civicpulse:stats")
    for key in redis.scan_iter("civicpulse:rate:*"):
        redis.delete(key)
    for key in redis.scan_iter("civicpulse:triage:*"):
        redis.delete(key)
    with TestClient(app) as client:
        yield client, redis
    redis.delete("civicpulse:stats")
    for key in redis.scan_iter("civicpulse:rate:*"):
        redis.delete(key)
    for key in redis.scan_iter("civicpulse:triage:*"):
        redis.delete(key)
    get_settings.cache_clear()


def payload(text="There is a water leak near the market"):
    return {"text": text, "location": "Central market", "reporter_contact": None}


def test_stats_cache_miss_hit_and_write_invalidation_against_real_redis(real_client):
    client, redis = real_client
    first = client.get("/api/stats")
    assert first.status_code == 200
    assert first.headers["X-Cache"] == "MISS"
    assert redis.ttl("civicpulse:stats") > 0

    second = client.get("/api/stats")
    assert second.headers["X-Cache"] == "HIT"

    created = client.post("/api/complaints", json=payload("A new water complaint should invalidate statistics"))
    assert created.status_code == 201
    assert redis.exists("civicpulse:stats") == 0

    after_write = client.get("/api/stats")
    assert after_write.headers["X-Cache"] == "MISS"
    assert after_write.json()["byCategory"]["water"] >= 1


def test_rate_limiter_uses_real_redis_and_returns_retry_after(real_client):
    client, redis = real_client
    app.state.rate_limiter.limit = 2

    for index in range(2):
        response = client.post("/api/complaints", json=payload(f"Rate limit complaint number {index} is valid"))
        assert response.status_code == 201

    limited = client.post("/api/complaints", json=payload("This request should exceed the Redis limit"))
    assert limited.status_code == 429
    assert limited.headers["Retry-After"].isdigit()
    assert any(redis.scan_iter("civicpulse:rate:*") )


def test_content_hash_cache_reuses_real_redis_result(real_client):
    client, redis = real_client
    text = "The same water complaint is reported twice for cache verification"
    first = client.post("/api/complaints", json=payload(text))
    second = client.post("/api/complaints", json=payload(text))
    assert first.status_code == 201
    assert second.status_code == 201
    assert len(list(redis.scan_iter("civicpulse:triage:*"))) == 1
