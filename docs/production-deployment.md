# Production deployment

Production mirrors the staging topology in [staging-deployment.md](staging-deployment.md):
Cloudflare Workers Static Assets serves the frontend, and a Worker reaches FastAPI
through a production-only Workers VPC HTTP service and Cloudflare Tunnel. It runs on
the same 4 GiB VPS as staging, beside the shared dataset MongoDB, as a separate
Compose project (`lifegoods-app-prod`) with its own:

| | Staging | Production |
|---|---|---|
| Compose file | `docker-compose.app-staging.yml` | `docker-compose.app-prod.yml` |
| App directory on the VPS | `/opt/lifegoods-staging` | `/opt/lifegoods-production` |
| API subnet (backend / tunnel) | `172.30.85.0/29` (.2 / .3) | `172.30.86.0/29` (.2 / .3) |
| Secrets | `infra/secrets/app-staging/` | `infra/secrets/app-prod/` |
| Generated data | `lifegoods_generated` | `lifegoods_generated_prod` |
| Redis | own container, `noeviction` | own container, `noeviction` |
| Worker | `lifegoods-staging` | `lifegoods` |
| VPC service ID variable | `LIFEGOODS_VPC_SERVICE_ID` | `LIFEGOODS_PRODUCTION_VPC_SERVICE_ID` |

Both read the one Dataset Snapshot (`lifegoods_off`) with separate read-only identities.
No public VPS port is added. Staging acceptance is a precondition, not production
acceptance.

## 0. Preconditions

- The release commit passed CI and the staging acceptance in
  [staging-deployment.md §5](staging-deployment.md#5-acceptance-and-rollback).
- The **Build reviewed staging backend** workflow published
  `ghcr.io/internetonion/life-goods-backend:<full-commit-sha>`. Production uses that
  same image; nothing is rebuilt.
- Memory: MongoDB (2 GiB limit) + two backends (768 MiB each) + two Redis (256 MiB)
  + two cloudflared (192 MiB) is about 4.4 GiB against 4 GiB RAM. Keep staging stopped
  outside QA windows (`docker compose --project-name lifegoods-app-staging … stop`) and
  accept production only after the §5 load measurement shows no OOM or sustained swap.

## 1. Identities and secrets (VPS)

Clone the reviewed commit to `/opt/lifegoods-production`. As the existing MongoDB admin,
create production identities with prompted passwords (never in shell history):

```bash
docker exec -it compose-mongodb-1 mongosh -u "$ADMIN_USER" --authenticationDatabase admin
```

```javascript
db.getSiblingDB("lifegoods_off").createUser({ user: "lifegoods_prod_reader", pwd: passwordPrompt(), roles: [{ role: "read", db: "lifegoods_off" }] })
db.getSiblingDB("lifegoods_generated_prod").createUser({ user: "lifegoods_prod_generated", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "lifegoods_generated_prod" }] })
db.getSiblingDB("lifegoods_generated_prod").createUser({ user: "lifegoods_prod_backup", pwd: passwordPrompt(), roles: [{ role: "read", db: "lifegoods_generated_prod" }] })
```

Copy `infra/secrets/app-prod/.env.example` to `infra/secrets/app-prod/.env`, `chmod 600`,
and fill it. URL-encode passwords in URIs. Use a new random Redis password. Keep
`LIFEGOODS_GEMINI_API_KEY` empty for now. Then initialize the isolated generated schema:

```bash
cd /opt/lifegoods-production
C="docker compose --project-name lifegoods-app-prod --env-file infra/secrets/app-prod/.env -f infra/compose/docker-compose.app-prod.yml"
$C pull
$C run --rm --no-deps backend uv run --no-sync python -m lifegoods.generated_data.cli init
$C run --rm --no-deps backend uv run --no-sync python -m lifegoods.generated_data.cli verify
```

Expected: `INITIALIZED`, then `VERIFIED`. The Dataset Snapshot is already active and
search-ready from staging; do not run dataset lifecycle commands for production.

## 2. Tunnel and VPC service

In Cloudflare, create a **new** Tunnel (`lifegoods-production`) with Workers VPC
private-network routing. Save its token to `infra/secrets/app-prod/tunnel-token`
(ignored by Git), readable only by the cloudflared container's UID. Then, on your computer:

```bash
pnpm exec wrangler vpc service create lifegoods-prod-api --type http --tunnel-id REPLACE_PRODUCTION_TUNNEL_ID --ipv4 172.30.86.2 --http-port 8000
```

Record the returned service ID (an identifier, not a secret) for
`LIFEGOODS_PRODUCTION_VPC_SERVICE_ID`. Never bind the staging service to production.

## 3. Start without the AI key, then add it

```bash
$C up -d
$C ps
$C exec -T backend /app/.venv/bin/python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health/ready', timeout=15).read().decode())"
```

Expected `{"status":"ready"}`. In Google Cloud, use a **separate production API key**
restricted to the Generative Language API, set per-minute and per-day request quotas
for the pinned models, and add a billing budget with email alerts. Only then put the key
in `.env` and run `$C up -d backend`. Compose admission limits (10 translation
admissions/minute, 3 photo requests/client/minute) are not a spending cap.

## 4. Frontend

On your computer, at the same reviewed commit:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm production:frontend:deploy --dry-run
pnpm production:frontend:deploy
```

Set `LIFEGOODS_PRODUCTION_VPC_SERVICE_ID` in your terminal environment first. The Worker
publishes as `lifegoods.<subdomain>.workers.dev`. Put that exact origin in
`LIFEGOODS_ALLOWED_ORIGINS` and run `$C up -d backend`. Record the Worker version ID
and backend image for rollback.

## 5. Acceptance

Repeat [staging §5](staging-deployment.md#5-acceptance-and-rollback) against the
production origin, including: routes and deep links in English and Khmer; Product Lookup
hit/miss; Product Search and pagination; images; Khmer Translation; Read This Label and
Compare Nutrition; `/docs`, `/redoc`, `/scalar`, `/openapi.json`, `/api/health/*`
returning 404; CSP, HSTS and `X-Frame-Options` present; spoofed forwarding headers
ignored; oversized uploads 413; rate limits 429; foreign CORS origins rejected. Run the
five-Shopper load script from staging with **both** stacks running and record memory,
swap, OOM and latency. Stop on any failure.

## 6. Backups and alerts

Generated data (`lifegoods_generated_prod`) is the only production state that is not
rebuildable. Redis is disposable. The Dataset Snapshot is rebuilt with
[dataset-deployment.md](dataset-deployment.md) and the staging operator steps
(`import-file`, `reindex-search`, `revalidate`, `activate`), so it is not dumped nightly.

1. Install `rclone`, configure an off-VPS remote (for example a Cloudflare R2 bucket with a
   write-only token), and create `/etc/lifegoods/backup.env` (root, `0600`) as documented
   in `infra/deploy/backup-generated.sh`, using the `lifegoods_prod_backup` identity.
2. Create `/etc/lifegoods/alert.env` (root, `0600`) as documented in
   `infra/deploy/health-alert.sh`, with a webhook you receive on your phone.
3. Add root cron entries:

   ```cron
   15 3 * * * /opt/lifegoods-production/infra/deploy/backup-generated.sh >> /var/log/lifegoods-backup.log 2>&1
   */5 * * * * /opt/lifegoods-production/infra/deploy/health-alert.sh
   ```

4. Run both scripts once by hand. Force an alert (`$C stop backend`), confirm it arrives,
   start the backend, and confirm the recovery message.
5. **Restore drill**: download the latest archive, verify its SHA-256, and restore into an
   isolated container on your computer as in [staging §2](staging-deployment.md#2-backup-and-restore-gate),
   using `--nsFrom 'lifegoods_generated_prod.*' --nsTo 'lifegoods_generated_restore.*'`.
   Compare collection counts and indexes. Never restore into the VPS database.

Production is accepted only when §5 passes, the restore drill succeeds, a forced alert
arrives, and Gemini quotas and the budget alert are confirmed.

## 7. Release and rollback

For each release: CI green → backend image workflow → staging deploy and acceptance →
set the same image in `infra/secrets/app-prod/.env`, `$C pull backend && $C up -d backend`,
readiness probe → `pnpm production:frontend:deploy` → smoke test. Record image and Worker
version IDs.

Rollback: restore the previous `LIFEGOODS_BACKEND_IMAGE`, `pull` and `up -d backend`; select
the previous Worker deployment in the Cloudflare dashboard. Never roll back or replace the
Dataset Snapshot as part of an application rollback.
