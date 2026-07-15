-- Letter Management System schema
CREATE DATABASE IF NOT EXISTS letter_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE letter_management;

-- Officers who can be named as "subject officer" or "relevant officer" on a letter
CREATE TABLE IF NOT EXISTS officers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)      NOT NULL,
  email         VARCHAR(190)      NOT NULL,
  designation   VARCHAR(150)      NULL,
  division      VARCHAR(2)        NULL,
  active         TINYINT(1)       NOT NULL DEFAULT 1,
  created_at    TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_officers_email (email)
) ENGINE=InnoDB;

-- Small key/value store for singleton app configuration - currently just
-- which officers row is "the" permanent Subject Officer (see officers.controller.js).
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key    VARCHAR(50)  PRIMARY KEY,
  setting_value  VARCHAR(190) NULL
) ENGINE=InnoDB;

-- One row per division: the next number to issue (DCSP/{division}/{NNNNN}),
-- wrapping back to 00000 once it exceeds 99999. Not year-scoped - `year` is
-- kept only for bookkeeping, it no longer triggers a reset (numberService.js).
CREATE TABLE IF NOT EXISTS number_sequence (
  division        VARCHAR(2)   PRIMARY KEY,
  current_number  INT UNSIGNED NOT NULL DEFAULT 0,
  year            SMALLINT     NOT NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO number_sequence (division, current_number, year)
VALUES ('01', 0, YEAR(CURDATE())),
       ('02', 0, YEAR(CURDATE())),
       ('03', 0, YEAR(CURDATE()))
ON DUPLICATE KEY UPDATE division = division;

CREATE TABLE IF NOT EXISTS letters (
  id                            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  letter_number                 VARCHAR(30)  NOT NULL UNIQUE,
  division                      VARCHAR(2)   NOT NULL,
  subject                       VARCHAR(255) NULL,
  sender_name                   VARCHAR(190) NULL,
  received_date                 DATE         NULL,
  subject_officer_id            INT UNSIGNED NULL,
  relevant_officer_id           INT UNSIGNED NULL,
  created_by_role ENUM('dcs', 'subject_officer') NOT NULL DEFAULT 'dcs',
  status ENUM(
    'issued',                 -- number printed/reserved, no letter details yet
    'pending_review',         -- subject officer submitted it, awaiting DCS review
    'created',                -- DCS assigned officers, links emailed
    'sent_to_subject',        -- subject officer link sent, awaiting receipt
    'with_subject_officer',   -- subject officer marked it received
    'sent_to_relevant',       -- subject officer forwarded it on
    'with_relevant_officer',  -- relevant officer opened/received it
    'action_taken',           -- relevant officer recorded the action
    'closed'
  ) NOT NULL DEFAULT 'issued',
  subject_officer_received_at  DATETIME NULL,
  sent_to_relevant_at          DATETIME NULL,
  relevant_officer_received_at DATETIME NULL,
  action_taken_at              DATETIME NULL,
  action_notes                  TEXT     NULL,
  created_at                   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_letters_subject_officer
    FOREIGN KEY (subject_officer_id) REFERENCES officers(id),
  CONSTRAINT fk_letters_relevant_officer
    FOREIGN KEY (relevant_officer_id) REFERENCES officers(id),
  KEY idx_letters_division (division),
  KEY idx_letters_status (status)
) ENGINE=InnoDB;

-- Emailed, single-use links. token is the HMAC-signed value handed out;
-- used_at / expires_at let the server reject stale or replayed links even
-- if the signature still checks out.
CREATE TABLE IF NOT EXISTS links (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token         VARCHAR(255) NOT NULL UNIQUE,
  letter_id     INT UNSIGNED NOT NULL,
  officer_role  ENUM('subject', 'relevant') NOT NULL,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_links_letter FOREIGN KEY (letter_id) REFERENCES letters(id),
  KEY idx_links_letter (letter_id)
) ENGINE=InnoDB;

-- Audit trail of relevant-officer reassignments (see links.routes.js
-- POST /:token/reassign). letters.relevant_officer_id only ever holds the
-- *current* assignee, so this is the only record of who a letter passed
-- through before that - both the admin dashboard and the new assignee's
-- own link page (relevant-officer.html) read it to show the handoff
-- instead of a silently-changed name.
CREATE TABLE IF NOT EXISTS letter_reassignments (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  letter_id         INT UNSIGNED NOT NULL,
  from_officer_id   INT UNSIGNED NOT NULL,
  to_officer_id     INT UNSIGNED NOT NULL,
  note              TEXT NULL,
  reassigned_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reassign_letter FOREIGN KEY (letter_id) REFERENCES letters(id),
  CONSTRAINT fk_reassign_from FOREIGN KEY (from_officer_id) REFERENCES officers(id),
  CONSTRAINT fk_reassign_to FOREIGN KEY (to_officer_id) REFERENCES officers(id),
  KEY idx_reassign_letter (letter_id)
) ENGINE=InnoDB;
