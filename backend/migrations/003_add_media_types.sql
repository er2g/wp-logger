-- Expand media type constraint to include voice and sticker
ALTER TABLE media DROP CONSTRAINT IF EXISTS valid_media_type;

ALTER TABLE media
  ADD CONSTRAINT valid_media_type CHECK (media_type IN (
    'image', 'video', 'audio', 'document', 'voice', 'sticker'
  ));

COMMENT ON COLUMN media.media_type IS 'Category: image, video, audio, document, voice, sticker';
