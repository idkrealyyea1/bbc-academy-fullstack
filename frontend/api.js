// BBC Academy — full-stack API layer (NOT in the demo repo).
// Loaded after config.js and BEFORE app.js / new-home.js, so its form
// handlers register first and can take over in connected mode.
// Rules:
//  - No API base set (config.js empty, no localStorage override) = demo mode:
//    do nothing here; the demo mock handlers in app.js / new-home.js run.
//  - API base set = connected mode: login uses the real API (no demo fallback),
//    booking posts a real booking request, courses come from the API.
//  - A failed connected request never silently falls back to demo success.
(function () {
  function base() {
    var b = (window.BBC_API_BASE || localStorage.getItem('bbc_api_base') || '').replace(/\/$/, '');
    return b;
  }
  function token() { return localStorage.getItem('bbc-token') || ''; }
  async function req(path, opts) {
    var o = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (token()) headers.Authorization = 'Bearer ' + token();
    var res = await fetch(base() + path, { method: o.method || 'GET', headers: headers, body: o.body ? JSON.stringify(o.body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }
  window.BBC_API = { base: base, req: req };
  function lang() { return (localStorage.getItem('bbc-lang') || 'ar'); }
  function errBox(form, msg) {
    var el = form.querySelector('.api-error');
    if (!el) { el = document.createElement('p'); el.className = 'api-error'; el.style.cssText = 'color:#a83238;font-weight:700;margin:12px 0'; form.appendChild(el); }
    el.hidden = false; el.textContent = msg;
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!base()) return;
    // Connected mode: the login demo note is no longer true.
    var note = document.getElementById('loginDemoNote'); if (note) note.hidden = true;
    document.querySelectorAll('.demo-note').forEach(function (el) { el.hidden = true; });
    // --- Login: real auth, redirect by role ---
    var loginForm = document.querySelector('form[data-mock="loginOk"]');
    if (loginForm) loginForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var inputs = loginForm.querySelectorAll('input');
      try {
        var ident = inputs[0].value.trim();
        var data = await req('/api/auth/login', { method: 'POST', body: (ident.indexOf('@') >= 0 ? { email: ident, password: inputs[1].value } : { username: ident, password: inputs[1].value }) });
        localStorage.setItem('bbc-token', data.token);
        localStorage.setItem('bbc-user', JSON.stringify(data.user));
        var role = (data.user && data.user.role) || 'student';
        window.location.href = role === 'admin' ? 'dashboard-admin.html' : role === 'teacher' ? 'dashboard-teacher.html' : 'dashboard-student.html';
      } catch (err) { errBox(loginForm, lang() === 'ar' ? 'فشل تسجيل الدخول: ' + err.message : 'Login failed: ' + err.message); }
    });
    // --- Booking: real booking request (anonymous, by design) ---
    var bookingForm = document.querySelector('form[data-mock="bookingOk"]');
    if (bookingForm) bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var inputs = bookingForm.querySelectorAll('input');
      var selects = bookingForm.querySelectorAll('select');
      var ta = bookingForm.querySelector('textarea');
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: inputs[0] ? inputs[0].value.trim() : '',
          phone: inputs[1] ? inputs[1].value.trim() : '',
          course: selects[0] ? selects[0].options[selects[0].selectedIndex].text : '',
          source: selects[1] ? selects[1].value : '',
          message: ta ? ta.value.trim() : ''
        }});
        var out = document.getElementById('bookingOk'); if (out) { out.hidden = false; out.scrollIntoView({ behavior: 'smooth' }); }
      } catch (err) { errBox(bookingForm, lang() === 'ar' ? 'فشل إرسال الطلب: ' + err.message : 'Booking request failed: ' + err.message); }
    });
    // --- Main-page enrollment: same booking request ---
    var enrollForm = document.querySelector('#enrollment-form');
    if (enrollForm) enrollForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var name = document.querySelector('#name'); var phone = document.querySelector('#phone');
      var goal = document.querySelector('#path') || document.querySelector('#goal'); var source = document.querySelector('#source');
      var message = document.querySelector('#message');
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: name ? name.value.trim() : '', phone: phone ? phone.value.trim() : '',
          course: goal && goal.selectedIndex >= 0 ? goal.options[goal.selectedIndex].text : '', source: source ? source.value : '', message: message ? message.value.trim() : ''
        }});
        var ok = document.querySelector('#form-success'); if (ok) { ok.hidden = false; ok.classList.add('visible'); ok.textContent = (lang() === 'ar' ? 'شكرًا لاهتمامك! تم استلام طلبك، وستؤكد الأكاديمية مقعدك قريبًا.' : 'Thanks for your interest! Your request has been received, and the academy will confirm your seat soon.'); }
      } catch (err) { alert((lang() === 'ar' ? 'فشل إرسال الطلب: ' : 'Booking request failed: ') + err.message); }
    });
    // --- Courses: fetch from the API, map to the demo shape, re-render ---
    if (document.getElementById('courseGrid') && typeof renderCourses === 'function') {
      (async function () {
        try {
          var levels = await req('/api/levels'); var byId = {};
          (levels.levels || []).forEach(function (l) { byId[l.id] = l.name_en; });
          var data = await req('/api/courses');
          var mapped = (data.courses || []).map(function (c) {
            var section = 'general';
            if (/ielts/i.test(c.slug)) section = 'ielts';
            else if (/conversation/i.test(c.slug)) section = 'conversation';
            else if (/business/i.test(c.slug)) section = 'business';
            else if (/kids|young/i.test(c.slug)) section = 'kids';
            return { id: c.slug || c.id, en: c.title_en, ar: c.title_ar || c.title_en, desc_en: c.description_en || '', desc_ar: c.description_ar || c.description_en || '', weeks: c.duration_weeks || 0, lessons: null, level: byId[c.level_id] || 'Beginner', section: section };
          });
          if (mapped.length && typeof COURSES !== 'undefined') { COURSES.splice(0, COURSES.length); mapped.forEach(function (c) { COURSES.push(c); }); renderCourses(window.__filter || 'all', lang()); }
        } catch (err) { /* API unreachable: keep demo catalogue, do not fake success */ }
      })();
    }
  });

  // --- Admin dashboard: booking requests + create student account (connected mode only) ---
  document.addEventListener('DOMContentLoaded', function () {
    if (!base() || !document.getElementById('bookingRequestsList')) return;
    var lang2 = localStorage.getItem('bbc-lang') || 'ar';
    var note = document.getElementById('bookingRequestsNote');
    async function loadRequests() {
      var list = document.getElementById('bookingRequestsList');
      try {
        var data = await req('/api/admin/booking-requests');
        if (note) note.hidden = true;
        var rows = data.booking_requests || [];
        if (!rows.length) { list.innerHTML = '<p class="muted">' + (lang2 === 'ar' ? 'لا توجد طلبات حجز بعد.' : 'No booking requests yet.') + '</p>'; return; }
        list.innerHTML = '<table><tr><th>' + (lang2 === 'ar' ? 'الاسم' : 'Name') + '</th><th>' + (lang2 === 'ar' ? 'الدورة' : 'Course') + '</th><th>' + (lang2 === 'ar' ? 'الحالة' : 'Status') + '</th><th></th></tr>' + rows.map(function (r) {
          return '<tr><td>' + r.full_name + (r.phone ? '<br><small>' + r.phone + '</small>' : '') + (r.source ? '<br><small>' + r.source + '</small>' : '') + '</td><td>' + (r.course || '') + '</td><td>' + r.status + '</td><td>' + (r.status === 'pending' ? '<button class="btn small" data-confirm="' + r.id + '">' + (lang2 === 'ar' ? 'تأكيد' : 'Confirm') + '</button> <button class="btn small outline" data-reject="' + r.id + '">' + (lang2 === 'ar' ? 'رفض' : 'Reject') + '</button>' : '') + '</td></tr>';
        }).join('') + '</table>';
        list.querySelectorAll('[data-confirm]').forEach(function (b) { b.addEventListener('click', async function () { await req('/api/admin/booking-requests/' + b.dataset.confirm, { method: 'PUT', body: { status: 'confirmed' } }); loadRequests(); }); });
        list.querySelectorAll('[data-reject]').forEach(function (b) { b.addEventListener('click', async function () { await req('/api/admin/booking-requests/' + b.dataset.reject, { method: 'PUT', body: { status: 'rejected' } }); loadRequests(); }); });
      } catch (err) {
        if (note) note.textContent = (lang2 === 'ar' ? 'تعذّر تحميل طلبات الحجز (سجّل دخولك كمسؤول أولًا).' : 'Could not load booking requests (log in as admin first).');
      }
    }
    loadRequests();
    var form = document.getElementById('adminCreateAccountForm');
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var ok = document.getElementById('adminCreateAccountOk');
      try {
        var data = await req('/api/auth/register', { method: 'POST', body: { full_name: document.getElementById('newStudentName').value.trim(), email: document.getElementById('newStudentEmail').value.trim(), password: document.getElementById('newStudentPassword').value, role: 'student' } });
        if (ok) { ok.hidden = false; ok.textContent = (lang2 === 'ar' ? 'تم إنشاء حساب ' : 'Account created for ') + data.user.email + ' ✔'; }
        form.reset();
      } catch (err) { alert((lang2 === 'ar' ? 'فشل إنشاء الحساب: ' : 'Account creation failed: ') + err.message); }
    });
  });


  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // --- Admin: students / teachers / courses management (connected mode only) ---
  document.addEventListener('DOMContentLoaded', function () {
    if (!base() || !document.getElementById('adminStudentsList')) return;
    var users = [], courses = [], levels = [], enrolments = [], selectedStudent = null;
    function byId(arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0]; }
    function courseName(id) { var c = byId(courses, id); return c ? (c.title_en || c.slug) : id; }
    async function loadAll() {
      try {
        var u = await req('/api/admin/users'); users = u.users || [];
        var c = await req('/api/courses'); courses = c.courses || [];
        try { levels = (await req('/api/levels')).levels || []; } catch (e) { levels = []; }
        try { enrolments = (await req('/api/enrolments')).enrolments || []; } catch (e) { enrolments = []; }
        renderAll();
      } catch (err) { /* not logged in as admin: leave sections empty, do not fake data */ }
    }
    function renderAll() {
      var students = users.filter(function (u) { return u.role === 'student'; }).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      var teachers = users.filter(function (u) { return u.role === 'teacher'; });
      var sl = document.getElementById('adminStudentsList');
      sl.innerHTML = students.length ? students.map(function (s) {
        return '<p><button class="btn small outline" data-student="' + s.id + '">' + esc(s.full_name) + '</button> ' + esc(s.username || '') + ' &middot; ' + esc(s.email) + (s.phone ? ' &middot; ' + esc(s.phone) : '') + '</p>';
      }).join('') : '<p class="muted">No students yet.</p>';
      sl.querySelectorAll('[data-student]').forEach(function (b) { b.addEventListener('click', function () { selectedStudent = byId(users, b.dataset.student); renderDetail(); }); });
      var tl = document.getElementById('adminTeachersList');
      tl.innerHTML = teachers.length ? teachers.map(function (s) { return '<p>' + esc(s.full_name) + ' (' + esc(s.username || 'no username') + ') &middot; ' + esc(s.email) + '</p>'; }).join('') : '<p class="muted">No teachers yet.</p>';
      var cl = document.getElementById('adminCoursesList');
      cl.innerHTML = courses.length ? courses.map(function (c) {
        var teacher = c.teacher_id ? byId(users, c.teacher_id) : null;
        return '<p>' + esc(c.title_en) + ' <small>(' + esc(c.slug) + (teacher ? ' &middot; ' + esc(teacher.full_name) : ' &middot; unassigned') + ')</small> <button class="btn small outline" data-edit-course="' + c.id + '">Edit</button> <button class="btn small outline" data-del-course="' + c.id + '">Delete</button></p>';
      }).join('') : '<p class="muted">No courses yet.</p>';
      cl.querySelectorAll('[data-edit-course]').forEach(function (b) { b.addEventListener('click', function () { fillCourseForm(byId(courses, b.dataset.editCourse)); }); });
      cl.querySelectorAll('[data-del-course]').forEach(function (b) { b.addEventListener('click', async function () { if (!window.confirm('Delete this course?')) return; await req('/api/courses/' + b.dataset.delCourse, { method: 'DELETE' }); await loadAll(); }); });
      var sel = document.getElementById('adminEnrolCourse');
      sel.innerHTML = courses.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title_en) + '</option>'; }).join('');
      var lvl = document.getElementById('courseLevel');
      lvl.innerHTML = '<option value="">(no level)</option>' + levels.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name_en) + '</option>'; }).join('');
      var tch = document.getElementById('courseTeacher');
      tch.innerHTML = '<option value="">(unassigned)</option>' + teachers.map(function (s) { return '<option value="' + s.id + '">' + esc(s.full_name) + ' (' + esc(s.username || s.email) + ')</option>'; }).join('');
      renderDetail();
    }
    function renderDetail() {
      var d = document.getElementById('adminStudentDetail');
      if (!selectedStudent) { d.innerHTML = '<p class="muted">Select a student above to see details.</p>'; return; }
      var s = selectedStudent;
      var mine = enrolments.filter(function (e) { return e.student_id === s.id; });
      d.innerHTML = '<h4>' + esc(s.full_name) + '</h4><p>Username: ' + esc(s.username || '—') + '<br>Email: ' + esc(s.email) + '<br>Phone: ' + esc(s.phone || '—') + '<br>Created: ' + esc(s.created_at || '—') + '</p>'
        + (mine.length ? mine.map(function (e) { return '<p>' + esc(courseName(e.course_id)) + ' &middot; ' + esc(e.status) + ' <button class="btn small outline" data-del-enrol="' + e.id + '">Remove</button></p>'; }).join('') : '<p class="muted">No enrolments yet.</p>');
      d.querySelectorAll('[data-del-enrol]').forEach(function (b) { b.addEventListener('click', async function () { await req('/api/enrolments/' + b.dataset.delEnrol, { method: 'DELETE' }); await loadAll(); }); });
    }
    function fillCourseForm(c) {
      document.getElementById('courseEditId').value = c ? c.id : '';
      document.getElementById('courseSlug').value = c ? c.slug : '';
      document.getElementById('courseTitleEn').value = c ? c.title_en : '';
      document.getElementById('courseTitleAr').value = c ? (c.title_ar || '') : '';
      document.getElementById('courseLevel').value = c ? (c.level_id || '') : '';
      document.getElementById('courseWeeks').value = c ? (c.duration_weeks || '') : '';
      document.getElementById('courseTeacher').value = c ? (c.teacher_id || '') : '';
      document.getElementById('coursePublished').checked = c ? c.is_published !== false : true;
    }
    var enrolForm = document.getElementById('adminEnrolForm');
    if (enrolForm) enrolForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!selectedStudent) { alert('Select a student first.'); return; }
      try {
        await req('/api/enrolments', { method: 'POST', body: { student_id: selectedStudent.id, course_id: document.getElementById('adminEnrolCourse').value } });
        var ok = document.getElementById('adminEnrolOk'); ok.hidden = false; ok.textContent = 'Student enrolled ✔';
        await loadAll();
      } catch (err) { alert('Enrolment failed: ' + err.message); }
    });
    var teacherForm = document.getElementById('adminCreateTeacherForm');
    if (teacherForm) teacherForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        // NOTE: register returns a token for the NEW teacher. Deliberately NOT
        // stored: storing it would overwrite the admin's own bbc-token/bbc-user
        // and log the admin in as the teacher.
        var data = await req('/api/auth/register', { method: 'POST', body: { full_name: document.getElementById('newTeacherName').value.trim(), username: document.getElementById('newTeacherUsername').value.trim(), email: document.getElementById('newTeacherEmail').value.trim(), password: document.getElementById('newTeacherPassword').value, role: 'teacher' } });
        var ok = document.getElementById('adminCreateTeacherOk'); ok.hidden = false; ok.textContent = 'Teacher account created for ' + data.user.email + ' ✔';
        teacherForm.reset(); await loadAll();
      } catch (err) { alert('Teacher creation failed: ' + err.message); }
    });
    var courseForm = document.getElementById('adminCourseForm');
    if (courseForm) courseForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = document.getElementById('courseEditId').value;
      var body = { slug: document.getElementById('courseSlug').value.trim(), title_en: document.getElementById('courseTitleEn').value.trim(), title_ar: document.getElementById('courseTitleAr').value.trim() || null, level_id: document.getElementById('courseLevel').value || null, duration_weeks: document.getElementById('courseWeeks').value ? Number(document.getElementById('courseWeeks').value) : null, teacher_id: document.getElementById('courseTeacher').value || null, is_published: document.getElementById('coursePublished').checked };
      try {
        if (id) await req('/api/courses/' + id, { method: 'PUT', body: body });
        else await req('/api/courses', { method: 'POST', body: body });
        var ok = document.getElementById('adminCourseOk'); ok.hidden = false; ok.textContent = 'Course saved ✔';
        fillCourseForm(null); await loadAll();
      } catch (err) { alert('Course save failed: ' + err.message); }
    });
    var resetBtn = document.getElementById('courseFormReset');
    if (resetBtn) resetBtn.addEventListener('click', function () { fillCourseForm(null); });
    loadAll();
  });

  // --- Teacher dashboard: real data in connected mode, demo untouched otherwise ---
  document.addEventListener('DOMContentLoaded', function () {
    if (!base() || !document.getElementById('teacherLiveSection')) return;
    var me = null;
    try { me = JSON.parse(localStorage.getItem('bbc-user') || 'null'); } catch (e) { me = null; }
    if (!me || me.role !== 'teacher') return;
    var demo = document.getElementById('teacherDemoContent'); if (demo) demo.hidden = true;
    var live = document.getElementById('teacherLiveSection'); live.hidden = false;
    (async function () {
      try {
        var courses = (await req('/api/courses')).courses || [];
        var mine = courses.filter(function (c) { return c.teacher_id === me.id; });
        var enrolments = (await req('/api/enrolments')).enrolments || [];
        var list = document.getElementById('teacherCoursesList');
        list.innerHTML = mine.length ? mine.map(function (c) {
          var students = enrolments.filter(function (e) { return e.course_id === c.id; });
          var names = students.map(function (e) { return esc(e.student_name || e.student_id); }).join(', ');
          return '<p><strong>' + esc(c.title_en) + '</strong> — ' + students.length + ' student(s)' + (names ? '<br><small>' + names + '</small>' : '') + '</p>';
        }).join('') : '<p class="muted">No courses assigned to you yet.</p>';
        var sel = document.getElementById('teacherLessonCourse');
        sel.innerHTML = mine.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title_en) + '</option>'; }).join('');
      } catch (err) { /* API unreachable: leave demo hidden but show nothing fake */ }
    })();
    var lessonForm = document.getElementById('teacherLessonForm');
    if (lessonForm) lessonForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await req('/api/lessons', { method: 'POST', body: { course_id: document.getElementById('teacherLessonCourse').value, title_en: document.getElementById('teacherLessonTitle').value.trim() } });
        var ok = document.getElementById('teacherLessonOk'); ok.hidden = false; ok.textContent = 'Lesson added ✔';
        lessonForm.reset();
      } catch (err) { alert('Lesson failed: ' + err.message); }
    });
  });

})();
