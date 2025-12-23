-- Migration: Add chat_type column to groups table
-- This allows storing both group chats and private (DM) conversations

-- Add chat_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'groups' AND column_name = 'chat_type'
    ) THEN
        ALTER TABLE groups ADD COLUMN chat_type VARCHAR(20) DEFAULT 'group';
    END IF;
END $$;

-- Update existing records to have 'group' type
UPDATE groups SET chat_type = 'group' WHERE chat_type IS NULL;

-- Add constraint for valid chat types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'groups_chat_type_check' AND table_name = 'groups'
    ) THEN
        ALTER TABLE groups ADD CONSTRAINT groups_chat_type_check
        CHECK (chat_type IN ('group', 'private'));
    END IF;
END $$;

-- Create index for faster lookups by chat_type
CREATE INDEX IF NOT EXISTS idx_groups_chat_type ON groups(chat_type);

-- Update media_type constraint to include new types
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE media DROP CONSTRAINT IF EXISTS media_media_type_check;

    -- Add new constraint with additional types
    ALTER TABLE media ADD CONSTRAINT media_media_type_check
    CHECK (media_type IN ('image', 'video', 'audio', 'document', 'sticker', 'voice'));
END $$;

-- Add index for media lookups
CREATE INDEX IF NOT EXISTS idx_media_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_has_media ON messages(has_media) WHERE has_media = true;
