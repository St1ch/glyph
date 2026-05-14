ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL AFTER created_at;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_preference ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system' AFTER verified_email_at,
  ADD COLUMN IF NOT EXISTS notifications_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER theme_preference,
  ADD COLUMN IF NOT EXISTS private_profile TINYINT(1) NOT NULL DEFAULT 0 AFTER notifications_enabled;

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY conversations_updated_idx (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  last_read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY conversation_members_user_idx (user_id, created_at),
  CONSTRAINT conversation_members_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT conversation_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  image_path VARCHAR(255) NULL,
  media_paths TEXT NULL,
  reply_to_message_id VARCHAR(36) NULL,
  forwarded_from_message_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  edited_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  deleted_for_all TINYINT(1) NOT NULL DEFAULT 0,
  KEY direct_messages_conversation_idx (conversation_id, created_at),
  KEY direct_messages_sender_idx (sender_user_id, created_at),
  KEY direct_messages_reply_idx (reply_to_message_id),
  KEY direct_messages_forward_idx (forwarded_from_message_id),
  CONSTRAINT direct_messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_sender_fk FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_reply_fk FOREIGN KEY (reply_to_message_id) REFERENCES direct_messages(id) ON DELETE SET NULL,
  CONSTRAINT direct_messages_forward_fk FOREIGN KEY (forwarded_from_message_id) REFERENCES direct_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS media_paths TEXT NULL AFTER image_path,
  ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(36) NULL AFTER image_path,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id VARCHAR(36) NULL AFTER reply_to_message_id,
  ADD COLUMN IF NOT EXISTS edited_at DATETIME(3) NULL AFTER created_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME(3) NULL AFTER edited_at,
  ADD COLUMN IF NOT EXISTS deleted_for_all TINYINT(1) NOT NULL DEFAULT 0 AFTER deleted_at;

CREATE TABLE IF NOT EXISTS direct_message_deletions (
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  deleted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (message_id, user_id),
  KEY direct_message_deletions_user_idx (user_id, deleted_at),
  CONSTRAINT direct_message_deletions_message_fk FOREIGN KEY (message_id) REFERENCES direct_messages(id) ON DELETE CASCADE,
  CONSTRAINT direct_message_deletions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
