-- Add chat_type and sync metadata for DM support
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS chat_type VARCHAR(10) NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_chat_type'
  ) THEN
    ALTER TABLE groups
      ADD CONSTRAINT valid_chat_type CHECK (chat_type IN ('group', 'dm'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_groups_chat_type ON groups(chat_type);
