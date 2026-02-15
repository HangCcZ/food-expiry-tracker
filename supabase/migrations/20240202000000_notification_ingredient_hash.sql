-- Add ingredient_hash to notification_log
-- This allows the AI recipe suggestion job to detect when a user's
-- expiring ingredient set hasn't changed, avoiding redundant notifications
-- and unnecessary OpenAI API calls.

ALTER TABLE notification_log ADD COLUMN ingredient_hash TEXT;

CREATE INDEX idx_notification_log_ingredient_hash
  ON notification_log(user_id, notification_type, ingredient_hash);
