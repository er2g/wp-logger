#!/usr/bin/env bash
set -euo pipefail

cd /opt/wp-logger

PUBLIC_HOST=$(hostname -f 2>/dev/null || hostname)
PUBLIC_IPS=$(hostname -I || true)
set -- $PUBLIC_IPS
PUBLIC_IP=${1:-localhost}
if [ -z "$PUBLIC_HOST" ]; then
  PUBLIC_HOST=$PUBLIC_IP
fi

DB_PASSWORD=$(openssl rand -base64 24 | tr -d "\n")
JWT_SECRET=$(openssl rand -base64 32 | tr -d "\n")
OCR_AZURE_ENDPOINT=${OCR_AZURE_ENDPOINT:-https://your-resource.cognitiveservices.azure.com}
OCR_AZURE_KEY=${OCR_AZURE_KEY:-your_azure_key}
OCR_AZURE_REGION=${OCR_AZURE_REGION:-}
OCR_AZURE_API_VERSION=${OCR_AZURE_API_VERSION:-v4.0}

sudo mkdir -p /var/lib/wp-logger/whatsapp-session
sudo chmod 700 /var/lib/wp-logger
sudo chown -R root:root /var/lib/wp-logger

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='whatsapp_user'" | grep -q 1; then
  printf "ALTER ROLE whatsapp_user WITH PASSWORD '%s';\n" "$DB_PASSWORD" | sudo -u postgres psql -v ON_ERROR_STOP=1
else
  printf "CREATE ROLE whatsapp_user LOGIN PASSWORD '%s';\n" "$DB_PASSWORD" | sudo -u postgres psql -v ON_ERROR_STOP=1
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='whatsapp_bot'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE whatsapp_bot OWNER TO whatsapp_user;"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE whatsapp_bot OWNER whatsapp_user;"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE whatsapp_bot TO whatsapp_user;"

echo "Writing backend .env..."
cat > /opt/wp-logger/backend/.env <<EOF
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_bot
DB_USER=whatsapp_user
DB_PASSWORD=${DB_PASSWORD}
DB_SSL=false
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
RP_ID=${PUBLIC_IP}
RP_NAME=WhatsApp Manager
RP_ORIGIN=http://${PUBLIC_IP}:5173
STORAGE_BASE_PATH=/var/lib/wp-logger
MAX_FILE_SIZE=104857600
ALLOWED_ORIGINS=http://${PUBLIC_IP}:5173,http://${PUBLIC_HOST}:5173,http://localhost:5173
WA_SESSION_PATH=/var/lib/wp-logger/whatsapp-session
WS_PORT=3001
OCR_ENABLED=true
OCR_PROVIDER=azure
OCR_FALLBACK_PROVIDER=
OCR_LANGUAGE=unk
OCR_CONCURRENCY=2
OCR_POLL_INTERVAL_MS=5000
OCR_MAX_ATTEMPTS=3
OCR_MAX_FILE_SIZE_MB=25
OCR_AZURE_ENDPOINT=${OCR_AZURE_ENDPOINT}
OCR_AZURE_KEY=${OCR_AZURE_KEY}
OCR_AZURE_REGION=${OCR_AZURE_REGION}
OCR_AZURE_API_VERSION=${OCR_AZURE_API_VERSION}
OCR_AZURE_POLL_INTERVAL_MS=1000
OCR_AZURE_MAX_POLLS=120
HISTORY_SYNC_ON_START=true
HISTORY_SYNC_INCLUDE_MEDIA=true
HISTORY_SYNC_MAX_MESSAGES=
EOF

echo "Writing frontend .env..."
cat > /opt/wp-logger/frontend/.env <<EOF
VITE_API_BASE_URL=http://${PUBLIC_IP}:3000/api/v1
VITE_WS_URL=ws://${PUBLIC_IP}:3000/ws
VITE_BASE_PATH=/
EOF

echo "Installing backend deps..."
cd /opt/wp-logger/backend
npm install

echo "Building backend..."
npm run build

echo "Running migrations..."
npm run migrate

echo "Installing frontend deps..."
cd /opt/wp-logger/frontend
npm install

echo "Building frontend..."
npm run build

echo "Starting services with pm2..."
pm2 delete whatsapp-bot || true
pm2 delete wp-logger-frontend || true
pm2 delete wp-logger-backend || true

cd /opt/wp-logger/backend
pm2 start ecosystem.config.js

cd /opt/wp-logger/frontend
pm2 serve dist 5173 --name wp-logger-frontend --spa
pm2 save
pm2 list

echo "Done. Frontend on :5173, Backend on :3000"
