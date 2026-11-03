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
app.use(express.json({ limit: '1mb' }));
const origins = (process.env.CORS_ORIGIN || 'http://localhost:8000,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => (!o || origins.includes(o) ? cb(null, true) : cb(new Error('CORS origin not allowed'))), credentials: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true }));

const bad = (res, code, msg) => res.status(code).json({ error: msg });
const ok = (res, data, code = 200) => res.status(code).json(data);
const isEmail = s => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const reqStr = (b, f, max = 500) => typeof b[f] === 'string' && b[f].trim().length > 0 && b[f].length <= max;
function publicUser(u) { if (!u) return null; const { password_hash, ...rest } = u; return rest; }
function sign(u) { return jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return bad(res, 401, 'Missing token');
  try { req.user = jwt.verify(t, JWT_SECRET); next(); } catch { return bad(res, 401, 'Invalid or expired token'); }
}
const roles = (...r) => (req, res, next) => (req.user && r.includes(req.user.role) ? next() : bad(res, 403, 'Forbidden for this role'));

app.get('/api/health', (req, res) => ok(res, { status: 'ok', store: store.kind, time: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ name: 'BBC English Academy API', health: '/api/health', docs: 'docs/API.md' }));

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body || {};
    if (!isEmail(email)) return bad(res, 400, 'Valid email required');
    if (typeof password !== 'string' || password.length < 8) return bad(res, 400, 'Password must be at least 8 characters');
    if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'full_name required');
    const wanted = role || 'student';
    if (!['student', 'teacher'].includes(wanted)) {
      if (wanted === 'admin') {
        const key = process.env.ADMIN_SETUP_KEY;
        if (!key || req.headers['x-admin-setup-key'] !== key) return bad(res, 403, 'Admin registration requires ADMIN_SETUP_KEY');
      } else return bad(res, 400, 'role must be student, teacher, or admin (with key)');
    }
    if (await store.findUserByEmail(email)) return bad(res, 409, 'Email already registered');
    const user = await store.createUser({ email, full_name: full_name.trim(), role: wanted, password_hash: await bcrypt.hash(password, 10) });
    return ok(res, { user: publicUser(user), token: sign(user) }, 201);
  } catch (e) { console.error(e); return bad(res, 500, 'Registration failed'); }
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== 'string') return bad(res, 400, 'Email and password required');
  const user = await store.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) return bad(res, 401, 'Invalid email or password');
  return ok(res, { user: publicUser(user), token: sign(user) });
});
app.get('/api/auth/me', auth, async (req, res) => ok(res, { user: publicUser(await store.getUser(req.user.id)) }));
app.get('/api/profile/me', auth, async (req, res) => ok(res, { user: publicUser(await store.getUser(req.user.id)) }));
app.put('/api/profile/me', auth, async (req, res) => {
  const p = {};
  if (req.body.full_name !== undefined) { if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'Invalid full_name'); p.full_name = req.body.full_name.trim(); }
  if (req.body.phone !== undefined) p.phone = String(req.body.phone).slice(0, 50);
  const u = await store.updateUser(req.user.id, p);
  return ok(res, { user: publicUser(u) });
});

// --- Levels & courses ---
app.get('/api/levels', async (req, res) => ok(res, { levels: await store.listLevels() }));
app.get('/api/courses', async (req, res) => {
  const all = await store.listCourses();
  const pub = req.query.all === '1' && ['admin', 'teacher'].includes(req.user?.role) ? all : all;
  return ok(res, { courses: pub });
});
app.get('/api/courses/:id', async (req, res) => { const c = await store.getCourse(req.params.id); return c ? ok(res, { course: c }) : bad(res, 404, 'Course not found'); });
app.post('/api/courses', auth, roles('admin', 'teacher'), async (req, res) => {
  const b = req.body || {};
  if (!reqStr(b, 'slug', 100) || !reqStr(b, 'title_en', 200)) return bad(res, 400, 'slug and title_en required');
  const c = await store.createCourse({ slug: b.slug.trim(), level_id: b.level_id || null, title_en: b.title_en.trim(), title_ar: b.title_ar || null, description_en: b.description_en || null, description_ar: b.description_ar || null, duration_weeks: b.duration_weeks || null, price_amount: null, price_currency: 'ILS', is_published: b.is_published !== false, teacher_id: req.user.role === 'teacher' ? req.user.id : (b.teacher_id || null) });
  return ok(res, { course: c }, 201);
});
app.put('/api/courses/:id', auth, roles('admin', 'teacher'), async (req, res) => {
  const c = await store.updateCourse(req.params.id, { ...req.body, price_amount: undefined });
  return c ? ok(res, { course: c }) : bad(res, 404, 'Course not found');
});
app.delete('/api/courses/:id', auth, roles('admin'), async (req, res) => {
  const c = await store.getCourse(req.params.id);
  if (!c) return bad(res, 404, 'Course not found');
  return (await store.deleteCourse(c.id) ? ok(res, { deleted: true }) : bad(res, 404, 'Course not found'));
});

// --- Lessons ---
app.get('/api/lessons', async (req, res) => ok(res, { lessons: await store.listLessons(req.query.course_id || null) }));
app.post('/api/lessons', auth, roles('admin', 'teacher'), async (req, res) => {
  const b = req.body || {};
  if (!reqStr(b, 'course_id') || !reqStr(b, 'title_en', 200)) return bad(res, 400, 'course_id and title_en required');
  return ok(res, { lesson: await store.createLesson({ course_id: b.course_id, title_en: b.title_en.trim(), title_ar: b.title_ar || null, content_url: b.content_url || null, material_url: b.material_url || null, live_class_url: b.live_class_url || null, order_no: b.order_no || 1 }) }, 201);
});

// --- Booking requests (anonymous: students apply BEFORE having an account) ---
app.use('/api/booking-requests', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true }));
app.post('/api/booking-requests', async (req, res) => {
  try {
    if (!reqStr(req.body, 'full_name', 200)) return bad(res, 400, 'full_name required');
    const b = req.body || {};
    const r = await store.createBookingRequest({ full_name: b.full_name.trim(), phone: typeof b.phone === 'string' ? b.phone.slice(0, 50) : null, course: typeof b.course === 'string' ? b.course.slice(0, 200) : null, source: typeof b.source === 'string' ? b.source.slice(0, 50) : null, message: typeof b.message === 'string' ? b.message.slice(0, 2000) : null });
    return ok(res, { booking_request: r }, 201);
  } catch (e) { console.error(e); return bad(res, 500, 'Booking request failed'); }
});
app.get('/api/admin/booking-requests', auth, roles('admin'), async (req, res) => ok(res, { booking_requests: await store.listBookingRequests() }));
app.put('/api/admin/booking-requests/:id', auth, roles('admin'), async (req, res) => {
  if (!['pending', 'confirmed', 'rejected'].includes(req.body?.status)) return bad(res, 400, 'status must be pending, confirmed or rejected');
  const r = await store.updateBookingRequest(req.params.id, req.body.status);
  return r ? ok(res, { booking_request: r }) : bad(res, 404, 'Booking request not found');
});

// --- Enrolments ---
app.post('/api/enrolments', auth, roles('student', 'admin'), async (req, res) => {
  if (!reqStr(req.body, 'course_id')) return bad(res, 400, 'course_id required');
  const course = await store.getCourse(req.body.course_id);
  if (!course) return bad(res, 404, 'Course not found');
  return ok(res, { enrolment: await store.createEnrolment({ student_id: req.user.id, course_id: course.id, status: 'pending' }) }, 201);
});
app.get('/api/enrolments/me', auth, async (req, res) => ok(res, { enrolments: await store.listEnrolmentsForUser(req.user.id) }));
app.get('/api/enrolments', auth, roles('admin', 'teacher'), async (req, res) => ok(res, { enrolments: await store.listEnrolmentsAll() }));

// --- Placement test: 20 questions, scored server-side ---
// Must match the 20 questions in frontend/app.js (QUIZ_ANSWERS), in order.
const PLACEMENT_ANSWERS = [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 2, 1, 1, 1, 0, 1, 1];
function levelFor(score, total) {
  const r = score / total;
  if (r < 0.25) return 'A1'; if (r < 0.45) return 'A2'; if (r < 0.65) return 'B1';
  if (r < 0.85) return 'B2'; if (r < 0.95) return 'C1'; return 'C2';
}
app.post('/api/placement-tests', auth, async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== 20 || answers.some(a => ![0, 1, 2].includes(a))) return bad(res, 400, 'answers must be an array of 20 option indexes (0-2)');
  let score = 0; answers.forEach((a, i) => { if (a === PLACEMENT_ANSWERS[i]) score++; });
  const result = await store.createPlacement({ student_id: req.user.id, score, total: 20, recommended_level: levelFor(score, 20), answers });
  return ok(res, { result }, 201);
});
app.get('/api/placement-tests/me', auth, async (req, res) => ok(res, { results: await store.listPlacementsForUser(req.user.id) }));

// --- Assignments / submissions / grades ---
app.post('/api/assignments', auth, roles('admin', 'teacher'), async (req, res) => {
  if (!reqStr(req.body, 'course_id') || !reqStr(req.body, 'title', 300)) return bad(res, 400, 'course_id and title required');
  return ok(res, { assignment: await store.createAssignment({ course_id: req.body.course_id, teacher_id: req.user.id, title: req.body.title.trim(), description: req.body.description || null, due_date: req.body.due_date || null }) }, 201);
});
app.get('/api/assignments', async (req, res) => ok(res, { assignments: await store.listAssignments(req.query.course_id || null) }));
app.post('/api/submissions', auth, roles('student'), async (req, res) => {
  if (!reqStr(req.body, 'assignment_id') || (!reqStr(req.body, 'content_text', 5000) && !reqStr(req.body, 'content_url', 1000))) return bad(res, 400, 'assignment_id and content_text or content_url required');
  return ok(res, { submission: await store.createSubmission({ assignment_id: req.body.assignment_id, student_id: req.user.id, content_text: req.body.content_text || null, content_url: req.body.content_url || null }) }, 201);
});
app.get('/api/submissions', auth, roles('admin', 'teacher'), async (req, res) => ok(res, { submissions: await store.listSubmissions(req.query.assignment_id || null) }));
app.post('/api/submissions/:id/grade', auth, roles('admin', 'teacher'), async (req, res) => {
  const grade = Number(req.body?.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return bad(res, 400, 'grade must be a number 0-100');
  const s = await store.gradeSubmission(req.params.id, grade, req.body?.feedback || null);
  return s ? ok(res, { submission: s }) : bad(res, 404, 'Submission not found');
});

// --- Attendance / announcements ---
app.post('/api/attendance', auth, roles('admin', 'teacher'), async (req, res) => {
  if (!reqStr(req.body, 'course_id') || !reqStr(req.body, 'student_id')) return bad(res, 400, 'course_id and student_id required');
  if (!['present', 'absent', 'late', 'excused'].includes(req.body.status || 'present')) return bad(res, 400, 'Invalid status');
  return ok(res, { attendance: await store.createAttendance({ course_id: req.body.course_id, student_id: req.body.student_id, lesson_id: req.body.lesson_id || null, status: req.body.status || 'present', attended_on: req.body.attended_on || null }) }, 201);
});
app.get('/api/attendance', auth, roles('admin', 'teacher'), async (req, res) => ok(res, { attendance: await store.listAttendance(req.query.course_id || null) }));
app.post('/api/announcements', auth, roles('admin', 'teacher'), async (req, res) => {
  if (!reqStr(req.body, 'title', 300) || !reqStr(req.body, 'body', 5000)) return bad(res, 400, 'title and body required');
  return ok(res, { announcement: await store.createAnnouncement({ author_id: req.user.id, title: req.body.title.trim(), body: req.body.body, audience: req.body.audience || 'all' }) }, 201);
});
app.get('/api/announcements', async (req, res) => ok(res, { announcements: await store.listAnnouncements() }));

// --- Payments: PLACEHOLDER ONLY — records an intent/status, no provider, no money ---
app.post('/api/payments', auth, async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount !== null && (typeof req.body.amount !== 'number' || req.body.amount < 0)) return bad(res, 400, 'Invalid amount');
  return ok(res, { payment: await store.createPayment({ student_id: req.user.id, course_id: req.body.course_id || null, amount: req.body.amount ?? null, currency: req.body.currency || 'ILS', status: 'pending', provider_ref: null }), note: 'PLACEHOLDER: no payment provider is connected and no money moves. The owner must choose a provider before launch.' }, 201);
});
app.get('/api/payments/me', auth, async (req, res) => ok(res, { payments: await store.listPaymentsForUser(req.user.id) }));
app.get('/api/payments', auth, roles('admin'), async (req, res) => ok(res, { payments: await store.listPaymentsAll() }));

// --- Admin: users list ---
app.get('/api/admin/users', auth, roles('admin'), async (req, res) => ok(res, { users: (await store.listUsers()).map(publicUser) }));

app.use((req, res) => bad(res, 404, 'Not found'));
app.use((err, req, res, next) => { console.error(err); return bad(res, err.message === 'CORS origin not allowed' ? 403 : 500, err.message === 'CORS origin not allowed' ? 'Origin not allowed' : 'Server error'); });

async function main() {
  await seedDemo(store, bcrypt);
  app.listen(PORT, () => console.log(`BBC Academy API listening on http://localhost:${PORT} (store=${store.kind})`));
}
if (require.main === module) main();
module.exports = { app, store, levelFor };
