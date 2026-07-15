-- Run this once against an existing local DB created before the Subject
-- Officer could originate letters. Fresh installs get this via schema.sql
-- directly and don't need it.
USE letter_management;

ALTER TABLE letters
  MODIFY status ENUM(
    'issued',
    'pending_minute',
    'minuted',
    'sent_to_subject',
    'with_subject_officer',
    'sent_to_relevant',
    'with_relevant_officer',
    'action_taken',
    'closed'
  ) NOT NULL DEFAULT 'issued';

ALTER TABLE letters
  ADD COLUMN created_by_role ENUM('dcs', 'subject_officer') NOT NULL DEFAULT 'dcs'
  AFTER relevant_officer_id;
