#!/usr/bin/env bash
# LifeGoods — hardened deploy to a Netcup VPS (single box, Docker Compose).
#
# Design (Netcup-only):
#   * The VPS is created once in the Netcup panel (SCP). Terraform is NOT used.
#   * This script SSHes in and, idempotently:
#       1. hardens the host (UFW deny-by-default, fail2ban, unattended-upgrades)
#       2. installs Docker + Compose plugin
#       3. provisions TLS via Let's Encrypt (certbot) if DOMAIN is set
#       4. pushes the sealed secrets + compose + nginx config
#       5. builds and starts the stack
#
# Usage:
#   SSH_HOST=203.0.113.10 \
#   SSH_USER=root \
#   ADMIN_CIDRS="203.0.113.10/32 198.51.100.5/32" \
#   ENV=prod \
#   DOMAIN=app.example.com \
#   ./infra/deploy/deploy.sh
#
# Variables (all optional, sensible defaults):
#   SSH_HOST        IP/host of the Netcup VPS        (required)
#   SSH_USER        ssh user (root or sudo user)     (default: root)
#   SSH_KEY         path to private key              (default: ~/.ssh/lifegoods_deploy)
#   ENV             prod | staging                   (default: prod)
#   ADMIN_CIDRS     space-separated CIDRs for SSH    (default: warn if empty)
#   DOMAIN          public domain for TLS            (default: empty -> self-signed/plain)
#   EMAIL           Let's Encrypt contact            (default: empty)
set -euo pipefail

# --- Config ---------------------------------------------------------------
SSH_HOST="${SSH_HOST:?SSH_HOST is required (Netcup VPS IP)}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lifegoods_deploy}"
ENV="${ENV:-prod}"
ADMIN_CIDRS="${ADMIN_CIDRS:-}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/compose/docker-compose.$ENV.yml"
NGINX_CONF="$REPO_ROOT/infra/nginx/nginx.conf"
SECRETS_FILE="$REPO_ROOT/infra/secrets/$ENV/.env"
TLS_DIR="$REPO_ROOT/infra/tls"           # generated certs live here (gitignored)

[ -f "$COMPOSE_FILE" ] || { echo "FATAL: $COMPOSE_FILE not found" >&2; exit 1; }
[ -f "$SECRETS_FILE" ] || { echo "FATAL: secrets not found. cp $REPO_ROOT/infra/secrets/$ENV/.env.example $SECRETS_FILE and fill it." >&2; exit 1; }

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
SCP_DST="${SSH_USER}@${SSH_HOST}"

if [ -n "$ADMIN_CIDRS" ]; then
  ADMIN_CIDRS_ARGS=()
  for cidr in $ADMIN_CIDRS; do
    ADMIN_CIDRS_ARGS+=("$cidr")
  done
else
  echo "WARNING: ADMIN_CIDRS is empty. SSH will be open to the world via UFW (firewalled only by Netcup). Set ADMIN_CIDRS." >&2
  ADMIN_CIDRS_ARGS=()
fi

echo "==> Deploying LifeGoods [$ENV] to $SSH_USER@$SSH_HOST"

# --- 1. Host hardening (idempotent) ---------------------------------------
"${SSH[@]}" bash -s <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Base packages
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades curl ca-certificates gnupg lsb-release

# Unattended security upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'UA'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}";
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESM:${distro_codename}";
};
Unattended-Upgrade::AutoFixInterrupted "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UA
echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
EOF

# --- Firewall policy (UFW, Netcup-aware) ------------------------------------
# Strict deny-by-default incoming. SSH is only reachable from the operator's
# current session IP plus any ADMIN_CIDRS. Web (80/443) is open to the world.
# The policy is applied atomically and refused if it would lock out the current
# session, so the operator is never bricked out of the Netcup VPS.
UFW_RULE_FILE=/tmp/lifegoods-ufw-rules.sh
{
  cat <<'POLICY'
set -euo pipefail

# Resolve the current SSH client IP from the active session.
CURIP="$(echo "${SSH_CLIENT:-${SSH_CONNECTION:-}}" | awk '{print $1}')"
[ -n "${CURIP:-}" ] || { echo "ERROR: cannot determine current SSH client IP" >&2; exit 1; }

ufw --force reset >/dev/null 2>&1 || true

ufw default deny incoming
ufw default allow outgoing
# Always allow the operator's current session IP (guards against lockout).
ufw allow proto tcp from "$CURIP" to any port 22 comment 'deploy session'
POLICY
  # Explicit admin CIDRs.
  for cidr in "${ADMIN_CIDRS_ARGS[@]}"; do
    echo "ufw allow proto tcp from $cidr to any port 22 comment 'admin-cidr'"
  done
  cat <<'POLICY2'
# Web edge (public).
ufw allow 80/tcp comment http
ufw allow 443/tcp comment https

# The current session IP is explicitly allowed above, so enablement is safe.
ufw --force enable
ufw --force reload
ufw status verbose
POLICY2
} > "$UFW_RULE_FILE"

echo "==> Applying Netcup firewall policy (SSH: current session + ADMIN_CIDRS only; web: 80/443)"
"${SSH[@]}" 'bash -s' < "$UFW_RULE_FILE"
rm -f "$UFW_RULE_FILE"

# --- 2. Docker + Compose ---------------------------------------------------
"${SSH[@]}" bash -s <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose plugin missing" >&2; exit 1; }
EOF

# --- 3. TLS (Let's Encrypt or self-signed) ---------------------------------
mkdir -p "$TLS_DIR"
if [ -n "$DOMAIN" ]; then
  "${SSH[@]}" bash -s <<EOF
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi
# Ensure port 80 webroot is served during issuance by touching the dir.
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --non-interactive --agree-tos \
  ${EMAIL:+-m "$EMAIL"} --redirect
EOF
  echo "==> Copying certs for $DOMAIN to $TLS_DIR"
  scp -q -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$SSH_HOST:/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$TLS_DIR/fullchain.pem"
  scp -q -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$SSH_HOST:/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$TLS_DIR/privkey.pem"
  chmod 600 "$TLS_DIR/privkey.pem"
else
  echo "==> No DOMAIN set: generating a self-signed cert (replace with real TLS later)."
  if [ ! -f "$TLS_DIR/fullchain.pem" ]; then
    openssl req -x509 -newkey rsa:2048 -nodes \
      -days 30 -subj "/CN=lifegoods-selfsigned" \
      -keyout "$TLS_DIR/privkey.pem" -out "$TLS_DIR/fullchain.pem"
    chmod 600 "$TLS_DIR/privkey.pem"
  fi
fi

# --- 4. Package + push the repo (preserves structure so compose contexts resolve)
REMOTE_DIR=/opt/lifegoods
TARBALL="$(mktemp /tmp/lifegoods-repo-XXXXXX.tar.gz)"

echo "==> Packaging repo (excluding .git, deps, build outputs, secrets) to $TARBALL"
tar --exclude='./.git' \
    --exclude='./node_modules' \
    --exclude='./frontend/node_modules' \
    --exclude='./backend/.venv' \
    --exclude='./frontend/dist' \
    --exclude='./**/__pycache__' \
    --exclude='./frontend/certs' \
    --exclude='./infra/tls' \
    --exclude='./infra/secrets/**/.env' \
    --exclude='./**/*.log' \
    --exclude='./.impeccable' \
    -czf "$TARBALL" -C "$REPO_ROOT" .

echo "==> Sending repo + secrets to $SCP_DST:$REMOTE_DIR"
"${SSH[@]}" "rm -rf $REMOTE_DIR/infra/secrets && mkdir -p $REMOTE_DIR/infra/secrets/$ENV"
scp -q -i "$SSH_KEY" -o BatchMode=yes "$TARBALL" "$SCP_DST:/tmp/lifegoods-repo.tar.gz"
scp -q -i "$SSH_KEY" -o BatchMode=yes "$SECRETS_FILE" "$SCP_DST:$REMOTE_DIR/infra/secrets/$ENV/.env"
rm -f "$TARBALL"

"${SSH[@]}" bash -s <<'EOF'
set -euo pipefail
rm -rf /opt/lifegoods/repo
mkdir -p /opt/lifegoods/repo
tar -xzf /tmp/lifegoods-repo.tar.gz -C /opt/lifegoods/repo
rm -f /tmp/lifegoods-repo.tar.gz
chmod 600 /opt/lifegoods/infra/secrets/*/.env
EOF

# --- 5. TLS certs into the compose TLS mount dir ---------------------------
REMOTE_COMPOSE_DIR=$REMOTE_DIR/repo/infra/compose
"${SSH[@]}" "mkdir -p $REMOTE_COMPOSE_DIR/tls"
scp -q -i "$SSH_KEY" -o BatchMode=yes "$TLS_DIR/fullchain.pem" "$SCP_DST:$REMOTE_COMPOSE_DIR/tls/fullchain.pem"
scp -q -i "$SSH_KEY" -o BatchMode=yes "$TLS_DIR/privkey.pem" "$SCP_DST:$REMOTE_COMPOSE_DIR/tls/privkey.pem"
"${SSH[@]}" "chmod 600 $REMOTE_COMPOSE_DIR/tls/privkey.pem"

# --- 6. Build + start the stack --------------------------------------------
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
cd $REMOTE_COMPOSE_DIR
export COMPOSE_ENV_FILE=$REMOTE_DIR/infra/secrets/$ENV/.env
docker compose --env-file "\$COMPOSE_ENV_FILE" -f docker-compose.$ENV.yml config >/dev/null
docker compose --env-file "\$COMPOSE_ENV_FILE" -f docker-compose.$ENV.yml up -d --build --remove-orphans
echo '==> Stack is up.'
EOF

echo "==> Done. HTTPS entry: ${DOMAIN:-https://$SSH_HOST}"
