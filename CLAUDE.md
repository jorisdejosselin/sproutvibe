# Claude Instructions for Sprout

## Git commits and pushes

Only commit and push when the user explicitly confirms the changes are good and ready. Do not commit after completing a feature or fixing a bug unless the user says so.

## Dependency versions

Always pin dependency versions explicitly — no floating ranges (`^`, `~`, `>=`, `latest`).
This applies to Python packages (`pyproject.toml`), npm packages (`package.json`), Docker base images (`Dockerfile`), Helm chart versions, and GitHub Actions.

## Temporary files

Use `tmp/` in the project root for any files that need to be created on the fly (generated configs, exported secrets, scratch files, etc.).

Do **not** use the system `/tmp/` directory.

The `tmp/` directory is git-ignored and safe for sensitive files like Kubernetes secret exports.
