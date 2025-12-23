-- WhatsApp Bot Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- ============================================================================
-- WebAuthn Credentials Table
-- ============================================================================
CREATE TABLE webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT DEFAULT 0,
    transports TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE,
    CONSTRAINT counter_positive CHECK (counter >= 0)
);

-- ============================================================================
-- WhatsApp Groups Table
-- ============================================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_monitored BOOLEAN DEFAULT false,
    participant_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT participant_count_positive CHECK (participant_count >= 0)
);

-- ============================================================================
-- Messages Table
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(255) UNIQUE NOT NULL,
    sender_name VARCHAR(255),
    sender_number VARCHAR(50),
    content TEXT,
    message_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_forwarded BOOLEAN DEFAULT false,
    has_media BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_message_type CHECK (message_type IN (
        'text', 'image', 'video', 'audio', 'document',
        'sticker', 'location', 'contact', 'voice', 'ptt'
    ))
);

-- ============================================================================
-- Media Files Table
-- ============================================================================
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    media_type VARCHAR(50) NOT NULL,
    thumbnail_path TEXT,
    duration INTEGER,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_media_type CHECK (media_type IN (
        'image', 'video', 'audio', 'document'
    )),
    CONSTRAINT file_size_positive CHECK (file_size > 0),
    CONSTRAINT duration_positive CHECK (duration IS NULL OR duration > 0),
    CONSTRAINT dimensions_positive CHECK (
        (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
    )
);

-- ============================================================================
-- Activity Logs Table
-- ============================================================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Bot Status Table
-- ============================================================================
CREATE TABLE bot_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_connected BOOLEAN DEFAULT false,
    qr_code TEXT,
    last_connected TIMESTAMP WITH TIME ZONE,
    last_disconnected TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize bot_status with single row
INSERT INTO bot_status (id, is_connected) VALUES (1, false);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- WebAuthn credentials indexes
CREATE INDEX idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential_id ON webauthn_credentials(credential_id);

-- Groups indexes
CREATE INDEX idx_groups_whatsapp_id ON groups(whatsapp_id);
CREATE INDEX idx_groups_monitored ON groups(is_monitored) WHERE is_monitored = true;
CREATE INDEX idx_groups_last_message ON groups(last_message_at DESC NULLS LAST);

-- Messages indexes
CREATE INDEX idx_messages_group_id ON messages(group_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX idx_messages_sender ON messages(sender_number);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Media indexes
CREATE INDEX idx_media_message_id ON media(message_id);
CREATE INDEX idx_media_group_id ON media(group_id);
CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_created ON media(created_at DESC);
CREATE INDEX idx_media_mime_type ON media(mime_type);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- ============================================================================
-- Full-Text Search
-- ============================================================================

-- Full-text search for message content
CREATE INDEX idx_messages_content_search ON messages
USING gin(to_tsvector('english', COALESCE(content, '')));

-- Full-text search for group names
CREATE INDEX idx_groups_name_search ON groups
USING gin(to_tsvector('english', name));

-- ============================================================================
-- Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for groups table
CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON groups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for bot_status table
CREATE TRIGGER update_bot_status_updated_at
BEFORE UPDATE ON bot_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to update group's last_message_at
CREATE OR REPLACE FUNCTION update_group_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE groups
    SET last_message_at = NEW.timestamp
    WHERE id = NEW.group_id
    AND (last_message_at IS NULL OR last_message_at < NEW.timestamp);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update group's last message timestamp
CREATE TRIGGER update_group_last_message_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_group_last_message();

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View for recent messages with group info
CREATE VIEW recent_messages_view AS
SELECT
    m.id,
    m.whatsapp_message_id,
    m.content,
    m.message_type,
    m.timestamp,
    m.sender_name,
    m.sender_number,
    m.is_forwarded,
    m.has_media,
    g.id as group_id,
    g.name as group_name,
    g.whatsapp_id as group_whatsapp_id
FROM messages m
JOIN groups g ON m.group_id = g.id
ORDER BY m.timestamp DESC;

-- View for media files with message and group info
CREATE VIEW media_with_context_view AS
SELECT
    md.id,
    md.file_name,
    md.file_path,
    md.file_size,
    md.mime_type,
    md.media_type,
    md.thumbnail_path,
    md.duration,
    md.width,
    md.height,
    md.created_at,
    m.whatsapp_message_id,
    m.sender_name,
    m.timestamp as message_timestamp,
    g.id as group_id,
    g.name as group_name
FROM media md
JOIN messages m ON md.message_id = m.id
JOIN groups g ON md.group_id = g.id
ORDER BY md.created_at DESC;

-- View for group statistics
CREATE VIEW group_stats_view AS
SELECT
    g.id,
    g.name,
    g.whatsapp_id,
    g.is_monitored,
    g.participant_count,
    g.last_message_at,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT CASE WHEN m.has_media THEN m.id END) as messages_with_media,
    COUNT(DISTINCT md.id) as total_media_files,
    COALESCE(SUM(md.file_size), 0) as total_storage_bytes
FROM groups g
LEFT JOIN messages m ON g.id = m.group_id
LEFT JOIN media md ON g.id = md.group_id
GROUP BY g.id, g.name, g.whatsapp_id, g.is_monitored, g.participant_count, g.last_message_at;

-- ============================================================================
-- Functions for Statistics
-- ============================================================================

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
    total_messages BIGINT,
    total_media_files BIGINT,
    total_storage_bytes BIGINT,
    active_groups INTEGER,
    messages_today BIGINT,
    messages_this_week BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM messages)::BIGINT,
        (SELECT COUNT(*) FROM media)::BIGINT,
        (SELECT COALESCE(SUM(file_size), 0) FROM media)::BIGINT,
        (SELECT COUNT(*)::INTEGER FROM groups WHERE is_monitored = true),
        (SELECT COUNT(*)::BIGINT FROM messages WHERE timestamp >= CURRENT_DATE),
        (SELECT COUNT(*)::BIGINT FROM messages WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE users IS 'Application users with WebAuthn authentication';
COMMENT ON TABLE webauthn_credentials IS 'WebAuthn passkey credentials for passwordless authentication';
COMMENT ON TABLE groups IS 'WhatsApp groups being monitored';
COMMENT ON TABLE messages IS 'All messages from monitored WhatsApp groups';
COMMENT ON TABLE media IS 'Media files (images, videos, audio, documents) from messages';
COMMENT ON TABLE activity_logs IS 'Audit log of user actions';
COMMENT ON TABLE bot_status IS 'Current status of the WhatsApp bot (singleton table)';

COMMENT ON COLUMN messages.message_type IS 'Type: text, image, video, audio, document, sticker, location, contact, voice, ptt';
COMMENT ON COLUMN media.media_type IS 'Category: image, video, audio, document';
COMMENT ON COLUMN webauthn_credentials.counter IS 'Signature counter for replay attack prevention';

-- ============================================================================
-- Grant Permissions (adjust username as needed)
-- ============================================================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO whatsapp_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO whatsapp_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO whatsapp_user;
