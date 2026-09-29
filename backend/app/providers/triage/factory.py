from .base import TriageProvider
from .llm import LLMTriage
from .ollama import OllamaTriage
from .rules import RuleBasedTriage
from .simulated import SimulatedTriage

SUPPORTED_PROVIDERS = {"llm", "ollama", "rules", "simulated"}


def create_provider(
    provider_name: str,
    *,
    groq_api_key: str | None = None,
    groq_model: str = "openai/gpt-oss-20b",
    ollama_base_url: str = "http://ollama:11434",
    ollama_model: str = "llama3.2:1b",
) -> TriageProvider:
    if provider_name == "llm":
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY is required when TRIAGE_PROVIDER=llm")
        return LLMTriage(api_key=groq_api_key, model=groq_model)
    if provider_name == "ollama":
        return OllamaTriage(base_url=ollama_base_url, model=ollama_model)
    if provider_name == "rules":
        return RuleBasedTriage()
    if provider_name == "simulated":
        return SimulatedTriage()
    raise ValueError(
        f"Unsupported TRIAGE_PROVIDER={provider_name!r}; choose llm, ollama, rules, or simulated"
    )
