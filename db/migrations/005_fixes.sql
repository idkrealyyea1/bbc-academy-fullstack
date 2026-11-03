-- 005_fixes.sql — apply after 001-004.
-- 1) Booking requests now keep the applicant's email.
-- 2) One grade row per submission (re-grading updates the row).
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS email TEXT;

-- Keep the newest row for each submission before adding the unique key.
DELETE FROM grades a USING grades b
WHERE a.submission_id = b.submission_id AND a.ctid < b.ctid;

ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_submission_unique;
ALTER TABLE grades ADD CONSTRAINT grades_submission_unique UNIQUE (submission_id);
