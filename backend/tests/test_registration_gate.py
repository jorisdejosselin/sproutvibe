"""Signup gating.

sprout.joict.nl was exposed publicly with open registration, so anyone on the
internet could create an account. These cover the three states an operator can
put an instance in.
"""

import pytest


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    monkeypatch.delenv("ALLOW_REGISTRATION", raising=False)
    monkeypatch.delenv("REGISTRATION_INVITE_CODE", raising=False)


def _payload(email="new@example.com"):
    return {"name": "New", "email": email, "password": "hunter2hunter2"}


def test_open_by_default(client):
    # Existing self-hosted instances must not break on upgrade.
    assert client.post("/auth/register", json=_payload()).status_code == 201


def test_disabled_rejects_signup(client, monkeypatch):
    monkeypatch.setenv("ALLOW_REGISTRATION", "false")
    r = client.post("/auth/register", json=_payload())
    assert r.status_code == 403
    assert "disabled" in r.json()["detail"].lower()


def test_disabled_does_not_leak_whether_an_email_exists(client, monkeypatch):
    # Same response for a taken address as for a free one, so a closed
    # instance cannot be probed for registered users.
    client.post("/auth/register", json=_payload("taken@example.com"))
    monkeypatch.setenv("ALLOW_REGISTRATION", "false")
    taken = client.post("/auth/register", json=_payload("taken@example.com"))
    free = client.post("/auth/register", json=_payload("free@example.com"))
    assert taken.status_code == free.status_code == 403
    assert taken.json() == free.json()


def test_invite_code_required_when_set(client, monkeypatch):
    monkeypatch.setenv("REGISTRATION_INVITE_CODE", "let-me-in")
    assert client.post("/auth/register", json=_payload()).status_code == 403
    assert (
        client.post(
            "/auth/register", json={**_payload(), "invite_code": "wrong"}
        ).status_code
        == 403
    )


def test_correct_invite_code_is_accepted(client, monkeypatch):
    monkeypatch.setenv("REGISTRATION_INVITE_CODE", "let-me-in")
    r = client.post("/auth/register", json={**_payload(), "invite_code": "let-me-in"})
    assert r.status_code == 201


def test_disabled_beats_invite_code(client, monkeypatch):
    monkeypatch.setenv("ALLOW_REGISTRATION", "false")
    monkeypatch.setenv("REGISTRATION_INVITE_CODE", "let-me-in")
    r = client.post("/auth/register", json={**_payload(), "invite_code": "let-me-in"})
    assert r.status_code == 403


def test_status_endpoint_reports_the_mode(client, monkeypatch):
    assert client.get("/auth/registration").json() == {
        "allowed": True,
        "invite_required": False,
    }
    monkeypatch.setenv("REGISTRATION_INVITE_CODE", "x")
    assert client.get("/auth/registration").json() == {
        "allowed": True,
        "invite_required": True,
    }
    monkeypatch.setenv("ALLOW_REGISTRATION", "false")
    assert client.get("/auth/registration").json()["allowed"] is False
