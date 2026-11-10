-- 008_homework_questions.sql — homework that a teacher can build or attach.
--
-- A teacher now creates homework in one of two ways:
--   1. upload a file (PDF / PNG / JPEG / WebP), stored in assignment_files;
--   2. write questions himself (choose / complete / translate / short answer),
--      stored in assignments.questions.
--
-- Files live in Postgres rather than a public bucket on purpose: the API is the
-- only reader (GET /api/assignment-files/:id), so every download is checked
-- against the caller's role and course membership. There is no public URL.
--
-- questions shape (array, order = question order):
--   { id:'q1', type:'multiple_choice', prompt, options:[...], correct:0 }
--   { id:'q2', type:'fill_blank'|'translate', prompt, answers:[accepted...] }
--   { id:'q3', type:'short_answer', prompt }
-- Student-facing responses strip `correct` and `answers` in the API.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS assignment_files (
  assignment_id UUID PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_score INTEGER,
  ADD COLUMN IF NOT EXISTS auto_total INTEGER;

-- Only the API reads these rows; keep direct Supabase access closed.
ALTER TABLE assignment_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assignment_files_owner ON assignment_files;
CREATE POLICY assignment_files_owner ON assignment_files FOR ALL USING (
  public.current_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = assignment_files.assignment_id AND a.teacher_id = auth.uid()
  )
);
