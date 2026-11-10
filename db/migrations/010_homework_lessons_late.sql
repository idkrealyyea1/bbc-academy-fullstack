-- Two small additions the homework flow now relies on:
--  * assignments.lesson_id — homework can belong to one lesson, so a lesson
--    page shows its own work instead of the whole course's.
--  * submissions.submitted_late — decided when the work arrives, so moving the
--    due date later does not quietly turn a late submission into an on-time one.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_lesson ON assignments(lesson_id);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_late boolean NOT NULL DEFAULT false;
