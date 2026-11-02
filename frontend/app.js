// Shared frontend logic: i18n (EN/AR, RTL/LTR), API client, demo-mode fallback.
// Demo mode: when window.BBC_API_BASE is empty OR the API is unreachable,
// pages render the same demo catalogue and show a visible "demo mode" banner.
// Nothing in demo mode is a real booking, account, payment or academy fact.
const LANG_KEY = 'bbc-lang';
const TOKEN_KEY = 'bbc-token', USER_KEY = 'bbc-user';
const getLang = () => localStorage.getItem(LANG_KEY) || 'en';
const API_BASE = () => (window.BBC_API_BASE || '').replace(/\/$/, '');
let demoMode = !API_BASE();
function t(en, ar) { return getLang() === 'ar' ? (ar || en) : en; }
function applyLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-en]').forEach(el => { el.textContent = lang === 'ar' ? (el.dataset.ar || el.dataset.en) : el.dataset.en; });
  const b = document.getElementById('langBtn'); if (b) b.textContent = lang === 'ar' ? 'English' : 'العربية';
  document.querySelectorAll('[data-en-html]').forEach(el => { el.innerHTML = lang === 'ar' ? (el.dataset.arHtml || el.dataset.enHtml) : el.dataset.enHtml; });
}
function showDemoBanner() {
  if (!demoMode || document.getElementById('demoBanner')) return;
  const d = document.createElement('div');
  d.id = 'demoBanner'; d.className = 'demo-banner';
  d.textContent = t('DEMO MODE — no backend connected: data shown is demo data, nothing is really booked, paid or saved.',
    'وضع تجريبي — لا يوجد خادم متصل: البيانات المعروضة تجريبية، ولا يتم حجز أو دفع أو حفظ أي شيء فعليًا.');
  document.body.prepend(d);
}
async function api(path, opts = {}) {
  if (!API_BASE()) { demoMode = true; throw new Error('no-api'); }
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(API_BASE() + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}
async function apiOrDemo(path, demoValue) {
  try { const d = await api(path); demoMode = false; return d; }
  catch (e) { demoMode = true; showDemoBanner(); return demoValue; }
}
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
function setSession(user, token) { localStorage.setItem(USER_KEY, JSON.stringify(user)); if (token) localStorage.setItem(TOKEN_KEY, token); }
function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = 'index.html'; }
function requireRole(...roles) {
  const u = getUser();
  if (!u) { location.href = 'login.html'; return null; }
  if (roles.length && !roles.includes(u.role)) { document.body.innerHTML = '<main class="wrap"><p class="alert">' + t('This dashboard is not for your role.', 'لوحة التحكم هذه ليست لدورك.') + '</p></main>'; return null; }
  return u;
}
// Demo catalogue (mirrors backend seed; prices intentionally absent/TODO).
const DEMO_COURSES = [
  { id: 'course-general-a1', slug: 'general-a1', level_code: 'A1', title_en: 'General English A1', title_ar: 'الإنجليزية العامة A1', description_en: 'Speak, listen, read and write with confidence from the first lesson.', description_ar: 'تحدث واستمع واقرأ واكتب بثقة من الدرس الأول.', duration_weeks: 8, price_amount: null, price_currency: 'ILS' },
  { id: 'course-general-a2', slug: 'general-a2', level_code: 'A2', title_en: 'General English A2', title_ar: 'الإنجليزية العامة A2', description_en: 'Everyday vocabulary, grammar and conversation for daily life.', description_ar: 'مفردات وقواعد ومحادثة يومية للحياة اليومية.', duration_weeks: 8, price_amount: null, price_currency: 'ILS' },
  { id: 'course-general-b1', slug: 'general-b1', level_code: 'B1', title_en: 'General English B1', title_ar: 'الإنجليزية العامة B1', description_en: 'Discuss opinions, tell stories and handle travel and work situations.', description_ar: 'ناقش الآراء واحكِ القصص وتعامل مع مواقف السفر والعمل.', duration_weeks: 10, price_amount: null, price_currency: 'ILS' },
  { id: 'course-general-b2', slug: 'general-b2', level_code: 'B2', title_en: 'General English B2', title_ar: 'الإنجليزية العامة B2', description_en: 'Debate, present and write clearly for study and professional use.', description_ar: 'ناقش وقدّم واكتب بوضوح للدراسة والاستخدام المهني.', duration_weeks: 10, price_amount: null, price_currency: 'ILS' },
  { id: 'course-ielts-prep', slug: 'ielts-prep', level_code: 'B2', title_en: 'IELTS Preparation (Demo)', title_ar: 'التحضير لاختبار IELTS (تجريبي)', description_en: 'Exam strategies, timed practice and feedback on all four skills.', description_ar: 'استراتيجيات الامتحان وتدريب موقوت وملاحظات على المهارات الأربع.', duration_weeks: 6, price_amount: null, price_currency: 'ILS' },
  { id: 'course-conversation-club', slug: 'conversation-club', level_code: 'A2', title_en: 'Conversation Club', title_ar: 'نادي المحادثة', description_en: 'Weekly speaking practice on real-life topics, in small groups.', description_ar: 'تدريب أسبوعي على التحدث حول مواضيع واقعية في مجموعات صغيرة.', duration_weeks: 4, price_amount: null, price_currency: 'ILS' },
];
const DEMO_LEVELS = [
  { code: 'A1', name_en: 'Beginner', name_ar: 'مبتدئ' }, { code: 'A2', name_en: 'Elementary', name_ar: 'ابتدائي' },
  { code: 'B1', name_en: 'Intermediate', name_ar: 'متوسط' }, { code: 'B2', name_en: 'Upper Intermediate', name_ar: 'فوق المتوسط' },
  { code: 'C1', name_en: 'Advanced', name_ar: 'متقدم' }, { code: 'C2', name_en: 'Proficiency', name_ar: 'إتقان' },
];
function courseTitle(c) { return getLang() === 'ar' ? (c.title_ar || c.title_en) : c.title_en; }
function courseDesc(c) { return getLang() === 'ar' ? (c.description_ar || c.description_en || '') : (c.description_en || ''); }
function priceText(c) { return c.price_amount == null ? t('Price: TODO — owner to confirm', 'السعر: بانتظار تأكيد المالك') : (c.price_amount + ' ' + (c.price_currency || 'ILS')); }
function courseCard(c) {
  return `<article class="card"><span class="tag">${c.level_code || ''}</span><h3>${courseTitle(c)}</h3><p class="muted">${courseDesc(c)}</p><p>${c.duration_weeks ? `<strong>${c.duration_weeks}</strong> ${t('weeks', 'أسابيع')} · ` : ''}${priceText(c)}</p><p><a class="btn small" href="course.html?id=${encodeURIComponent(c.slug || c.id)}">${t('Details & enrol', 'التفاصيل والتسجيل')}</a></p></article>`;
}
async function loadCourses(gridId, filter) {
  const grid = document.getElementById(gridId); if (!grid) return;
  const data = await apiOrDemo('/api/courses', { courses: DEMO_COURSES });
  const list = (data.courses || []).filter(c => !filter || filter === 'all' || (c.level_code || '') === filter);
  grid.innerHTML = list.map(courseCard).join('') || `<p class="muted">${t('No courses found.', 'لا توجد دورات.')}</p>`;
}
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('langBtn');
  if (b) b.addEventListener('click', () => { applyLang(getLang() === 'ar' ? 'en' : 'ar'); location.reload(); });
  applyLang(getLang());
  if (demoMode) showDemoBanner();
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const authArea = document.getElementById('authArea');
  const u = getUser();
  if (authArea) {
    authArea.innerHTML = u
      ? `<span class="muted">${u.full_name} (${u.role})</span> <a class="btn small" href="dashboard-${u.role === 'admin' ? 'admin' : u.role === 'teacher' ? 'teacher' : 'student'}.html">${t('Dashboard', 'لوحة التحكم')}</a> <button class="btn small outline" id="logoutBtn2">${t('Logout', 'تسجيل الخروج')}</button>`
      : `<a class="btn small" href="login.html">${t('Login', 'تسجيل الدخول')}</a>`;
    const l2 = document.getElementById('logoutBtn2'); if (l2) l2.addEventListener('click', logout);
  }
});

// Placement quiz: 20 scored questions (grammar/vocabulary/reading).
// The frontend scores for instant feedback; when logged in AND an API is
// configured, the answers are also POSTed so the backend scores and stores
// the official result. Demo-mode results are NOT official placements.
const QUIZ = [
  { q: ['Choose the correct sentence.', 'اختر الجملة الصحيحة.'], o: ['I am go to school.', 'I go to school.', 'I going school.'] },
  { q: ['She ___ a teacher.', 'هي ___ معلمة.'], o: ['is', 'are', 'am'] },
  { q: ['Past of "go" is ___.', 'الماضي من "go" هو ___.'], o: ['goed', 'went', 'gone to'] },
  { q: ['"I have lived here ___ 2020."', '"I have lived here ___ 2020."'], o: ['for', 'since', 'from'] },
  { q: ['Which is most formal?', 'أيها الأكثر رسمية؟'], o: ['Wanna come?', 'Could you please join us?', 'Come now!'] },
  { q: ['"Despite the rain, ___."', '"Despite the rain, ___."'], o: ['we went out', 'we go yesterday', 'we are go'] },
  { q: ['If I ___ more time, I would study French.', 'لو ___ وقت أكثر، لدرست الفرنسية.'], o: ['have', 'had', 'has'] },
  { q: ['He has worked here ___ three years.', 'هو يعمل هنا ___ ثلاث سنوات.'], o: ['since', 'for', 'during'] },
  { q: ['"Can you ___ me with this bag?"', '"Can you ___ me with this bag?"'], o: ['help', 'helps', 'helping'] },
  { q: ['The opposite of "generous" is ___.', 'عكس "generous" هو ___.'], o: ['kind', 'selfish', 'selfishly'] },
  { q: ['She ___ to London twice.', 'هي ___ إلى لندن مرتين.'], o: ['has been', 'have been', 'is been'] },
  { q: ['"I wish I ___ speak English fluently."', '"I wish I ___ speak English fluently."'], o: ['could', 'can', 'will'] },
  { q: ['The book ___ on the table yesterday.', 'الكتاب ___ على الطاولة أمس.'], o: ['was', 'were', 'is'] },
  { q: ['"Neither Ali ___ Sara came to class."', '"Neither Ali ___ Sara came to class."'], o: ['or', 'and', 'nor'] },
  { q: ['Choose the correctly spelled word.', 'اختر الكلمة المكتوبة بشكل صحيح.'], o: ['accomodate', 'accommodate', 'acommodate'] },
  { q: ['"By this time tomorrow, we ___ our exams."', '"By this time tomorrow, we ___ our exams."'], o: ['will finish', 'will have finished', 'finish'] },
  { q: ['A word that means "to make something easier to understand".', 'كلمة تعني "جعل شيء أسهل للفهم".'], o: ['complicate', 'clarify', 'ignore'] },
  { q: ['"Hardly ___ arrived when it started to rain."', '"Hardly ___ arrived when it started to rain."'], o: ['had we', 'we had', 'did we'] },
  { q: ['Which sentence is correct?', 'أي جملة صحيحة؟'], o: ['She don\'t like tea.', 'She doesn\'t like tea.', 'She isn\'t like tea.'] },
  { q: ['"The proposal was ___ by the committee." (formal)', '"The proposal was ___ by the committee." (formal)'], o: ['turned down', 'rejected', 'refused off'] },
];
const QUIZ_ANSWERS = [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 2, 1, 1, 1, 0, 1, 1];
function quizLevel(score, total) {
  const r = score / total;
  if (r < 0.25) return 'A1'; if (r < 0.45) return 'A2'; if (r < 0.65) return 'B1';
  if (r < 0.85) return 'B2'; if (r < 0.95) return 'C1'; return 'C2';
}
let quizIdx = 0, quizAnswers = [];
function quizStart() { quizIdx = 0; quizAnswers = []; quizShow(); }
function quizShow() {
  const box = document.getElementById('quizBox'); if (!box) return;
  const lang = getLang();
  if (quizIdx >= QUIZ.length) {
    let score = 0; quizAnswers.forEach((a, i) => { if (a === QUIZ_ANSWERS[i]) score++; });
    const lvl = quizLevel(score, QUIZ.length);
    box.innerHTML = `<div class="success"><h3>${lang === 'ar' ? 'نتيجتك' : 'Your result'}</h3><p>${score} / ${QUIZ.length} — <strong>${lvl}</strong> ${t('recommended level', 'المستوى الموصى به')}</p><p class="muted">${demoMode ? t('Demo-mode result only — not an official placement. Log in with a connected backend to store the result.', 'نتيجة تجريبية فقط — ليست تحديد مستوى رسميًا. سجّل الدخول مع خادم متصل لحفظ النتيجة.') : t('Result saved to your account (if logged in). A teacher can still override it.', 'تم حفظ النتيجة في حسابك (إن كنت مسجلًا). ويمكن للمعلم تعديلها.')}</p><p><a class="btn" href="courses.html">${t('Browse courses', 'تصفح الدورات')}</a> <button class="btn outline" onclick="quizStart()">${t('Retake', 'إعادة الاختبار')}</button></p></div>`;
    if (!demoMode && getUser()) api('/api/placement-tests', { method: 'POST', body: JSON.stringify({ answers: quizAnswers }) }).catch(() => {});
    return;
  }
  const q = QUIZ[quizIdx];
  box.innerHTML = `<p><strong>${lang === 'ar' ? 'السؤال' : 'Question'} ${quizIdx + 1} / ${QUIZ.length}</strong></p><div class="bar"><i style="width:${Math.round(quizIdx / QUIZ.length * 100)}%"></i></div><h3>${lang === 'ar' ? q.q[1] : q.q[0]}</h3>` + q.o.map((o, i) => `<button class="quiz-opt" onclick="quizAnswer(${i})">${o}</button>`).join('');
}
function quizAnswer(i) { quizAnswers.push(i); quizIdx++; quizShow(); }
