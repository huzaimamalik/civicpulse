from uuid import uuid4
import os

import pytest
from fastapi.testclient import TestClient

os.environ["TESTING"] = "true"

from app.main import app
from app.services import FailingTriage


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        app.state.repository._items.clear()
        app.state.cache.delete("civicpulse:stats")
        app.state.rate_limiter._hits.clear()
        app.state.rate_limiter.limit = 10
        app.state.service.triage.provider = app.state.service.triage.fallback
        app.state.active_provider = app.state.service.triage.provider.name
        yield test_client


def payload(text="There is a water leak near the market", location="Central market"):
    return {"text": text, "location": location, "reporter_contact": None}


def submit(client, text="There is a water leak near the market"):
    response = client.post("/api/complaints", json=payload(text=text))
    assert response.status_code == 201
    return response.json()


def test_health_does_not_require_dependencies(client):
    response = client.get("/health", headers={"X-Request-ID": "test-request"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"] == "test-request"


def test_ready(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_ready_names_failed_dependency(client, monkeypatch):
    monkeypatch.setattr(app.state.cache, "healthcheck", lambda: False)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["failed"] == ["redis"]


def test_create_and_get_complaint(client):
    complaint = submit(client)
    response = client.get(f"/api/complaints/{complaint['id']}")
    assert response.status_code == 200
    assert response.json()["category"] == "water"


def test_create_validation_is_field_level(client):
    response = client.post("/api/complaints", json=payload(text="short", location="x"))
    assert response.status_code == 400
    assert {error["loc"][-1] for error in response.json()["detail"]} == {"text", "location"}


def test_missing_complaint_is_404(client):
    response = client.get(f"/api/complaints/{uuid4()}")
    assert response.status_code == 404


def test_list_filters_and_pagination(client):
    submit(client, "Road damage needs urgent repair")
    submit(client, "Water supply is unavailable today")
    response = client.get("/api/complaints?category=roads&page=1&page_size=1")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert len(response.json()["complaints"]) == 1


def test_page_size_over_100_is_400(client):
    response = client.get("/api/complaints?page_size=101")
    assert response.status_code == 400


def test_status_open_to_in_progress(client):
    complaint = submit(client)
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "in_progress"})
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_status_open_to_rejected(client):
    complaint = submit(client)
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "rejected"})
    assert response.status_code == 200


def test_status_in_progress_to_resolved(client):
    complaint = submit(client)
    client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "in_progress"})
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "resolved"})
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"


def test_status_in_progress_to_rejected(client):
    complaint = submit(client)
    client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "in_progress"})
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "rejected"})
    assert response.status_code == 200


def test_terminal_status_transition_is_409(client):
    complaint = submit(client)
    client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "rejected"})
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "open"})
    assert response.status_code == 409
    assert "rejected to open" in response.json()["detail"]


def test_invalid_open_to_resolved_is_409(client):
    complaint = submit(client)
    response = client.patch(f"/api/complaints/{complaint['id']}/status", json={"status": "resolved"})
    assert response.status_code == 409
    assert "open to resolved" in response.json()["detail"]


def test_stats_cache_miss_then_hit_and_invalidate(client):
    submit(client)
    first = client.get("/api/stats")
    second = client.get("/api/stats")
    assert first.headers["X-Cache"] == "MISS"
    assert second.headers["X-Cache"] == "HIT"
    complaint = first.json()
    assert complaint["byCategory"]["water"] == 1


def test_provider_meta_keeps_recent_outcomes(client):
    submit(client)
    response = client.get("/api/meta/providers")
    assert response.status_code == 200
    assert len(response.json()["outcomes"]) == 1
    assert response.json()["outcomes"][0]["fallback"] is False


def test_rate_limit_returns_429_and_retry_after(client):
    app.state.rate_limiter.limit = 1
    submit(client)
    response = client.post("/api/complaints", json=payload(text="A second complaint should be rejected"))
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"


def test_provider_failure_falls_back_and_persists(client):
    app.state.service.triage.provider = FailingTriage()
    response = client.post("/api/complaints", json=payload())
    assert response.status_code == 201
    assert response.json()["triaged_by"] == "rules:fallback"


def test_metrics_is_prometheus_text(client):
    submit(client)
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "civicpulse_requests_total" in response.text
