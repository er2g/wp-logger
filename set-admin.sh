#!/usr/bin/env bash
set -euo pipefail
ADMIN_PASSWORD="3131"
ADMIN_USERNAME="admin"
ENV_FILE="/opt/wp-logger/backend/.env"
if grep -q "^ADMIN_PASSWORD=" "$ENV_FILE"; then
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" "$ENV_FILE"
else
  printf "\nADMIN_PASSWORD=%s\n" "$ADMIN_PASSWORD" >> "$ENV_FILE"
fi
if grep -q "^ADMIN_USERNAME=" "$ENV_FILE"; then
  sed -i "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${ADMIN_USERNAME}|" "$ENV_FILE"
else
  printf "ADMIN_USERNAME=%s\n" "$ADMIN_USERNAME" >> "$ENV_FILE"
fi
pm2 restart whatsapp-bot
printf "ADMIN_USERNAME=%s\n" "$ADMIN_USERNAME"
printf "ADMIN_PASSWORD=%s\n" "$ADMIN_PASSWORD"
