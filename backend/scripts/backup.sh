#!/bin/bash

# WhatsApp Bot Database Backup Script
# Usage: ./backup.sh

# Load environment variables
set -a
source "$(dirname "$0")/../.env"
set +a

# Configuration
BACKUP_DIR="${STORAGE_BASE_PATH}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Database backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -Fc \
  "$DB_NAME" > "$BACKUP_DIR/db_backup_$DATE.dump"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "[$(date)] Database backup successful: db_backup_$DATE.dump"

    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/db_backup_$DATE.dump" | cut -f1)
    echo "[$(date)] Backup size: $BACKUP_SIZE"
else
    echo "[$(date)] ERROR: Database backup failed!"
    exit 1
fi

# Remove old backups
echo "[$(date)] Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -type f -name "*.dump" | wc -l)
echo "[$(date)] Total backups: $BACKUP_COUNT"

echo "[$(date)] Backup completed successfully!"

# Optional: Upload to remote storage (uncomment and configure)
# aws s3 cp "$BACKUP_DIR/db_backup_$DATE.dump" s3://your-bucket/backups/
# rclone copy "$BACKUP_DIR/db_backup_$DATE.dump" remote:backups/
