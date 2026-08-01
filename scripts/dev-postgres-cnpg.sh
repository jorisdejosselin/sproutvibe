#!/usr/bin/env bash
# `skaffold dev --profile postgres-cnpg`, with the CNPG dev cluster guaranteed
# to exist first.
#
# The cluster deliberately lives outside skaffold's lifecycle (skaffold deletes
# what it deploys on exit, and this cluster is a one-time prod clone meant to
# outlive dev sessions), so nothing in `skaffold dev` creates it. Run against a
# missing cluster, the profile doesn't fail — the app's init containers just
# loop `nc: bad address sprout-dev-rw.postgres-clusters...` until you give up.
#
# A skaffold hook can't cover this: the helm deployer has no hooks in
# v4beta11, and deploy.kubectl hooks run after the helm deploy has already
# happened. Hence this wrapper.
#
# Usage:
#   bash scripts/dev-postgres-cnpg.sh [extra skaffold args...]

set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/setup-postgres-cnpg.sh

exec skaffold dev --profile postgres-cnpg "$@"
