# ADR-0001: Pluggable Triage Provider Interface

## Decision

Use a small `TriageProvider` protocol with a `name` and `triage(text, location)` method returning the validated `TriageResult` model. The factory selects `llm`, `ollama`, `rules`, or `simulated` from `TRIAGE_PROVIDER`.

`LLMTriage` owns Groq/OpenAI-compatible transport, JSON parsing, validation, timeout, and retry policy. `RuleBasedTriage` is the always-available fallback, and `SimulatedTriage` keeps CI deterministic. Callers depend on the protocol rather than a concrete provider, so provider changes do not alter routes or persistence.

## Consequences

Provider failures are converted into a deterministic rules fallback. Tests can inject fake clients and failure modes without network access. `OllamaTriage` reuses `LLMTriage` through a local OpenAI-compatible client, preserving the same validation and retry policy. The service retains ownership of cache, fallback and latency recording.
