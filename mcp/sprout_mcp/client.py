"""SproutClient: authenticated HTTP client for the Sprout plant care API."""

import os
from typing import Any

import httpx


class SproutConfigError(Exception):
    """Raised when required environment variables are missing."""


class SproutAPIError(Exception):
    """Raised when the Sprout API returns a non-2xx response."""

    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail
        super().__init__(f"Error {status}: {detail}")


class SproutClient:
    def __init__(self) -> None:
        url = os.environ.get("SPROUT_URL", "").rstrip("/")
        email = os.environ.get("SPROUT_EMAIL", "")
        password = os.environ.get("SPROUT_PASSWORD", "")

        missing = [k for k, v in [("SPROUT_URL", url), ("SPROUT_EMAIL", email), ("SPROUT_PASSWORD", password)] if not v]
        if missing:
            raise SproutConfigError(f"Missing required environment variables: {', '.join(missing)}")

        self._base_url = url
        self._email = email
        self._password = password
        self._token: str | None = None
        self._http = httpx.AsyncClient(base_url=url, timeout=30.0)

    async def _fetch_token(self) -> str:
        response = await self._http.post(
            "/auth/token",
            data={"username": self._email, "password": self._password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            raise SproutAPIError(
                response.status_code,
                "Authentication failed — check SPROUT_EMAIL and SPROUT_PASSWORD.",
            )
        return response.json()["access_token"]

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: dict | None = None,
        _retry: bool = True,
    ) -> Any:
        if self._token is None:
            self._token = await self._fetch_token()

        response = await self._http.request(
            method,
            path,
            json=json,
            params=params,
            headers={"Authorization": f"Bearer {self._token}"},
        )

        if response.status_code == 401 and _retry:
            self._token = None
            return await self._request(method, path, json=json, params=params, _retry=False)

        if response.status_code >= 400:
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text
            if response.status_code == 401:
                detail = "Authentication failed — check SPROUT_EMAIL and SPROUT_PASSWORD."
            raise SproutAPIError(response.status_code, str(detail))

        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    # --- Plants ---

    async def list_plants(self) -> list[dict]:
        return await self._request("GET", "/plants/")

    async def get_plant(self, plant_id: int) -> dict:
        return await self._request("GET", f"/plants/{plant_id}")

    async def create_plant(
        self,
        name: str,
        species: str | None = None,
        location: str | None = None,
        notes: str | None = None,
    ) -> dict:
        body: dict[str, Any] = {"name": name}
        if species is not None:
            body["species"] = species
        if location is not None:
            body["location"] = location
        if notes is not None:
            body["notes"] = notes
        return await self._request("POST", "/plants/", json=body)

    async def update_plant(
        self,
        plant_id: int,
        name: str | None = None,
        species: str | None = None,
        location: str | None = None,
        notes: str | None = None,
    ) -> dict:
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if species is not None:
            body["species"] = species
        if location is not None:
            body["location"] = location
        if notes is not None:
            body["notes"] = notes
        return await self._request("PATCH", f"/plants/{plant_id}", json=body)

    async def delete_plant(self, plant_id: int) -> None:
        await self._request("DELETE", f"/plants/{plant_id}")

    # --- Schedules ---

    async def list_schedules(self, plant_id: int) -> list[dict]:
        return await self._request("GET", f"/plants/{plant_id}/schedules/")

    async def create_schedule(
        self,
        plant_id: int,
        task_type: str,
        frequency_days: int,
    ) -> dict:
        return await self._request(
            "POST",
            f"/plants/{plant_id}/schedules/",
            json={"task_type": task_type, "frequency_days": frequency_days},
        )

    async def delete_schedule(self, plant_id: int, schedule_id: int) -> None:
        await self._request("DELETE", f"/plants/{plant_id}/schedules/{schedule_id}")

    async def mark_schedule_done(self, plant_id: int, schedule_id: int) -> dict:
        return await self._request("POST", f"/plants/{plant_id}/schedules/{schedule_id}/done")

    async def get_schedules_summary(self) -> list[dict]:
        return await self._request("GET", "/schedules/summary")

    async def get_due_tasks(self) -> list[dict]:
        return await self._request("GET", "/schedules/due")

    # --- Journal ---

    async def list_journal(self, plant_id: int, limit: int | None = None) -> list[dict]:
        params = {}
        if limit is not None:
            params["limit"] = limit
        return await self._request("GET", f"/plants/{plant_id}/journal/", params=params or None)

    async def create_journal_entry(
        self,
        plant_id: int,
        body: str,
        title: str | None = None,
        health: str | None = None,
        entry_date: str | None = None,
    ) -> dict:
        payload: dict[str, Any] = {"body": body}
        if title is not None:
            payload["title"] = title
        if health is not None:
            payload["health"] = health
        if entry_date is not None:
            payload["entry_date"] = entry_date
        return await self._request("POST", f"/plants/{plant_id}/journal/", json=payload)

    # --- Species / AI ---

    async def search_species(self, query: str) -> list[dict]:
        return await self._request("GET", "/plants/species/search", params={"q": query})

    async def get_ai_care(self, common_name: str, scientific_name: str | None = None) -> dict:
        body: dict[str, Any] = {"common_name": common_name}
        if scientific_name is not None:
            body["scientific_name"] = scientific_name
        return await self._request("POST", "/plants/species/ai-care", json=body)

    async def close(self) -> None:
        await self._http.aclose()
