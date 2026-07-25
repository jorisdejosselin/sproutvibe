import json
import os
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from core.crypto import decrypt_value
from models.setting import Setting


class PlantIdentity(BaseModel):
    common_name: str
    scientific_name: str | None = None


class CareTask(BaseModel):
    task_type: Literal["water", "fertilize", "mist", "repot"]
    frequency_days: int
    notes: str | None = None


class CareRecommendation(BaseModel):
    tasks: list[CareTask]
    care_summary: str | None = None


class ProviderNotConfigured(Exception):
    pass


class CareProviderError(Exception):
    pass


class CareProvider(Protocol):
    default_model: str

    async def recommend(
        self,
        plant: PlantIdentity,
        *,
        api_key: str,
        model: str,
        safety_identifier: str,
    ) -> CareRecommendation: ...


def _prompt(plant: PlantIdentity) -> str:
    label = (
        f"{plant.common_name} ({plant.scientific_name})"
        if plant.scientific_name
        else plant.common_name
    )
    return f"""You are a plant care expert. For the plant "{label}", return a JSON object with care schedule recommendations for a typical home grower.

Return ONLY valid JSON in exactly this structure (no extra text):
{{
  "care_summary": "One or two sentences on how to keep this plant happy.",
  "tasks": [
    {{"task_type": "water", "frequency_days": 7, "notes": "brief tip"}},
    {{"task_type": "fertilize", "frequency_days": 30, "notes": "brief tip"}}
  ]
}}

task_type must be one of: water, fertilize, mist, repot.
Include only relevant tasks. frequency_days must be an integer."""


def _parse_recommendation(content: str) -> CareRecommendation:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```", 2)[1]
        if content.startswith("json"):
            content = content[4:]
    try:
        return CareRecommendation.model_validate_json(content)
    except (ValidationError, ValueError) as exc:
        raise CareProviderError("AI provider returned an invalid care response.") from exc


class AnthropicCareProvider:
    default_model = "claude-haiku-4-5-20251001"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client

    async def recommend(
        self,
        plant: PlantIdentity,
        *,
        api_key: str,
        model: str,
        safety_identifier: str,
    ) -> CareRecommendation:
        try:
            response = await self._post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 512,
                    "messages": [{"role": "user", "content": _prompt(plant)}],
                },
            )
        except httpx.HTTPError as exc:
            raise CareProviderError("AI provider request failed.") from exc
        if not response.is_success:
            raise CareProviderError("AI provider request failed.")
        try:
            content = response.json()["content"][0]["text"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise CareProviderError(
                "AI provider returned an invalid care response."
            ) from exc
        return _parse_recommendation(content)

    async def _post(self, *args, **kwargs) -> httpx.Response:
        if self._client:
            return await self._client.post(*args, **kwargs)
        async with httpx.AsyncClient(timeout=20) as client:
            return await client.post(*args, **kwargs)


class CareAdvisor:
    def __init__(
        self,
        db: Session,
        provider: CareProvider | None = None,
    ):
        self._db = db
        self._provider = provider or AnthropicCareProvider()

    async def recommend(
        self,
        plant: PlantIdentity,
        *,
        user_id: int,
        allow_env_fallback: bool = True,
    ) -> CareRecommendation:
        api_key = self._setting(user_id, "anthropic_api_key")
        if not api_key and allow_env_fallback:
            api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ProviderNotConfigured(
                "Add an Anthropic API key in Settings."
            )
        return await self._provider.recommend(
            plant,
            api_key=api_key,
            model=os.getenv("ANTHROPIC_MODEL", self._provider.default_model),
            safety_identifier="",
        )

    def _setting(self, user_id: int, key: str) -> str | None:
        row = (
            self._db.query(Setting)
            .filter(Setting.user_id == user_id, Setting.key == key)
            .first()
        )
        return decrypt_value(row.value) if row and row.value else None
