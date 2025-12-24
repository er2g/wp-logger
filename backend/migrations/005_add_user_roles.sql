-- Add role and password hash to users

ALTER TABLE users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN password_hash TEXT;

ALTER TABLE users
  ADD CONSTRAINT valid_user_role CHECK (role IN ('admin', 'user'));

CREATE INDEX idx_users_role ON users(role);

-- Promote default admin username if present
UPDATE users
SET role = 'admin'
WHERE username = 'admin';
