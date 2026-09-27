"""Exercise a fresh CivicPulse deployment through its public HTTP entry point."""

import json
import os
from urllib.request import Request, urlopen

base_url = os.environ["SMOKE_URL"].rstrip("/")
host = os.environ.get("SMOKE_HOST")


def request(path, payload=None):
    headers = {"Host": host} if host else {}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    with urlopen(Request(base_url + path, data=data, headers=headers), timeout=15) as response:
        return response.status, response.headers, json.load(response)


payload = {
    "text": "Urgent water leak near the university gate",
    "location": "University gate",
    "reporter_contact": None,
}
status, _, created = request("/api/complaints", payload)
assert status == 201, f"Expected creation status 201, got {status}"
assert created["id"], "Missing complaint ID"
for field, value in payload.items():
    assert created[field] == value, f"Incorrect {field}"
assert created["category"] == "water"
assert created["priority"] == "high"
assert created["status"] == "open"
assert created["triaged_by"] == "rules"
assert created["ai_summary"] == payload["text"]

status, _, fetched = request(f"/api/complaints/{created['id']}")
assert status == 200
assert fetched == created, "Fetched complaint differs from the saved complaint"

status, headers, first = request("/api/stats")
assert status == 200 and headers["X-Cache"] == "MISS"
assert first["byCategory"]["water"] == 1
assert first["byPriority"]["high"] == 1
status, headers, second = request("/api/stats")
assert status == 200 and headers["X-Cache"] == "HIT"
assert second == first
print("Complaint persisted, simulated triage correct, stats cache MISS -> HIT")
