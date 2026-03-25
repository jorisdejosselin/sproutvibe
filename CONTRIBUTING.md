# Contributing to Sprout

## Development setup

### Docker (recommended)

The easiest way to run a full dev environment with hot reload for both backend and frontend:

```bash
cp .env.example .env  # edit as needed (JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)
docker compose -f docker-compose.dev.yml up
```

- Frontend (Vite HMR): http://localhost:5173
- Backend (uvicorn --reload): proxied via Vite

Editing any file in `backend/` or `frontend/src/` is reflected immediately without restarting containers.

If you add or change Python dependencies, rebuild the backend image:

```bash
docker compose -f docker-compose.dev.yml build backend
```

### Local (without Docker)

If you prefer running the processes directly:

**Backend**

```bash
cd backend
poetry install        # creates .venv/ automatically
poetry run uvicorn main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000` automatically.

#### Using PostgreSQL for local development

To run the backend against PostgreSQL instead of SQLite, add the postgres overlay:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.postgres.yml up
```

This starts a `postgres:16-alpine` container and sets `DATABASE_URL` automatically.
Tables are created on first startup via SQLAlchemy's `create_all()`.

For production deployments, provide your own PostgreSQL instance and set:
```
DATABASE_URL=postgresql://user:password@host:5432/sprout
```

#### Using PostgreSQL with Skaffold

By default `skaffold dev` uses SQLite (a PVC mounted at `/data`). To use PostgreSQL instead, activate the `postgres` profile:

```bash
skaffold dev --profile postgres
```

This deploys a `postgres:16-alpine` pod and a [pgweb](https://github.com/sosedoff/pgweb) database UI into the `sprout-dev` namespace alongside the app. `DATABASE_URL` is pointed at postgres automatically.

The pgweb DB UI is exposed at `sprout-postgres.<BASE_DOMAIN>` — set `BASE_DOMAIN` in your `skaffold.env`.

#### Using a custom image registry (skaffold)

By default `skaffold.yaml` references `ghcr.io/YOUR_GITHUB_USER` as the image registry.
Skaffold rewrites all image names transparently when you configure a default repo.

**Option A — persistent global config (set once):**

```bash
skaffold config set default-repo zot.example.com/youruser --global
```

Stored in `~/.skaffold/config`. Override per-run with `--default-repo <value>`.

**Option B — local env file (easy to switch):**

```bash
cp skaffold.env.example skaffold.env
# edit SKAFFOLD_DEFAULT_REPO and BASE_DOMAIN in skaffold.env
skaffold dev
```

`skaffold.env` is gitignored and auto-loaded by Skaffold — no sourcing needed. Both options leave `skaffold.yaml` untouched.

`BASE_DOMAIN` sets the base domain for all ingress hostnames (e.g. `yourdomain.com` → app at `sprout.yourdomain.com`). It must be set when using skaffold — `skaffold.env` handles this automatically.

For production Helm deployments (without skaffold), edit the host directly in `deploy/helm-values.yaml`.

## Running tests

### Backend

```bash
cd backend
poetry run pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm test
```

## Pre-commit hooks

Install [pre-commit](https://pre-commit.com/), then run once:

```bash
pip install pre-commit
pre-commit install
```

After that, hooks run automatically on every `git commit`. To run manually:

```bash
pre-commit run --all-files
```

## Code style

**Python:** [Ruff](https://docs.astral.sh/ruff/) handles both linting and formatting. Config is in `ruff.toml`. Run manually:

```bash
ruff check backend/ --fix
ruff format backend/
```

**JavaScript:** ESLint. Config is in `frontend/eslint.config.js`. Run manually:

```bash
cd frontend && npm run lint
```

## Commit message format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/) to automate versioning and changelogs. Every commit message on `main` must follow the format:

```
<type>[optional scope]: <description>

[optional body]
```

**Types and their effect on versioning:**

| Type | Version bump | Example |
|------|-------------|---------|
| `fix` | patch | `fix: handle missing photo gracefully` |
| `feat` | minor | `feat: add dark mode toggle` |
| `feat!` or `BREAKING CHANGE` | major | `feat!: rename API endpoint` |
| `chore`, `docs`, `style`, `refactor`, `test`, `ci` | none | `chore: update dependencies` |

The `commitlint` pre-commit hook (runs on the `commit-msg` stage) will reject commits that don't match this format. Install the hook with:

```bash
pre-commit install --hook-type commit-msg
```

## Pull requests

- Keep PRs focused — one feature or fix per PR.
- All CI checks must pass before merging.
- Write or update tests for any changed behaviour.
