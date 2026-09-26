import json
from time import time
from time import monotonic
from typing import Any


class Cache:
    def __init__(self, redis_url: str | None = None, allow_in_memory: bool = False) -> None:
        self._values: dict[str, tuple[float, str]] = {}
        self._redis = None
        if redis_url:
            try:
                import redis

                self._redis = redis.from_url(redis_url, decode_responses=True)
                if not allow_in_memory:
                    self._redis.ping()
            except Exception as error:
                self._redis = None
                if not allow_in_memory:
                    raise RuntimeError("REDIS_URL is configured but Redis is unavailable") from error
        elif not allow_in_memory:
            raise RuntimeError("REDIS_URL must be configured outside test mode")

    @property
    def redis_client(self):
        if self._redis is None:
            raise RuntimeError("Redis client is unavailable")
        return self._redis

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


class RedisRateLimiter:
    def __init__(self, redis_client, limit: int, window_seconds: int = 60) -> None:
        self.redis = redis_client
        self.limit = limit
        self.window_seconds = window_seconds

    def _key(self, client_ip: str) -> str:
        window = int(time() // self.window_seconds)
        return f"civicpulse:rate:{client_ip}:{window}"

    def allow(self, client_ip: str) -> bool:
        key = self._key(client_ip)
        count = self.redis.incr(key)
        if count == 1:
            self.redis.expire(key, self.window_seconds)
        return count <= self.limit

    def retry_after(self) -> int:
        return self.window_seconds - (int(time()) % self.window_seconds)
