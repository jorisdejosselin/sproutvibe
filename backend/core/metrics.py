"""Prometheus metrics.

Deliberately opt-in: only starts when METRICS_ENABLED=true, so a self-hosted
Sprout does not grow an extra listening port that nobody asked for. The demo
deployment turns it on; everything else leaves it off and the counters simply
sit in memory unread.

The exporter binds its own port rather than adding a /metrics route to the
FastAPI app on purpose. The frontend nginx proxies /api/ straight through to
the backend, so a route would be publicly reachable at
<host>/api/metrics. A separate port is not proxied, so it stays internal.
"""

import logging
import os

from prometheus_client import Counter, start_http_server

logger = logging.getLogger(__name__)

DEFAULT_METRICS_PORT = 9000

# Incremented once per demo session handed out (see routes/auth.py). This is
# "someone actually clicked try the demo", as opposed to a page view. The
# process restarts nightly when the demo database is reset, so always query
# this with increase()/rate(), which handle counter resets.
demo_sessions_total = Counter(
    "sprout_demo_sessions_total",
    "Demo sessions created via POST /auth/demo (kiosk mode only)",
)


def start_metrics_server() -> None:
    """Expose metrics on METRICS_PORT if METRICS_ENABLED=true. Never fatal."""
    if os.getenv("METRICS_ENABLED", "false").lower() != "true":
        return

    try:
        port = int(os.getenv("METRICS_PORT", str(DEFAULT_METRICS_PORT)))
    except ValueError:
        logger.warning(
            "METRICS_PORT is not a number — falling back to %d", DEFAULT_METRICS_PORT
        )
        port = DEFAULT_METRICS_PORT

    try:
        start_http_server(port)
        logger.info("Prometheus metrics listening on :%d/metrics", port)
    except OSError as exc:
        # Losing metrics must never take the app down with it.
        logger.warning("Could not start metrics server on :%d — %s", port, exc)
