from ...models import Category, Priority, TriageResult


class RuleBasedTriage:
    name = "rules"

    def triage(self, text: str, location: str) -> TriageResult:
        lowered = text.lower()
        category = Category.OTHER
        for keyword, candidate in (
            ("water", Category.WATER),
            ("electric", Category.ELECTRICITY),
            ("sanitation", Category.SANITATION),
            ("road", Category.ROADS),
            ("streetlight", Category.STREETLIGHTS),
        ):
            if keyword in lowered:
                category = candidate
                break
        priority = Priority.HIGH if any(
            word in lowered for word in ("urgent", "danger", "emergency")
        ) else Priority.NORMAL
        return TriageResult(
            category=category,
            priority=priority,
            summary=text.strip()[:140],
            confidence=0.95,
        )
