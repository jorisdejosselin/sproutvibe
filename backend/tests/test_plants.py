from core.security import create_access_token, hash_password


def test_list_plants_empty(client, auth_headers):
    resp = client.get("/plants/", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_plant(client, auth_headers):
    resp = client.post("/plants/", json={"name": "Monstera"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Monstera"
    assert "id" in data


def test_create_and_get_plant(client, auth_headers):
    create_resp = client.post(
        "/plants/", json={"name": "Fern", "location": "Bedroom"}, headers=auth_headers
    )
    plant_id = create_resp.json()["id"]
    resp = client.get(f"/plants/{plant_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Fern"


def test_update_plant(client, auth_headers):
    create_resp = client.post("/plants/", json={"name": "Cactus"}, headers=auth_headers)
    plant_id = create_resp.json()["id"]
    resp = client.patch(
        f"/plants/{plant_id}", json={"name": "Big Cactus"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Big Cactus"


def test_delete_plant(client, auth_headers):
    create_resp = client.post("/plants/", json={"name": "Orchid"}, headers=auth_headers)
    plant_id = create_resp.json()["id"]
    resp = client.delete(f"/plants/{plant_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = client.get(f"/plants/{plant_id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_plant_not_found(client, auth_headers):
    resp = client.get("/plants/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_plant_isolation(client, db, auth_headers):
    from models.user import User

    other_user = User(
        name="Other",
        email="other@example.com",
        hashed_password=hash_password("pass"),
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_token = create_access_token({"sub": str(other_user.id)})
    other_headers = {"Authorization": f"Bearer {other_token}"}

    client.post("/plants/", json={"name": "My Plant"}, headers=auth_headers)
    resp = client.get("/plants/", headers=other_headers)
    assert resp.json() == []
