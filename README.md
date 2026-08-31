# SproutVibe

A self-hosted plant care PWA. Track your plants, log journal entries, set watering and fertilizing schedules, and receive push notifications when tasks are due.

**Try it out:** [demo.sproutvibe.net](https://demo.sproutvibe.net/) — no account needed, resets nightly.

**Stack:** FastAPI (Python) + React/Vite frontend, installable as a PWA or Android APK.
**Deploy:** Docker Compose (simple) or Kubernetes via Helm (production).

---

## Table of contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Production deployment](#production-deployment)
  - [Docker Compose](#docker-compose)
  - [Kubernetes / Helm](#kubernetes--helm)
- [Development setup](#development-setup)
- [Android APK](#android-apk)
- [MCP server](#mcp-server)
- [Advanced](#advanced)

---

## Quick start

```bash
cp .env.example .env
bash scripts/generate-secrets.sh   # fills in JWT_SECRET, VAPID keys, prompts for the rest
docker compose up -d
```

Open `http://localhost` in your browser. The admin account is created on first startup using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Configuration

All configuration is via environment variables. Use `.env` for Docker Compose or a Kubernetes secret for Helm.

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Secret used to sign login tokens. Generate with `openssl rand -hex 32` |
| `ADMIN_EMAIL` | No | Email of the admin account created on first startup |
| `ADMIN_PASSWORD` | No | Password for the admin account |
| `ADMIN_NAME` | No | Display name for the admin account (default: `Admin`) |
| `DATABASE_URL` | No | SQLite path (default) or PostgreSQL connection string |
| `VAPID_PRIVATE_KEY` | No | VAPID private key — required for push notifications |
| `VAPID_PUBLIC_KEY` | No | VAPID public key — required for push notifications |
| `VAPID_EMAIL` | No | VAPID contact address, e.g. `mailto:admin@example.com` |
| `AI_PROVIDER` | No | AI care provider: `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI care suggestions |
| `ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-haiku-4-5-20251001`) |
| `OPENAI_API_KEY` | No | OpenAI API key for AI care suggestions |
| `OPENAI_MODEL` | No | OpenAI model (default: `gpt-5.6-luna`) |
| `PERENUAL_API_KEY` | No | Perenual API key for plant species search |
| `DEV_MODE` | No | Set to `true` to enable `/dev/*` debug endpoints (never in production) |

### Generating secrets

The included script generates `JWT_SECRET` and VAPID keys automatically, and prompts for everything else:

```bash
# Native (needs openssl + python3 + cryptography package):
bash scripts/generate-secrets.sh

# Or with Docker — no local dependencies needed:
docker run --rm -it \
  -v "$(pwd)/tmp:/out" \
  -e OUTPUT=/out/.env \
  -e K8S_OUTPUT=/out/sprout-secrets.yaml \
  python:3.12-slim \
  sh -c "pip install cryptography -q && bash /dev/stdin" < scripts/generate-secrets.sh
```

The Docker variant writes `tmp/.env` (for Docker Compose) and `tmp/sprout-secrets.yaml` (ready to `kubectl apply`).

### Optional: config.yml

As an alternative to environment variables, mount a `config.yml` at `/app/config.yml` in the backend container:

```bash
cp config.example.yml config.yml
# fill in API keys, then mount it:
# - ./config.yml:/app/config.yml:ro
```

---

## Production deployment

### Docker Compose

Suitable for a single server with a reverse proxy (e.g. Caddy or nginx) handling HTTPS.

**1. Generate secrets**

```bash
bash scripts/generate-secrets.sh
# Output is written to stdout — copy the .env block into your .env file,
# or use -e OUTPUT=.env to write it directly.
```

**2. Configure**

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

**3. Start**

```bash
docker compose up -d
```

The backend listens on port `8000`, the frontend on port `80`. Put a reverse proxy in front and terminate TLS there.

**Caddy example** (`Caddyfile`):

```
sprout.example.com {
    reverse_proxy localhost:80
}
```

**4. Update**

```bash
docker compose pull
docker compose up -d
```

---

### Kubernetes / Helm

Sprout uses the [bjw-s app-template](https://bjw-s-labs.github.io/helm-charts/) Helm chart. Images are published to GitHub Container Registry:

- `ghcr.io/jorisdejosselin/sprout-backend`
- `ghcr.io/jorisdejosselin/sprout-frontend`

**1. Generate the Kubernetes secret**

```bash
# With Docker (outputs tmp/sprout-secrets.yaml):
docker run --rm -it \
  -v "$(pwd)/tmp:/out" \
  -e K8S_OUTPUT=/out/sprout-secrets.yaml \
  python:3.12-slim \
  sh -c "pip install cryptography -q && bash /dev/stdin" < scripts/generate-secrets.sh

kubectl apply -f tmp/sprout-secrets.yaml
```

The secret must be named `sprout-secrets` in the `sprout` namespace and contain:
`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VAPID_PRIVATE_KEY`,
`VAPID_PUBLIC_KEY`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`PERENUAL_API_KEY`.

**2. Customize Helm values**

Edit `deploy/helm-values.yaml` — at minimum set your hostname:

```yaml
route:
  main:
    hostnames:
      - sprout.example.com   # ← your domain
```

If you're using a traditional Ingress controller instead of a Gateway API controller, see the commented-out `ingress` block in `deploy/helm-values.yaml`.

**3. Deploy**

```bash
helm repo add bjw-s https://bjw-s-labs.github.io/helm-charts
helm repo update

helm upgrade --install sprout oci://ghcr.io/bjw-s/helm/app-template \
  --version 4.6.2 \
  --namespace sprout --create-namespace \
  --values deploy/helm-values.yaml
```

**4. Update to a new release**

```bash
helm upgrade sprout bjw-s/app-template \
  --namespace sprout \
  --values deploy/helm-values.yaml \
  --set controllers.backend.containers.main.image.tag=vX.Y.Z \
  --set controllers.frontend.containers.main.image.tag=vX.Y.Z
```

**Using Skaffold (for development against a cluster)**

```bash
cp skaffold.env.example skaffold.env
# edit SKAFFOLD_DEFAULT_REPO and BASE_DOMAIN in skaffold.env
skaffold dev
```

---

## Development setup

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev workflow. Quick version:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up
```

- Frontend (Vite HMR): `http://localhost:5173`
- Backend (uvicorn --reload): proxied via Vite at `/api`

---

## Android APK

Download the latest signed APK from the [Releases](../../releases) page.

1. On Android, enable **Install unknown apps** in Settings.
2. Open the downloaded APK to install.
3. On first launch, enter your Sprout server URL (e.g. `https://sprout.example.com`).

---

## MCP server

Sprout ships an MCP server that lets Claude Desktop manage your plants via natural language. See [`mcp/README.md`](mcp/README.md).

---

## Advanced

- [Kiosk / demo mode](docs/kiosk-mode.md) — let visitors explore without signing up

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, running tests, and code style guidelines.

---

## License

[MIT](LICENSE) — do whatever you like with it.
