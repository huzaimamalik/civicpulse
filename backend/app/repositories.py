from datetime import datetime, timezone
from threading import RLock
from typing import Protocol
from uuid import UUID

from .models import Category, Complaint, Priority, Status


class ComplaintRepositoryProtocol(Protocol):
    def healthcheck(self) -> bool: ...

    def create(self, complaint: Complaint) -> Complaint: ...

    def get(self, complaint_id: UUID) -> Complaint | None: ...

    def list(
        self,
        category: Category | None,
        priority: Priority | None,
        status: Status | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Complaint], int]: ...

    def update_status(self, complaint_id: UUID, status: Status) -> Complaint | None: ...

    def stats(self) -> dict[str, dict[str, int]]: ...


class ComplaintRepository:
    """Persistence boundary; replace the storage implementation without changing routes."""

    def __init__(self) -> None:
        self._items: dict[UUID, Complaint] = {}
        self._lock = RLock()

    def healthcheck(self) -> bool:
        return True

    def create(self, complaint: Complaint) -> Complaint:
        with self._lock:
            self._items[complaint.id] = complaint
        return complaint

    def get(self, complaint_id: UUID) -> Complaint | None:
        return self._items.get(complaint_id)

    def list(
        self,
        category: Category | None,
        priority: Priority | None,
        status: Status | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Complaint], int]:
        with self._lock:
            items = list(self._items.values())
        filtered = [
            item for item in items
            if (category is None or item.category == category)
            and (priority is None or item.priority == priority)
            and (status is None or item.status == status)
        ]
        filtered.sort(key=lambda item: item.created_at, reverse=True)
        start = (page - 1) * page_size
        return filtered[start : start + page_size], len(filtered)

    def update_status(self, complaint_id: UUID, status: Status) -> Complaint | None:
        with self._lock:
            item = self._items.get(complaint_id)
            if item is None:
                return None
            updated = item.model_copy(update={"status": status, "updated_at": datetime.now(timezone.utc)})
            self._items[complaint_id] = updated
            return updated

    def stats(self) -> dict[str, dict[str, int]]:
        with self._lock:
            items = list(self._items.values())
        by_category = {category.value: 0 for category in Category}
        by_priority = {priority.value: 0 for priority in Priority}
        for item in items:
            by_category[item.category.value] += 1
            by_priority[item.priority.value] += 1
        return {"byCategory": by_category, "byPriority": by_priority}
