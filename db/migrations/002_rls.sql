-- 002_rls.sql — Row Level Security. Apply after 001_init.sql.
-- Rule summary: students see only their own rows; teachers see rows for
-- courses they teach (plus their own profile); admins see everything.
-- The API uses its own JWTs, so these policies mainly protect direct
-- Supabase (PostgREST / client) access. The API itself connects with a
-- service-style connection and enforces roles in code (see backend/src/server.js).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_tests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles FOR ALL USING (id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS levels_read ON levels;
CREATE POLICY levels_read ON levels FOR SELECT USING (true);

DROP POLICY IF EXISTS courses_read ON courses;
CREATE POLICY courses_read ON courses FOR SELECT USING (is_published = true OR teacher_id = auth.uid() OR public.current_user_role() = 'admin');
DROP POLICY IF EXISTS courses_write ON courses;
CREATE POLICY courses_write ON courses FOR ALL USING (teacher_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS lessons_read ON lessons;
CREATE POLICY lessons_read ON lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses c WHERE c.id = lessons.course_id AND (c.is_published = true OR c.teacher_id = auth.uid()))
  OR public.current_user_role() = 'admin'
  OR EXISTS (SELECT 1 FROM enrolments e WHERE e.course_id = lessons.course_id AND e.student_id = auth.uid())
);

DROP POLICY IF EXISTS enrolments_self ON enrolments;
CREATE POLICY enrolments_self ON enrolments FOR ALL USING (student_id = auth.uid() OR public.current_user_role() = 'admin' OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrolments.course_id AND c.teacher_id = auth.uid()));

DROP POLICY IF EXISTS placement_self ON placement_results;
CREATE POLICY placement_self ON placement_results FOR ALL USING (student_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS assignments_read ON assignments;
CREATE POLICY assignments_read ON assignments FOR SELECT USING (teacher_id = auth.uid() OR public.current_user_role() = 'admin' OR EXISTS (SELECT 1 FROM enrolments e WHERE e.course_id = assignments.course_id AND e.student_id = auth.uid()));
DROP POLICY IF EXISTS assignments_write ON assignments;
CREATE POLICY assignments_write ON assignments FOR ALL USING (teacher_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS submissions_self ON submissions;
CREATE POLICY submissions_self ON submissions FOR ALL USING (student_id = auth.uid() OR public.current_user_role() = 'admin' OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid()));

DROP POLICY IF EXISTS grades_self ON grades;
CREATE POLICY grades_self ON grades FOR SELECT USING (student_id = auth.uid() OR public.current_user_role() = 'admin' OR EXISTS (SELECT 1 FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = grades.submission_id AND a.teacher_id = auth.uid()));

DROP POLICY IF EXISTS attendance_access ON attendance;
CREATE POLICY attendance_access ON attendance FOR ALL USING (student_id = auth.uid() OR public.current_user_role() = 'admin' OR EXISTS (SELECT 1 FROM courses c WHERE c.id = attendance.course_id AND c.teacher_id = auth.uid()));

DROP POLICY IF EXISTS announcements_read ON announcements;
CREATE POLICY announcements_read ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS announcements_write ON announcements;
CREATE POLICY announcements_write ON announcements FOR ALL USING (author_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS payments_self ON payments;
CREATE POLICY payments_self ON payments FOR ALL USING (student_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS placement_tests_read ON placement_tests;
CREATE POLICY placement_tests_read ON placement_tests FOR SELECT USING (true);
