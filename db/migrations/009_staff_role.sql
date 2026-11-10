-- Staff: the people who keep student records. A staff account creates and
-- edits students, sets their usernames and passwords, and manages which
-- courses they are enrolled in. Staff cannot manage teachers, courses,
-- bookings or other staff — that stays with the admin.
--
-- ADD VALUE cannot be rolled back, so this file is safe to run once and
-- re-running it is a no-op (IF NOT EXISTS).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

INSERT INTO roles (name, description) VALUES
  ('staff', 'Student records: accounts, usernames, passwords and course enrolments')
ON CONFLICT (name) DO NOTHING;
