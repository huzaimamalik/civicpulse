import random
import time
from collections.abc import Callable
from typing import Any

from openai import OpenAI

from .llm import LLMTriage


class OllamaTriage(LLMTriage):
    """Reuse the validated LLM pipeline through Ollama's compatible endpoint."""

    name = "llm:ollama"

    def __init__(
        self,
        *,
        base_url: str = "http://ollama:11434",
        model: str = "llama3.2:1b",
        client: Any | None = None,
        sleeper: Callable[[float], None] = time.sleep,
        jitter: Callable[[float, float], float] = random.uniform,
    ) -> None:
        super().__init__(
            api_key="ollama",  # The SDK requires a value; local Ollama ignores it.
            model=model,
            client=client or OpenAI(
                api_key="ollama",
                base_url=f"{base_url.rstrip('/')}/v1",
                max_retries=0,
            ),
            sleeper=sleeper,
            jitter=jitter,
        )
