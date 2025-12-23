# wp-logger

WhatsApp message logger with a web UI, WebAuthn authentication, real-time updates,
and media downloads.

## Features
- Logs group chats and DMs with message metadata.
- Backfills message history on startup (configurable).
- Stores media (images, video, audio, documents) with download support.
- Web UI with search, filters, and WebSocket updates.

## Project Structure
- `backend/` Node.js/Express API + WhatsApp client + PostgreSQL storage
- `frontend/` Vite/React UI

## Requirements
- Node.js 18+
- PostgreSQL 13+
- WhatsApp account for the Web client session

## Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

For production:
```bash
npm run build
npm start
```

## Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Build static assets:
```bash
npm run build
```

## History Sync
History sync runs when WhatsApp becomes ready. Configure it in `backend/.env`:
- `HISTORY_SYNC_ON_START=true|false`
- `HISTORY_SYNC_INCLUDE_MEDIA=true|false`
- `HISTORY_SYNC_MAX_MESSAGES=` (empty for all available)

## Media Storage
Media is stored under `STORAGE_BASE_PATH` (see `backend/.env`). Thumbnails are
generated for images and videos. Downloads are served via `/api/v1/media/:id`.

## Deployment Notes
- `backend/ecosystem.config.js` can be used with PM2.
- `frontend/nginx.conf` provides a sample Nginx config.
- Set `RP_ID` and `RP_ORIGIN` for WebAuthn in production.

