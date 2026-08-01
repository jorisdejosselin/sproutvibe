#!/usr/bin/env bash
# One-time setup for the postgres-cnpg skaffold profile.
#
# Creates the sprout-dev CNPG cluster (deploy/cnpg-dev-cluster.yaml), cloned
# from prod's existing barman backup archive, then wires up its app-user
# credentials. Run this ONCE, before `skaffold dev --profile postgres-cnpg` —
# not part of that skaffold run itself, since skaffold deletes everything it
# deploys on exit and this cluster is meant to outlive individual dev
# sessions.
#
# Safe to re-run: if the cluster already exists, only the credential sync
# step runs (useful after the cluster was deleted and recreated by hand).
#
# Usage:
#   bash scripts/setup-postgres-cnpg.sh

set -euo pipefail

CLUSTER_NS=postgres-clusters
APP_NS=sprout-dev
CLUSTER_NAME=sprout-dev
SECRET_NAME=sprout-dev-app

if kubectl get cluster "$CLUSTER_NAME" -n "$CLUSTER_NS" >/dev/null 2>&1; then
  echo "Cluster $CLUSTER_NAME already exists in $CLUSTER_NS — skipping creation." >&2
else
  echo "Creating $CLUSTER_NAME (cloning from prod's backup archive)..." >&2
  kubectl apply -f "$(dirname "$0")/../deploy/cnpg-dev-cluster.yaml"

  echo "Waiting for cluster to become healthy..." >&2
  for _ in $(seq 1 60); do
    phase=$(kubectl get cluster "$CLUSTER_NAME" -n "$CLUSTER_NS" -o jsonpath='{.status.phase}' 2>/dev/null || true)
    [ "$phase" = "Cluster in healthy state" ] && break
    sleep 5
  done
  if [ "$phase" != "Cluster in healthy state" ]; then
    echo "Cluster did not become healthy in time (last phase: ${phase:-unknown})." >&2
    exit 1
  fi
fi

# CNPG's bootstrap.recovery does NOT auto-generate the app-user secret the
# way bootstrap.initdb does, so it's created here instead. If it already
# exists (e.g. cluster was deleted+recreated), reuse its password rather
# than rotating it, and just re-sync the restored role to match.
if kubectl get secret "$SECRET_NAME" -n "$CLUSTER_NS" >/dev/null 2>&1; then
  echo "Secret $SECRET_NAME already exists in $CLUSTER_NS — reusing its password." >&2
  password=$(kubectl get secret "$SECRET_NAME" -n "$CLUSTER_NS" -o jsonpath='{.data.password}' | base64 -d)
else
  echo "Generating new app-user credentials..." >&2
  password=$(openssl rand -base64 24 | tr -d '=+/' | head -c 32)
fi

kubectl exec -n "$CLUSTER_NS" "${CLUSTER_NAME}-1" -c postgres -- \
  psql -U postgres -c "ALTER ROLE sprout WITH PASSWORD '${password}';" >/dev/null

uri="postgresql://sprout:${password}@${CLUSTER_NAME}-rw.${CLUSTER_NS}.svc.cluster.local:5432/sprout"

# secretKeyRef can't cross namespaces — the app's Deployment (sprout-dev ns)
# and the CNPG cluster (postgres-clusters ns) both need their own copy.
for ns in "$CLUSTER_NS" "$APP_NS"; do
  kubectl create secret generic "$SECRET_NAME" -n "$ns" \
    --from-literal=username=sprout \
    --from-literal=password="$password" \
    --from-literal=uri="$uri" \
    --dry-run=client -o yaml | kubectl apply -f -
done

unset password uri

echo "Done. $SECRET_NAME is set in both $CLUSTER_NS and $APP_NS." >&2
