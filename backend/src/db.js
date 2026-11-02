// Data layer: PostgreSQL (via pg) when DATABASE_URL is set, otherwise an
// in-memory store with the same interface. The in-memory store is for local
// development / smoke tests only and loses data on restart. Production must
// use DATABASE_URL (Supabase) — see docs/DEPLOY.md.
const crypto = require('crypto');
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

const DEMO_LEVELS = [
  { code: 'A1', name_en: 'Beginner', name_ar: 'مبتدئ', order_no: 1, description_en: 'First steps: greetings, everyday words, simple sentences.', description_ar: 'خطوات أولى: تحيات وكلمات يومية وجمل بسيطة.' },
  { code: 'A2', name_en: 'Elementary', name_ar: 'ابتدائي', order_no: 2, description_en: 'Everyday conversation, routine topics, short messages.', description_ar: 'محادثة يومية ومواضيع روتينية ورسائل قصيرة.' },
  { code: 'B1', name_en: 'Intermediate', name_ar: 'متوسط', order_no: 3, description_en: 'Opinions, stories, travel and work situations.', description_ar: 'آراء وقصص ومواقف سفر وعمل.' },
  { code: 'B2', name_en: 'Upper Intermediate', name_ar: 'فوق المتوسط', order_no: 4, description_en: 'Debate, presentations, clear writing for study and work.', description_ar: 'نقاش وعروض وكتابة واضحة للدراسة والعمل.' },
  { code: 'C1', name_en: 'Advanced', name_ar: 'متقدم', order_no: 5, description_en: 'Fluent, flexible English for academic and professional use.', description_ar: 'إنجليزية طليقة ومرنة للاستخدام الأكاديمي والمهني.' },
  { code: 'C2', name_en: 'Proficiency', name_ar: 'إتقان', order_no: 6, description_en: 'Near-native precision across complex topics.', description_ar: 'دقة قريبة من الناطقين الأصليين في مواضيع معقدة.' },
];
const DEMO_COURSES = [
  { slug: 'general-a1', level_code: 'A1', title_en: 'General English A1', title_ar: 'الإنجليزية العامة A1', description_en: 'Speak, listen, read and write with confidence from the first lesson.', description_ar: 'تحدث واستمع واقرأ واكتب بثقة من الدرس الأول.', duration_weeks: 8, price_amount: null, price_currency: 'ILS', is_published: true },
  { slug: 'general-a2', level_code: 'A2', title_en: 'General English A2', title_ar: 'الإنجليزية العامة A2', description_en: 'Everyday vocabulary, grammar and conversation for daily life.', description_ar: 'مفردات وقواعد ومحادثة يومية للحياة اليومية.', duration_weeks: 8, price_amount: null, price_currency: 'ILS', is_published: true },
  { slug: 'general-b1', level_code: 'B1', title_en: 'General English B1', title_ar: 'الإنجليزية العامة B1', description_en: 'Discuss opinions, tell stories and handle travel and work situations.', description_ar: 'ناقش الآراء واحكِ القصص وتعامل مع مواقف السفر والعمل.', duration_weeks: 10, price_amount: null, price_currency: 'ILS', is_published: true },
  { slug: 'general-b2', level_code: 'B2', title_en: 'General English B2', title_ar: 'الإنجليزية العامة B2', description_en: 'Debate, present and write clearly for study and professional use.', description_ar: 'ناقش وقدّم واكتب بوضوح للدراسة والاستخدام المهني.', duration_weeks: 10, price_amount: null, price_currency: 'ILS', is_published: true },
  { slug: 'ielts-prep', level_code: 'B2', title_en: 'IELTS Preparation (Demo)', title_ar: 'التحضير لاختبار IELTS (تجريبي)', description_en: 'Exam strategies, timed practice and feedback on all four skills.', description_ar: 'استراتيجيات الامتحان وتدريب موقوت وملاحظات على المهارات الأربع.', duration_weeks: 6, price_amount: null, price_currency: 'ILS', is_published: true },
  { slug: 'conversation-club', level_code: 'A2', title_en: 'Conversation Club', title_ar: 'نادي المحادثة', description_en: 'Weekly speaking practice on real-life topics, in small groups.', description_ar: 'تدريب أسبوعي على التحدث حول مواضيع واقعية في مجموعات صغيرة.', duration_weeks: 4, price_amount: null, price_currency: 'ILS', is_published: true },
];
// NOTE: price_amount is null on purpose. Prices are TODO for the owner —
// never invent a real price. The frontend renders "Price: TODO — confirm".

class MemoryStore {
  constructor() {
    this.users = []; this.courses = []; this.levels = [...DEMO_LEVELS.map((l, i) => ({ id: `level-${l.code}`, ...l }))];
    this.lessons = []; this.enrolments = []; this.placements = []; this.assignments = [];
    this.submissions = []; this.attendance = []; this.announcements = []; this.payments = [];
    this.courses = DEMO_COURSES.map((c, i) => ({ id: `course-${c.slug}`, teacher_id: null, ...c, created_at: now() }));
  }
  async findUserByEmail(e) { return this.users.find(u => u.email === e.toLowerCase()) || null; }
  async getUser(id) { return this.users.find(u => u.id === id) || null; }
  async listUsers() { return this.users; }
  async createUser(u) { const r = { id: uid(), created_at: now(), ...u, email: u.email.toLowerCase() }; this.users.push(r); return r; }
  async updateUser(id, p) { const u = await this.getUser(id); if (!u) return null; Object.assign(u, p); return u; }
  async listLevels() { return [...this.levels].sort((a, b) => a.order_no - b.order_no); }
  async listCourses() { return this.courses; }
  async getCourse(id) { return this.courses.find(c => c.id === id || c.slug === id) || null; }
  async createCourse(c) { const r = { id: uid(), created_at: now(), ...c }; this.courses.push(r); return r; }
  async updateCourse(id, p) { const c = await this.getCourse(id); if (!c) return null; Object.assign(c, p); return c; }
  async deleteCourse(id) { const i = this.courses.findIndex(c => c.id === id); if (i < 0) return false; this.courses.splice(i, 1); return true; }
  async listLessons(courseId) { return this.lessons.filter(l => !courseId || l.course_id === courseId).sort((a, b) => a.order_no - b.order_no); }
  async createLesson(l) { const r = { id: uid(), created_at: now(), ...l }; this.lessons.push(r); return r; }
  async createEnrolment(e) { const r = { id: uid(), status: 'pending', created_at: now(), ...e }; this.enrolments.push(r); return r; }
  async listEnrolmentsForUser(uid_) { return this.enrolments.filter(e => e.student_id === uid_); }
  async listEnrolmentsAll() { return this.enrolments; }
  async createPlacement(p) { const r = { id: uid(), created_at: now(), ...p }; this.placements.push(r); return r; }
  async listPlacementsForUser(uid_) { return this.placements.filter(p => p.student_id === uid_); }
  async createAssignment(a) { const r = { id: uid(), created_at: now(), ...a }; this.assignments.push(r); return r; }
  async listAssignments(courseId) { return this.assignments.filter(a => !courseId || a.course_id === courseId); }
  async createSubmission(s) { const r = { id: uid(), grade: null, feedback: null, created_at: now(), ...s }; this.submissions.push(r); return r; }
  async listSubmissions(assignmentId) { return this.submissions.filter(s => !assignmentId || s.assignment_id === assignmentId); }
  async gradeSubmission(id, grade, feedback) { const s = this.submissions.find(x => x.id === id); if (!s) return null; s.grade = grade; s.feedback = feedback; return s; }
  async createAttendance(a) { const r = { id: uid(), created_at: now(), attended_on: new Date().toISOString().slice(0, 10), ...a, attended_on: a.attended_on || new Date().toISOString().slice(0, 10) }; this.attendance.push(r); return r; }
  async listAttendance(courseId) { return this.attendance.filter(a => !courseId || a.course_id === courseId); }
  async createAnnouncement(a) { const r = { id: uid(), created_at: now(), ...a }; this.announcements.push(r); return r; }
  async listAnnouncements() { return [...this.announcements].reverse(); }
  async createPayment(p) { const r = { id: uid(), status: 'pending', created_at: now(), ...p }; this.payments.push(r); return r; }
  async listPaymentsForUser(uid_) { return this.payments.filter(p => p.student_id === uid_); }
  async listPaymentsAll() { return this.payments; }
}

class PgStore {
  constructor(pool) { this.pool = pool; }
  async q(t, v = []) { return (await this.pool.query(t, v)).rows; }
  async findUserByEmail(e) { return (await this.q('SELECT * FROM profiles WHERE email=$1', [e.toLowerCase()]))[0] || null; }
  async getUser(id) { return (await this.q('SELECT * FROM profiles WHERE id=$1', [id]))[0] || null; }
  async listUsers() { return this.q('SELECT id,email,full_name,role,phone,created_at FROM profiles ORDER BY created_at'); }
  async createUser(u) { return (await this.q('INSERT INTO profiles (email,full_name,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5) RETURNING *', [u.email.toLowerCase(), u.full_name, u.password_hash, u.role, u.phone || null]))[0]; }
  async updateUser(id, p) { const sets = []; const vals = []; let i = 1; for (const [k, v] of Object.entries(p)) { sets.push(`${k}=$${i++}`); vals.push(v); } if (!sets.length) return this.getUser(id); vals.push(id); return (await this.q(`UPDATE profiles SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals))[0] || null; }
  async listLevels() { return this.q('SELECT * FROM levels ORDER BY order_no'); }
  async listCourses() { return this.q('SELECT * FROM courses ORDER BY created_at'); }
  async getCourse(id) { return (await this.q('SELECT * FROM courses WHERE id::text=$1 OR slug=$1', [id]))[0] || null; }
  async createCourse(c) { return (await this.q('INSERT INTO courses (slug,level_id,title_en,title_ar,description_en,description_ar,duration_weeks,price_amount,price_currency,is_published,teacher_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [c.slug, c.level_id || null, c.title_en, c.title_ar || null, c.description_en || null, c.description_ar || null, c.duration_weeks || null, c.price_amount || null, c.price_currency || 'ILS', c.is_published !== false, c.teacher_id || null]))[0]; }
  async updateCourse(id, p) { const sets = []; const vals = []; let i = 1; for (const [k, v] of Object.entries(p)) { if (['id', 'created_at'].includes(k)) continue; sets.push(`${k}=$${i++}`); vals.push(v); } if (!sets.length) return this.getCourse(id); vals.push(id); return (await this.q(`UPDATE courses SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals))[0] || null; }
  async deleteCourse(id) { const r = await this.pool.query('DELETE FROM courses WHERE id=$1', [id]); return r.rowCount > 0; }
  async listLessons(courseId) { return courseId ? this.q('SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_no', [courseId]) : this.q('SELECT * FROM lessons ORDER BY order_no'); }
  async createLesson(l) { return (await this.q('INSERT INTO lessons (course_id,title_en,title_ar,content_url,material_url,live_class_url,order_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [l.course_id, l.title_en, l.title_ar || null, l.content_url || null, l.material_url || null, l.live_class_url || null, l.order_no || 1]))[0]; }
  async createEnrolment(e) { return (await this.q('INSERT INTO enrolments (student_id,course_id,status) VALUES ($1,$2,$3) RETURNING *', [e.student_id, e.course_id, e.status || 'pending']))[0]; }
  async listEnrolmentsForUser(u) { return this.q('SELECT * FROM enrolments WHERE student_id=$1 ORDER BY created_at DESC', [u]); }
  async listEnrolmentsAll() { return this.q('SELECT * FROM enrolments ORDER BY created_at DESC'); }
  async createPlacement(p) { return (await this.q('INSERT INTO placement_results (student_id,score,total,recommended_level,answers) VALUES ($1,$2,$3,$4,$5) RETURNING *', [p.student_id, p.score, p.total, p.recommended_level, JSON.stringify(p.answers || [])]))[0]; }
  async listPlacementsForUser(u) { return this.q('SELECT * FROM placement_results WHERE student_id=$1 ORDER BY created_at DESC', [u]); }
  async createAssignment(a) { return (await this.q('INSERT INTO assignments (course_id,teacher_id,title,description,due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *', [a.course_id, a.teacher_id, a.title, a.description || null, a.due_date || null]))[0]; }
  async listAssignments(courseId) { return courseId ? this.q('SELECT * FROM assignments WHERE course_id=$1 ORDER BY created_at DESC', [courseId]) : this.q('SELECT * FROM assignments ORDER BY created_at DESC'); }
  async createSubmission(s) { return (await this.q('INSERT INTO submissions (assignment_id,student_id,content_url,content_text) VALUES ($1,$2,$3,$4) RETURNING *', [s.assignment_id, s.student_id, s.content_url || null, s.content_text || null]))[0]; }
  async listSubmissions(aid) { return aid ? this.q('SELECT * FROM submissions WHERE assignment_id=$1 ORDER BY created_at DESC', [aid]) : this.q('SELECT * FROM submissions ORDER BY created_at DESC'); }
  async gradeSubmission(id, grade, feedback) { const s = (await this.q('UPDATE submissions SET grade=$1, feedback=$2 WHERE id=$3 RETURNING *', [grade, feedback || null, id]))[0]; if (!s) return null; await this.q('INSERT INTO grades (submission_id,student_id,score,feedback) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [id, s.student_id, grade, feedback || null]).catch(() => {}); return s; }
  async createAttendance(a) { return (await this.q('INSERT INTO attendance (course_id,student_id,lesson_id,status,attended_on) VALUES ($1,$2,$3,$4,$5) RETURNING *', [a.course_id, a.student_id, a.lesson_id || null, a.status || 'present', a.attended_on || new Date().toISOString().slice(0, 10)]))[0]; }
  async listAttendance(courseId) { return courseId ? this.q('SELECT * FROM attendance WHERE course_id=$1 ORDER BY attended_on DESC', [courseId]) : this.q('SELECT * FROM attendance ORDER BY attended_on DESC'); }
  async createAnnouncement(a) { return (await this.q('INSERT INTO announcements (author_id,title,body,audience) VALUES ($1,$2,$3,$4) RETURNING *', [a.author_id, a.title, a.body, a.audience || 'all']))[0]; }
  async listAnnouncements() { return this.q('SELECT * FROM announcements ORDER BY created_at DESC'); }
  async createPayment(p) { return (await this.q('INSERT INTO payments (student_id,course_id,amount,currency,status,provider,provider_ref) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [p.student_id, p.course_id || null, p.amount || null, p.currency || 'ILS', p.status || 'pending', 'placeholder', p.provider_ref || null]))[0]; }
  async listPaymentsForUser(u) { return this.q('SELECT * FROM payments WHERE student_id=$1 ORDER BY created_at DESC', [u]); }
  async listPaymentsAll() { return this.q('SELECT * FROM payments ORDER BY created_at DESC'); }
}

function createStore() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const s = new PgStore(pool); s.kind = 'postgres'; s.pool = pool; return s;
  }
  const s = new MemoryStore(); s.kind = 'memory'; return s;
}
async function seedDemo(store, bcrypt) {
  if (process.env.SEED_DEMO === 'false') return;
  if (store.kind === 'postgres') {
    try {
      const existing = await store.listLevels();
      if (!existing.length) for (const l of DEMO_LEVELS) await store.q('INSERT INTO levels (code,name_en,name_ar,order_no,description_en,description_ar) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING', [l.code, l.name_en, l.name_ar, l.order_no, l.description_en, l.description_ar]);
      const courses = await store.listCourses();
      if (!courses.length) { const levels = await store.listLevels(); const byCode = Object.fromEntries(levels.map(x => [x.code, x.id])); for (const c of DEMO_COURSES) await store.createCourse({ ...c, level_id: byCode[c.level_code] }); }
    } catch (e) { console.warn('[seed] postgres seed skipped:', e.message); }
  }
  const demos = [
    { email: 'student@demo.local', full_name: 'Demo Student', role: 'student' },
    { email: 'teacher@demo.local', full_name: 'Demo Teacher', role: 'teacher' },
    { email: 'admin@demo.local', full_name: 'Demo Admin', role: 'admin' },
  ];
  for (const d of demos) {
    if (!(await store.findUserByEmail(d.email))) {
      await store.createUser({ ...d, password_hash: await bcrypt.hash('Demo1234!', 10) });
    }
  }
}
module.exports = { createStore, seedDemo, DEMO_LEVELS, DEMO_COURSES };
