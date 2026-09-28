from .base import TriageProvider
from .llm import LLMTriage
from .rules import RuleBasedTriage
from .simulated import SimulatedTriage

SUPPORTED_PROVIDERS = {"llm", "rules", "simulated"}


def create_provider(
    provider_name: str,
    *,
    groq_api_key: str | None = None,
    groq_model: str = "whisper-large-v3",
) -> TriageProvider:
    if provider_name == "llm":
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY is required when TRIAGE_PROVIDER=llm")
        return LLMTriage(api_key=groq_api_key, model=groq_model)
    if provider_name == "rules":
        return RuleBasedTriage()
    if provider_name == "simulated":
        return SimulatedTriage()
    raise ValueError(
        f"Unsupported TRIAGE_PROVIDER={provider_name!r}; choose llm, rules, or simulated"
    )
