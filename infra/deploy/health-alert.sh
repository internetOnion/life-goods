#!/usr/bin/env bash
# Aggregate health alert for production (VPS only, run from cron every 5 minutes; see
# docs/production-deployment.md section 6). Sends only aggregate status, never Barcodes,
# request bodies or client data.
#
# Reads /etc/lifegoods/alert.env (root:root, 0600):
#   LIFEGOODS_ALERT_WEBHOOK_URL   receives a JSON {"text": ...} POST (e.g. ntfy, Slack, Discord)
#   LIFEGOODS_PUBLIC_ORIGIN       e.g. https://lifegoods.example.workers.dev
#   LIFEGOODS_APP_DIR             optional, default /opt/lifegoods-production
set -uo pipefail

# shellcheck disable=SC1091
source /etc/lifegoods/alert.env
: "${LIFEGOODS_ALERT_WEBHOOK_URL:?}" "${LIFEGOODS_PUBLIC_ORIGIN:?}"
app_dir="${LIFEGOODS_APP_DIR:-/opt/lifegoods-production}"
state=/var/lib/lifegoods-health.state
compose=(docker compose --project-name lifegoods-app-prod
    --env-file "$app_dir/infra/secrets/app-prod/.env"
    -f "$app_dir/infra/compose/docker-compose.app-prod.yml")
failures=()

if ! (cd "$app_dir" && "${compose[@]}" exec -T backend /app/.venv/bin/python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/ready', timeout=15)") \
    >/dev/null 2>&1; then
    failures+=("backend readiness")
fi
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$LIFEGOODS_PUBLIC_ORIGIN/")" != 200 ]; then
    failures+=("public frontend")
fi
# A well-known public Product; checks the Worker, Tunnel, backend and Dataset Snapshot.
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    "$LIFEGOODS_PUBLIC_ORIGIN/api/v1/products/3017624010701")" != 200 ]; then
    failures+=("public Product Lookup")
fi
for container in $(cd "$app_dir" && "${compose[@]}" ps -q) compose-mongodb-1; do
    if [ "$(docker inspect -f '{{.State.OOMKilled}}' "$container" 2>/dev/null)" = true ]; then
        failures+=("OOM kill in $(docker inspect -f '{{.Name}}' "$container")")
    fi
done
disk_used="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
if [ "${disk_used:-0}" -ge 90 ]; then
    failures+=("disk ${disk_used}% used")
fi

previous="$(cat "$state" 2>/dev/null || echo ok)"
if [ ${#failures[@]} -gt 0 ]; then
    message="Life Goods production unhealthy: $(IFS=', '; echo "${failures[*]}")"
    current="$message"
else
    message="Life Goods production recovered"
    current=ok
fi
# Notify only on state changes so a long outage sends one alert and one recovery.
if [ "$current" != "$previous" ]; then
    curl -s --max-time 20 -H 'Content-Type: application/json' \
        -d "{\"text\": \"$message\"}" "$LIFEGOODS_ALERT_WEBHOOK_URL" >/dev/null
fi
echo "$current" > "$state"
