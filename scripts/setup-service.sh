#!/usr/bin/env bash
# setup-service.sh — installs portfolio-dashboard as a systemd service
# Run as root or with sudo

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="portfolio-dashboard"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
USER_NAME="${SUDO_USER:-$(whoami)}"

echo "[sysconfig] Installing ${SERVICE_NAME} systemd service..."
echo "            Project dir : ${PROJECT_DIR}"
echo "            Service user: ${USER_NAME}"

# Detect docker compose command
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "ERROR: docker compose not found. Install Docker Compose first." >&2
  exit 1
fi

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Portfolio Dashboard (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${PROJECT_DIR}
ExecStartPre=${COMPOSE_CMD} pull --quiet
ExecStart=${COMPOSE_CMD} up
ExecStop=${COMPOSE_CMD} down
Restart=on-failure
RestartSec=10s
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo ""
echo "[sysconfig] Done!"
echo "  Status  : sudo systemctl status ${SERVICE_NAME}"
echo "  Logs    : sudo journalctl -u ${SERVICE_NAME} -f"
echo "  Stop    : sudo systemctl stop ${SERVICE_NAME}"
echo "  Dashboard: http://localhost:8080"
