def test_register(client):
    resp = client.post(
        "/auth/register",
        json={"name": "Alice", "email": "alice@example.com", "password": "secret123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@example.com"
    assert data["name"] == "Alice"
    assert "id" in data


def test_register_duplicate_email(client):
    payload = {"name": "Bob", "email": "bob@example.com", "password": "pass"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_login(client):
    client.post(
        "/auth/register",
        json={"name": "Carol", "email": "carol@example.com", "password": "mypassword"},
    )
    resp = client.post(
        "/auth/token",
        data={"username": "carol@example.com", "password": "mypassword"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client):
    client.post(
        "/auth/register",
        json={"name": "Dave", "email": "dave@example.com", "password": "correct"},
    )
    resp = client.post(
        "/auth/token",
        data={"username": "dave@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_me(client, test_user, auth_headers):
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == test_user.email


def test_me_unauthenticated(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
