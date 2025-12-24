#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=/opt/wp-logger/backend/.env
WA_WEB_VERSION=2.3000.1031440646-alpha
WA_WEB_VERSION_REMOTE_PATH=https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html
if grep -q "^WA_WEB_VERSION=" "$ENV_FILE"; then
  sed -i "s|^WA_WEB_VERSION=.*|WA_WEB_VERSION=${WA_WEB_VERSION}|" "$ENV_FILE"
else
  printf "\nWA_WEB_VERSION=%s\n" "$WA_WEB_VERSION" >> "$ENV_FILE"
fi
if grep -q "^WA_WEB_VERSION_REMOTE_PATH=" "$ENV_FILE"; then
  sed -i "s|^WA_WEB_VERSION_REMOTE_PATH=.*|WA_WEB_VERSION_REMOTE_PATH=${WA_WEB_VERSION_REMOTE_PATH}|" "$ENV_FILE"
else
  printf "WA_WEB_VERSION_REMOTE_PATH=%s\n" "$WA_WEB_VERSION_REMOTE_PATH" >> "$ENV_FILE"
fi