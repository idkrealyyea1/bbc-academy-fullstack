// BBC Academy — connected-mode API layer.
// Loaded after config.js and BEFORE app.js, so its submit handlers register
// first and take over when an API base exists.
//
// Rules (see AGENTS.md):
//  - No API base = demo mode. This file does nothing; app.js owns demo feedback.
//  - API base set = connected mode. The real API is always used for login,
//    bookings, contact, catalogue and enrolment.
//  - A failed connected request never silently becomes demo success, and a
//    success message is only shown after the server answers successfully.
(function () {
  function base() {
    var b = (window.BBC_API_BASE || localStorage.getItem('bbc_api_base') || '').replace(/\/$/, '');
    return b;
  }
  function token() { return localStorage.getItem('bbc-token') || ''; }
  function lang() { return localStorage.getItem('bbc-lang') || 'ar'; }
  function t(en, ar) { return lang() === 'ar' ? ar : en; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  async function req(path, opts) {
    var o = opts || {};
    var headers = { Accept: 'application/json' };
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = 'Bearer ' + token();
    var res = await fetch(base() + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || t('Request failed', 'فشل الطلب') + ' (' + res.status + ')');
    return data;
  }
  window.BBC_API = { base: base, req: req, esc: esc };

  function clearError(form) {
    form.querySelectorAll('.api-error').forEach(function (el) { el.remove(); });
  }
  function errBox(form, msg) {
    clearError(form);
    var el = document.createElement('p');
    el.className = 'api-error';
    el.setAttribute('role', 'alert');
    el.textContent = msg;
    var submit = form.querySelector('[type="submit"]');
    if (submit && submit.parentNode === form) form.insertBefore(el, submit);
    else form.appendChild(el);
    // Move focus to the message so it is read out, not just rendered.
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function busyLabel(form) {
    var en = form.getAttribute('data-busy-en');
    var ar = form.getAttribute('data-busy-ar');
    return lang() === 'ar' ? (ar || 'جارٍ التنفيذ…') : (en || 'Working…');
  }
  // The button answers the click: a spinner plus the verb it is doing, at the
  // same width, and no second submit while the request is in flight.
  function setBusy(form, busy) {
    var btns = form.querySelectorAll('button[type="submit"], button:not([type])');
    Array.prototype.forEach.call(btns, function (btn) {
      if (busy) {
        if (btn.__busy) return;
        btn.__busy = { html: btn.innerHTML, width: btn.offsetWidth };
        btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span></span>';
        btn.lastChild.textContent = busyLabel(form);
        if (btn.__busy.width) btn.style.minWidth = btn.__busy.width + 'px';
        btn.disabled = true;
        btn.classList.add('is-busy');
        btn.setAttribute('aria-busy', 'true');
      } else if (btn.__busy) {
        btn.innerHTML = btn.__busy.html;
        btn.style.minWidth = '';
        btn.disabled = false;
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-busy');
        btn.__busy = null;
      }
    });
  }
  function showSuccess(el, form) {
    if (!el) return;
    clearError(form);
    el.hidden = false;
    el.setAttribute('role', 'status');
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function empty(grid, en, ar) {
    grid.innerHTML = '<div class="empty-state"><p>' + esc(t(en, ar)) + '</p></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!base()) return;

    // Connected mode: demo-only notes are no longer true.
    var note = document.getElementById('loginDemoNote');
    if (note) note.hidden = true;
    document.querySelectorAll('.demo-note').forEach(function (el) { el.hidden = true; });

    var intro = document.getElementById('enrollIntro');
    if (intro) {
      intro.textContent = t(
        'Tell us a little about your goal. Your request goes straight to the academy, and the team will contact you to confirm the details.',
        'أخبرنا قليلًا عن هدفك. يصل طلبك مباشرة إلى الأكاديمية، وسيتواصل معك الفريق لتأكيد التفاصيل.'
      );
    }

    /* ------------------------------- login -------------------------------- */
    var loginForm = document.querySelector('form[data-mock="loginOk"]');
    if (loginForm) loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var inputs = loginForm.querySelectorAll('input');
      var ident = inputs[0].value.trim();
      if (!ident || !inputs[1].value) { errBox(loginForm, t('Enter your email or username and password.', 'أدخل بريدك أو اسم المستخدم وكلمة المرور.')); return; }
      setBusy(loginForm, true);
      try {
        var data = await req('/api/auth/login', {
          method: 'POST',
          body: ident.indexOf('@') >= 0
            ? { email: ident, password: inputs[1].value }
            : { username: ident, password: inputs[1].value }
        });
        localStorage.setItem('bbc-token', data.token);
        localStorage.setItem('bbc-user', JSON.stringify(data.user));
        var role = (data.user && data.user.role) || 'student';
        window.location.href = role === 'admin' ? 'dashboard-admin.html' : role === 'teacher' ? 'dashboard-teacher.html' : role === 'staff' ? 'dashboard-staff.html' : 'dashboard-student.html';
      } catch (err) {
        setBusy(loginForm, false);
        errBox(loginForm, t('Login failed: ', 'فشل تسجيل الدخول: ') + err.message);
      }
    });

    /* ------------------------------ booking ------------------------------- */
    var bookingForm = document.querySelector('form[data-mock="bookingOk"]');
    if (bookingForm) bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var f = bookingForm.elements;
      var courseSel = f.course;
      var course = courseSel && courseSel.selectedIndex >= 0
        ? (courseSel.options[courseSel.selectedIndex].dataset.en || courseSel.options[courseSel.selectedIndex].text)
        : '';
      setBusy(bookingForm, true);
      try {
        await req('/api/booking-requests', {
          method: 'POST',
          body: {
            full_name: f.full_name ? f.full_name.value.trim() : '',
            email: f.email ? f.email.value.trim() : '',
            phone: f.phone ? f.phone.value.trim() : '',
            course: course,
            source: f.source ? f.source.value : '',
            message: f.message ? f.message.value.trim() : ''
          }
        });
        bookingForm.dataset.submitted = '1';
        // Sent state: collapse the form to the thank-you block (unmissable
        // without scrolling) and remember it for the next load, in case the
        // browser reloads the page after submit (some mobile proxy browsers do).
        // Collapse FIRST, then scroll: the scroll must measure the collapsed
        // layout, or the thank-you block ends up above the viewport.
        bookingForm.classList.add('is-sent');
        try { sessionStorage.setItem('bbc-booking-sent', '1'); } catch (e) { /* storage unavailable: the visible state above is enough */ }
        showSuccess(document.getElementById('bookingOk'), bookingForm);
        setBusy(bookingForm, false);
        var submit = bookingForm.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
      } catch (err) {
        setBusy(bookingForm, false);
        errBox(bookingForm, t('Booking request failed: ', 'فشل إرسال الطلب: ') + err.message);
      }
    });

    // If the last submit succeeded and the browser then reloaded the page,
    // show the sent state again instead of a fresh-looking form. The flag is
    // consumed on this load, so a later fresh visit shows the form as usual.
    var bookingSent = null;
    try { bookingSent = sessionStorage.getItem('bbc-booking-sent'); } catch (e) { /* storage unavailable */ }
    if (bookingSent && bookingForm) {
      try { sessionStorage.removeItem('bbc-booking-sent'); } catch (e) { /* ignore */ }
      bookingForm.dataset.submitted = '1';
      bookingForm.classList.add('is-sent');
      showSuccess(document.getElementById('bookingOk'), bookingForm);
      // Browsers restore the pre-reload scroll position after load, which can
      // override the scroll above; re-assert it once layout has settled.
      window.setTimeout(function () {
        var okEl = document.getElementById('bookingOk');
        if (okEl) okEl.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 300);
      var sentSubmit = bookingForm.querySelector('[type="submit"]');
      if (sentSubmit) sentSubmit.disabled = true;
    }

    /* --------------------------- home enrolment --------------------------- */
    var enrollForm = document.querySelector('#enrollment-form');
    if (enrollForm) enrollForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var name = document.querySelector('#name');
      var email = document.querySelector('#email');
      var phone = document.querySelector('#phone');
      var goal = document.querySelector('#path');
      var source = document.querySelector('#source');
      var message = document.querySelector('#message');
      setBusy(enrollForm, true);
      try {
        await req('/api/booking-requests', {
          method: 'POST',
          body: {
            full_name: name ? name.value.trim() : '',
            email: email ? email.value.trim() : '',
            phone: phone ? phone.value.trim() : '',
            course: goal && goal.selectedIndex > 0 ? goal.options[goal.selectedIndex].text : '',
            source: source ? source.value : '',
            message: message ? message.value.trim() : ''
          }
        });
        var ok = document.querySelector('#form-success');
        if (ok) {
          ok.innerHTML = '<p>' + esc(t(
            'Thank you — your request has been received by the academy. The team will contact you to confirm your level and seat.',
            'شكرًا لك — وصل طلبك إلى الأكاديمية. سيتواصل معك الفريق لتأكيد مستواك ومقعدك.'
          )) + '</p>';
        }
        showSuccess(ok, enrollForm);
        setBusy(enrollForm, false);
        var submit = enrollForm.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
      } catch (err) {
        setBusy(enrollForm, false);
        errBox(enrollForm, t('Could not send your request: ', 'تعذّر إرسال طلبك: ') + err.message);
      }
    });

    /* ------------------------------- contact ------------------------------ */
    var contactForm = document.querySelector('form[data-mock="contactOk"]');
    if (contactForm) contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var f = contactForm.elements;
      setBusy(contactForm, true);
      try {
        await req('/api/booking-requests', {
          method: 'POST',
          body: {
            full_name: f.full_name ? f.full_name.value.trim() : '',
            email: f.email ? f.email.value.trim() : '',
            message: f.message ? f.message.value.trim() : '',
            source: 'contact'
          }
        });
        var out = document.getElementById('contactOk');
        if (out) {
          out.innerHTML = '<p>' + esc(t('Thank you — your message has reached the academy.', 'شكرًا لك — وصلت رسالتك إلى الأكاديمية.')) + '</p>';
        }
        showSuccess(out, contactForm);
        setBusy(contactForm, false);
        var submit = contactForm.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
      } catch (err) {
        setBusy(contactForm, false);
        errBox(contactForm, t('Message failed: ', 'فشل إرسال الرسالة: ') + err.message);
      }
    });

    /* ------------------------------- catalogue ---------------------------- */
    if (document.getElementById('courseGrid') && typeof window.renderCourses === 'function') {
      (async function () {
        var grid = document.getElementById('courseGrid');
        grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
        try {
          var levels = await req('/api/levels');
          var byId = {};
          (levels.levels || []).forEach(function (l) { byId[l.id] = l; });
          var data = await req('/api/courses');
          var mapped = (data.courses || []).map(function (c) {
            var section = 'general';
            if (/ielts|exam/i.test(c.slug)) section = 'ielts';
            else if (/conversation/i.test(c.slug)) section = 'conversation';
            else if (/business/i.test(c.slug)) section = 'business';
            else if (/kids|young/i.test(c.slug)) section = 'kids';
            var lvl = byId[c.level_id];
            return {
              id: c.slug || c.id,
              en: c.title_en,
              ar: c.title_ar || c.title_en,
              desc_en: c.description_en || '',
              desc_ar: c.description_ar || c.description_en || '',
              weeks: c.duration_weeks || 0,
              lessons: null,
              // '' when the course has no level: never imply the lowest level.
              level: lvl ? lvl.name_en : '',
              level_code: lvl ? lvl.code : '',
              level_en: lvl ? lvl.name_en : '',
              level_ar: lvl ? (lvl.name_ar || lvl.name_en) : '',
              section: section
            };
          });
          if (typeof COURSES !== 'undefined') {
            COURSES.splice(0, COURSES.length);
            mapped.forEach(function (c) { COURSES.push(c); });
          }
          window.__coursesLoaded = true;
          if (mapped.length) window.renderCourses(window.__filter || 'all', lang());
          else empty(grid, 'No courses are published yet.', 'لا توجد دورات منشورة بعد.');
        } catch (err) {
          grid.innerHTML = '<p class="api-error" role="alert">' + esc(t('Could not load courses. Please try again later.', 'تعذّر تحميل الدورات. حاول لاحقًا.')) + '</p>';
        }
      })();
    }

    /* ------------------------------ enrolment ----------------------------- */
    async function mountEnrol(courseId) {
      var slot = document.getElementById('enrolSlot');
      if (!slot) return;
      if (!token()) {
        slot.innerHTML = '<a class="btn outline block" href="login.html">' + esc(t('Log in to enrol', 'سجّل الدخول للتسجيل')) + '</a>';
        return;
      }
      try {
        var mine = (await req('/api/enrolments/me')).enrolments || [];
        var existing = mine.filter(function (e) { return String(e.course_id) === String(courseId); })[0];
        if (existing) {
          slot.innerHTML = '<p class="muted">' + esc(t('You are enrolled in this course', 'أنت مسجّل في هذه الدورة') + ' (' + existing.status + ')') + '</p>';
          return;
        }
      } catch (err) { /* not fatal: the POST below reports the real error */ }
      var btn = document.createElement('button');
      btn.className = 'btn outline block';
      btn.type = 'button';
      btn.textContent = t('Enrol in this course', 'سجّل في هذه الدورة');
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        try {
          await req('/api/enrolments', { method: 'POST', body: { course_id: courseId } });
          location.reload();
        } catch (err) {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          slot.insertAdjacentHTML('beforeend', '<p class="api-error" role="alert">' + esc(t('Enrolment failed: ', 'فشل التسجيل: ') + err.message) + '</p>');
        }
      });
      slot.appendChild(btn);
    }
    window.__mountEnrol = mountEnrol;

    /* ---------------------------- course detail --------------------------- */
    if (document.getElementById('courseDetail') && typeof window.renderCourseDetail === 'function') {
      (async function () {
        var id = new URLSearchParams(location.search).get('id');
        var detail = document.getElementById('courseDetail');
        if (!id) {
          detail.innerHTML = '<div class="empty-state"><h1>' + esc(t('Choose a course', 'اختر دورة')) + '</h1><p>' + esc(t('Pick a programme from the catalogue to see its details.', 'اختر برنامجًا من الكتالوج لعرض تفاصيله.')) + '</p><a class="btn" href="courses.html">' + esc(t('All courses', 'كل الدورات')) + '</a></div>';
          return;
        }
        try {
          var data = await req('/api/courses/' + encodeURIComponent(id));
          var c = data.course;
          var levels = await req('/api/levels');
          var byId = {};
          (levels.levels || []).forEach(function (l) { byId[l.id] = l; });
          var lvl = byId[c.level_id];
          var mapped = {
            id: id,
            en: c.title_en,
            ar: c.title_ar || c.title_en,
            desc_en: c.description_en || '',
            desc_ar: c.description_ar || c.description_en || '',
            weeks: c.duration_weeks || 0,
            lessons: null,
            level: lvl ? lvl.name_en : '',
            level_code: lvl ? lvl.code : '',
            level_en: lvl ? lvl.name_en : '',
            level_ar: lvl ? (lvl.name_ar || lvl.name_en) : '',
            section: 'general'
          };
          if (typeof COURSES !== 'undefined') { COURSES.splice(0, COURSES.length, mapped); }
          window.__courseLoaded = true;
          window.renderCourseDetail(lang());
        } catch (err) {
          detail.innerHTML = '<div class="empty-state"><h1>' + esc(t('Course not found', 'الدورة غير موجودة')) + '</h1><p>' + esc(t('The course may be unpublished, or the link is out of date.', 'قد تكون الدورة غير منشورة أو أن الرابط قديم.')) + '</p><a class="btn" href="courses.html">' + esc(t('All courses', 'كل الدورات')) + '</a></div>';
        }
      })();
    }

    /* -------------------------- booking course list ----------------------- */
    var courseSel = document.getElementById('bookingCourse');
    if (courseSel) (async function () {
      try {
        var data = await req('/api/courses');
        if (!data.courses || !data.courses.length) return;
        var placeholder = courseSel.querySelector('option[value="not-sure"]');
        courseSel.innerHTML = (placeholder ? placeholder.outerHTML : '') + data.courses.map(function (c) {
          return '<option value="' + esc(c.id) + '" data-en="' + esc(c.title_en) + '" data-ar="' + esc(c.title_ar || c.title_en) + '">'
            + esc(lang() === 'ar' ? (c.title_ar || c.title_en) : c.title_en) + '</option>';
        }).join('');
        var wanted = new URLSearchParams(location.search).get('course');
        if (wanted) {
          var match = Array.prototype.find.call(courseSel.options, function (o) { return String(o.value) === String(wanted); });
          if (match) courseSel.value = match.value;
        }
      } catch (err) { /* keep the options already on the page; submission reports errors */ }
    })();

    /* ------------------------------ add course ---------------------------- */
    var addForm = document.getElementById('addCourseForm');
    var addSection = document.getElementById('add-course');
    if (addForm && addSection) (async function () {
      try {
        var me = (await req('/api/auth/me')).user;
        if (!me || (me.role !== 'admin' && me.role !== 'teacher')) { addSection.remove(); return; }
      } catch (err) { addSection.remove(); return; }
      addSection.hidden = false;
      addForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var name = document.getElementById('courseName').value.trim();
        var weeks = parseInt(document.getElementById('courseWeeks').value, 10);
        var desc = document.getElementById('courseDesc').value.trim();
        if (!name || !weeks) return;
        setBusy(addForm, true);
        try {
          var levels = (await req('/api/levels')).levels || [];
          var levelName = document.getElementById('courseLevel').value;
          var level = levels.find(function (l) { return l.name_en && l.name_en.toLowerCase() === String(levelName).toLowerCase(); });
          await req('/api/courses', {
            method: 'POST',
            body: {
              slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || ('course-' + Date.now()),
              title_en: name,
              title_ar: name,
              description_en: desc || null,
              duration_weeks: weeks,
              level_id: level ? level.id : null,
              is_published: true
            }
          });
          location.reload();
        } catch (err) {
          setBusy(addForm, false);
          errBox(addForm, t('Could not add the course: ', 'فشل إضافة الدورة: ') + err.message);
        }
      });
    })();
  });
})();
