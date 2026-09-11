-- Drop the legacy generic ConfigEmail table.
-- Superseded by config_email_quotidien / config_email_hebdomadaire / config_email_mensuel,
-- which are the only tables actually populated and used by the application.
DROP TABLE IF EXISTS "config_email";
