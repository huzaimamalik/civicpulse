import json
from time import monotonic
from typing import Any


class Cache:
    def __init__(self, redis_url: str | None = None) -> None:
        self._values: dict[str, tuple[float, str]] = {}
        self._redis = None
        if redis_url:
            try:
                import redis

                self._redis = redis.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    def healthcheck(self) -> bool:
        if self._redis is None:
            return True
        try:
            return bool(self._redis.ping())
        except Exception:
            return False

    def get_json(self, key: str) -> Any | None:
        if self._redis is not None:
            value = self._redis.get(key)
            return json.loads(value) if value else None
        cached = self._values.get(key)
        if cached is None or cached[0] <= monotonic():
            self._values.pop(key, None)
            return None
        return json.loads(cached[1])

    def set_json(self, key: str, value: Any, ttl: int) -> None:
        if self._redis is not None:
            self._redis.setex(key, ttl, json.dumps(value))
        else:
            self._values[key] = (monotonic() + ttl, json.dumps(value))

    def delete(self, key: str) -> None:
        if self._redis is not None:
            self._redis.delete(key)
        else:
            self._values.pop(key, None)
