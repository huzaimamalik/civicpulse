from typing import Literal

from ...models import TriageResult
from .base import TriageProviderError
from .rules import RuleBasedTriage


class SimulatedTriage(RuleBasedTriage):
    """Deterministic CI provider; output is recorded as rules-compatible data."""

    name = "rules"

    def __init__(self, *, failure: Literal["timeout", "malformed"] | None = None) -> None:
        self.failure = failure

    def triage(self, text: str, location: str) -> TriageResult:
        if self.failure == "timeout":
            raise TriageProviderError("Simulated timeout", retryable=True)
        if self.failure == "malformed":
            return TriageResult.model_validate_json("not json")
        return super().triage(text, location)
