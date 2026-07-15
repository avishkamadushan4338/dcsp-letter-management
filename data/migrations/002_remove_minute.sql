-- Removes the free-text "Minute" note from the system entirely, and renames
-- the two status values that referenced it. Run this once against an
-- existing DB. Fresh installs get this via schema.sql directly.
USE letter_management;

ALTER TABLE letters DROP COLUMN minute_text;

-- No existing rows use 'minuted' or 'pending_minute' at the time this was
-- written, so this is a plain label rename, not a data migration.
ALTER TABLE letters
  MODIFY status ENUM(
    'issued',
    'pending_review',
    'created',
    'sent_to_subject',
    'with_subject_officer',
    'sent_to_relevant',
    'with_relevant_officer',
    'action_taken',
    'closed'
  ) NOT NULL DEFAULT 'issued';
