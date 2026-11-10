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
  { code: 'B2', name_en: 'Upper intermediate', name_ar: 'فوق المتوسط', order_no: 4, description_en: 'Debate, presentations, clear writing for study and work.', description_ar: 'نقاش وعروض وكتابة واضحة للدراسة والعمل.' },
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
    this.submissions = []; this.grades = []; this.attendance = []; this.announcements = []; this.payments = []; this.bookingRequests = [];
    // assignment_id -> { filename, mime_type, byte_size, data } (uploaded homework)
    this.assignmentFiles = new Map();
    // level_id, not level_code: the API and the frontend both speak level_id,
    // so the demo store must look the same as Postgres or local testing
    // misrepresents what production shows.
    this.courses = DEMO_COURSES.map((c) => {
      const lvl = this.levels.find((l) => l.code === c.level_code);
      return { id: `course-${c.slug}`, teacher_id: null, ...c, level_id: lvl ? lvl.id : null, created_at: now() };
    });
  }
  async findUserByEmail(e) { return this.users.find(u => u.email === e.toLowerCase()) || null; }
  async findUserByUsername(u) { return this.users.find(x => x.username && x.username === String(u).toLowerCase()) || null; }
  async getUser(id) { return this.users.find(u => u.id === id) || null; }
  async listUsers() { return this.users; }
  async createUser(u) { const r = { id: uid(), created_at: now(), ...u, username: u.username ? String(u.username).toLowerCase() : null, email: u.email.toLowerCase() }; this.users.push(r); return r; }
  async updateUser(id, p) { const u = await this.getUser(id); if (!u) return null; Object.assign(u, p); return u; }
  async listLevels() { return [...this.levels].sort((a, b) => a.order_no - b.order_no); }
  async listCourses() { return this.courses; }
  async getCourse(id) { return this.courses.find(c => c.id === id || c.slug === id) || null; }
  async createCourse(c) { const r = { id: uid(), created_at: now(), ...c }; this.courses.push(r); return r; }
  async updateCourse(id, p) { const c = await this.getCourse(id); if (!c) return null; Object.assign(c, p); return c; }
  async deleteCourse(id) { const i = this.courses.findIndex(c => c.id === id); if (i < 0) return false; this.courses.splice(i, 1); return true; }
  async listLessons(courseId) { return this.lessons.filter(l => !courseId || l.course_id === courseId).sort((a, b) => a.order_no - b.order_no); }
  async listLessonsForStudent(studentId) {
    const ids = new Set(this.enrolments.filter(e => e.student_id === studentId).map(e => e.course_id));
    return this.lessons.filter(l => ids.has(l.course_id)).sort((a, b) => a.order_no - b.order_no);
  }
  async listLessonsForTeacher(teacherId) {
    const ids = new Set(this.courses.filter(c => c.teacher_id === teacherId).map(c => c.id));
    return this.lessons.filter(l => ids.has(l.course_id)).sort((a, b) => a.order_no - b.order_no);
  }
  async createLesson(l) { const r = { id: uid(), created_at: now(), ...l }; this.lessons.push(r); return r; }
  async isEnrolled(studentId, courseId) { return this.enrolments.some(e => e.student_id === studentId && e.course_id === courseId); }
  async getEnrolment(studentId, courseId) { return this.enrolments.find(e => e.student_id === studentId && e.course_id === courseId) || null; }
  async createEnrolment(e) {
    if (this.enrolments.some(x => x.student_id === e.student_id && x.course_id === e.course_id)) {
      const err = new Error('Already enrolled'); err.code = '23505'; throw err;
    }
    const r = { id: uid(), created_at: now(), ...e, status: e.status || 'pending' };
    this.enrolments.push(r); return r;
  }
  async listEnrolmentsForUser(u) { return this.enrolments.filter(e => e.student_id === u).map(e => ({ ...e, student_name: (this.users.find(x => x.id === e.student_id) || {}).full_name || null })); }
  async updateEnrolment(id, status) { const e = this.enrolments.find(x => x.id === id); if (!e) return null; e.status = status; return e; }
  async deleteEnrolment(id) { const i = this.enrolments.findIndex(e => e.id === id); if (i < 0) return false; this.enrolments.splice(i, 1); return true; }
  async listEnrolmentsAll(teacherId) {
    let rows = this.enrolments;
    if (teacherId) {
      const ids = new Set(this.courses.filter(c => c.teacher_id === teacherId).map(c => c.id));
      rows = rows.filter(e => ids.has(e.course_id));
    }
    return rows.map(e => ({ ...e, student_name: (this.users.find(u => u.id === e.student_id) || {}).full_name || null }));
  }
  async createPlacement(p) { const r = { id: uid(), created_at: now(), ...p }; this.placements.push(r); return r; }
  async listPlacementsForUser(u) { return this.placements.filter(p => p.student_id === u); }
  async createAssignment(a) { const r = { id: uid(), created_at: now(), questions: [], ...a }; this.assignments.push(r); return r; }
  async getAssignment(id) { const a = this.assignments.find(x => x.id === id) || null; return a ? this.assignView(a) : null; }
  async deleteAssignment(id) {
    const i = this.assignments.findIndex(a => a.id === id);
    if (i < 0) return false;
    this.assignments.splice(i, 1);
    this.assignmentFiles.delete(id);
    const gone = new Set(this.submissions.filter(s => s.assignment_id === id).map(s => s.id));
    this.submissions = this.submissions.filter(s => s.assignment_id !== id);
    this.grades = this.grades.filter(g => !gone.has(g.submission_id));
    return true;
  }
  // Files are metadata in list responses; the bytes are only read by the
  // download endpoint, so keep them out of every listing.
  assignView(a) { return { ...a, questions: a.questions || [], has_file: this.assignmentFiles.has(a.id) }; }
  async attachAssignmentFile(f) {
    this.assignmentFiles.set(f.assignment_id, { filename: f.filename, mime_type: f.mime_type, byte_size: f.byte_size, data: f.data });
    const { data, ...meta } = f;
    return meta;
  }
  async getAssignmentFile(assignmentId) {
    const f = this.assignmentFiles.get(assignmentId);
    return f ? { ...f, assignment_id: assignmentId } : null;
  }
  async listAssignments(courseId) { return this.assignments.filter(a => !courseId || a.course_id === courseId).map(a => this.assignView(a)); }
  async listAssignmentsForStudent(studentId) {
    const ids = new Set(this.enrolments.filter(e => e.student_id === studentId).map(e => e.course_id));
    return this.assignments.filter(a => ids.has(a.course_id)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(a => {
      const s = this.submissions.find(x => x.assignment_id === a.id && x.student_id === studentId) || null;
      return { ...this.assignView(a), submission: s };
    });
  }
  async listAssignmentsForTeacher(teacherId) {
    const ids = new Set(this.courses.filter(c => c.teacher_id === teacherId).map(c => c.id));
    return this.assignments.filter(a => ids.has(a.course_id)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(a => this.assignView(a));
  }
  // One submission per (assignment, student): a student who answers again is
  // editing their answer, not adding a second one. The reset grade is
  // deliberate — the new text has not been marked yet.
  async createSubmission(s) {
    const existing = this.submissions.find(x => x.assignment_id === s.assignment_id && x.student_id === s.student_id);
    if (existing) {
      existing.content_text = s.content_text || null;
      existing.content_url = s.content_url || null;
      existing.answers = s.answers || [];
      existing.auto_score = s.auto_score == null ? null : s.auto_score;
      existing.auto_total = s.auto_total == null ? null : s.auto_total;
      existing.grade = null; existing.feedback = null;
      return { ...existing, created: false };
    }
    const r = { id: uid(), grade: null, feedback: null, created_at: now(), ...s, created: true };
    this.submissions.push(r); return r;
  }
  async getSubmission(id) { return this.submissions.find(s => s.id === id) || null; }
  async listSubmissions(assignmentId, teacherId) {
    let rows = this.submissions.filter(s => !assignmentId || s.assignment_id === assignmentId);
    if (teacherId) {
      const ids = new Set(this.assignments.filter(a => a.teacher_id === teacherId).map(a => a.id));
      rows = rows.filter(s => ids.has(s.assignment_id));
    }
    return rows.map(s => ({ ...s, student_name: (this.users.find(u => u.id === s.student_id) || {}).full_name || null }));
  }
  async gradeSubmission(id, grade, feedback) {
    const s = this.submissions.find(x => x.id === id); if (!s) return null;
    s.grade = grade; s.feedback = feedback;
    const g = this.grades.find(x => x.submission_id === id);
    if (g) { g.score = grade; g.feedback = feedback; }
    else this.grades.push({ id: uid(), submission_id: id, student_id: s.student_id, score: grade, feedback, created_at: now() });
    return s;
  }
  async createAttendance(a) { const r = { id: uid(), created_at: now(), ...a, attended_on: a.attended_on || new Date().toISOString().slice(0, 10) }; this.attendance.push(r); return r; }
  async listAttendance(courseId, teacherId) {
    let rows = this.attendance.filter(a => !courseId || a.course_id === courseId);
    if (teacherId) {
      const ids = new Set(this.courses.filter(c => c.teacher_id === teacherId).map(c => c.id));
      rows = rows.filter(a => ids.has(a.course_id));
    }
    return rows;
  }
  async listAttendanceForUser(u) { return this.attendance.filter(a => a.student_id === u); }
  async createAnnouncement(a) { const r = { id: uid(), created_at: now(), ...a }; this.announcements.push(r); return r; }
  async listAnnouncements() { return [...this.announcements].reverse(); }
  async createPayment(p) { const r = { id: uid(), status: 'pending', created_at: now(), ...p }; this.payments.push(r); return r; }
  async listPaymentsForUser(uid_) { return this.payments.filter(p => p.student_id === uid_); }
  async listPaymentsAll() { return this.payments; }
  async createBookingRequest(b) { const r = { id: uid(), status: 'pending', created_at: now(), ...b }; this.bookingRequests.push(r); return r; }
  async listBookingRequests() { return [...this.bookingRequests].reverse(); }
  async updateBookingRequest(id, status) { const r = this.bookingRequests.find(x => x.id === id); if (!r) return null; r.status = status; return r; }
  async deleteBookingRequest(id) { const i = this.bookingRequests.findIndex(x => x.id === id); if (i < 0) return false; this.bookingRequests.splice(i, 1); return true; }
  async deleteUser(id) { const i = this.users.findIndex(x => x.id === id); if (i < 0) return false; this.enrolments = this.enrolments.filter(e => e.student_id !== id); this.courses.forEach(c => { if (c.teacher_id === id) c.teacher_id = null; }); this.users.splice(i, 1); return true; }
}

class PgStore {
  constructor(pool) { this.pool = pool; }
  async q(t, v = []) { return (await this.pool.query(t, v)).rows; }
  async findUserByEmail(e) { return (await this.q('SELECT * FROM profiles WHERE email=$1', [e.toLowerCase()]))[0] || null; }
  async findUserByUsername(u) { return (await this.q('SELECT * FROM profiles WHERE LOWER(username)=LOWER($1)', [u]))[0] || null; }
  async getUser(id) { return (await this.q('SELECT * FROM profiles WHERE id=$1', [id]))[0] || null; }
  async listUsers() { return this.q('SELECT id,email,username,full_name,role,phone,created_at FROM profiles ORDER BY created_at'); }
  async createUser(u) { return (await this.q('INSERT INTO profiles (email,username,full_name,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [u.email.toLowerCase(), u.username ? String(u.username).toLowerCase() : null, u.full_name, u.password_hash, u.role, u.phone || null]))[0]; }
  async updateUser(id, p) { const sets = []; const vals = []; let i = 1; for (const [k, v] of Object.entries(p)) { sets.push(`${k}=$${i++}`); vals.push(v); } if (!sets.length) return this.getUser(id); vals.push(id); return (await this.q(`UPDATE profiles SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals))[0] || null; }
  async listLevels() { return this.q('SELECT * FROM levels ORDER BY order_no'); }
  async listCourses() { return this.q('SELECT * FROM courses ORDER BY created_at'); }
  async getCourse(id) { return (await this.q('SELECT * FROM courses WHERE id::text=$1 OR slug=$1', [id]))[0] || null; }
  async createCourse(c) { return (await this.q('INSERT INTO courses (slug,level_id,title_en,title_ar,description_en,description_ar,duration_weeks,price_amount,price_currency,is_published,teacher_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [c.slug, c.level_id || null, c.title_en, c.title_ar || null, c.description_en || null, c.description_ar || null, c.duration_weeks || null, c.price_amount || null, c.price_currency || 'ILS', c.is_published !== false, c.teacher_id || null]))[0]; }
  async updateCourse(id, p) { const sets = []; const vals = []; let i = 1; for (const [k, v] of Object.entries(p)) { if (['id', 'created_at'].includes(k)) continue; sets.push(`${k}=$${i++}`); vals.push(v); } if (!sets.length) return this.getCourse(id); vals.push(id); return (await this.q(`UPDATE courses SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals))[0] || null; }
  async deleteCourse(id) { const r = await this.pool.query('DELETE FROM courses WHERE id=$1', [id]); return r.rowCount > 0; }
  async listLessons(courseId) { return courseId ? this.q('SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_no', [courseId]) : this.q('SELECT * FROM lessons ORDER BY order_no'); }
  async listLessonsForStudent(studentId) { return this.q('SELECT l.* FROM lessons l JOIN enrolments e ON e.course_id=l.course_id WHERE e.student_id=$1 ORDER BY l.order_no', [studentId]); }
  async listLessonsForTeacher(teacherId) { return this.q('SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.teacher_id=$1 ORDER BY l.order_no', [teacherId]); }
  async createLesson(l) { return (await this.q('INSERT INTO lessons (course_id,title_en,title_ar,content_url,material_url,live_class_url,order_no) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [l.course_id, l.title_en, l.title_ar || null, l.content_url || null, l.material_url || null, l.live_class_url || null, l.order_no || 1]))[0]; }
  async isEnrolled(studentId, courseId) { return (await this.q('SELECT 1 FROM enrolments WHERE student_id=$1 AND course_id=$2 LIMIT 1', [studentId, courseId])).length > 0; }
  async getEnrolment(studentId, courseId) { return (await this.q('SELECT * FROM enrolments WHERE student_id=$1 AND course_id=$2', [studentId, courseId]))[0] || null; }
  async createEnrolment(e) { return (await this.q('INSERT INTO enrolments (student_id,course_id,status) VALUES ($1,$2,$3) RETURNING *', [e.student_id, e.course_id, e.status || 'pending']))[0]; }
  async listEnrolmentsForUser(u) { return this.q('SELECT e.*, p.full_name AS student_name FROM enrolments e LEFT JOIN profiles p ON p.id=e.student_id WHERE e.student_id=$1 ORDER BY e.created_at DESC', [u]); }
  async updateEnrolment(id, status) { return (await this.q('UPDATE enrolments SET status=$2 WHERE id=$1 RETURNING *', [id, status]))[0] || null; }
  async deleteEnrolment(id) { const r = await this.pool.query('DELETE FROM enrolments WHERE id=$1', [id]); return r.rowCount > 0; }
  async listEnrolmentsAll(teacherId) {
    if (teacherId) return this.q('SELECT e.*, p.full_name AS student_name FROM enrolments e JOIN courses c ON c.id=e.course_id LEFT JOIN profiles p ON p.id=e.student_id WHERE c.teacher_id=$1 ORDER BY e.created_at DESC', [teacherId]);
    return this.q('SELECT e.*, p.full_name AS student_name FROM enrolments e LEFT JOIN profiles p ON p.id=e.student_id ORDER BY e.created_at DESC');
  }
  async createPlacement(p) { return (await this.q('INSERT INTO placement_results (student_id,score,total,recommended_level,answers) VALUES ($1,$2,$3,$4,$5) RETURNING *', [p.student_id, p.score, p.total, p.recommended_level, JSON.stringify(p.answers || [])]))[0]; }
  async listPlacementsForUser(u) { return this.q('SELECT * FROM placement_results WHERE student_id=$1 ORDER BY created_at DESC', [u]); }
  async createAssignment(a) {
    return (await this.q('INSERT INTO assignments (course_id,teacher_id,title,description,due_date,questions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=assignments.id) AS has_file', [a.course_id, a.teacher_id, a.title, a.description || null, a.due_date || null, JSON.stringify(a.questions || [])]))[0];
  }
  async getAssignment(id) { return (await this.q('SELECT a.*, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=a.id) AS has_file FROM assignments a WHERE a.id=$1', [id]))[0] || null; }
  async deleteAssignment(id) { const r = await this.pool.query('DELETE FROM assignments WHERE id=$1', [id]); return r.rowCount > 0; }
  async attachAssignmentFile(f) {
    return (await this.q('INSERT INTO assignment_files (assignment_id,filename,mime_type,byte_size,data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (assignment_id) DO UPDATE SET filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type, byte_size=EXCLUDED.byte_size, data=EXCLUDED.data RETURNING assignment_id, filename, mime_type, byte_size', [f.assignment_id, f.filename, f.mime_type, f.byte_size, f.data]))[0];
  }
  async getAssignmentFile(assignmentId) { return (await this.q('SELECT * FROM assignment_files WHERE assignment_id=$1', [assignmentId]))[0] || null; }
  async listAssignments(courseId) { return courseId ? this.q('SELECT a.*, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=a.id) AS has_file FROM assignments a WHERE course_id=$1 ORDER BY created_at DESC', [courseId]) : this.q('SELECT a.*, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=a.id) AS has_file FROM assignments a ORDER BY created_at DESC'); }
  async listAssignmentsForStudent(studentId) {
    const rows = await this.q('SELECT a.*, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=a.id) AS has_file, s.id AS submission_id, s.grade, s.feedback, s.content_text AS submission_text, s.content_url AS submission_url, s.answers AS submission_answers, s.auto_score, s.auto_total, s.created_at AS submitted_at FROM assignments a JOIN enrolments e ON e.course_id=a.course_id AND e.student_id=$1 LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=$1 ORDER BY a.created_at DESC', [studentId]);
    return rows.map(r => ({ ...r, submission: r.submission_id ? { id: r.submission_id, grade: r.grade, feedback: r.feedback, content_text: r.submission_text, content_url: r.submission_url, answers: r.submission_answers || [], auto_score: r.auto_score, auto_total: r.auto_total, created_at: r.submitted_at } : null }));
  }
  async listAssignmentsForTeacher(teacherId) { return this.q('SELECT a.*, EXISTS (SELECT 1 FROM assignment_files f WHERE f.assignment_id=a.id) AS has_file FROM assignments a JOIN courses c ON c.id=a.course_id WHERE c.teacher_id=$1 ORDER BY a.created_at DESC', [teacherId]); }
  // ON CONFLICT needs submissions_assignment_student_unique (migration 007).
  // xmax = 0 is true only for a fresh insert, which is how the route tells
  // '201 created' from '200 updated' without a second query.
  async createSubmission(s) {
    const row = (await this.q(
      'INSERT INTO submissions (assignment_id,student_id,content_url,content_text,answers,auto_score,auto_total) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (assignment_id,student_id) DO UPDATE SET content_url=EXCLUDED.content_url, content_text=EXCLUDED.content_text, answers=EXCLUDED.answers, auto_score=EXCLUDED.auto_score, auto_total=EXCLUDED.auto_total, grade=NULL, feedback=NULL, created_at=now() RETURNING *, (xmax = 0) AS created',
      [s.assignment_id, s.student_id, s.content_url || null, s.content_text || null, JSON.stringify(s.answers || []), s.auto_score == null ? null : s.auto_score, s.auto_total == null ? null : s.auto_total]))[0];
    const created = row.created; delete row.created;
    return { ...row, created };
  }
  async getSubmission(id) { return (await this.q('SELECT * FROM submissions WHERE id=$1', [id]))[0] || null; }
  async listSubmissions(assignmentId, teacherId) {
    const where = []; const vals = [];
    if (assignmentId) { vals.push(assignmentId); where.push(`s.assignment_id=$${vals.length}`); }
    if (teacherId) { vals.push(teacherId); where.push(`a.teacher_id=$${vals.length}`); }
    return this.q(`SELECT s.*, p.full_name AS student_name FROM submissions s JOIN assignments a ON a.id=s.assignment_id LEFT JOIN profiles p ON p.id=s.student_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.created_at DESC`, vals);
  }
  async gradeSubmission(id, grade, feedback) {
    const s = (await this.q('UPDATE submissions SET grade=$1, feedback=$2 WHERE id=$3 RETURNING *', [grade, feedback || null, id]))[0];
    if (!s) return null;
    await this.q('INSERT INTO grades (submission_id,student_id,score,feedback) VALUES ($1,$2,$3,$4) ON CONFLICT (submission_id) DO UPDATE SET score=EXCLUDED.score, feedback=EXCLUDED.feedback', [id, s.student_id, grade, feedback || null]);
    return s;
  }
  async createAttendance(a) { return (await this.q('INSERT INTO attendance (course_id,student_id,lesson_id,status,attended_on) VALUES ($1,$2,$3,$4,$5) RETURNING *', [a.course_id, a.student_id, a.lesson_id || null, a.status || 'present', a.attended_on || new Date().toISOString().slice(0, 10)]))[0]; }
  async listAttendance(courseId, teacherId) {
    const where = []; const vals = [];
    if (courseId) { vals.push(courseId); where.push(`a.course_id=$${vals.length}`); }
    if (teacherId) { vals.push(teacherId); where.push(`c.teacher_id=$${vals.length}`); }
    const join = teacherId ? ' JOIN courses c ON c.id=a.course_id' : '';
    return this.q(`SELECT a.* FROM attendance a${join}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY a.attended_on DESC`, vals);
  }
  async listAttendanceForUser(u) { return this.q('SELECT * FROM attendance WHERE student_id=$1 ORDER BY attended_on DESC', [u]); }
  async createAnnouncement(a) { return (await this.q('INSERT INTO announcements (author_id,title,body,audience) VALUES ($1,$2,$3,$4) RETURNING *', [a.author_id, a.title, a.body, a.audience || 'all']))[0]; }
  async listAnnouncements() { return this.q('SELECT * FROM announcements ORDER BY created_at DESC'); }
  async createPayment(p) { return (await this.q('INSERT INTO payments (student_id,course_id,amount,currency,status,provider,provider_ref) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [p.student_id, p.course_id || null, p.amount ?? null, p.currency || 'ILS', p.status || 'pending', 'placeholder', p.provider_ref || null]))[0]; }
  async listPaymentsForUser(u) { return this.q('SELECT * FROM payments WHERE student_id=$1 ORDER BY created_at DESC', [u]); }
  async listPaymentsAll() { return this.q('SELECT * FROM payments ORDER BY created_at DESC'); }
  async createBookingRequest(b) { return (await this.q('INSERT INTO booking_requests (full_name,email,phone,course,source,message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [b.full_name, b.email || null, b.phone || null, b.course || null, b.source || null, b.message || null]))[0]; }
  async listBookingRequests() { return this.q('SELECT * FROM booking_requests ORDER BY created_at DESC'); }
  async updateBookingRequest(id, status) { return (await this.q('UPDATE booking_requests SET status=$2 WHERE id=$1 RETURNING *', [id, status]))[0] || null; }
  async deleteBookingRequest(id) { const r = await this.pool.query('DELETE FROM booking_requests WHERE id=$1', [id]); return r.rowCount > 0; }
  async deleteUser(id) { await this.pool.query('DELETE FROM enrolments WHERE student_id=$1', [id]); await this.pool.query('UPDATE courses SET teacher_id=NULL WHERE teacher_id=$1', [id]); const r = await this.pool.query('DELETE FROM profiles WHERE id=$1', [id]); return r.rowCount > 0; }
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
  // Safe by default: demo accounts are created only when explicitly asked, or
  // when running locally with no SEED_DEMO setting. Production defaults off.
  const enabled = process.env.SEED_DEMO === 'true' || (process.env.SEED_DEMO === undefined && process.env.NODE_ENV !== 'production');
  if (!enabled) return;
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
// The store classes are exported so tests can exercise the Postgres path
// against a throwaway schema without starting the HTTP server.
module.exports = { createStore, seedDemo, DEMO_LEVELS, DEMO_COURSES, MemoryStore, PgStore };
