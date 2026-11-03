// Exercises every PgStore method against a throwaway schema in the live
// database, so the Postgres SQL path is actually executed. The schema is
// created and dropped by this script; nothing in `public` is touched.
import pg from 'pg';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PgStore } = require('./src/db.js');

const SCHEMA = 'smoke_test';
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sandbox = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  options: `-c search_path=${SCHEMA},public`,
});

const checks = [];
const check = (name, cond, detail) => checks.push({ name, ok: !!cond, detail });

try {
  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);

  for (const f of ['001_init.sql', '004_booking_requests.sql', '005_fixes.sql']) {
    await sandbox.query(fs.readFileSync(new URL('../../db/migrations/' + f, import.meta.url), 'utf8'));
  }
  const where = await sandbox.query(`SELECT table_schema FROM information_schema.tables WHERE table_name='profiles'`);
  check('sandbox isolation (profiles not in public)', where.rows.length === 1 && where.rows[0].table_schema === SCHEMA, JSON.stringify(where.rows));

  const s = new PgStore(sandbox);

  // users
  const teacher = await s.createUser({ email: 'T@test.local', full_name: 'Teacher', role: 'teacher', password_hash: 'x' });
  const student = await s.createUser({ email: 's@test.local', full_name: 'Student One', role: 'student', password_hash: 'x' });
  check('createUser lowercases email', teacher.email === 't@test.local', teacher.email);
  check('findUserByEmail', (await s.findUserByEmail('s@test.local')).id === student.id);
  check('getUser', (await s.getUser(student.id)).id === student.id);
  check('listUsers omits password_hash', !('password_hash' in (await s.listUsers())[0]));
  check('updateUser', (await s.updateUser(student.id, { phone: '0599' })).phone === '0599');

  // levels / courses
  await sandbox.query(`INSERT INTO levels (code,name_en,name_ar,order_no) VALUES ('B1','Intermediate','متوسط',1)`);
  const level = (await s.listLevels())[0];
  check('listLevels', level && level.code === 'B1');
  const course = await s.createCourse({ slug: 'course-one', level_id: level.id, title_en: 'Course One', is_published: true, teacher_id: teacher.id });
  check('createCourse', course.slug === 'course-one' && course.is_published === true);
  check('listCourses', (await s.listCourses()).length === 1);
  check('getCourse by uuid', (await s.getCourse(course.id)).id === course.id);
  check('getCourse by slug', (await s.getCourse('course-one')).id === course.id);
  const updated = await s.updateCourse(course.id, { title_en: 'Course One (renamed)' });
  check('updateCourse', updated.title_en === 'Course One (renamed)');

  // lessons
  await s.createLesson({ course_id: course.id, title_en: 'Lesson 1', order_no: 1 });
  await s.createLesson({ course_id: course.id, title_en: 'Lesson 2', order_no: 2 });
  check('listLessons ordered', (await s.listLessons(course.id)).map(l => l.title_en).join(',') === 'Lesson 1,Lesson 2');

  // enrolments
  check('isEnrolled false before', (await s.isEnrolled(student.id, course.id)) === false);
  await s.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  check('isEnrolled true after', (await s.isEnrolled(student.id, course.id)) === true);
  let dupErr = null;
  try { await s.createEnrolment({ student_id: student.id, course_id: course.id, status: 'pending' }); } catch (e) { dupErr = e; }
  check('duplicate enrolment hits unique constraint', dupErr && dupErr.code === '23505', dupErr && dupErr.code);
  check('listLessonsForStudent joins enrolments', (await s.listLessonsForStudent(student.id)).length === 2);
  check('listLessonsForTeacher joins courses', (await s.listLessonsForTeacher(teacher.id)).length === 2);
  const enrAll = await s.listEnrolmentsAll();
  check('listEnrolmentsAll has student_name', enrAll[0] && enrAll[0].student_name === 'Student One');
  check('listEnrolmentsAll(teacherId) scope', (await s.listEnrolmentsAll(teacher.id)).length === 1);
  check('listEnrolmentsForUser', (await s.listEnrolmentsForUser(student.id)).length === 1);

  // placement
  const placement = await s.createPlacement({ student_id: student.id, score: 18, total: 20, recommended_level: 'C1', answers: [1, 0] });
  check('createPlacement returns C1', placement.recommended_level === 'C1');
  check('listPlacementsForUser', (await s.listPlacementsForUser(student.id)).length === 1);

  // assignments / submissions / grades
  const asg = await s.createAssignment({ course_id: course.id, teacher_id: teacher.id, title: 'Essay' });
  check('getAssignment', (await s.getAssignment(asg.id)).title === 'Essay');
  check('listAssignmentsForTeacher', (await s.listAssignmentsForTeacher(teacher.id)).length === 1);
  const forStudent = await s.listAssignmentsForStudent(student.id);
  check('listAssignmentsForStudent shows null submission', forStudent.length === 1 && forStudent[0].submission === null, JSON.stringify(forStudent[0] && forStudent[0].submission));
  const sub = await s.createSubmission({ assignment_id: asg.id, student_id: student.id, content_text: 'hello' });
  const afterSubmit = await s.listAssignmentsForStudent(student.id);
  check('listAssignmentsForStudent maps submission', afterSubmit[0].submission && afterSubmit[0].submission.id === sub.id);
  check('getSubmission', (await s.getSubmission(sub.id)).id === sub.id);
  const subs = await s.listSubmissions(null, teacher.id);
  check('listSubmissions has student_name', subs[0] && subs[0].student_name === 'Student One');
  check('listSubmissions scoped by assignment', (await s.listSubmissions(asg.id, null)).length === 1);

  await s.gradeSubmission(sub.id, 70, 'ok');
  await s.gradeSubmission(sub.id, 95, 'better');
  const gradeRows = await sandbox.query('SELECT score FROM grades WHERE submission_id=$1', [sub.id]);
  check('re-grading upserts one row', gradeRows.rows.length === 1 && Number(gradeRows.rows[0].score) === 95, JSON.stringify(gradeRows.rows));

  // attendance
  await s.createAttendance({ course_id: course.id, student_id: student.id, status: 'present', attended_on: '2026-11-03' });
  check('listAttendance default date', (await s.listAttendance()).length === 1);
  check('listAttendance scoped by teacher', (await s.listAttendance(null, teacher.id)).length === 1);
  check('listAttendance foreign teacher empty', (await s.listAttendance(null, teacher.id === 'x' ? teacher.id : (await s.createUser({ email: 'other@test.local', full_name: 'Other', role: 'teacher', password_hash: 'x' })).id)).length === 0);
  check('listAttendanceForUser', (await s.listAttendanceForUser(student.id)).length === 1);

  // announcements
  await s.createAnnouncement({ author_id: teacher.id, title: 'Hi', body: 'Body', audience: 'students' });
  check('listAnnouncements', (await s.listAnnouncements()).length === 1);

  // booking requests (the 005 email column)
  const booking = await s.createBookingRequest({ full_name: 'Lead', email: 'lead@test.local', phone: '0599', course: 'Course One', source: 'instagram', message: 'hi' });
  check('createBookingRequest stores email', booking.email === 'lead@test.local', JSON.stringify(booking));
  check('listBookingRequests', (await s.listBookingRequests()).length === 1);
  check('updateBookingRequest', (await s.updateBookingRequest(booking.id, 'confirmed')).status === 'confirmed');

  // payments
  await s.createPayment({ student_id: student.id, course_id: course.id, amount: 0, currency: 'ILS' });
  const pay = (await s.listPaymentsAll())[0];
  check('createPayment keeps amount 0 (not null)', pay.amount !== null && Number(pay.amount) === 0, String(pay.amount));
  check('listPaymentsForUser', (await s.listPaymentsForUser(student.id)).length === 1);

  // deletes
  const delCourse = await s.createCourse({ slug: 'to-delete', title_en: 'X', is_published: false });
  check('deleteCourse', (await s.deleteCourse(delCourse.id)) === true);
} finally {
  try { await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`); } catch (e) { console.error('cleanup failed:', e.message); }
  await sandbox.end(); await admin.end();
}

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok ? '' : '  [' + c.detail + ']'));
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' Postgres checks passed');
process.exit(failed.length ? 1 : 0);
