CREATE DATABASE IF NOT EXISTS paginaauto
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE paginaauto;

CREATE TABLE IF NOT EXISTS previews (
  id           VARCHAR(64)  PRIMARY KEY,
  source       VARCHAR(16)  NOT NULL,
  status       VARCHAR(24)  NOT NULL DEFAULT 'pending',
  priority     VARCHAR(16)  NOT NULL DEFAULT 'medium',
  file         VARCHAR(512),
  line         INT,
  message      TEXT,
  stack        MEDIUMTEXT,
  diagnosis    MEDIUMTEXT,
  original     LONGTEXT,
  fixed        LONGTEXT,
  diff         LONGTEXT,
  validation   TEXT,
  backup_path  VARCHAR(512),
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id         VARCHAR(64)  PRIMARY KEY,
  date       DATE         NOT NULL,
  text       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
  role       VARCHAR(32)  NOT NULL,
  content    MEDIUMTEXT   NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB;
