-- 007_submissions_unique.sql — one submission per (assignment, student).
--
-- Why: nothing stopped a student from POSTing the same assignment twice, which
-- created two rows. The student's own assignment list joins submissions, so the
-- homework appeared twice, and grading only ever touched one of the rows.
-- The API now upserts, and this index makes that the database's rule too.
--
-- Which duplicate survives: a graded row wins over an ungraded one (so marking
-- is not lost), and among equals the newest row wins. Deleting a submission
-- cascades to its grade row, so the kept row must be the graded one.

DELETE FROM submissions a
USING submissions b
WHERE a.assignment_id = b.assignment_id
  AND a.student_id = b.student_id
  AND (
    (a.grade IS NULL AND b.grade IS NOT NULL)
    OR ((a.grade IS NULL) = (b.grade IS NULL) AND a.created_at < b.created_at)
  );

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_student_unique
  ON submissions (assignment_id, student_id);
