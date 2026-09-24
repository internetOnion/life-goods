#!/usr/bin/env bash
# Nightly off-VPS backup of production generated data (VPS only; see
# docs/production-deployment.md section 6). The Dataset Snapshot is not dumped here:
# it is rebuilt from Open Food Facts with the documented import procedure.
#
# Reads /etc/lifegoods/backup.env (root:root, 0600):
#   LIFEGOODS_BACKUP_MONGODB_URI   read-only identity on lifegoods_generated_prod
#   LIFEGOODS_BACKUP_REMOTE        rclone destination, e.g. r2:lifegoods-backups/generated
#   LIFEGOODS_MONGODB_CONTAINER    optional, default compose-mongodb-1
#   LIFEGOODS_BACKUP_KEEP_DAYS     optional remote retention, default 30
set -euo pipefail
umask 077

# shellcheck disable=SC1091
source /etc/lifegoods/backup.env
: "${LIFEGOODS_BACKUP_MONGODB_URI:?}" "${LIFEGOODS_BACKUP_REMOTE:?}"
container="${LIFEGOODS_MONGODB_CONTAINER:-compose-mongodb-1}"
keep_days="${LIFEGOODS_BACKUP_KEEP_DAYS:-30}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
archive="$workdir/lifegoods_generated_prod-$stamp.archive.gz"

# The URI travels on stdin into a private config file, never on a command line.
printf 'uri: "%s"\n' "$LIFEGOODS_BACKUP_MONGODB_URI" |
    docker exec -i "$container" sh -c '
        umask 077
        cfg="$(mktemp)"
        cat > "$cfg"
        mongodump --quiet --config "$cfg" --db lifegoods_generated_prod --archive --gzip
        status=$?
        rm -f "$cfg"
        exit $status
    ' > "$archive"

test -s "$archive"
sha256sum "$archive" | awk '{print $1}' > "$archive.sha256"
rclone copy --no-traverse "$archive" "$LIFEGOODS_BACKUP_REMOTE/"
rclone copy --no-traverse "$archive.sha256" "$LIFEGOODS_BACKUP_REMOTE/"
rclone delete --min-age "${keep_days}d" "$LIFEGOODS_BACKUP_REMOTE/"
echo "backup ok $stamp $(stat -c %s "$archive") bytes"
