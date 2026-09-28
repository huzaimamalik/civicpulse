import pytest

from app.models import Category, Priority, TriageResult
from app.providers.triage import (
    LLMTriage,
    RuleBasedTriage,
    SimulatedTriage,
    TriageProviderError,
    create_provider,
)


class FakeCompletions:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        response = next(self.responses)
        if isinstance(response, BaseException):
            raise response
        return response


class FakeClient:
    def __init__(self, responses):
        self.chat = type("Chat", (), {"completions": FakeCompletions(responses)})()


class FakeMessage:
    def __init__(self, content):
        self.content = content


class FakeChoice:
    def __init__(self, content):
        self.message = FakeMessage(content)


class FakeResponse:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]


def valid_json():
    return '{"category":"water","priority":"normal","summary":"Pipe leak","confidence":0.8}'


def make_provider(responses, sleeper=lambda _: None):
    return LLMTriage(
        api_key="test-key",
        client=FakeClient(responses),
        sleeper=sleeper,
        jitter=lambda _low, _high: 0,
    )


def test_factory_selects_three_supported_providers():
    assert isinstance(create_provider("rules"), RuleBasedTriage)
    assert isinstance(create_provider("simulated"), SimulatedTriage)
    assert isinstance(create_provider("llm", groq_api_key="test-key"), LLMTriage)
    with pytest.raises(ValueError):
        create_provider("ollama")


def test_malformed_json_retries_without_network():
    provider = make_provider([FakeResponse("not json"), FakeResponse(valid_json())])
    result = provider.triage("There is a water leak", "Market")
    assert result.category == Category.WATER


def test_out_of_enum_category_fails_after_retry():
    provider = make_provider([
        FakeResponse('{"category":"traffic","priority":"normal","summary":"x","confidence":0.5}'),
        FakeResponse('{"category":"traffic","priority":"normal","summary":"x","confidence":0.5}'),
    ])
    with pytest.raises(TriageProviderError):
        provider.triage("A complaint with invalid model output", "Market")


def test_overlong_summary_fails_after_retry():
    long_summary = "x" * 141
    output = '{"category":"water","priority":"normal","summary":"' + long_summary + '","confidence":0.5}'
    provider = make_provider([FakeResponse(output), FakeResponse(output)])
    with pytest.raises(TriageProviderError):
        provider.triage("A complaint with a long summary", "Market")


def test_retryable_provider_failure_retries_once():
    provider = make_provider([])
    calls = []

    def request(_text, _location):
        calls.append(1)
        if len(calls) == 1:
            raise TriageProviderError("timeout", retryable=True)
        return TriageResult(category=Category.WATER, priority=Priority.NORMAL, summary="ok", confidence=0.8)

    provider._request_once = request
    assert provider.triage("A retryable failure", "Market").category == Category.WATER
    assert len(calls) == 2


def test_non_retryable_provider_failure_does_not_retry():
    provider = make_provider([])
    calls = []

    def request(_text, _location):
        calls.append(1)
        raise TriageProviderError("bad request", retryable=False)

    provider._request_once = request
    with pytest.raises(TriageProviderError):
        provider.triage("A non-retryable failure", "Market")
    assert len(calls) == 1
