const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { app, store } = require('../src/server');

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function makeUser(role, email) {
  return store.createUser({
    email,
    full_name: `Test ${role}`,
    role,
    password_hash: await bcrypt.hash('Password1!', 10),
  });
}

async function login(email) {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1!' } });
  assert.equal(r.status, 200);
  return r.data.token;
}

test('public registration cannot create a teacher', async () => {
  const r = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'sneaky@test.local', password: 'Password1!', full_name: 'Sneaky', role: 'teacher' },
  });
  assert.equal(r.status, 403);
});

test('a student cannot enrol in the same course twice', async () => {
  const student = await makeUser('student', 'twice@test.local');
  const token = await login(student.email);
  const course = store.courses[0];
  const first = await call('/api/enrolments', { method: 'POST', token, body: { course_id: course.id } });
  const second = await call('/api/enrolments', { method: 'POST', token, body: { course_id: course.id } });
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
});

test('grading the same submission twice keeps one grade row', async () => {
  const teacher = await makeUser('teacher', 'grader@test.local');
  const student = await makeUser('student', 'graded@test.local');
  const course = await store.createCourse({ slug: 'grade-course', title_en: 'Grade course', is_published: true, teacher_id: teacher.id });
  const assignment = await store.createAssignment({ course_id: course.id, teacher_id: teacher.id, title: 'Essay' });
  const submission = await store.createSubmission({ assignment_id: assignment.id, student_id: student.id, content_text: 'Hello' });
  const token = await login(teacher.email);
  const first = await call(`/api/submissions/${submission.id}/grade`, { method: 'POST', token, body: { grade: 70, feedback: 'Good' } });
  const second = await call(`/api/submissions/${submission.id}/grade`, { method: 'POST', token, body: { grade: 90, feedback: 'Better' } });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(store.grades.filter(g => g.submission_id === submission.id).length, 1);
  assert.equal(store.grades.find(g => g.submission_id === submission.id).score, 90);
});

test('a student answering twice edits one submission instead of adding another', async () => {
  const teacher = await makeUser('teacher', 'resub-teacher@test.local');
  const student = await makeUser('student', 'resub@test.local');
  const course = await store.createCourse({ slug: 'resub-course', title_en: 'Resub course', is_published: true, teacher_id: teacher.id });
  const assignment = await store.createAssignment({ course_id: course.id, teacher_id: teacher.id, title: 'Essay' });
  await store.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  const token = await login(student.email);
  const first = await call('/api/submissions', { method: 'POST', token, body: { assignment_id: assignment.id, content_text: 'First try' } });
  const second = await call('/api/submissions', { method: 'POST', token, body: { assignment_id: assignment.id, content_text: 'Second try' } });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.data.submission.id, second.data.submission.id);
  assert.equal(store.submissions.filter(s => s.assignment_id === assignment.id && s.student_id === student.id).length, 1);

  // The revised answer has not been marked yet, and the student's list shows it once.
  const teacherToken = await login(teacher.email);
  assert.equal((await call(`/api/submissions/${second.data.submission.id}/grade`, { method: 'POST', token: teacherToken, body: { grade: 80 } })).status, 200);
  const again = await call('/api/submissions', { method: 'POST', token, body: { assignment_id: assignment.id, content_text: 'Third try' } });
  assert.equal(again.status, 200);
  assert.equal(again.data.submission.grade, null);
  const list = await call('/api/assignments', { token });
  const mine = list.data.assignments.filter(a => a.id === assignment.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].submission.content_text, 'Third try');
});

test('placement test scores 20 answers on the server', async () => {
  const student = await makeUser('student', 'placement@test.local');
  const token = await login(student.email);
  const perfect = await call('/api/placement-tests', { method: 'POST', token, body: { answers: [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 2, 1, 1, 1, 0, 1, 1] } });
  const zero = await call('/api/placement-tests', { method: 'POST', token, body: { answers: Array(20).fill(2) } });
  assert.equal(perfect.status, 201);
  assert.equal(perfect.data.result.score, 20);
  assert.equal(perfect.data.result.recommended_level, 'C2');
  assert.equal(zero.status, 201);
  assert.equal(zero.data.result.recommended_level, 'A1');
});

test('unpublished courses are hidden from the public but visible to admins', async () => {
  const admin = await makeUser('admin', 'admin@test.local');
  const token = await login(admin.email);
  const draft = await store.createCourse({ slug: 'draft-course', title_en: 'Draft', is_published: false });
  const pub = await call('/api/courses');
  const all = await call('/api/courses?all=1', { token });
  assert.equal(pub.data.courses.some(c => c.id === draft.id), false);
  assert.equal(all.data.courses.some(c => c.id === draft.id), true);
});

test('lessons need a login and booking requests keep the email', async () => {
  const lessons = await call('/api/lessons');
  assert.equal(lessons.status, 401);
  const booking = await call('/api/booking-requests', {
    method: 'POST',
    body: { full_name: 'Lead', email: 'lead@test.local', phone: '0599000000' },
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.data.booking_request.email, 'lead@test.local');
});

test('a user can change their own password and the new one works', async () => {
  const user = await makeUser('student', 'pw@test.local');
  const token = await login(user.email);
  const wrong = await call('/api/profile/password', { method: 'POST', token, body: { current_password: 'nope', new_password: 'NewPass99!' } });
  assert.equal(wrong.status, 401);
  const okRes = await call('/api/profile/password', { method: 'POST', token, body: { current_password: 'Password1!', new_password: 'NewPass99!' } });
  assert.equal(okRes.status, 200);
  const oldLogin = await call('/api/auth/login', { method: 'POST', body: { email: user.email, password: 'Password1!' } });
  const newLogin = await call('/api/auth/login', { method: 'POST', body: { email: user.email, password: 'NewPass99!' } });
  assert.equal(oldLogin.status, 401);
  assert.equal(newLogin.status, 200);
});

test('an admin can change a role and reset a password, but not demote themselves', async () => {
  const admin = await makeUser('admin', 'boss@test.local');
  const token = await login(admin.email);
  const student = await makeUser('student', 'promote@test.local');
  const promoted = await call('/api/admin/users/' + student.id, { method: 'PUT', token, body: { role: 'teacher' } });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.user.role, 'teacher');
  const reset = await call('/api/admin/users/' + student.id, { method: 'PUT', token, body: { password: 'Reset123!' } });
  assert.equal(reset.status, 200);
  const relogin = await call('/api/auth/login', { method: 'POST', body: { email: student.email, password: 'Reset123!' } });
  assert.equal(relogin.status, 200);
  const selfDemote = await call('/api/admin/users/' + admin.id, { method: 'PUT', token, body: { role: 'student' } });
  assert.equal(selfDemote.status, 400);
});

test('attendance without a date is stamped in the academy time zone', async () => {
  const teacher = await makeUser('teacher', 'att@test.local');
  const student = await makeUser('student', 'att-student@test.local');
  const course = await store.createCourse({ slug: 'att-course', title_en: 'Attendance', is_published: true, teacher_id: teacher.id });
  const token = await login(teacher.email);
  const res = await call('/api/attendance', { method: 'POST', token, body: { course_id: course.id, student_id: student.id, status: 'present' } });
  assert.equal(res.status, 201);
  assert.match(res.data.attendance.attended_on, /^\d{4}-\d{2}-\d{2}$/);
  const expected = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.ACADEMY_TIMEZONE || 'Asia/Gaza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert.equal(res.data.attendance.attended_on, expected);
  const bad = await call('/api/attendance', { method: 'POST', token, body: { course_id: course.id, student_id: student.id, attended_on: '03/11/2026' } });
  assert.equal(bad.status, 400);
});

test('only an admin can move a course to another teacher', async () => {
  const admin = await makeUser('admin', 'mover@test.local');
  const teacherA = await makeUser('teacher', 'ta@test.local');
  const teacherB = await makeUser('teacher', 'tb@test.local');
  const course = await store.createCourse({ slug: 'move-course', title_en: 'Move', is_published: true, teacher_id: teacherA.id });
  const adminToken = await login(admin.email);
  const teacherToken = await login(teacherA.email);

  const hijack = await call('/api/courses/' + course.id, { method: 'PUT', token: teacherToken, body: { teacher_id: teacherB.id } });
  assert.equal(hijack.status, 403);

  const missing = await call('/api/courses/' + course.id, { method: 'PUT', token: adminToken, body: { teacher_id: 'not-a-user' } });
  assert.equal(missing.status, 400);

  const moved = await call('/api/courses/' + course.id, { method: 'PUT', token: adminToken, body: { teacher_id: teacherB.id } });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.course.teacher_id, teacherB.id);
});

test('teachers can be created with a username and sign in with it', async () => {
  const admin = await makeUser('admin', 'uname-admin@test.local');
  const token = await login(admin.email);
  const created = await call('/api/admin/users', { method: 'POST', token, body: {
    email: 'uname.teacher@test.local', username: 'Mr_Sami', password: 'Password1!', full_name: 'Sami', role: 'teacher',
  }});
  assert.equal(created.status, 201);
  assert.equal(created.data.user.username, 'mr_sami');

  const byUsername = await call('/api/auth/login', { method: 'POST', body: { username: 'mr_sami', password: 'Password1!' } });
  assert.equal(byUsername.status, 200);
  const bare = await call('/api/auth/login', { method: 'POST', body: { email: 'mr_sami', password: 'Password1!' } });
  const byEmail = await call('/api/auth/login', { method: 'POST', body: { email: 'uname.teacher@test.local', password: 'Password1!' } });
  assert.equal(bare.status, 200);
  assert.equal(byEmail.status, 200);

  const dupe = await call('/api/admin/users', { method: 'POST', token, body: {
    email: 'other.teacher@test.local', username: 'mr_sami', password: 'Password1!', full_name: 'Other', role: 'teacher',
  }});
  assert.equal(dupe.status, 409);
  const bad = await call('/api/admin/users', { method: 'POST', token, body: {
    email: 'bad.teacher@test.local', username: 'no spaces!', password: 'Password1!', full_name: 'Bad', role: 'teacher',
  }});
  assert.equal(bad.status, 400);
});

test('an admin can remove an enrolment', async () => {
  const admin = await makeUser('admin', 'del-admin@test.local');
  const student = await makeUser('student', 'del-student@test.local');
  const course = await store.createCourse({ slug: 'del-course', title_en: 'Del', is_published: true });
  const token = await login(admin.email);
  const created = await call('/api/enrolments', { method: 'POST', token, body: { student_id: student.id, course_id: course.id } });
  assert.equal(created.status, 201);
  assert.equal(created.data.enrolment.status, 'active');
  const removed = await call('/api/enrolments/' + created.data.enrolment.id, { method: 'DELETE', token });
  assert.equal(removed.status, 200);
  const listed = await call('/api/enrolments', { token });
  assert.equal(listed.data.enrolments.some(e => e.id === created.data.enrolment.id), false);
  const again = await call('/api/enrolments/' + created.data.enrolment.id, { method: 'DELETE', token });
  assert.equal(again.status, 404);
});
