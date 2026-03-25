from datetime import datetime, timedelta

import pytest


@pytest.fixture()
def plant(client, auth_headers):
    resp = client.post("/plants/", json={"name": "Peace Lily"}, headers=auth_headers)
    return resp.json()


def test_create_schedule(client, auth_headers, plant):
    resp = client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "water", "frequency_days": 7},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["task_type"] == "water"
    assert data["frequency_days"] == 7
    assert data["next_due_at"] is not None


def test_list_schedules(client, auth_headers, plant):
    client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "fertilize", "frequency_days": 30},
        headers=auth_headers,
    )
    resp = client.get(f"/plants/{plant['id']}/schedules/", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_mark_done(client, auth_headers, plant):
    create_resp = client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "water", "frequency_days": 3},
        headers=auth_headers,
    )
    schedule_id = create_resp.json()["id"]
    resp = client.post(
        f"/plants/{plant['id']}/schedules/{schedule_id}/done",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["last_done_at"] is not None


def test_delete_schedule(client, auth_headers, plant):
    create_resp = client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "mist", "frequency_days": 1},
        headers=auth_headers,
    )
    schedule_id = create_resp.json()["id"]
    resp = client.delete(
        f"/plants/{plant['id']}/schedules/{schedule_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204


def test_due_schedules(client, auth_headers, plant):
    past = (datetime.utcnow() - timedelta(days=10)).isoformat()
    client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "water", "frequency_days": 7, "last_done_at": past},
        headers=auth_headers,
    )
    resp = client.get("/schedules/due", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_schedule_summary(client, auth_headers, plant):
    client.post(
        f"/plants/{plant['id']}/schedules/",
        json={"task_type": "water", "frequency_days": 7},
        headers=auth_headers,
    )
    resp = client.get("/schedules/summary", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_schedule_not_found(client, auth_headers, plant):
    resp = client.delete(f"/plants/{plant['id']}/schedules/9999", headers=auth_headers)
    assert resp.status_code == 404
