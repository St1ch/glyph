CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  handle VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  bio TEXT NOT NULL,
  avatar_type ENUM('emoji', 'image') NOT NULL,
  avatar_value VARCHAR(255) NOT NULL,
  cover_image VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  verified_email_at DATETIME(3) NULL,
  theme_preference ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
  notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  private_profile TINYINT(1) NOT NULL DEFAULT 0,
  verification_status ENUM('none', 'pending', 'approved') NOT NULL DEFAULT 'none'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS groups_clans (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  avatar_type ENUM('emoji', 'image') NOT NULL,
  avatar_value VARCHAR(255) NOT NULL,
  cover_image VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id VARCHAR(36) NOT NULL,
  following_user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (follower_user_id, following_user_id),
  CONSTRAINT follows_follower_fk FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_following_fk FOREIGN KEY (following_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_members (
  group_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_members_group_fk FOREIGN KEY (group_id) REFERENCES groups_clans(id) ON DELETE CASCADE,
  CONSTRAINT group_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) PRIMARY KEY,
  author_type ENUM('user', 'group') NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  image_path VARCHAR(255) NULL,
  repost_of_post_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  KEY posts_author_idx (author_type, author_id),
  KEY posts_created_at_idx (created_at),
  KEY posts_repost_idx (repost_of_post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_likes (
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_likes_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_likes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  image_path VARCHAR(255) NULL,
  parent_comment_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  KEY comments_post_idx (post_id, created_at),
  KEY comments_user_idx (user_id, created_at),
  KEY comments_parent_idx (parent_comment_id),
  CONSTRAINT comments_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT comments_parent_fk FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS polls (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL UNIQUE,
  question VARCHAR(500) NOT NULL,
  CONSTRAINT polls_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_options (
  id VARCHAR(36) PRIMARY KEY,
  poll_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  CONSTRAINT poll_options_poll_fk FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_votes (
  option_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (option_id, user_id),
  CONSTRAINT poll_votes_option_fk FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
  CONSTRAINT poll_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  link VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  KEY notifications_user_idx (user_id, created_at),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_reports (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  reporter_user_id VARCHAR(36) NOT NULL,
  category ENUM('spam', 'abuse', 'adult', 'violence', 'misinformation', 'other') NOT NULL DEFAULT 'other',
  details TEXT NULL,
  status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL,
  reviewed_at DATETIME(3) NULL,
  UNIQUE KEY post_reports_unique_reporter_idx (post_id, reporter_user_id),
  KEY post_reports_status_idx (status, created_at),
  CONSTRAINT post_reports_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_reports_reporter_fk FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY sessions_user_idx (user_id),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_tokens (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  email VARCHAR(190) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY verification_tokens_user_idx (user_id),
  CONSTRAINT verification_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  reason TEXT NOT NULL,
  consent TINYINT(1) NOT NULL,
  video_path VARCHAR(255) NOT NULL,
  submitted_at DATETIME(3) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  KEY verification_requests_user_idx (user_id, submitted_at),
  CONSTRAINT verification_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  KEY password_reset_tokens_user_idx (user_id, created_at),
  CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mail_previews (
  id VARCHAR(36) PRIMARY KEY,
  email_to VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  link VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY mail_previews_email_idx (email_to, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
