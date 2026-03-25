import pytest


@pytest.fixture()
def plant(client, auth_headers):
    resp = client.post("/plants/", json={"name": "Basil"}, headers=auth_headers)
    return resp.json()


def test_list_entries_empty(client, auth_headers, plant):
    resp = client.get(f"/plants/{plant['id']}/journal/", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_entry(client, auth_headers, plant):
    resp = client.post(
        f"/plants/{plant['id']}/journal/",
        json={"title": "First entry", "body": "Looking healthy"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "First entry"
    assert data["plant_id"] == plant["id"]


def test_get_entry(client, auth_headers, plant):
    create_resp = client.post(
        f"/plants/{plant['id']}/journal/",
        json={"title": "Note"},
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]
    resp = client.get(f"/plants/{plant['id']}/journal/{entry_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Note"


def test_update_entry(client, auth_headers, plant):
    create_resp = client.post(
        f"/plants/{plant['id']}/journal/",
        json={"title": "Old title"},
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]
    resp = client.patch(
        f"/plants/{plant['id']}/journal/{entry_id}",
        json={"title": "New title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New title"


def test_delete_entry(client, auth_headers, plant):
    create_resp = client.post(
        f"/plants/{plant['id']}/journal/",
        json={"title": "To delete"},
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]
    resp = client.delete(
        f"/plants/{plant['id']}/journal/{entry_id}", headers=auth_headers
    )
    assert resp.status_code == 204
    get_resp = client.get(
        f"/plants/{plant['id']}/journal/{entry_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404


def test_entry_on_missing_plant(client, auth_headers):
    resp = client.get("/plants/9999/journal/", headers=auth_headers)
    assert resp.status_code == 404
