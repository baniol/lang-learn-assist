-- Seed development user (DEV_USER_ID)
-- This user is used during development when auth is disabled

INSERT INTO users (id, email, email_verified, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@localhost',
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Default settings for dev user
INSERT INTO user_settings (user_id, source_language, active_target_language)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'en',
    'de'
) ON CONFLICT (user_id) DO NOTHING;

-- Add German as target language
INSERT INTO user_languages (user_id, target_language, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'de',
    TRUE
) ON CONFLICT (user_id, target_language) DO NOTHING;
