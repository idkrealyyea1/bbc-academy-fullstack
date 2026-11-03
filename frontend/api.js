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
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  async function req(path, opts) {
    var o = opts || {};
    var headers = {};
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = 'Bearer ' + token();
    var res = await fetch(base() + path, { method: o.method || 'GET', headers: headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }
  window.BBC_API = { base: base, req: req, esc: esc };
  function lang() { return (localStorage.getItem('bbc-lang') || 'ar'); }
  function errBox(form, msg) {
    var el = form.querySelector('.api-error');
    if (!el) { el = document.createElement('p'); el.className = 'api-error'; el.style.cssText = 'color:#a83238;font-weight:700;margin:12px 0'; form.appendChild(el); }
    el.hidden = false; el.textContent = msg;
  }
  function empty(grid, en, ar) { grid.innerHTML = '<p class="muted">' + esc(lang() === 'ar' ? ar : en) + '</p>'; }

  document.addEventListener('DOMContentLoaded', function () {
    if (!base()) return;
    // Connected mode: the login demo note is no longer true.
    var note = document.getElementById('loginDemoNote'); if (note) note.hidden = true;
    document.querySelectorAll('.demo-note').forEach(function (el) { el.hidden = true; });
    var intro = document.getElementById('enrollIntro');
    if (intro) intro.textContent = lang() === 'ar'
      ? 'أخبرنا قليلًا عن هدفك. سيصل طلبك إلى الأكاديمية، وسيتواصل معك الفريق لتأكيد التفاصيل.'
      : 'Tell us a little about your goal. Your request goes to the academy, and the team will contact you to confirm the details.';

    // --- Login: real auth, redirect by role ---
    var loginForm = document.querySelector('form[data-mock="loginOk"]');
    if (loginForm) loginForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var inputs = loginForm.querySelectorAll('input');
      try {
        var data = await req('/api/auth/login', { method: 'POST', body: { email: inputs[0].value.trim(), password: inputs[1].value } });
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
      var f = bookingForm.elements;
      var courseSel = f.course;
      var course = courseSel && courseSel.selectedIndex >= 0
        ? (courseSel.options[courseSel.selectedIndex].dataset.en || courseSel.options[courseSel.selectedIndex].text)
        : '';
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: f.full_name ? f.full_name.value.trim() : '',
          email: f.email ? f.email.value.trim() : '',
          phone: f.phone ? f.phone.value.trim() : '',
          course: course,
          source: f.source ? f.source.value : '',
          message: f.message ? f.message.value.trim() : ''
        }});
        var out = document.getElementById('bookingOk'); if (out) { out.hidden = false; out.scrollIntoView({ behavior: 'smooth' }); }
      } catch (err) { errBox(bookingForm, lang() === 'ar' ? 'فشل إرسال الطلب: ' + err.message : 'Booking request failed: ' + err.message); }
    });

    // --- Main-page enrollment: same booking request ---
    var enrollForm = document.querySelector('#enrollment-form');
    if (enrollForm) enrollForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var name = document.querySelector('#name'); var email = document.querySelector('#email');
      var phone = document.querySelector('#phone');
      var goal = document.querySelector('#path') || document.querySelector('#goal'); var source = document.querySelector('#source');
      var message = document.querySelector('#message');
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: name ? name.value.trim() : '', email: email ? email.value.trim() : '',
          phone: phone ? phone.value.trim() : '',
          course: goal && goal.selectedIndex > 0 ? goal.options[goal.selectedIndex].text : '',
          source: source ? source.value : '', message: message ? message.value.trim() : ''
        }});
        var ok = document.querySelector('#form-success'); if (ok) { ok.hidden = false; ok.classList.add('visible'); ok.textContent = (lang() === 'ar' ? 'شكرًا لاهتمامك! تم استلام طلبك، وستؤكد الأكاديمية مقعدك قريبًا.' : 'Thanks for your interest! Your request has been received, and the academy will confirm your seat soon.'); }
      } catch (err) { alert((lang() === 'ar' ? 'فشل إرسال الطلب: ' : 'Booking request failed: ') + err.message); }
    });

    // --- Contact: same anonymous lead endpoint ---
    var contactForm = document.querySelector('form[data-mock="contactOk"]');
    if (contactForm) contactForm.addEventListener('submit', async function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var f = contactForm.elements;
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: f.full_name ? f.full_name.value.trim() : '',
          email: f.email ? f.email.value.trim() : '',
          message: f.message ? f.message.value.trim() : '', source: 'contact'
        }});
        var out = document.getElementById('contactOk'); if (out) { out.hidden = false; out.scrollIntoView({ behavior: 'smooth' }); }
      } catch (err) { errBox(contactForm, lang() === 'ar' ? 'فشل إرسال الرسالة: ' + err.message : 'Message failed: ' + err.message); }
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
          if (typeof COURSES !== 'undefined') { COURSES.splice(0, COURSES.length); mapped.forEach(function (c) { COURSES.push(c); }); }
          if (mapped.length) renderCourses(window.__filter || 'all', lang());
          else empty(document.getElementById('courseGrid'), 'No courses are published yet.', 'لا توجد دورات منشورة بعد.');
        } catch (err) { /* API unreachable: keep the catalogue already on the page */ }
      })();
    }

    // --- Enrol button on the course page (logged-in students only; the
    // academy still confirms seats, so this only records the enrolment) ---
    async function mountEnrol(courseId) {
      var slot = document.getElementById('enrolSlot');
      if (!slot) return;
      if (!token()) {
        slot.innerHTML = '<a class="btn outline" href="login.html">' + esc(lang() === 'ar' ? 'سجّل الدخول للتسجيل' : 'Log in to enrol') + '</a>';
        return;
      }
      try {
        var mine = (await req('/api/enrolments/me')).enrolments || [];
        var existing = mine.filter(function (e) { return e.course_id === courseId; })[0];
        if (existing) {
          slot.innerHTML = '<span class="muted">' + esc((lang() === 'ar' ? 'أنت مسجّل في هذه الدورة (' : 'You are enrolled in this course (') + existing.status + ')') + '</span>';
          return;
        }
      } catch (err) { /* not fatal: the POST below reports the real error */ }
      var btn = document.createElement('button');
      btn.className = 'btn outline';
      btn.type = 'button';
      btn.textContent = lang() === 'ar' ? 'سجّل في هذه الدورة' : 'Enrol in this course';
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
          await req('/api/enrolments', { method: 'POST', body: { course_id: courseId } });
          location.reload();
        } catch (err) {
          btn.disabled = false;
          alert((lang() === 'ar' ? 'فشل التسجيل: ' : 'Enrolment failed: ') + err.message);
        }
      });
      slot.appendChild(btn);
    }

    // --- Course detail: the API course, not the demo catalogue ---
    if (document.getElementById('courseDetail') && typeof renderCourseDetail === 'function') {
      (async function () {
        var id = new URLSearchParams(location.search).get('id');
        var detail = document.getElementById('courseDetail');
        if (!id) { empty(detail, 'Choose a course from the courses page.', 'اختر دورة من صفحة الدورات.'); return; }
        try {
          var data = await req('/api/courses/' + encodeURIComponent(id));
          var c = data.course;
          var levels = await req('/api/levels'); var byId = {};
          (levels.levels || []).forEach(function (l) { byId[l.id] = l.name_en; });
          var mapped = { id: id, en: c.title_en, ar: c.title_ar || c.title_en, desc_en: c.description_en || '', desc_ar: c.description_ar || c.description_en || '', weeks: c.duration_weeks || 0, lessons: null, level: byId[c.level_id] || 'Beginner', section: 'general' };
          if (typeof COURSES !== 'undefined') { COURSES.splice(0, COURSES.length, mapped); }
          renderCourseDetail(lang());
          mountEnrol(c.id);
        } catch (err) {
          detail.innerHTML = '<h1>' + esc(lang() === 'ar' ? 'الدورة غير موجودة' : 'Course not found') + '</h1><p><a class="btn" href="courses.html">' + esc(lang() === 'ar' ? 'كل الدورات' : 'All courses') + '</a></p>';
        }
      })();
    }

    // --- Booking course list: real courses + preselection from ?course= ---
    var courseSel = document.getElementById('bookingCourse');
    if (courseSel) (async function () {
      try {
        var data = await req('/api/courses');
        if (!data.courses || !data.courses.length) return;
        courseSel.innerHTML = data.courses.map(function (c) {
          return '<option value="' + esc(c.id) + '" data-en="' + esc(c.title_en) + '" data-ar="' + esc(c.title_ar || c.title_en) + '">' + esc(c.title_en) + '</option>';
        }).join('');
        var wanted = new URLSearchParams(location.search).get('course');
        if (wanted) {
          var match = Array.prototype.find.call(courseSel.options, function (o) { return o.value === wanted; });
          if (match) courseSel.value = match.value;
        }
      } catch (err) { /* keep the options already on the page */ }
    })();

    // --- Add a course: admin/teacher only, real API in connected mode ---
    var addForm = document.getElementById('addCourseForm');
    var addSection = document.getElementById('add-course');
    if (addForm && addSection) (async function () {
      try {
        var me = (await req('/api/auth/me')).user;
        if (!me || !['admin', 'teacher'].includes(me.role)) { addSection.remove(); return; }
      } catch (err) { addSection.remove(); return; }
      addSection.hidden = false;
      addForm.addEventListener('submit', async function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var name = document.getElementById('courseName').value.trim();
        var weeks = parseInt(document.getElementById('courseWeeks').value, 10);
        var desc = document.getElementById('courseDesc').value.trim();
        if (!name || !weeks) return;
        try {
          var levels = (await req('/api/levels')).levels || [];
          var levelName = document.getElementById('courseLevel').value;
          var level = levels.find(function (l) { return l.name_en === levelName; });
          await req('/api/courses', { method: 'POST', body: {
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || ('course-' + Date.now()),
            title_en: name, title_ar: name, description_en: desc || null,
            duration_weeks: weeks, level_id: level ? level.id : null, is_published: true
          }});
          location.reload();
        } catch (err) { alert((lang() === 'ar' ? 'فشل إضافة الدورة: ' : 'Could not add the course: ') + err.message); }
      });
    })();
  });
})();
