import os

os.environ["KIOSK_MODE"] = "true"

from core.metrics import demo_sessions_total


def _val():
    return demo_sessions_total._value.get()


def test_demo_session_increments_counter(client):
    before = _val()
    r = client.post("/auth/demo")
    assert r.status_code == 200, r.text
    assert _val() == before + 1, "counter did not increment"


def test_counter_not_incremented_when_kiosk_disabled(client, monkeypatch):
    monkeypatch.setenv("KIOSK_MODE", "false")
    before = _val()
    r = client.post("/auth/demo")
    assert r.status_code == 403
    assert _val() == before, "counter moved on a rejected request"


def test_metrics_not_exposed_as_app_route(client):
    # nginx proxies /api/ to the backend, so an app route here would be public
    assert client.get("/metrics").status_code == 404
