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

async function call(path, { method = 'GET', body, token, headers: extraHeaders } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
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
  // Attendance now requires an active enrolment (see the regression test
  // below); without this line this test's 201 would be a 403.
  await store.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  const token = await login(teacher.email);
  const res = await call('/api/attendance', { method: 'POST', token, body: { course_id: course.id, student_id: student.id, status: 'present' } });
  assert.equal(res.status, 201);
  assert.match(res.data.attendance.attended_on, /^\d{4}-\d{2}-\d{2}$/);
  const expected = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.ACADEMY_TIMEZONE || 'Asia/Gaza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert.equal(res.data.attendance.attended_on, expected);
  const bad = await call('/api/attendance', { method: 'POST', token, body: { course_id: course.id, student_id: student.id, attended_on: '03/11/2026' } });
  assert.equal(bad.status, 400);
});

test('attendance requires an active enrolment, and another teacher is still blocked', async () => {
  const teacher = await makeUser('teacher', 'att2-teacher@test.local');
  const otherTeacher = await makeUser('teacher', 'att2-other@test.local');
  const admin = await makeUser('admin', 'att2-admin@test.local');
  const enrolled = await makeUser('student', 'att2-enrolled@test.local');
  const pending = await makeUser('student', 'att2-pending@test.local');
  const never = await makeUser('student', 'att2-never@test.local');
  const completed = await makeUser('student', 'att2-completed@test.local');
  const cancelled = await makeUser('student', 'att2-cancelled@test.local');
  const course = await store.createCourse({ slug: 'att2-course', title_en: 'Attendance 2', is_published: true, teacher_id: teacher.id });
  await store.createEnrolment({ student_id: enrolled.id, course_id: course.id, status: 'active' });
  await store.createEnrolment({ student_id: pending.id, course_id: course.id, status: 'pending' });
  await store.createEnrolment({ student_id: completed.id, course_id: course.id, status: 'completed' });
  await store.createEnrolment({ student_id: cancelled.id, course_id: course.id, status: 'cancelled' });
  const token = await login(teacher.email);
  const otherToken = await login(otherTeacher.email);
  const adminToken = await login(admin.email);
  const mark = (tok, studentId, status) => call('/api/attendance', { method: 'POST', token: tok, body: { course_id: course.id, student_id: studentId, status } });

  // (a) Non-enrolled cannot be marked — present or absent, and no
  // non-active status counts: pending (not yet approved), completed
  // (course finished) and cancelled (withdrawn) are all rejected.
  assert.equal((await mark(token, never.id, 'present')).status, 403);
  assert.equal((await mark(token, never.id, 'absent')).status, 403);
  assert.equal((await mark(token, pending.id, 'absent')).status, 403);
  assert.equal((await mark(token, completed.id, 'present')).status, 403);
  assert.equal((await mark(token, cancelled.id, 'present')).status, 403);
  // The rule binds admins too, not just teachers.
  assert.equal((await mark(adminToken, never.id, 'present')).status, 403);

  // (b) A teacher still cannot mark attendance for another teacher's course,
  // even for a student who IS actively enrolled in it.
  assert.equal((await mark(otherToken, enrolled.id, 'present')).status, 403);

  // (c) An actively enrolled student CAN still be marked, by the owning
  // teacher and by an admin.
  assert.equal((await mark(token, enrolled.id, 'present')).status, 201);
  assert.equal((await mark(adminToken, enrolled.id, 'absent')).status, 201);
});

test('an admin assigning a course on creation must name an existing teacher', async () => {
  const admin = await makeUser('admin', 'assign-admin@test.local');
  const teacher = await makeUser('teacher', 'assign-teacher@test.local');
  const student = await makeUser('student', 'assign-student@test.local');
  const token = await login(admin.email);
  const create = (teacherId) => call('/api/courses', { method: 'POST', token, body: { slug: 'assign-course-' + String(teacherId).slice(0, 8), title_en: 'Assign', teacher_id: teacherId } });
  assert.equal((await create('not-a-user')).status, 400);
  assert.equal((await create(student.id)).status, 400);
  assert.equal((await create(teacher.id)).status, 201);
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

test('public registration is closed without the admin setup key', async () => {
  const r = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'closed@test.local', password: 'Password1!', full_name: 'Closed', role: 'student' },
  });
  assert.equal(r.status, 403);
});

test('registration with the admin setup key still works (admin bootstrap)', async () => {
  const prev = process.env.ADMIN_SETUP_KEY;
  process.env.ADMIN_SETUP_KEY = 'test-setup-key';
  try {
    const r = await call('/api/auth/register', {
      method: 'POST',
      headers: { 'x-admin-setup-key': 'test-setup-key' },
      body: { email: 'boot@test.local', password: 'Password1!', full_name: 'Boot', role: 'student' },
    });
    assert.equal(r.status, 201);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_SETUP_KEY;
    else process.env.ADMIN_SETUP_KEY = prev;
  }
});

test('an admin can approve a pending enrolment, a student cannot', async () => {
  const admin = await makeUser('admin', 'approver@test.local');
  const student = await makeUser('student', 'pending@test.local');
  const token = await login(admin.email);
  const studentToken = await login(student.email);
  const course = store.courses[0];
  const created = await call('/api/enrolments', { method: 'POST', token: studentToken, body: { course_id: course.id } });
  assert.equal(created.status, 201);
  assert.equal(created.data.enrolment.status, 'pending');
  const asStudent = await call(`/api/enrolments/${created.data.enrolment.id}`, { method: 'PUT', token: studentToken, body: { status: 'active' } });
  assert.equal(asStudent.status, 403);
  const approved = await call(`/api/enrolments/${created.data.enrolment.id}`, { method: 'PUT', token, body: { status: 'active' } });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.enrolment.status, 'active');
  const missing = await call('/api/enrolments/no-such-id', { method: 'PUT', token, body: { status: 'active' } });
  assert.equal(missing.status, 404);
});

test('teacher-built homework questions are marked on the server and the key stays private', async () => {
  const teacher = await makeUser('teacher', 'hw-teacher@test.local');
  const student = await makeUser('student', 'hw-student@test.local');
  const course = await store.createCourse({ slug: 'hw-questions', title_en: 'HW questions', is_published: true, teacher_id: teacher.id });
  await store.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  const token = await login(teacher.email);
  const created = await call('/api/assignments', {
    method: 'POST',
    token,
    body: {
      course_id: course.id,
      title: 'Unit 3 homework',
      questions: [
        { type: 'multiple_choice', prompt: 'She ___ to school.', options: ['go', 'goes', 'going', 'gone'], correct: 1 },
        { type: 'fill_blank', prompt: 'I ___ a student.', answers: ['am'] },
        { type: 'translate', prompt: 'Translate: أنا بخير', answers: ['I am fine', 'I am okay'] },
        { type: 'short_answer', prompt: 'Write two sentences about your day.' },
      ],
    },
  });
  assert.equal(created.status, 201);
  const assignment = created.data.assignment;

  // A student must never receive the answer key.
  const studentToken = await login(student.email);
  const list = await call('/api/assignments', { token: studentToken });
  const mine = list.data.assignments.find(a => a.id === assignment.id);
  assert.equal(mine.questions.length, 4);
  assert.equal(mine.questions[0].correct, undefined);
  assert.equal(mine.questions[1].answers, undefined);
  assert.equal(mine.questions[0].options.length, 4);

  const submitted = await call('/api/submissions', {
    method: 'POST',
    token: studentToken,
    body: {
      assignment_id: assignment.id,
      answers: [
        { question_id: 'q1', answer: '1' },
        { question_id: 'q2', answer: '  AM. ' },
        { question_id: 'q3', answer: 'i am fine!' },
        { question_id: 'q4', answer: 'I woke up. I studied English.' },
      ],
    },
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.submission.auto_score, 3);
  assert.equal(submitted.data.submission.auto_total, 3);
  assert.equal(submitted.data.submission.answers.length, 4);

  const teacherToken = await login(teacher.email);
  const subs = await call(`/api/submissions?assignment_id=${assignment.id}`, { token: teacherToken });
  const row = subs.data.submissions.find(s => s.id === submitted.data.submission.id);
  assert.equal(row.auto_score, 3);
  assert.equal(row.answers.length, 4);

  // An empty submission is refused; a malformed question list is refused.
  const empty = await call('/api/submissions', { method: 'POST', token: studentToken, body: { assignment_id: assignment.id, answers: [] } });
  assert.equal(empty.status, 400);
  const badQuestion = await call('/api/assignments', {
    method: 'POST',
    token,
    body: { course_id: course.id, title: 'Broken', questions: [{ type: 'multiple_choice', prompt: 'x', options: ['a', 'b'], correct: 5 }] },
  });
  assert.equal(badQuestion.status, 400);
});

test('homework file uploads are type-checked and only served to the class', async () => {
  const teacher = await makeUser('teacher', 'hw-file-teacher@test.local');
  const student = await makeUser('student', 'hw-file-student@test.local');
  const outsider = await makeUser('student', 'hw-file-outsider@test.local');
  const course = await store.createCourse({ slug: 'hw-files', title_en: 'HW files', is_published: true, teacher_id: teacher.id });
  await store.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  const token = await login(teacher.email);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

  const upload = await call('/api/assignments', {
    method: 'POST',
    token,
    body: { course_id: course.id, title: 'Worksheet', file: { name: 'worksheet.pdf', type: 'application/pdf', data: pdf.toString('base64') } },
  });
  assert.equal(upload.status, 201);
  assert.equal(upload.data.assignment.has_file, true);

  // Wrong content with a PDF name is rejected, and nothing is left behind.
  const fake = await call('/api/assignments', {
    method: 'POST',
    token,
    body: { course_id: course.id, title: 'Not a PDF', file: { name: 'bad.pdf', type: 'application/pdf', data: Buffer.from('<html>nope</html>').toString('base64') } },
  });
  assert.equal(fake.status, 400);
  assert.equal(store.assignments.some(a => a.title === 'Not a PDF'), false);

  const id = upload.data.assignment.id;
  const studentToken = await login(student.email);
  const download = await fetch(`${base}/api/assignment-files/${id}`, { headers: { Authorization: `Bearer ${studentToken}` } });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(download.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);

  const outsiderToken = await login(outsider.email);
  assert.equal((await fetch(`${base}/api/assignment-files/${id}`, { headers: { Authorization: `Bearer ${outsiderToken}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/assignment-files/${id}`)).status, 401);
});

test('staff create and edit students, and are kept out of admin records', async () => {
  const admin = await makeUser('admin', 'staffadmin@test.local');
  const staff = await makeUser('staff', 'staffer@test.local');
  const teacher = await makeUser('teacher', 'staffteacher@test.local');
  const student = await makeUser('student', 'staffstudent@test.local');
  const adminToken = await login(admin.email);
  const staffToken = await login(staff.email);
  const studentToken = await login(student.email);
  const course = await store.createCourse({ slug: 'staff-course', title_en: 'Staff course', is_published: true, teacher_id: teacher.id });

  const created = await call('/api/staff/students', {
    method: 'POST', token: staffToken,
    body: { full_name: 'New Learner', email: 'new.learner@test.local', username: 'new.learner', password: 'Learner123!', course_id: course.id, status: 'active' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.student.role, 'student');
  assert.equal(created.data.enrolment.status, 'active');
  assert.ok(!('password_hash' in created.data.student));

  // The username and password set here are the ones that sign in.
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { username: 'new.learner', password: 'Learner123!' } })).status, 200);

  const id = created.data.student.id;
  const edited = await call(`/api/staff/students/${id}`, { method: 'PUT', token: staffToken, body: { full_name: 'Renamed Learner', username: 'renamed.learner' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.student.username, 'renamed.learner');
  assert.equal((await call(`/api/staff/students/${id}/password`, { method: 'POST', token: staffToken, body: { password: 'Changed123!' } })).status, 200);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { username: 'renamed.learner', password: 'Changed123!' } })).status, 200);

  const detail = await call(`/api/staff/students/${id}`, { token: staffToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.enrolments[0].course_title, 'Staff course');
  assert.deepEqual(detail.data.submissions, []);

  const enrolmentId = detail.data.enrolments[0].id;
  const updated = await call(`/api/staff/students/${id}/enrolments/${enrolmentId}`, { method: 'PUT', token: staffToken, body: { status: 'completed' } });
  assert.equal(updated.data.enrolment.status, 'completed');
  assert.equal((await call(`/api/staff/students/${id}/enrolments/${enrolmentId}`, { method: 'DELETE', token: staffToken })).status, 200);

  // Boundaries: only staff/admin reach student records; staff stay out of admin.
  assert.equal((await call('/api/staff/students', { token: studentToken })).status, 403);
  assert.equal((await call('/api/staff/students', { token: await login(teacher.email) })).status, 403);
  assert.equal((await call('/api/admin/users', { token: staffToken })).status, 403);
  assert.equal((await call(`/api/staff/students/${teacher.id}`, { method: 'PUT', token: staffToken, body: { full_name: 'Hijack' } })).status, 404);

  // An admin creates staff accounts, and only that role is added.
  const made = await call('/api/admin/users', { method: 'POST', token: adminToken, body: { full_name: 'Second Staff', email: 'second.staff@test.local', password: 'Password1!', role: 'staff' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.user.role, 'staff');

  assert.equal((await call(`/api/staff/students/${id}`, { method: 'DELETE', token: staffToken })).status, 200);
  assert.equal((await call(`/api/staff/students/${id}`, { token: staffToken })).status, 404);
});

test('teachers edit and delete homework, due dates mark late work, and homework follows a lesson', async () => {
  const teacher = await makeUser('teacher', 'hw-owner@test.local');
  const other = await makeUser('teacher', 'hw-other@test.local');
  const student = await makeUser('student', 'hw-late@test.local');
  const course = await store.createCourse({ slug: 'hw-edit-course', title_en: 'HW edit course', is_published: true, teacher_id: teacher.id });
  const course2 = await store.createCourse({ slug: 'hw-edit-course-2', title_en: 'HW second course', is_published: true, teacher_id: teacher.id });
  const otherCourse = await store.createCourse({ slug: 'hw-other-course', title_en: 'HW other course', is_published: true, teacher_id: other.id });
  const lesson = await store.createLesson({ course_id: course.id, title_en: 'Lesson one', order_no: 1 });
  await store.createEnrolment({ student_id: student.id, course_id: course.id, status: 'active' });
  const token = await login(teacher.email);
  const studentToken = await login(student.email);

  const created = await call('/api/assignments', { method: 'POST', token, body: { course_id: course.id, title: 'Draft', lesson_id: lesson.id } });
  assert.equal(created.status, 201);
  assert.equal(created.data.assignment.lesson_id, lesson.id);
  const id = created.data.assignment.id;

  const wrongLesson = await call('/api/assignments', { method: 'POST', token, body: { course_id: course.id, title: 'Bad', lesson_id: 'no-such-lesson' } });
  assert.equal(wrongLesson.status, 400);

  const otherToken = await login(other.email);
  assert.equal((await call(`/api/assignments/${id}`, { method: 'PUT', token: otherToken, body: { title: 'Hijacked' } })).status, 403);
  assert.equal((await call(`/api/assignments/${id}`, { method: 'DELETE', token: otherToken })).status, 403);
  assert.equal((await call(`/api/assignments/${id}`, { method: 'PUT', token, body: { course_id: otherCourse.id } })).status, 403);

  const edited = await call(`/api/assignments/${id}`, { method: 'PUT', token, body: { title: 'Final title', due_date: '2020-01-01' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.assignment.title, 'Final title');
  assert.equal(edited.data.assignment.due_date, '2020-01-01');

  const late = await call('/api/submissions', { method: 'POST', token: studentToken, body: { assignment_id: id, content_text: 'Sorry' } });
  assert.equal(late.status, 201);
  assert.equal(late.data.submission.submitted_late, true);

  // Homework with submissions keeps its course, so grades stay with their class.
  assert.equal((await call(`/api/assignments/${id}`, { method: 'PUT', token, body: { course_id: course2.id } })).status, 409);

  // A later due date makes the revised work on time, without rewriting the first attempt.
  await call(`/api/assignments/${id}`, { method: 'PUT', token, body: { due_date: '2099-01-01' } });
  const onTime = await call('/api/submissions', { method: 'POST', token: studentToken, body: { assignment_id: id, content_text: 'On time' } });
  assert.ok([200, 201].includes(onTime.status));
  assert.equal(onTime.data.submission.submitted_late, false);

  const list = await call('/api/assignments', { token: studentToken });
  assert.equal(list.data.assignments[0].submission.submitted_late, false);
  assert.equal(list.data.assignments[0].lesson_id, lesson.id);

  const staff = await makeUser('staff', 'hw-staff@test.local');
  const staffToken = await login(staff.email);
  const marked = await call(`/api/staff/students/${student.id}/attendance`, { method: 'POST', token: staffToken, body: { course_id: course.id, status: 'present' } });
  assert.equal(marked.status, 201);
  assert.equal((await store.listAttendanceForUser(student.id)).length, 1);

  const outsider = await makeUser('student', 'hw-outsider@test.local');
  assert.equal((await call(`/api/staff/students/${outsider.id}/attendance`, { method: 'POST', token: staffToken, body: { course_id: course.id } })).status, 403);

  assert.equal((await call(`/api/assignments/${id}`, { method: 'DELETE', token })).status, 200);
  assert.equal((await call('/api/assignments', { token: studentToken })).data.assignments.length, 0);
  assert.equal(store.submissions.filter(x => x.assignment_id === id).length, 0);
});
