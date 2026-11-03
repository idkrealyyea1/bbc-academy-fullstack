const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createStore, seedDemo } = require('./db');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be set in production.'); process.exit(1);
}
const store = createStore();
const app = express();
// Render (and most hosts) put a proxy in front. Without this, every visitor
// shares one rate-limit bucket and the API logs a validation error per request.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});
const origins = (process.env.CORS_ORIGIN || 'http://localhost:8000,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => (!o || origins.includes(o) ? cb(null, true) : cb(new Error('CORS origin not allowed'))), credentials: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true }));

const bad = (res, code, msg) => res.status(code).json({ error: msg });
const ok = (res, data, code = 200) => res.status(code).json(data);
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isEmail = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const reqStr = (b, f, max = 500) => typeof b[f] === 'string' && b[f].trim().length > 0 && b[f].length <= max;
const pick = (o, keys) => keys.reduce((r, k) => { if (o[k] !== undefined) r[k] = o[k]; return r; }, {});
// The academy runs on Gaza time. A class at 01:00 local is still "today" for
// the teacher, but the server clock (UTC) says yesterday — so any default date
// is computed in the academy's time zone, never from the server clock.
const ACADEMY_TZ = process.env.ACADEMY_TIMEZONE || 'Asia/Gaza';
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Teachers sign in with a username. Returns null when absent, false when
// present but invalid, otherwise the normalised value.
function normaliseUsername(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const u = String(v).trim().toLowerCase();
  return /^[a-z0-9_.]{3,30}$/.test(u) ? u : false;
}
function todayInAcademyTz() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ACADEMY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
// Public sign-up is open by nature (students self-serve); keep the flood cost
// high without blocking a real class intake.
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true });
function publicUser(u) { if (!u) return null; const { password_hash, ...rest } = u; return rest; }
function sign(u) { return jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); }
async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return bad(res, 401, 'Missing token');
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    // The JWT role is up to 7 days old: re-read the user so a deleted or
    // demoted account loses access immediately instead of at token expiry.
    const u = await store.getUser(payload.id);
    if (!u) return bad(res, 401, 'Invalid or expired token');
    req.user = { id: u.id, email: u.email, role: u.role };
    next();
  } catch { return bad(res, 401, 'Invalid or expired token'); }
}
function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return next();
  let payload;
  try { payload = jwt.verify(t, JWT_SECRET); } catch { return next(); }
  store.getUser(payload.id).then(u => {
    if (u) req.user = { id: u.id, email: u.email, role: u.role };
    next();
  }).catch(() => next());
}
const roles = (...r) => (req, res, next) => (req.user && r.includes(req.user.role) ? next() : bad(res, 403, 'Forbidden for this role'));
const canManageCourse = (user, course) => !!user && (user.role === 'admin' || (user.role === 'teacher' && course.teacher_id === user.id));
async function canReadCourse(user, course) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return course.teacher_id === user.id;
  return store.isEnrolled(user.id, course.id);
}

app.get('/api/health', (req, res) => ok(res, { status: 'ok', store: store.kind, time: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ name: 'BBC English Academy API', health: '/api/health', docs: 'docs/API.md' }));

// --- Auth ---
app.post('/api/auth/register', registerLimiter, wrap(async (req, res) => {
  // Booking-only policy: students apply via booking and an admin creates the
  // account, so public registration is closed unless the caller holds the
  // admin setup key (the same key that bootstraps the first admin).
  const setupKey = process.env.ADMIN_SETUP_KEY;
  if (!setupKey || req.headers['x-admin-setup-key'] !== setupKey) return bad(res, 403, 'Registration is closed: accounts are created by an admin');
  const { email, password, full_name, role } = req.body || {};
  if (!isEmail(email)) return bad(res, 400, 'Valid email required');
  if (typeof password !== 'string' || password.length < 8) return bad(res, 400, 'Password must be at least 8 characters');
  if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'full_name required');
  const wanted = role || 'student';
  if (wanted === 'admin') {
    const key = process.env.ADMIN_SETUP_KEY;
    if (!key || req.headers['x-admin-setup-key'] !== key) return bad(res, 403, 'Admin registration requires ADMIN_SETUP_KEY');
  } else if (wanted !== 'student') {
    return bad(res, 403, 'Teachers are created by an admin');
  }
  const username = normaliseUsername(req.body && req.body.username);
  if (username === false) return bad(res, 400, 'username must be 3-30 characters: letters, digits, underscore or dot only');
  if (await store.findUserByEmail(email)) return bad(res, 409, 'Email already registered');
  if (username && await store.findUserByUsername(username)) return bad(res, 409, 'Username already taken');
  const user = await store.createUser({ email, username, full_name: full_name.trim(), role: wanted, password_hash: await bcrypt.hash(password, 10) });
  return ok(res, { user: publicUser(user), token: sign(user) }, 201);
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, username, password } = req.body || {};
  if (typeof password !== 'string') return bad(res, 400, 'Email and password required');
  // One identifier, two forms: an explicit username, an email value that has
  // an '@', or (from the single login field) a bare string that is a username.
  let user = null;
  if (username) user = await store.findUserByUsername(String(username).trim());
  else if (typeof email === 'string' && email.includes('@')) { if (!isEmail(email)) return bad(res, 400, 'Email and password required'); user = await store.findUserByEmail(email); }
  else if (typeof email === 'string' && email.trim()) user = await store.findUserByUsername(email.trim());
  else return bad(res, 400, 'Email and password required');
  if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) return bad(res, 401, 'Invalid email or password');
  return ok(res, { user: publicUser(user), token: sign(user) });
}));
app.get('/api/auth/me', auth, wrap(async (req, res) => ok(res, { user: publicUser(await store.getUser(req.user.id)) })));
app.get('/api/profile/me', auth, wrap(async (req, res) => ok(res, { user: publicUser(await store.getUser(req.user.id)) })));
app.put('/api/profile/me', auth, wrap(async (req, res) => {
  const p = {};
  if (req.body.full_name !== undefined) { if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'Invalid full_name'); p.full_name = req.body.full_name.trim(); }
  if (req.body.phone !== undefined) p.phone = String(req.body.phone).slice(0, 50);
  const u = await store.updateUser(req.user.id, p);
  return ok(res, { user: publicUser(u) });
}));
app.post('/api/profile/password', auth, wrap(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (typeof new_password !== 'string' || new_password.length < 8) return bad(res, 400, 'New password must be at least 8 characters');
  if (new_password.length > 200) return bad(res, 400, 'New password is too long');
  const u = await store.getUser(req.user.id);
  if (!u || !(await bcrypt.compare(String(current_password || ''), u.password_hash || ''))) return bad(res, 401, 'Current password is incorrect');
  await store.updateUser(u.id, { password_hash: await bcrypt.hash(new_password, 10) });
  // Existing JWTs stay valid until they expire (7 days by default); the new
  // password applies to the next sign-in.
  return ok(res, { updated: true });
}));

// --- Levels & courses ---
app.get('/api/levels', wrap(async (req, res) => ok(res, { levels: await store.listLevels() })));
app.get('/api/courses', optionalAuth, wrap(async (req, res) => {
  const all = await store.listCourses();
  const wantsAll = req.query.all === '1' && req.user && ['admin', 'teacher'].includes(req.user.role);
  const list = wantsAll
    ? all.filter(c => req.user.role === 'admin' || c.is_published || c.teacher_id === req.user.id)
    : all.filter(c => c.is_published);
  return ok(res, { courses: list });
}));
app.get('/api/courses/:id', optionalAuth, wrap(async (req, res) => {
  const c = await store.getCourse(req.params.id);
  if (!c) return bad(res, 404, 'Course not found');
  const canSee = c.is_published || (req.user && (req.user.role === 'admin' || (req.user.role === 'teacher' && c.teacher_id === req.user.id)));
  return canSee ? ok(res, { course: c }) : bad(res, 404, 'Course not found');
}));
app.post('/api/courses', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!reqStr(b, 'slug', 100) || !reqStr(b, 'title_en', 200)) return bad(res, 400, 'slug and title_en required');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug.trim())) return bad(res, 400, 'slug must be lowercase letters, digits and hyphens only');
  if ((await store.listCourses()).some(c => c.slug === b.slug.trim())) return bad(res, 409, 'Slug already exists');
  // Mirror the PUT /api/courses/:id rule: an admin assigning a course must
  // name a real teacher, not a student, a missing id, or an admin. (A
  // teacher creating a course is forced to themselves below, so this check
  // is admin-only and cannot be used to take over another teacher's course.)
  if (req.user.role === 'admin' && b.teacher_id) {
    const t = await store.getUser(b.teacher_id);
    if (!t || t.role !== 'teacher') return bad(res, 400, 'teacher_id must be an existing teacher');
  }
  const c = await store.createCourse({
    slug: b.slug.trim(), level_id: b.level_id || null, title_en: b.title_en.trim(), title_ar: b.title_ar || null,
    description_en: b.description_en || null, description_ar: b.description_ar || null, duration_weeks: b.duration_weeks || null,
    price_amount: null, price_currency: 'ILS', is_published: b.is_published !== false,
    teacher_id: req.user.role === 'teacher' ? req.user.id : (b.teacher_id || null),
  });
  return ok(res, { course: c }, 201);
}));
app.put('/api/courses/:id', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  const c = await store.getCourse(req.params.id);
  if (!c) return bad(res, 404, 'Course not found');
  if (!canManageCourse(req.user, c)) return bad(res, 403, 'You can only edit your own courses');
  const patch = pick(req.body || {}, ['slug', 'level_id', 'title_en', 'title_ar', 'description_en', 'description_ar', 'duration_weeks', 'is_published']);
  // Only an admin may move a course to another teacher (a teacher must not be
  // able to hand their course to someone else, or take one over).
  if (req.body && req.body.teacher_id !== undefined && req.user.role !== 'admin') {
    return bad(res, 403, 'Only an admin can change the teacher of a course');
  }
  if (req.user.role === 'admin' && req.body && req.body.teacher_id !== undefined) {
    const next = req.body.teacher_id || null;
    if (next) {
      const t = await store.getUser(next);
      if (!t || t.role !== 'teacher') return bad(res, 400, 'teacher_id must be an existing teacher');
    }
    patch.teacher_id = next;
  }
  if (patch.slug !== undefined) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(patch.slug)) return bad(res, 400, 'slug must be lowercase letters, digits and hyphens only');
    if ((await store.listCourses()).some(x => x.slug === patch.slug && x.id !== c.id)) return bad(res, 409, 'Slug already exists');
  }
  const updated = await store.updateCourse(c.id, patch);
  return ok(res, { course: updated });
}));
app.delete('/api/courses/:id', auth, roles('admin'), wrap(async (req, res) => {
  const c = await store.getCourse(req.params.id);
  if (!c) return bad(res, 404, 'Course not found');
  return (await store.deleteCourse(c.id) ? ok(res, { deleted: true }) : bad(res, 404, 'Course not found'));
}));

// --- Lessons (auth: only enrolled students, the owning teacher, or admin) ---
app.get('/api/lessons', auth, wrap(async (req, res) => {
  const courseId = req.query.course_id || null;
  if (courseId) {
    const course = await store.getCourse(courseId);
    if (!course) return bad(res, 404, 'Course not found');
    if (!(await canReadCourse(req.user, course))) return bad(res, 403, 'Forbidden');
    return ok(res, { lessons: await store.listLessons(course.id) });
  }
  if (req.user.role === 'student') return ok(res, { lessons: await store.listLessonsForStudent(req.user.id) });
  if (req.user.role === 'teacher') return ok(res, { lessons: await store.listLessonsForTeacher(req.user.id) });
  return ok(res, { lessons: await store.listLessons() });
}));
app.post('/api/lessons', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!reqStr(b, 'course_id') || !reqStr(b, 'title_en', 200)) return bad(res, 400, 'course_id and title_en required');
  const course = await store.getCourse(b.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  if (!canManageCourse(req.user, course)) return bad(res, 403, 'You can only add lessons to your own courses');
  return ok(res, { lesson: await store.createLesson({ course_id: course.id, title_en: b.title_en.trim(), title_ar: b.title_ar || null, content_url: b.content_url || null, material_url: b.material_url || null, live_class_url: b.live_class_url || null, order_no: b.order_no || 1 }) }, 201);
}));

// --- Booking requests (anonymous: students apply BEFORE having an account) ---
app.use('/api/booking-requests', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true }));
app.post('/api/booking-requests', wrap(async (req, res) => {
  if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'full_name required');
  const b = req.body || {};
  const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim().slice(0, 200) : null;
  if (email && !isEmail(email)) return bad(res, 400, 'Invalid email');
  const r = await store.createBookingRequest({
    full_name: b.full_name.trim(), email,
    phone: typeof b.phone === 'string' ? b.phone.slice(0, 50) : null,
    course: typeof b.course === 'string' ? b.course.slice(0, 200) : null,
    source: typeof b.source === 'string' ? b.source.slice(0, 50) : null,
    message: typeof b.message === 'string' ? b.message.slice(0, 2000) : null,
  });
  return ok(res, { booking_request: r }, 201);
}));
app.get('/api/admin/booking-requests', auth, roles('admin'), wrap(async (req, res) => ok(res, { booking_requests: await store.listBookingRequests() })));
app.put('/api/admin/booking-requests/:id', auth, roles('admin'), wrap(async (req, res) => {
  if (!['pending', 'confirmed', 'rejected'].includes(req.body?.status)) return bad(res, 400, 'status must be pending, confirmed or rejected');
  const r = await store.updateBookingRequest(req.params.id, req.body.status);
  return r ? ok(res, { booking_request: r }) : bad(res, 404, 'Booking request not found');
}));
app.delete('/api/admin/booking-requests/:id', auth, roles('admin'), wrap(async (req, res) => (await store.deleteBookingRequest(req.params.id) ? ok(res, { deleted: true }) : bad(res, 404, 'Booking request not found'))));

// --- Enrolments ---
app.post('/api/enrolments', auth, roles('student', 'admin'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'course_id')) return bad(res, 400, 'course_id required');
  const course = await store.getCourse(req.body.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  if (req.user.role !== 'admin' && req.body.student_id && req.body.student_id !== req.user.id) return bad(res, 403, 'Students may only enrol themselves');
  const studentId = req.user.role === 'admin' && req.body.student_id ? req.body.student_id : req.user.id;
  const student = await store.getUser(studentId);
  if (!student || student.role !== 'student') return bad(res, 404, 'Student not found');
  if (req.user.role !== 'admin' && !course.is_published) return bad(res, 404, 'Course not found');
  // A student enrolling themselves waits for the academy ('pending'); an admin
  // enrolling someone is the academy acting, so it is 'active' immediately.
  const status = req.user.role === 'admin' && req.body.student_id ? 'active' : 'pending';
  return ok(res, { enrolment: await store.createEnrolment({ student_id: student.id, course_id: course.id, status }) }, 201);
}));
app.get('/api/enrolments/me', auth, wrap(async (req, res) => ok(res, { enrolments: await store.listEnrolmentsForUser(req.user.id) })));
app.put('/api/enrolments/:id', auth, roles('admin'), wrap(async (req, res) => {
  const status = req.body?.status;
  if (!['pending', 'active', 'completed', 'cancelled'].includes(status)) return bad(res, 400, 'status must be pending, active, completed or cancelled');
  const updated = await store.updateEnrolment(req.params.id, status);
  return updated ? ok(res, { enrolment: updated }) : bad(res, 404, 'Enrolment not found');
}));
app.get('/api/enrolments', auth, roles('admin', 'teacher'), wrap(async (req, res) => ok(res, { enrolments: await store.listEnrolmentsAll(req.user.role === 'teacher' ? req.user.id : null) })));
app.delete('/api/enrolments/:id', auth, roles('admin'), wrap(async (req, res) => (await store.deleteEnrolment(req.params.id) ? ok(res, { deleted: true }) : bad(res, 404, 'Enrolment not found'))));

// --- Placement test: 20 questions, scored server-side ---
// Must match the 20 questions in frontend/app.js (QUIZ_ANSWERS), in order.
const PLACEMENT_ANSWERS = [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 2, 1, 1, 1, 0, 1, 1];
function levelFor(score, total) {
  const r = score / total;
  if (r < 0.25) return 'A1'; if (r < 0.45) return 'A2'; if (r < 0.65) return 'B1';
  if (r < 0.85) return 'B2'; if (r < 0.95) return 'C1'; return 'C2';
}
app.post('/api/placement-tests', auth, wrap(async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== 20 || answers.some(a => ![0, 1, 2].includes(a))) return bad(res, 400, 'answers must be an array of 20 option indexes (0-2)');
  let score = 0; answers.forEach((a, i) => { if (a === PLACEMENT_ANSWERS[i]) score++; });
  const result = await store.createPlacement({ student_id: req.user.id, score, total: 20, recommended_level: levelFor(score, 20), answers });
  return ok(res, { result }, 201);
}));
app.get('/api/placement-tests/me', auth, wrap(async (req, res) => ok(res, { results: await store.listPlacementsForUser(req.user.id) })));

// --- Assignments / submissions / grades ---
app.post('/api/assignments', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'course_id') || !reqStr(req.body, 'title', 300)) return bad(res, 400, 'course_id and title required');
  const course = await store.getCourse(req.body.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  if (!canManageCourse(req.user, course)) return bad(res, 403, 'You can only add assignments to your own courses');
  return ok(res, { assignment: await store.createAssignment({ course_id: course.id, teacher_id: req.user.id, title: req.body.title.trim(), description: req.body.description || null, due_date: req.body.due_date || null }) }, 201);
}));
app.get('/api/assignments', auth, wrap(async (req, res) => {
  const courseId = req.query.course_id || null;
  let list;
  if (req.user.role === 'admin') list = await store.listAssignments(courseId);
  else if (req.user.role === 'teacher') list = await store.listAssignmentsForTeacher(req.user.id);
  else list = await store.listAssignmentsForStudent(req.user.id);
  if (courseId && req.user.role !== 'admin') list = list.filter(a => a.course_id === courseId);
  return ok(res, { assignments: list });
}));
app.post('/api/submissions', auth, roles('student'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'assignment_id') || (!reqStr(req.body, 'content_text', 5000) && !reqStr(req.body, 'content_url', 1000))) return bad(res, 400, 'assignment_id and content_text or content_url required');
  const assignment = await store.getAssignment(req.body.assignment_id);
  if (!assignment) return bad(res, 404, 'Assignment not found');
  if (!(await store.isEnrolled(req.user.id, assignment.course_id))) return bad(res, 403, 'You are not enrolled in this course');
  // 201 the first time, 200 when the student revises an existing answer.
  const submission = await store.createSubmission({ assignment_id: assignment.id, student_id: req.user.id, content_text: req.body.content_text || null, content_url: req.body.content_url || null });
  const created = submission.created !== false;
  delete submission.created;
  return ok(res, { submission }, created ? 201 : 200);
}));
app.get('/api/submissions', auth, roles('admin', 'teacher'), wrap(async (req, res) => ok(res, { submissions: await store.listSubmissions(req.query.assignment_id || null, req.user.role === 'teacher' ? req.user.id : null) })));
app.post('/api/submissions/:id/grade', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  const grade = Number(req.body?.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return bad(res, 400, 'grade must be a number 0-100');
  const submission = await store.getSubmission(req.params.id);
  if (!submission) return bad(res, 404, 'Submission not found');
  const assignment = await store.getAssignment(submission.assignment_id);
  if (!assignment || !canManageCourse(req.user, { teacher_id: assignment.teacher_id })) return bad(res, 403, 'You can only grade your own courses');
  const s = await store.gradeSubmission(submission.id, grade, req.body?.feedback || null);
  return ok(res, { submission: s });
}));

// --- Attendance / announcements ---
app.post('/api/attendance', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'course_id') || !reqStr(req.body, 'student_id')) return bad(res, 400, 'course_id and student_id required');
  if (!['present', 'absent', 'late', 'excused'].includes(req.body.status || 'present')) return bad(res, 400, 'Invalid status');
  const course = await store.getCourse(req.body.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  if (!canManageCourse(req.user, course)) return bad(res, 403, 'You can only mark attendance for your own courses');
  const student = await store.getUser(req.body.student_id);
  if (!student || student.role !== 'student') return bad(res, 404, 'Student not found');
  // Attendance is only for current class members. 'active' is the sole status
  // that means "currently enrolled": 'pending' has not been approved by the
  // academy yet, 'completed' means the course is finished, and 'cancelled'
  // means withdrawn. No schema change: status already exists on enrolments
  // (001_init.sql enrolment_status enum), and this check applies to admins
  // as well as teachers — an admin marking a non-member present would be
  // just as wrong a record. Ownership is checked before this, so a teacher
  // marking another teacher's course still gets 403 above, not here.
  const enrolment = await store.getEnrolment(student.id, course.id);
  if (!enrolment || enrolment.status !== 'active') return bad(res, 403, 'Student is not actively enrolled in this course');
  const attendedOn = req.body.attended_on || todayInAcademyTz();
  if (!isDate(attendedOn)) return bad(res, 400, 'attended_on must be YYYY-MM-DD');
  return ok(res, { attendance: await store.createAttendance({ course_id: course.id, student_id: student.id, lesson_id: req.body.lesson_id || null, status: req.body.status || 'present', attended_on: attendedOn }) }, 201);
}));
app.get('/api/attendance', auth, roles('admin', 'teacher'), wrap(async (req, res) => ok(res, { attendance: await store.listAttendance(req.query.course_id || null, req.user.role === 'teacher' ? req.user.id : null) })));
app.get('/api/me/attendance', auth, wrap(async (req, res) => ok(res, { attendance: await store.listAttendanceForUser(req.user.id) })));
app.post('/api/announcements', auth, roles('admin', 'teacher'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'title', 300) || !reqStr(req.body, 'body', 5000)) return bad(res, 400, 'title and body required');
  const audience = req.body.audience || 'all';
  if (!['all', 'students', 'teachers'].includes(audience)) return bad(res, 400, 'audience must be all, students or teachers');
  return ok(res, { announcement: await store.createAnnouncement({ author_id: req.user.id, title: req.body.title.trim(), body: req.body.body, audience }) }, 201);
}));
app.get('/api/announcements', optionalAuth, wrap(async (req, res) => {
  const all = await store.listAnnouncements();
  const role = req.user?.role;
  const list = role === 'admin' ? all : all.filter(a => a.audience === 'all' || a.audience === (role === 'teacher' ? 'teachers' : role === 'student' ? 'students' : 'never'));
  return ok(res, { announcements: list });
}));

// --- Payments: PLACEHOLDER ONLY — records an intent/status, no provider, no money ---
app.post('/api/payments', auth, roles('admin'), wrap(async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount !== null && (typeof req.body.amount !== 'number' || req.body.amount < 0)) return bad(res, 400, 'Invalid amount');
  return ok(res, { payment: await store.createPayment({ student_id: req.body.student_id || req.user.id, course_id: req.body.course_id || null, amount: req.body.amount ?? null, currency: req.body.currency || 'ILS', status: 'pending', provider_ref: null }), note: 'PLACEHOLDER: no payment provider is connected and no money moves. The owner must choose a provider before launch.' }, 201);
}));
app.get('/api/payments/me', auth, wrap(async (req, res) => ok(res, { payments: await store.listPaymentsForUser(req.user.id) })));
app.get('/api/payments', auth, roles('admin'), wrap(async (req, res) => ok(res, { payments: await store.listPaymentsAll() })));

// --- Admin ---
app.get('/api/admin/users', auth, roles('admin'), wrap(async (req, res) => ok(res, { users: (await store.listUsers()).map(publicUser) })));
app.post('/api/admin/users', auth, roles('admin'), wrap(async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!isEmail(email)) return bad(res, 400, 'Valid email required');
  if (typeof password !== 'string' || password.length < 8) return bad(res, 400, 'Password must be at least 8 characters');
  if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'full_name required');
  const wanted = role || 'student';
  if (!['student', 'teacher', 'admin'].includes(wanted)) return bad(res, 400, 'role must be student, teacher or admin');
  const username = normaliseUsername(req.body && req.body.username);
  if (username === false) return bad(res, 400, 'username must be 3-30 characters: letters, digits, underscore or dot only');
  if (await store.findUserByEmail(email)) return bad(res, 409, 'Email already registered');
  if (username && await store.findUserByUsername(username)) return bad(res, 409, 'Username already taken');
  const user = await store.createUser({ email, username, full_name: full_name.trim(), role: wanted, password_hash: await bcrypt.hash(password, 10) });
  return ok(res, { user: publicUser(user) }, 201);
}));
app.put('/api/admin/users/:id', auth, roles('admin'), wrap(async (req, res) => {
  const u = await store.getUser(req.params.id);
  if (!u) return bad(res, 404, 'User not found');
  const b = req.body || {};
  const patch = {};
  if (b.full_name !== undefined) { if (!reqStr(b, 'full_name', 200)) return bad(res, 400, 'Invalid full_name'); patch.full_name = b.full_name.trim(); }
  if (b.phone !== undefined) patch.phone = String(b.phone).slice(0, 50);
  if (b.role !== undefined) {
    if (!['student', 'teacher', 'admin'].includes(b.role)) return bad(res, 400, 'Invalid role');
    if (u.id === req.user.id && b.role !== 'admin') return bad(res, 400, 'You cannot remove your own admin role');
    patch.role = b.role;
  }
  if (b.password !== undefined) {
    if (typeof b.password !== 'string' || b.password.length < 8) return bad(res, 400, 'Password must be at least 8 characters');
    patch.password_hash = await bcrypt.hash(b.password, 10);
  }
  if (b.username !== undefined) {
    const next = normaliseUsername(b.username);
    if (next === false) return bad(res, 400, 'username must be 3-30 characters: letters, digits, underscore or dot only');
    const taken = next ? await store.findUserByUsername(next) : null;
    if (taken && taken.id !== u.id) return bad(res, 409, 'Username already taken');
    patch.username = next;
  }
  if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to update');
  return ok(res, { user: publicUser(await store.updateUser(u.id, patch)) });
}));
app.delete('/api/admin/users/:id', auth, roles('admin'), wrap(async (req, res) => {
  if (req.params.id === req.user.id) return bad(res, 400, 'You cannot delete your own account');
  return (await store.deleteUser(req.params.id) ? ok(res, { deleted: true }) : bad(res, 404, 'User not found'));
}));
app.post('/api/admin/enrolments', auth, roles('admin'), wrap(async (req, res) => {
  if (!reqStr(req.body, 'student_id') || !reqStr(req.body, 'course_id')) return bad(res, 400, 'student_id and course_id required');
  const student = await store.getUser(req.body.student_id);
  if (!student || student.role !== 'student') return bad(res, 404, 'Student not found');
  const course = await store.getCourse(req.body.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  const status = req.body.status || 'active';
  if (!['pending', 'active', 'completed', 'cancelled'].includes(status)) return bad(res, 400, 'Invalid status');
  return ok(res, { enrolment: await store.createEnrolment({ student_id: student.id, course_id: course.id, status }) }, 201);
}));

app.use((req, res) => bad(res, 404, 'Not found'));
app.use((err, req, res, next) => {
  // Log only unhandled server errors. Expected application errors (409/400)
  // are already mapped to their responses above.
  if (res.statusCode === 500) console.error('ERR', err.message);
  if (err.message === 'CORS origin not allowed') return bad(res, 403, 'Origin not allowed');
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) return bad(res, 400, 'Invalid JSON body');
  if (err.code === '23505') return bad(res, 409, 'Already exists');
  if (err.code === '23503') return bad(res, 400, 'Related record not found');
  if (err.code === '22P02') return bad(res, 400, 'Invalid id');
  return bad(res, 500, 'Server error');
});

async function main() {
  await seedDemo(store, bcrypt);
  app.listen(PORT, () => console.log(`BBC Academy API listening on http://localhost:${PORT} (store=${store.kind})`));
}
if (require.main === module) main();
module.exports = { app, store, levelFor };
