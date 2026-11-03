-- 005_usernames.sql — BBC English Academy
-- Adds an optional username for login (teachers sign in with username).
-- Run this in Supabase SQL Editor BEFORE deploying code that writes
-- usernames, otherwise teacher creation will fail on Postgres.
-- A unique index (not a UNIQUE column constraint) allows many NULLs,
-- so existing users without a username are unaffected.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles (username);
