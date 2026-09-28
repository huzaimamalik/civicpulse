from .rules import RuleBasedTriage


class SimulatedTriage(RuleBasedTriage):
    """Deterministic CI provider; output is recorded as rules-compatible data."""

    name = "rules"
