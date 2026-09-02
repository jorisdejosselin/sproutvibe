"""Changing your own password while signed in."""

from core.security import create_access_token, hash_password, verify_password
from models.user import User


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_changes_the_password(client, db, test_user):
    token = create_access_token({"sub": str(test_user.id), "tv": 0})
    r = client.post(
        "/auth/me/password",
        json={"current_password": "testpass", "new_password": "a-much-better-one"},
        headers=_auth(token),
    )
    assert r.status_code == 204
    db.refresh(test_user)
    assert verify_password("a-much-better-one", test_user.hashed_password)
    assert not verify_password("testpass", test_user.hashed_password)


def test_rejects_a_wrong_current_password(client, db, test_user):
    token = create_access_token({"sub": str(test_user.id), "tv": 0})
    r = client.post(
        "/auth/me/password",
        json={"current_password": "not-it", "new_password": "a-much-better-one"},
        headers=_auth(token),
    )
    assert r.status_code == 400
    db.refresh(test_user)
    assert verify_password("testpass", test_user.hashed_password)


def test_rejects_a_short_new_password(client, test_user):
    token = create_access_token({"sub": str(test_user.id), "tv": 0})
    r = client.post(
        "/auth/me/password",
        json={"current_password": "testpass", "new_password": "short"},
        headers=_auth(token),
    )
    assert r.status_code == 422


def test_old_tokens_stop_working_after_the_change(client, db, test_user):
    # The point of the feature: tokens live a year, so a password change has to
    # revoke the ones already out there or it revokes nothing.
    token = create_access_token({"sub": str(test_user.id), "tv": 0})
    assert client.get("/auth/me", headers=_auth(token)).status_code == 200

    client.post(
        "/auth/me/password",
        json={"current_password": "testpass", "new_password": "a-much-better-one"},
        headers=_auth(token),
    )
    assert client.get("/auth/me", headers=_auth(token)).status_code == 401


def test_a_fresh_login_works_after_the_change(client, db, test_user):
    token = create_access_token({"sub": str(test_user.id), "tv": 0})
    client.post(
        "/auth/me/password",
        json={"current_password": "testpass", "new_password": "a-much-better-one"},
        headers=_auth(token),
    )
    r = client.post(
        "/auth/token",
        data={"username": test_user.email, "password": "a-much-better-one"},
    )
    assert r.status_code == 200
    new_token = r.json()["access_token"]
    assert client.get("/auth/me", headers=_auth(new_token)).status_code == 200


def test_tokens_without_a_version_claim_still_work(client, test_user):
    # Everyone signed in before this shipped holds such a token; upgrading
    # must not log them all out.
    legacy = create_access_token({"sub": str(test_user.id)})
    assert client.get("/auth/me", headers=_auth(legacy)).status_code == 200


def test_demo_accounts_cannot_change_their_password(client, db):
    demo = User(
        name="Demo",
        email="demo-x@sprout.demo",
        hashed_password=hash_password("whatever123"),
        is_demo=True,
    )
    db.add(demo)
    db.commit()
    token = create_access_token({"sub": str(demo.id), "tv": 0})
    r = client.post(
        "/auth/me/password",
        json={"current_password": "whatever123", "new_password": "a-much-better-one"},
        headers=_auth(token),
    )
    assert r.status_code == 403
