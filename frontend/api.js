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
      var goal = document.querySelector('#goal'); var source = document.querySelector('#source');
      var message = document.querySelector('#message');
      try {
        await req('/api/booking-requests', { method: 'POST', body: {
          full_name: name ? name.value.trim() : '', phone: phone ? phone.value.trim() : '',
          course: goal ? goal.value : '', source: source ? source.value : '', message: message ? message.value.trim() : ''
        }});
        var ok = document.querySelector('#form-success'); if (ok) ok.hidden = false;
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
})();
