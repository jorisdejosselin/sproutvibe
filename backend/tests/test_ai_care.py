import json

import httpx
import pytest

from ai.care import (
    AnthropicCareProvider,
    CareAdvisor,
    CareRecommendation,
    PlantIdentity,
)
from core.crypto import encrypt_value
from models.setting import Setting


class FakeProvider:
    default_model = "test-model"

    def __init__(self):
        self.calls = []

    async def recommend(self, plant, **kwargs):
        self.calls.append((plant, kwargs))
        return CareRecommendation(tasks=[], care_summary="Healthy")


@pytest.mark.asyncio
async def test_advisor_uses_anthropic_setting(db, test_user):
    provider = FakeProvider()
    db.add(
        Setting(
            user_id=test_user.id,
            key="anthropic_api_key",
            value=encrypt_value("secret"),
        )
    )
    db.commit()

    result = await CareAdvisor(db, provider).recommend(
        PlantIdentity(common_name="Fern"), user_id=test_user.id
    )

    assert result.care_summary == "Healthy"
    assert provider.calls[0][1]["api_key"] == "secret"


@pytest.mark.asyncio
async def test_anthropic_provider_preserves_messages_contract():
    request_body = {}

    async def handle(request):
        request_body.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "content": [
                    {
                        "text": json.dumps(
                            {"care_summary": "Bright light.", "tasks": []}
                        )
                    }
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        result = await AnthropicCareProvider(client).recommend(
            PlantIdentity(common_name="Cactus"),
            api_key="secret",
            model="claude-test",
            safety_identifier="unused",
        )

    assert result.care_summary == "Bright light."
    assert request_body["model"] == "claude-test"
    assert request_body["messages"][0]["role"] == "user"


def test_ai_care_requires_configuration(client, auth_headers):
    response = client.post(
        "/plants/species/ai-care",
        json={"common_name": "Fern"},
        headers=auth_headers,
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Add an Anthropic API key in Settings."
