# Kiosk / Demo Mode

Kiosk mode lets visitors explore SproutVibe without signing up. Each visitor gets an isolated demo account that is automatically created and pre-seeded with sample plants. Sessions expire after 24 hours and are cleaned up nightly.

This is intended for operators who want to offer a public demo of their SproutVibe instance — for example, on a shared display or a public-facing URL.

## Enabling kiosk mode

Set the environment variable on your backend:

```
KIOSK_MODE=true
```

### Docker Compose

In your `.env` file:

```env
KIOSK_MODE=true
```

### Kubernetes / Helm

In your values override file:

```yaml
controllers:
  backend:
    containers:
      main:
        env:
          KIOSK_MODE:
            value: "true"
```

## What changes in kiosk mode

- **Admin bootstrap is skipped.** `ADMIN_EMAIL` and `ADMIN_PASSWORD` are not read and no admin account is created. You can omit them from your secrets entirely.
- **Visitors land directly on the dashboard.** No login prompt — a demo account is created automatically in the background.
- **Each visitor is isolated.** Demo users are real accounts scoped to their own session token. Data is not shared between visitors.
- **Sessions expire after 24 hours.** Expired demo accounts and all their data are deleted by a nightly cleanup job (runs at 02:00 UTC).
- **Server-level API keys are not available to demo users.** Even if `PERENUAL_API_KEY` or `ANTHROPIC_API_KEY` are set on the server, demo users cannot use them. Demo users can supply their own keys in Settings, which are stored against their account and deleted with it.
- **A dismissible banner** is shown to demo users explaining that data resets nightly and linking to Settings for API key configuration.

## Counting demo sessions

Kiosk mode raises an obvious question: how many people actually try the demo?
Web analytics answers "how many loaded the page"; this answers "how many were
handed a demo account", which is usually the number you care about.

The backend can expose a Prometheus counter, `sprout_demo_sessions_total`,
incremented once per demo session successfully created. It is **off by
default** — a self-hosted instance does not open an extra port unless you ask
it to:

```yaml
controllers:
  backend:
    containers:
      main:
        env:
          METRICS_ENABLED:
            value: "true"
          METRICS_PORT:            # optional, defaults to 9000
            value: "9000"
```

Metrics are served on their own port rather than as a `/metrics` route,
because the bundled frontend nginx proxies `/api/` straight to the backend —
a route would be publicly reachable at `<your-host>/api/metrics`. The separate
port is not proxied, so it stays internal to the cluster or host.

The process restarts whenever you redeploy or reset the demo, which resets the
counter, so query it with `increase()` or `rate()`:

```promql
sum(increase(sprout_demo_sessions_total[1d]))
```

## Security considerations

- Demo accounts are ephemeral and fully isolated, but they consume database space and (if you expose API keys in your deployment) could be a source of abuse. The API key isolation above prevents demo users from using your server's keys.
- There is no built-in rate limiting on demo account creation. If you expose your instance publicly, consider putting a reverse proxy rate limit on `POST /api/auth/demo`.
- Kiosk mode is not intended as a multi-tenant SaaS feature — it is a demo aid for self-hosted instances.
