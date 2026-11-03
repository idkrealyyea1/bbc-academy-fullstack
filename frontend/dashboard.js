// Real dashboards: role guard, real API data, and no invented numbers.
// Loaded after api.js and app.js on dashboard-*.html.
(function () {
  var content = document.getElementById('dashContent');
  if (!content) return;
  var role = content.dataset.role;
  var api = window.BBC_API;
  var lang = localStorage.getItem('bbc-lang') || 'ar';
  var t = function (en, ar) { return lang === 'ar' ? ar : en; };
  var h = function (v) { return api.esc(v); };
  var ready = false;
  var currentMe = null;
  function toast(msg, kind) {
    var wrap = document.getElementById('dashToastWrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'dashToastWrap'; wrap.className = 'dash-toast-wrap'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    var el = document.createElement('div');
    el.className = 'dash-toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }
  function confirmDlg(titleEn, titleAr, bodyEn, bodyAr) {
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'dash-dialog-backdrop';
      back.innerHTML = '<div class="dash-dialog" role="dialog" aria-modal="true" aria-label="' + h(t(titleEn, titleAr)) + '"><h3>' + h(t(titleEn, titleAr)) + '</h3><p>' + h(t(bodyEn, bodyAr)) + '</p>'
        + '<div class="dash-dialog-actions"><button class="btn danger" type="button" id="dashDlgOk">' + h(t('Delete', 'حذف')) + '</button>'
        + '<button class="btn quiet" type="button" id="dashDlgCancel">' + h(t('Cancel', 'إلغاء')) + '</button></div></div>';
      document.body.appendChild(back);
      var ok = back.querySelector('#dashDlgOk'), cancel = back.querySelector('#dashDlgCancel');
      var done = function (v) { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      back.addEventListener('click', function (e) { if (e.target === back) done(false); });
      ok.addEventListener('click', function () { done(true); });
      cancel.addEventListener('click', function () { done(false); });
      ok.focus();
    });
  }
  function badge(status) {
    var s = String(status || '');
    var cls = { pending: 'badge-pending', confirmed: 'badge-confirmed', rejected: 'badge-rejected', active: 'badge-active', completed: 'badge-graded', cancelled: 'badge-cancelled', present: 'badge-present', absent: 'badge-absent', late: 'badge-pending', excused: 'badge-submitted', submitted: 'badge-submitted', graded: 'badge-graded' }[s] || '';
    return '<span class="badge ' + cls + '">' + h(s) + '</span>';
  }
  function setBusy(btn, busy) { if (btn) btn.disabled = !!busy; }
  function refreshCurrent() {
    if (!currentMe) return;
    if (role === 'student') renderStudent(currentMe);
    else if (role === 'teacher') renderTeacher(currentMe);
    else renderAdmin(currentMe);
    accountCard();
    showView(false);
  }
  window.__onLangChange = function () { if (ready) location.reload(); };

  function card(label, value, note) {
    return '<div class="card"><h3>' + h(label) + '</h3><p class="price">' + h(value) + '</p><p class="muted">' + h(note || '') + '</p></div>';
  }
  // Every dashboard table renders inside a horizontally scrollable region:
  // on a phone the table keeps its full width (no crushed/wrapped columns,
  // no cut-off action buttons) and the user scrolls it inside the viewport.
  // The hint below the table is shown on narrow screens only (see dashboard.css).
  function table(headers, rows, emptyText) {
    if (!rows.length) return '<p class="muted">' + h(emptyText) + '</p>';
    return '<div class="dash-table-scroll" tabindex="0" role="region" aria-label="' + h(t('Table', 'جدول')) + '"><table><tr>' + headers.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' + rows.join('') + '</table></div>'
      + '<p class="dash-table-hint">' + h(t('Scroll sideways to see all columns', 'مرّر أفقيًا لعرض كل الأعمدة')) + '</p>';
  }
  function dashFor(r) { return r === 'admin' ? 'dashboard-admin.html' : r === 'teacher' ? 'dashboard-teacher.html' : 'dashboard-student.html'; }
  function heading(me, note) {
    return '<span class="eyebrow page-eyebrow">BBC Academy</span><h1>' + h(t('Welcome, ', 'مرحبًا، ') + (me.full_name || '')) + '</h1><p class="muted">' + h(note) + '</p>';
  }


  // --- Dashboard shell: one view ("page") per section, hash-routed ---
  function view(id, titleEn, titleAr, inner) {
    return '<section class="dash-view" id="view-' + id + '" data-view="' + id + '" hidden><h2 class="dash-view-title" id="view-' + id + '-title">' + h(t(titleEn, titleAr)) + '</h2>' + inner + '</section>';
  }
  function showView(focusIt) {
    var views = Array.prototype.slice.call(content.querySelectorAll('.dash-view'));
    if (!views.length) return;
    var hash = (location.hash || '').replace(/^#/, '');
    var target = null;
    for (var i = 0; i < views.length; i++) { if (views[i].dataset.view === hash) { target = views[i]; break; } }
    if (!target) target = views[0];
    views.forEach(function (v) { v.hidden = (v !== target); });
    var nav = document.getElementById('dashNav');
    if (nav) nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + target.dataset.view); });
    var pt = document.getElementById('appPageTitle'), cr = document.getElementById('appCrumb');
    var hd = target.querySelector('.dash-view-title');
    if (pt && hd) pt.textContent = hd.textContent;
    if (cr && hd) cr.textContent = hd.textContent;
    if (focusIt) {
      var hd = target.querySelector('h1, h2');
      if (hd) { hd.tabIndex = -1; hd.focus(); }
    }
  }
  function wireDashChrome() {
    var btn = document.getElementById('dashMenuBtn'), sidebar = document.getElementById('dashSidebar'), nav = document.getElementById('dashNav'), scrim = document.getElementById('dashScrim');
    var closeMenu = function () {
      if (sidebar) sidebar.classList.remove('open');
      if (scrim) scrim.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    };
    if (btn && sidebar) {
      btn.addEventListener('click', function () {
        var open = sidebar.classList.toggle('open');
        if (scrim) scrim.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { var first = sidebar.querySelector('a'); if (first) first.focus(); }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
      if (scrim) scrim.addEventListener('click', closeMenu);
    }
    if (nav) nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { if (window.matchMedia('(max-width: 1023px)').matches) closeMenu(); });
    });
    var out = document.getElementById('logoutBtn');
    if (out) out.addEventListener('click', function () {
      localStorage.removeItem('bbc-token');
      localStorage.removeItem('bbc-user');
      location.href = 'index.html';
    });
    window.addEventListener('hashchange', function () { closeMenu(); showView(true); });
  }
  wireDashChrome();

  // Every role gets the same account block: change your own password.
  // It is its own view (#account) so it participates in hash routing.
  function accountCard() {
    var oldSec = document.getElementById('view-account');
    if (oldSec) oldSec.remove();
    var sec = document.createElement('section');
    sec.className = 'dash-view';
    sec.id = 'view-account';
    sec.dataset.view = 'account';
    sec.hidden = true;
    sec.innerHTML = '<h2 class="dash-view-title">' + h(t('Account', 'الحساب')) + '</h2><div class="card">'
      + '<form id="accountPassword"><div class="field"><label>' + h(t('Current password', 'كلمة المرور الحالية')) + ' <input type="password" name="current_password" required autocomplete="current-password"></label></div>'
      + '<div class="field"><label>' + h(t('New password (8+ characters)', 'كلمة المرور الجديدة (8 أحرف فأكثر)')) + ' <input type="password" name="new_password" required minlength="8" autocomplete="new-password"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Change password', 'تغيير كلمة المرور')) + '</button>'
      + '<p id="accountPasswordOk" class="muted" hidden style="margin-top:.5rem"></p></form></div>';
    content.appendChild(sec);
    var form = sec.querySelector('#accountPassword');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var okMsg = sec.querySelector('#accountPasswordOk');
      try {
        await api.req('/api/profile/password', { method: 'POST', body: { current_password: form.elements.current_password.value, new_password: form.elements.new_password.value } });
        form.reset();
        if (okMsg) { okMsg.hidden = false; okMsg.textContent = t('Password changed. It works from your next login.', 'تم تغيير كلمة المرور. ستُستخدم عند تسجيل الدخول القادم.'); }
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Button style helper: primary red button
  function btn(href, textEn, textAr, classes) {
    classes = classes || '';
    return '<a class="btn ' + classes + '" href="' + href + '">' + h(t(textEn, textAr)) + '</a>';
  }

  // Section wrapper with heading and action buttons at the end
  function sectionWithButtons(titleEn, titleAr, content, buttonHtml) {
    return '<div style="margin-top:2rem"><span class="eyebrow page-eyebrow">BBC Academy</span>' + '<h2>' + h(t(titleEn, titleAr)) + '</h2>' + content + (buttonHtml ? '<div style="margin-top:1rem">' + buttonHtml + '</div>' : '') + '</div>';
  }


  // --- Overview helper: summary cards shown at the top of every dashboard ---
  function overview(titleEn, titleAr, value, noteEn, noteAr) {
    return '<div class="card" style="margin-bottom:1rem"><h3>' + h(t(titleEn, titleAr)) + '</h3>' + '<p class="price">' + h(value) + '</p>' + '<p class="muted">' + h(t(noteEn || '', noteAr || '')) + '</p></div>';
  }

  // --- Helper: section wrapper with eyebrown heading ---
  function section(titleEn, titleAr, content) {
    return '<div style="margin-top:2rem"><span class="eyebrow page-eyebrow">BBC Academy</span>' + '<h2>' + h(t(titleEn, titleAr)) + '</h2>' + content + '</div>';
  }


  async function boot() {
    content.innerHTML = '<div class="dash-skeleton" aria-label="' + h(t('Loading', 'جارٍ التحميل')) + '"></div><div class="dash-skeleton"></div>';
    if (!api || !api.base()) {
      content.innerHTML = view('overview', 'Overview', 'نظرة عامة', heading({ full_name: '' }, t('Demo mode — connect the API to use the dashboards.', 'وضع تجريبي — اربط الـ API لاستخدام لوحات التحكم.')));
      showView(false);
      return;
    }
    if (!localStorage.getItem('bbc-token')) { location.replace('login.html'); return; }
    var me;
    try { me = (await api.req('/api/auth/me')).user; } catch (err) { me = null; }
    if (!me) {
      localStorage.removeItem('bbc-token'); localStorage.removeItem('bbc-user');
      location.replace('login.html'); return;
    }
    if (me.role !== role) { location.replace(dashFor(me.role)); return; }
    currentMe = me;
    var chip = document.getElementById('appUserChip');
    if (chip) chip.textContent = (me.full_name || me.email || '') + ' · ' + t({ student: 'Student', teacher: 'Teacher', admin: 'Admin' }[me.role] || me.role, { student: 'طالب', teacher: 'معلم', admin: 'مسؤول' }[me.role] || me.role);
    try {
      if (role === 'student') await renderStudent(me);
      else if (role === 'teacher') await renderTeacher(me);
      else await renderAdmin(me);
    } catch (err) {
      content.innerHTML = '<div class="dash-error"><p>' + h(t('Could not load your workspace. Check your connection and try again.', 'تعذّر تحميل مساحة العمل. تحقق من الاتصال وحاول مجددًا.')) + '</p><p class="muted">' + h(err.message) + '</p><button class="btn small" type="button" id="dashRetry">' + h(t('Retry', 'إعادة المحاولة')) + '</button></div>';
      var rb = document.getElementById('dashRetry');
      if (rb) rb.addEventListener('click', function () { boot(); });
      return;
    }
    accountCard();
    showView(!!location.hash);
    ready = true;
  }

  async function renderStudent(me) {
    var data = await Promise.all([
      api.req('/api/enrolments/me'), api.req('/api/placement-tests/me'), api.req('/api/me/attendance'),
      api.req('/api/assignments'), api.req('/api/announcements'), api.req('/api/lessons'), api.req('/api/courses')
    ]);
    var enr = data[0].enrolments || [], place = data[1].results || [], att = data[2].attendance || [];
    var asg = data[3].assignments || [], ann = data[4].announcements || [], lessons = data[5].lessons || [], courses = data[6].courses || [];
    var cmap = {}; courses.forEach(function (c) { cmap[c.id] = c; });
    var latest = place[0];
    var present = att.filter(function (a) { return a.status === 'present'; }).length;
    var graded = asg.filter(function (a) { return a.submission && a.submission.grade != null; }).length;
    var openAsg = asg.filter(function (a) { return !a.submission; });
    content.innerHTML = view('overview', 'Overview', 'نظرة عامة', heading(me, t('Your course, progress and homework in one place.', 'دورتك وتقدمك وواجباتك في مكان واحد.'))
      + overview('My courses', 'دوراتي', enr.length, 'enrolments', 'تسجيل')
      + overview('My level', 'مستواي', latest ? latest.recommended_level : '—', latest ? 'placement result' : 'not taken yet', latest ? 'نتيجة اختبار المستوى' : 'لم تُجرَ بعد')
      + overview('Attendance', 'الحضور', present + ' / ' + att.length, 'lessons attended', 'حصة حضرتها')
      + '<p class="muted" style="margin-top:1rem">' + h(t('Grades: ', 'الدرجات: ') + graded + ' / ' + asg.length) + '</p>'
      + (function () {
        var firstEnr = enr.find(function (e) { return e.status === 'active' || e.status === 'pending'; }) || enr[0];
        var firstCourse = firstEnr ? cmap[firstEnr.course_id] : null;
        var cont = firstCourse ? '<a class="btn small" href="course.html?id=' + h(firstCourse.slug || firstCourse.id) + '">' + h(t('Continue learning', 'واصل التعلّم')) + '</a>' : '';
        var steps = [];
        if (!place.length) steps.push('<li>' + h(t('Take the placement test to get your level.', 'أجرِ اختبار تحديد المستوى لمعرفة مستواك.')) + ' <a href="levels.html">' + h(t('Placement test', 'اختبار تحديد المستوى')) + '</a></li>');
        if (openAsg.length) steps.push('<li>' + h(t(openAsg.length + ' homework task(s) waiting for you.', openAsg.length + ' واجب بانتظارك.')) + ' <a href="#homework">' + h(t('Open homework', 'افتح الواجبات')) + '</a></li>');
        if (!enr.length) steps.push('<li>' + h(t('You are not enrolled in any course yet. Book a seat to get started.', 'لست مسجلًا في أي دورة بعد. احجز مقعدًا للبدء.')) + ' <a href="booking.html">' + h(t('Book a seat', 'احجز مقعدًا')) + '</a></li>');
        return '<div class="card"><h3>' + h(t('Next steps', 'الخطوات التالية')) + '</h3>' + (cont ? '<p>' + cont + '</p>' : '') + (steps.length ? '<ul>' + steps.join('') + '</ul>' : '<p class="muted">' + h(t('You are on track. Keep going with your enrolled courses.', 'أنت على المسار الصحيح. واصل في دوراتك المسجلة.')) + '</p>') + '</div>';
      })())
      + view('courses', 'My courses', 'دوراتي', '<div class="card">'
      + table([t('Course', 'الدورة'), t('Level', 'المستوى'), t('Status', 'الحالة'), t('Lessons', 'الدروس'), t('Assignments', 'الواجبات'), ''], enr.map(function (e) {
        var c = cmap[e.course_id];
        if (!c) return '<tr><td>' + h(e.course_id) + '</td><td></td><td>' + badge(e.status) + '</td><td></td><td></td><td></td></tr>';
        var lc = lessons.filter(function (l) { return l.course_id === c.id; }).length;
        var ac = asg.filter(function (a) { return a.course_id === c.id; }).length;
        return '<tr><td>' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</td><td>' + h(c.level_id || '') + '</td><td>' + badge(e.status) + '</td><td>' + lc + '</td><td>' + ac + '</td><td><a class="btn small" href="course.html?id=' + h(c.slug || c.id) + '">' + h(t('Open course', 'افتح الدورة')) + '</a></td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>')
      + view('progress', 'My progress', 'تقدّمي', '<div class="card"><h3>' + h(t('Placement & level', 'تحديد المستوى')) + '</h3>'
      + (latest ? '<p>' + h(t('Latest result: ', 'آخر نتيجة: ')) + latest.score + ' / ' + latest.total + ' — ' + h(t('Recommended level: ', 'المستوى الموصى به: ')) + latest.recommended_level + '</p>' : '<p class="muted">' + h(t('No placement test taken yet.', 'لم تُجرَ اختبار تحديد مستوى بعد.')) + ' <a href="levels.html">' + h(t('Take the placement test', 'أجرِ اختبار تحديد المستوى')) + '</a></p>') + '</div>'
      + '<div class="card"><h3>' + h(t('Attendance', 'الحضور')) + '</h3><p>' + h(t('Present: ', 'الحاضر: ')) + present + ' / ' + att.length + '</p><p class="muted">' + h(t('Attendance counts only records marked present, out of all recorded attendance days for you. Absent, late and excused days are not counted as present.', 'الحضور يحسب فقط الأيام المسجلة كحاضر، من مجموع أيام الحضور المسجلة لك. أيام الغياب والتأخر والعذر لا تُحسب كحاضر.')) + '</p></div>'
      + '<div class="card"><h3>' + h(t('Grades', 'الدرجات')) + '</h3>'
      + table([t('Task', 'المهمة'), t('Grade', 'الدرجة'), t('Feedback', 'ملاحظات')], asg.filter(function (a) { return a.submission && a.submission.grade != null; }).map(function (a) {
        return '<tr><td>' + h(a.title) + '</td><td>' + h(a.submission.grade) + ' / 100</td><td>' + h(a.submission.feedback || '') + '</td></tr>';
      }), t('No grades returned yet.', 'لا توجد درجات بعد.')) + '</div>')
      + view('homework', 'Homework', 'الواجبات', '<div class="card"><div class="dash-tabs" role="tablist">'
      + ['all', 'pending', 'submitted', 'graded'].map(function (s) { return '<button type="button" data-hw-tab="' + s + '" class="' + (s === 'all' ? 'active' : '') + '">' + h(s === 'all' ? t('All', 'الكل') : s === 'pending' ? t('Pending', 'بانتظار التسليم') : s === 'submitted' ? t('Submitted', 'مُسلَّمة') : t('Graded', 'مصححة')) + '</button>'; }).join('') + '</div>'
      + table([t('Task', 'المهمة'), t('Course', 'الدورة'), t('Status', 'الحالة'), t('Feedback', 'ملاحظات')], asg.map(function (a) {
        var c = cmap[a.course_id];
        var st = !a.submission ? 'pending' : (a.submission.grade != null ? 'graded' : 'submitted');
        var status = !a.submission ? t('Not submitted', 'لم يُسلَّم') : (a.submission.grade != null ? a.submission.grade + ' / 100' : t('Submitted', 'تم التسليم'));
        return '<tr data-hw-status="' + st + '"><td>' + h(a.title) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + badge(st) + ' ' + h(status) + '</td><td>' + h(a.submission && a.submission.feedback ? a.submission.feedback : '') + '</td></tr>';
      }), t('No homework yet.', 'لا توجد واجبات بعد.'))
      + (openAsg.length
        ? '<form id="studentSubmit" style="margin-top:1rem"><div class="field"><label>' + h(t('Assignment', 'الواجب')) + ' <select name="assignment_id">' + openAsg.map(function (a) { return '<option value="' + h(a.id) + '">' + h(a.title) + '</option>'; }).join('') + '</select></label></div>'
          + '<div class="field"><label>' + h(t('Your answer', 'إجابتك')) + ' <textarea name="content_text" rows="3" required></textarea></label></div>'
          + '<button class="btn small" type="submit">' + h(t('Submit homework', 'تسليم الواجب')) + '</button></form>'
        : '') + '</div>')
      + view('lessons', 'Lessons', 'الدروس', '<div class="card">'
      + table([t('Lesson', 'الدرس'), t('Course', 'الدورة'), ''], lessons.map(function (l) {
        var c = cmap[l.course_id];
        var join = l.live_class_url ? '<a class="btn small" href="' + h(l.live_class_url) + '" target="_blank" rel="noopener">' + h(t('Join', 'انضم')) + '</a>' : '';
        return '<tr><td>' + h(l.title_en) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + join + '</td></tr>';
      }), t('No lessons yet.', 'لا توجد دروس بعد.')) + '</div>')
      + view('announcements', 'Announcements', 'الإعلانات', '<div class="card">'
      + (ann.length ? ann.slice(0, 5).map(function (a) {
        return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body).replace(/\n/g, '<br>') + '</span></p>';
      }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div>');

    content.querySelectorAll('[data-hw-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.querySelectorAll('[data-hw-tab]').forEach(function (x) { x.classList.toggle('active', x === btn); });
        var wanted = btn.dataset.hwTab;
        content.querySelectorAll('[data-hw-status]').forEach(function (row) { row.hidden = !(wanted === 'all' || row.dataset.hwStatus === wanted); });
      });
    });
    var submitForm = document.getElementById('studentSubmit');
    if (submitForm) submitForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = submitForm.elements.content_text.value.trim();
      if (!text) return;
      var sbtn = submitForm.querySelector('button[type="submit"]');
      setBusy(sbtn, true);
      try {
        await api.req('/api/submissions', { method: 'POST', body: { assignment_id: submitForm.elements.assignment_id.value, content_text: text } });
        toast(t('Homework submitted.', 'تم تسليم الواجب.'), 'success');
        refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
      setBusy(sbtn, false);
    });
  }

  async function renderTeacher(me) {
    var data = await Promise.all([
      api.req('/api/enrolments'), api.req('/api/assignments'), api.req('/api/submissions'),
      api.req('/api/courses?all=1'), api.req('/api/attendance'), api.req('/api/announcements')
    ]);
    var enr = data[0].enrolments || [], asg = data[1].assignments || [], subs = data[2].submissions || [];
    var courses = (data[3].courses || []).filter(function (c) { return c.teacher_id === me.id; });
    var att = data[4].attendance || [], ann = data[5].announcements || [];
    var cmap = {}; courses.forEach(function (c) { cmap[c.id] = c; });
    var amap = {}; asg.forEach(function (a) { amap[a.id] = a; });
    var students = {}; enr.forEach(function (e) { students[e.student_id] = true; });
    var ungraded = subs.filter(function (s) { return s.grade == null; }).length;
    var courseOpts = courses.map(function (c) { return '<option value="' + h(c.id) + '">' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</option>'; }).join('');
    var studentOpts = function (courseId) {
      return enr.filter(function (e) { return !courseId || e.course_id === courseId; }).map(function (e) {
        return '<option value="' + h(e.student_id) + '">' + h(e.student_name || e.student_id) + '</option>';
      }).join('');
    };
    var noCourseNote = '<div class="card"><p class="muted">' + h(t('An admin must assign you a course before you can add lessons or assignments.', 'يجب أن يسند إليك المسؤول دورة قبل أن تضيف دروسًا أو واجبات.')) + '</p></div>';
    content.innerHTML = view('overview', 'Overview', 'نظرة عامة', heading(me, t('Your classes, students and tasks for today.', 'حصصك وطلابك ومهام اليوم.'))
      + overview('My courses', 'دوراتي', courses.length, '', '')
      + overview('Students', 'الطلاب', Object.keys(students).length, 'across your courses', 'في دوراتك')
      + overview('To grade', 'بانتظار التصحيح', ungraded, 'submissions', 'تسليم'))
      + view('classes', 'My classes', 'حصصي', '<div class="card">'
      + table([t('Class', 'الحصة'), t('Students', 'الطلاب')], courses.map(function (c) {
        return '<tr><td>' + h(c.title_en) + '</td><td>' + enr.filter(function (e) { return e.course_id === c.id; }).length + '</td></tr>';
      }), t('No courses assigned yet.', 'لا توجد دورات مسندة بعد.')) + '</div>')
      + view('grading', 'Submissions to grade', 'تسليمات للتصحيح', '<div class="card"><div class="dash-tabs" role="tablist">'
      + ['all', 'pending', 'graded'].map(function (s) { return '<button type="button" data-grade-tab="' + s + '" class="' + (s === 'all' ? 'active' : '') + '">' + h(s === 'all' ? t('All', 'الكل') : s === 'pending' ? t('Pending', 'بانتظار التصحيح') : t('Graded', 'مصححة')) + '</button>'; }).join('') + '</div>'
      + table([t('Student', 'الطالب'), t('Task', 'المهمة'), t('Status', 'الحالة'), t('Grade', 'الدرجة'), t('Feedback', 'ملاحظات'), ''], subs.map(function (s) {
        var a = amap[s.assignment_id];
        var st = s.grade == null ? 'pending' : 'graded';
        return '<tr data-grade-status="' + st + '"><td>' + h(s.student_name || s.student_id) + '</td><td>' + h(a ? a.title : '') + '</td><td>' + badge(st === 'pending' ? 'pending' : 'graded') + '</td><td><input type="number" min="0" max="100" style="width:80px" value="' + h(s.grade == null ? '' : s.grade) + '" data-grade="' + h(s.id) + '" aria-label="' + h(t('Grade 0-100', 'الدرجة من 0 إلى 100')) + '"></td><td><input data-feedback="' + h(s.id) + '" value="' + h(s.feedback || '') + '" aria-label="' + h(t('Feedback', 'ملاحظات')) + '"></td><td><button class="btn small" data-grade-btn="' + h(s.id) + '">' + h(t('Save', 'حفظ')) + '</button></td></tr>';
      }), t('No submissions yet.', 'لا توجد تسليمات بعد.'))
      + '<p class="muted">' + h(t('Grades are 0–100. Saving updates only that row; the submission stays visible so you can revise it.', 'الدرجات من 0 إلى 100. الحفظ يحدّث هذا الصف فقط، ويبقى التسليم ظاهرًا لتعديله.')) + '</p></div>')
      + view('mystudents', 'My students', 'طلابي', '<div class="card">'
      + table([t('Student', 'الطالب'), t('Courses', 'الدورات'), ''], Object.keys(students).map(function (sid) {
        var myCourses = courses.filter(function (c) { return enr.some(function (e) { return e.student_id === sid && e.course_id === c.id; }); }).map(function (c) { return lang === 'ar' ? c.title_ar || c.title_en : c.title_en; }).join(' · ');
        var nm = (enr.find(function (e) { return e.student_id === sid; }) || {}).student_name || sid;
        return '<tr><td>' + h(nm) + '</td><td>' + h(myCourses) + '</td><td></td></tr>';
      }), t('No students yet.', 'لا يوجد طلاب بعد.')) + '</div>')
      + view('attendance', 'Mark attendance', 'تسجيل الحضور', '<div class="card">'
      + '<p class="muted">' + h(t('Recent attendance for your courses is listed below the form. Only students enrolled in the selected course can be marked.', 'سجل الحضور الأخير لدوراتك يظهر أسفل النموذج. يمكن تسجيل الحضور فقط للطلاب المسجلين في الدورة المختارة.')) + '</p>'
      + '<form id="teacherAttendance"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Student', 'الطالب')) + ' <select name="student_id" required>' + studentOpts('') + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Status', 'الحالة')) + ' <select name="status"><option value="present">' + h(t('Present', 'حاضر')) + '</option><option value="absent">' + h(t('Absent', 'غائب')) + '</option><option value="late">' + h(t('Late', 'متأخر')) + '</option><option value="excused">' + h(t('Excused', 'بعذر')) + '</option></select></label></div>'
      + '<div class="field"><label>' + h(t('Date', 'التاريخ')) + ' <input type="date" name="attended_on" value="' + new Date().toLocaleDateString('en-CA') + '"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Save attendance', 'حفظ الحضور')) + '</button></form></div>'
      + '<div class="card" style="margin-top:1rem">'
      + table([t('Student', 'الطالب'), t('Course', 'الدورة'), t('Status', 'الحالة'), t('Date', 'التاريخ')], att.slice(0, 30).map(function (a) {
        var c = cmap[a.course_id];
        return '<tr><td>' + h(a.student_name || a.student_id) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + badge(a.status) + '</td><td>' + h(a.attended_on || '') + '</td></tr>';
      }), t('No attendance records yet.', 'لا توجد سجلات حضور بعد.')) + '</div>')
      + view('announcements', 'Announcements', 'الإعلانات', '<div class="card">'
      + '<form id="teacherAnnouncement"><div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required></label></div>'
      + '<div class="field"><label>' + h(t('Body', 'النص')) + ' <textarea name="body" rows="3" required></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Audience', 'الجمهور')) + ' <select name="audience"><option value="all">' + h(t('Everyone', 'الجميع')) + '</option><option value="students">' + h(t('Students', 'الطلاب')) + '</option></select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Publish', 'نشر')) + '</button></form></div>'
      + '<div class="card" style="margin-top:1rem">'
      + (ann.length ? ann.slice(0, 5).map(function (a) { return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body) + '</span></p>'; }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div>')
      + view('assignments', 'New assignment', 'واجب جديد', courses.length
        ? '<div class="card"><form id="teacherAssignment"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
          + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="300"></label></div>'
          + '<div class="field"><label>' + h(t('Description', 'الوصف')) + ' <textarea name="description" rows="2"></textarea></label></div>'
          + '<div class="field"><label>' + h(t('Due date', 'تاريخ التسليم')) + ' <input type="date" name="due_date"></label></div>'
          + '<button class="btn small" type="submit">' + h(t('Create assignment', 'إنشاء الواجب')) + '</button></form></div>'
        : noCourseNote)
      + view('lessons', 'New lesson', 'درس جديد', courses.length
        ? '<div class="card"><form id="teacherLesson"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
          + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="200"></label></div>'
          + '<div class="field"><label>' + h(t('Live class link', 'رابط الحصة المباشرة')) + ' <input name="live_class_url" type="url" dir="ltr" placeholder="https://meet.google.com/..."></label></div>'
          + '<div class="field"><label>' + h(t('Lesson number', 'رقم الدرس')) + ' <input type="number" name="order_no" min="1" value="1"></label></div>'
          + '<button class="btn small" type="submit">' + h(t('Add lesson', 'إضافة الدرس')) + '</button></form></div>'
        : noCourseNote);

    content.querySelectorAll('[data-grade-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.querySelectorAll('[data-grade-tab]').forEach(function (x) { x.classList.toggle('active', x === btn); });
        var wanted = btn.dataset.gradeTab;
        content.querySelectorAll('[data-grade-status]').forEach(function (row) { row.hidden = !(wanted === 'all' || row.dataset.gradeStatus === wanted); });
      });
    });
    content.querySelectorAll('[data-grade-btn]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.gradeBtn;
        var gradeInput = content.querySelector('[data-grade="' + id + '"]');
        var grade = Number(gradeInput.value);
        if (!Number.isFinite(grade) || grade < 0 || grade > 100) { toast(t('Grade must be a number from 0 to 100.', 'يجب أن تكون الدرجة رقمًا بين 0 و 100.'), 'error'); gradeInput.focus(); return; }
        var feedback = content.querySelector('[data-feedback="' + id + '"]').value;
        setBusy(b, true);
        try {
          var saved = await api.req('/api/submissions/' + id + '/grade', { method: 'POST', body: { grade: grade, feedback: feedback } });
          var row = b.closest('tr');
          if (row) { row.dataset.gradeStatus = 'graded'; var cells = row.querySelectorAll('td'); if (cells[2]) cells[2].innerHTML = badge('graded'); }
          toast(t('Grade saved.', 'تم حفظ الدرجة.'), 'success');
        } catch (err) { toast(err.message, 'error'); }
        setBusy(b, false);
      });
    });
    var attForm = document.getElementById('teacherAttendance');
    if (attForm) {
      var courseSel = attForm.elements.course_id, studentSel = attForm.elements.student_id;
      courseSel.addEventListener('change', function () { studentSel.innerHTML = studentOpts(courseSel.value); });
      attForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          await api.req('/api/attendance', { method: 'POST', body: { course_id: courseSel.value, student_id: studentSel.value, status: attForm.elements.status.value, attended_on: attForm.elements.attended_on.value || null } });
          toast(t('Attendance saved.', 'تم حفظ الحضور.'), 'success'); refreshCurrent();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    var annForm = document.getElementById('teacherAnnouncement');
    if (annForm) annForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api.req('/api/announcements', { method: 'POST', body: { title: annForm.elements.title.value.trim(), body: annForm.elements.body.value.trim(), audience: annForm.elements.audience.value } });
        toast(t('Announcement published.', 'تم نشر الإعلان.'), 'success'); annForm.reset(); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
    });
    var asgForm = document.getElementById('teacherAssignment');
    if (asgForm) asgForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api.req('/api/assignments', { method: 'POST', body: {
          course_id: asgForm.elements.course_id.value,
          title: asgForm.elements.title.value.trim(),
          description: asgForm.elements.description.value.trim() || null,
          due_date: asgForm.elements.due_date.value || null
        }});
        toast(t('Assignment created.', 'تم إنشاء الواجب.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
    });
    var lessonForm = document.getElementById('teacherLesson');
    if (lessonForm) lessonForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api.req('/api/lessons', { method: 'POST', body: {
          course_id: lessonForm.elements.course_id.value,
          title_en: lessonForm.elements.title.value.trim(),
          live_class_url: lessonForm.elements.live_class_url.value.trim() || null,
          order_no: Number(lessonForm.elements.order_no.value) || 1
        }});
        toast(t('Lesson added.', 'تمت إضافة الدرس.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function renderAdmin(me) {
    var levels = [];
    try { levels = (await api.req('/api/levels')).levels || []; } catch (e) { levels = []; }
    var data = await Promise.all([
      api.req('/api/admin/users'), api.req('/api/courses?all=1'), api.req('/api/admin/booking-requests'), api.req('/api/enrolments')
    ]);
    var ops = {};
    try { ops.lessons = (await api.req('/api/lessons')).lessons || []; } catch (e) { ops.lessons = null; }
    try { ops.assignments = (await api.req('/api/assignments')).assignments || []; } catch (e) { ops.assignments = null; }
    try { ops.submissions = (await api.req('/api/submissions')).submissions || []; } catch (e) { ops.submissions = null; }
    try { ops.attendance = (await api.req('/api/attendance')).attendance || []; } catch (e) { ops.attendance = null; }
    try { ops.announcements = (await api.req('/api/announcements')).announcements || []; } catch (e) { ops.announcements = null; }
    var users = data[0].users || [], courses = data[1].courses || [], bookings = data[2].booking_requests || [], enr = data[3].enrolments || [];
    var cmap = {}; courses.forEach(function (c) { cmap[c.id] = c; });
    var students = users.filter(function (u) { return u.role === 'student'; });
    var pending = bookings.filter(function (b) { return b.status === 'pending'; });
    var courseOpts = courses.map(function (c) { return '<option value="' + h(c.id) + '" data-en="' + h(c.title_en) + '">' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</option>'; }).join('');
    var teachers = users.filter(function (u) { return u.role === 'teacher'; });
    var unassigned = courses.filter(function (c) { return !c.teacher_id; });
    var recentBookings = bookings.slice(0, 5);
    var needsHtml = '';
    if (!pending.length && !unassigned.length) needsHtml = '<p class="muted">' + h(t('Nothing needs your attention right now.', 'لا يوجد شيء يحتاج انتباهك الآن.')) + '</p>';
    else {
      if (pending.length) needsHtml += '<p>• ' + h(t(pending.length + ' pending booking request(s) — review them in Admissions.', pending.length + ' طلب حجز معلّق — راجعها في القبول.')) + ' <a href="#bookings">' + h(t('Review bookings', 'مراجعة الطلبات')) + '</a></p>';
      if (unassigned.length) needsHtml += '<p>• ' + h(t(unassigned.length + ' course(s) without a teacher.', unassigned.length + ' دورة بدون معلم.')) + ' <a href="#courses">' + h(t('Assign teachers', 'إسناد المعلمين')) + '</a></p>';
    }
    content.innerHTML = view('overview', 'Overview', 'نظرة عامة', heading(me, t('Students, courses and bookings at a glance.', 'الطلاب والدورات والحجوزات في لمحة.'))
      + '<div class="dash-statgrid">' + overview('Students', 'الطلاب', students.length, '', '') + overview('Teachers', 'المعلمون', teachers.length, '', '') + overview('Courses', 'الدورات', courses.length, '', '') + overview('Pending bookings', 'حجوزات معلّقة', pending.length, '', '') + overview('Enrolments', 'التسجيلات', enr.length, '', '') + '</div>'
      + '<div class="card"><h3>' + h(t('Needs your attention', 'يحتاج انتباهك')) + '</h3>' + needsHtml + '</div>'
      + '<div class="card"><h3>' + h(t('Quick actions', 'إجراءات سريعة')) + '</h3><p><a class="btn small" href="#accounts">' + h(t('Add student', 'إضافة طالب')) + '</a> <a class="btn small" href="#people">' + h(t('Add teacher', 'إضافة معلم')) + '</a> <a class="btn small" href="#courses">' + h(t('Create course', 'إنشاء دورة')) + '</a> <a class="btn small" href="#bookings">' + h(t('Review bookings', 'مراجعة الطلبات')) + '</a></p></div>'
      + '<div class="card"><h3>' + h(t('Recent bookings', 'أحدث الطلبات')) + '</h3>'
      + table([t('Name', 'الاسم'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], recentBookings.map(function (b) {
        return '<tr><td>' + h(b.full_name) + '</td><td>' + h(b.course || '') + '</td><td>' + badge(b.status) + '</td><td>' + (b.status === 'pending' ? '<button class="btn small" data-confirm="' + h(b.id) + '">' + h(t('Confirm', 'تأكيد')) + '</button>' : '') + '</td></tr>';
      }), t('No booking requests yet.', 'لا توجد طلبات حجز بعد.')) + '</div>')
      + view('students', 'Students', 'الطلاب', '<div class="dash-filterbar"><label>' + h(t('Search students', 'ابحث في الطلاب')) + ' <input type="search" id="adminStudentSearch" placeholder="' + h(t('Name, email or username', 'الاسم أو البريد أو اسم المستخدم')) + '"></label></div>'
      + '<div class="card"><h3>' + h(t('Enrol a student', 'تسجيل طالب في دورة')) + '</h3>'
      + '<form id="adminEnrolForm"><div class="field"><label>' + h(t('Student', 'الطالب')) + ' <select name="student_id">' + students.map(function (u) { return '<option value="' + h(u.id) + '">' + h(u.full_name) + ' (' + h(u.email) + ')</option>'; }).join('') + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id"><option value="">' + h(t('Choose a course', 'اختر دورة')) + '</option>' + courseOpts + '</select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Enrol', 'سجّل')) + '</button></form></div>'
      + '<div class="card">'
      + table([t('Name', 'الاسم'), t('Email', 'البريد'), t('Username', 'اسم المستخدم'), t('Courses', 'الدورات'), ''], students.map(function (u) {
        var myCourses = enr.filter(function (e) { return e.student_id === u.id; }).map(function (e) { var c = cmap[e.course_id]; return c ? (lang === 'ar' ? c.title_ar || c.title_en : c.title_en) : e.course_id; }).join(' · ');
        return '<tr data-search-text="' + h((u.full_name + ' ' + u.email + ' ' + (u.username || '')).toLowerCase()) + '"><td>' + h(u.full_name) + '</td><td>' + h(u.email) + '</td><td>' + h(u.username || '') + '</td><td>' + h(myCourses || '') + '</td>'
          + '<td><button class="btn small outline" data-delete-user="' + h(u.id) + '">' + h(t('Delete', 'حذف')) + '</button></td></tr>';
      }), t('No students yet.', 'لا يوجد طلاب بعد.')) + '</div>')
      + view('bookings', 'Booking requests', 'طلبات الحجز', '<div class="card"><div class="dash-tabs" role="tablist">'
      + ['all', 'pending', 'confirmed', 'rejected'].map(function (s) { return '<button type="button" data-booking-tab="' + s + '" class="' + (s === 'all' ? 'active' : '') + '">' + h(s === 'all' ? t('All', 'الكل') : s === 'pending' ? t('Pending', 'معلّقة') : s === 'confirmed' ? t('Confirmed', 'مؤكدة') : t('Rejected', 'مرفوضة')) + '</button>'; }).join('') + '</div>'
      + table([t('Name', 'الاسم'), t('Contact', 'التواصل'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], bookings.map(function (b) {
        var actions = b.status === 'pending'
          ? '<button class="btn small" data-confirm="' + h(b.id) + '">' + h(t('Confirm', 'تأكيد')) + '</button> <button class="btn small outline" data-reject="' + h(b.id) + '">' + h(t('Reject', 'رفض')) + '</button>'
          : '';
        if (b.status !== 'rejected') actions += ' <button class="btn small outline" data-create="' + h(b.id) + '">' + h(t('Create account', 'إنشاء حساب')) + '</button>';
        actions += ' <button class="btn small outline" data-delete-booking="' + h(b.id) + '">' + h(t('Delete', 'حذف')) + '</button>';
        var contact = [b.email, b.phone].filter(Boolean).join(' · ');
        return '<tr data-booking-status="' + h(b.status) + '"><td>' + h(b.full_name) + '</td><td>' + h(contact) + '</td><td>' + h(b.course || '') + '</td><td>' + badge(b.status) + '</td><td>' + actions + '</td></tr>';
      }), t('No booking requests yet.', 'لا توجد طلبات حجز بعد.')) + '</div>')
      + view('accounts', 'Create a student account', 'إنشاء حساب طالب', '<div class="card">'
      + '<p class="muted">' + h(t('After confirming a booking, create the student account and enrol them in the course.', 'بعد تأكيد الحجز، أنشئ حساب الطالب وسجّله في الدورة.')) + '</p>'
      + '<form id="adminCreateAccountForm"><div class="field"><label>' + h(t('Full name', 'الاسم الكامل')) + ' <input name="full_name" required></label></div>'
      + '<div class="field"><label>' + h(t('Email', 'البريد الإلكتروني')) + ' <input name="email" type="email" required></label></div>'
      + '<div class="field"><label>' + h(t('Password (8+ characters)', 'كلمة المرور (8 أحرف فأكثر)')) + ' <input name="password" type="password" required minlength="8"></label></div>'
      + '<div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id"><option value="">' + h(t('No enrolment', 'بدون تسجيل')) + '</option>' + courseOpts + '</select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create student account', 'إنشاء حساب الطالب')) + '</button></form>'
      + '<div id="adminCreateAccountOk" class="success" hidden style="margin-top:1rem"></div></div>')
      + view('people', 'People', 'الأشخاص', '<div class="dash-filterbar"><label>' + h(t('Search people', 'ابحث في الأشخاص')) + ' <input type="search" id="adminPeopleSearch" placeholder="' + h(t('Name, email or username', 'الاسم أو البريد أو اسم المستخدم')) + '"></label><label>' + h(t('Role', 'الدور')) + ' <select id="adminPeopleRole"><option value="">' + h(t('All roles', 'كل الأدوار')) + '</option><option value="student">' + h(t('Student', 'طالب')) + '</option><option value="teacher">' + h(t('Teacher', 'معلم')) + '</option><option value="admin">' + h(t('Admin', 'مسؤول')) + '</option></select></label></div>'
      + '<div class="card"><h3>' + h(t('Create a teacher', 'إنشاء حساب معلم')) + '</h3>'
      + '<form id="adminCreateTeacherForm"><div class="field"><label>' + h(t('Full name', 'الاسم الكامل')) + ' <input name="full_name" required></label></div>'
      + '<div class="field"><label>' + h(t('Username (optional)', 'اسم المستخدم (اختياري)')) + ' <input name="username"></label></div>'
      + '<div class="field"><label>' + h(t('Email', 'البريد الإلكتروني')) + ' <input name="email" type="email" required></label></div>'
      + '<div class="field"><label>' + h(t('Password (8+ characters)', 'كلمة المرور (8 أحرف فأكثر)')) + ' <input name="password" type="password" required minlength="8"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create teacher', 'إنشاء معلم')) + '</button></form>'
      + '<div id="adminCreateTeacherOk" class="success" hidden style="margin-top:1rem"></div></div>'
      + '<div class="card">'
      + table([t('Name', 'الاسم'), t('Email', 'البريد'), t('Role', 'الدور'), t('New password', 'كلمة مرور جديدة'), ''], users.map(function (u) {
        return '<tr data-search-text="' + h((u.full_name + ' ' + u.email + ' ' + (u.username || '')).toLowerCase()) + '" data-role-row="' + h(u.role) + '"><td>' + h(u.full_name) + '</td><td>' + h(u.email) + '</td>'
          + '<td><select data-role-for="' + h(u.id) + '">' + ['student', 'teacher', 'admin'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + h(r) + '</option>'; }).join('') + '</select></td>'
          + '<td><input type="password" data-pw-for="' + h(u.id) + '" placeholder="' + h(t('8+ characters', '8 أحرف فأكثر')) + '" style="width:150px"></td>'
          + '<td><button class="btn small" data-save-user="' + h(u.id) + '">' + h(t('Save', 'حفظ')) + '</button>' + (u.id === me.id ? '' : ' <button class="btn small outline" data-delete-user="' + h(u.id) + '">' + h(t('Delete', 'حذف')) + '</button>') + '</td></tr>';
      }), t('No users yet.', 'لا يوجد مستخدمون بعد.')) + '</div>')
      + view('courses', 'Courses and teachers', 'الدورات والمعلمون', '<div class="card"><h3>' + h(t('Create a course', 'إنشاء دورة')) + '</h3>'
      + '<form id="adminCreateCourseForm"><div class="field"><label>' + h(t('Title (English)', 'العنوان بالإنجليزية')) + ' <input name="title_en" id="adminCourseTitleEn" required></label></div>'
      + '<div class="field"><label>' + h(t('Title (Arabic, optional)', 'العنوان بالعربية (اختياري)')) + ' <input name="title_ar"></label></div>'
      + '<div class="field"><label>' + h(t('Slug (lowercase, hyphens only)', 'المعرّف (أحرف صغيرة وشرطات فقط)')) + ' <input name="slug" id="adminCourseSlug" required></label></div>'
      + '<div class="field"><label>' + h(t('Level', 'المستوى')) + ' <select name="level_id"><option value="">' + h(t('No level', 'بدون مستوى')) + '</option>' + levels.map(function (l) { return '<option value="' + h(l.id) + '">' + h(l.code) + ' — ' + h(lang === 'ar' ? l.name_ar || l.name_en : l.name_en) + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Weeks (optional)', 'عدد الأسابيع (اختياري)')) + ' <input name="duration_weeks" type="number" min="1"></label></div>'
      + '<div class="field"><label>' + h(t('Teacher', 'المعلم')) + ' <select name="teacher_id"><option value="">' + h(t('Unassigned', 'غير مسند')) + '</option>' + users.filter(function (u) { return u.role === 'teacher'; }).map(function (u) { return '<option value="' + h(u.id) + '">' + h(u.full_name) + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="field"><label><input name="is_published" type="checkbox" checked> ' + h(t('Published (visible to everyone)', 'منشورة (ظاهرة للجميع)')) + '</label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create course', 'إنشاء دورة')) + '</button></form>'
      + '<div id="adminCreateCourseOk" class="success" hidden style="margin-top:1rem"></div></div>'
      + '<div class="card">'
      + table([t('Course', 'الدورة'), t('Teacher', 'المعلم'), ''], courses.map(function (c) {
        var opts = '<option value="">' + h(t('Unassigned', 'غير مسند')) + '</option>' + users.filter(function (u) { return u.role === 'teacher'; }).map(function (u) {
          return '<option value="' + h(u.id) + '"' + (c.teacher_id === u.id ? ' selected' : '') + '>' + h(u.full_name) + '</option>';
        }).join('');
        return '<tr><td>' + h(c.title_en) + '</td><td><select data-teacher-for="' + h(c.id) + '">' + opts + '</select></td>'
          + '<td><button class="btn small" data-save-course="' + h(c.id) + '">' + h(t('Save', 'حفظ')) + '</button> <button class="btn small outline" data-delete-course="' + h(c.id) + '">' + h(t('Delete', 'حذف')) + '</button></td></tr>';
      }), t('No courses yet.', 'لا توجد دورات بعد.')) + '</div>')
      + view('enrolments', 'Recent enrolments', 'أحدث التسجيلات', '<div class="card">'
      + table([t('Student', 'الطالب'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], enr.slice(0, 20).map(function (e) {
        var c = cmap[e.course_id];
        var approve = e.status === 'pending' ? '<button class="btn small" data-approve="' + h(e.id) + '">' + h(t('Approve', 'موافقة')) + '</button>' : '';
        return '<tr><td>' + h(e.student_name || e.student_id) + '</td><td>' + h(c ? c.title_en : e.course_id) + '</td><td>' + h(e.status) + '</td><td>' + approve + ' <button class="btn small outline" data-remove-enrolment="' + h(e.id) + '">' + h(t('Remove', 'إزالة')) + '</button></td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>')
      + view('reports', 'Reports', 'التقارير', '<div class="card"><h3>' + h(t('Academy summary (real counts only)', 'ملخص الأكاديمية (أعداد حقيقية فقط)')) + '</h3>'
      + '<div class="dash-statgrid">' + overview('Students', 'الطلاب', students.length, '', '') + overview('Teachers', 'المعلمون', teachers.length, '', '') + overview('Courses', 'الدورات', courses.length, '', '') + overview('Enrolments', 'التسجيلات', enr.length, '', '') + '</div>'
      + '<p>' + h(t('Bookings: ', 'الطلبات: ')) + ['pending', 'confirmed', 'rejected'].map(function (s) { return s + ': ' + bookings.filter(function (b) { return b.status === s; }).length; }).join(' · ') + '</p>'
      + '<p>' + h(t('Enrolments: ', 'التسجيلات: ')) + ['pending', 'active', 'completed', 'cancelled'].map(function (s) { return s + ': ' + enr.filter(function (e) { return e.status === s; }).length; }).join(' · ') + '</p>'
      + '<p class="muted">' + h(t('No charts or exports are offered: this summary uses only counts already available to the admin.', 'لا توجد رسوم بيانية أو تصدير: هذا الملخص يستخدم فقط الأعداد المتاحة للمسؤول.')) + '</p></div>')
      + view('operations', 'Academic operations', 'العمليات الأكاديمية', '<div class="card"><h3>' + h(t('Levels', 'المستويات')) + '</h3><p>' + levels.map(function (l) { return h(l.code) + ' — ' + h(lang === 'ar' ? l.name_ar || l.name_en : l.name_en); }).join(' · ') + '</p></div>'
      + '<div class="card"><h3>' + h(t('Lessons', 'الدروس')) + '</h3><p>' + h(t('Total lessons: ', 'إجمالي الدروس: ')) + (ops.lessons == null ? h(t('could not load', 'تعذّر التحميل')) : ops.lessons.length) + '</p></div>'
      + '<div class="card"><h3>' + h(t('Assignments', 'الواجبات')) + '</h3><p>' + h(t('Total assignments: ', 'إجمالي الواجبات: ')) + (ops.assignments == null ? h(t('could not load', 'تعذّر التحميل')) : ops.assignments.length) + '</p></div>'
      + '<div class="card"><h3>' + h(t('Submissions', 'التسليمات')) + '</h3><p>' + h(t('Total submissions: ', 'إجمالي التسليمات: ')) + (ops.submissions == null ? h(t('could not load', 'تعذّر التحميل')) : ops.submissions.length) + '</p></div>'
      + '<div class="card"><h3>' + h(t('Attendance records', 'سجلات الحضور')) + '</h3><p>' + h(t('Total records: ', 'إجمالي السجلات: ')) + (ops.attendance == null ? h(t('could not load', 'تعذّر التحميل')) : ops.attendance.length) + '</p></div>'
      + '<div class="card"><h3>' + h(t('Announcements', 'الإعلانات')) + '</h3>'
      + (ops.announcements == null ? '<p class="muted">' + h(t('Could not load announcements.', 'تعذّر تحميل الإعلانات.')) + '</p>'
        : (ops.announcements.length ? ops.announcements.slice(0, 10).map(function (a) { return '<p><strong>' + h(a.title) + '</strong> <span class="muted">(' + h(a.audience || 'all') + ')</span><br><span class="muted">' + h(a.body) + '</span></p>'; }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>'))
      + '<form id="adminAnnouncement" style="margin-top:1rem"><div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required></label></div>'
      + '<div class="field"><label>' + h(t('Body', 'النص')) + ' <textarea name="body" rows="3" required></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Audience', 'الجمهور')) + ' <select name="audience"><option value="all">' + h(t('Everyone', 'الجميع')) + '</option><option value="students">' + h(t('Students', 'الطلاب')) + '</option><option value="teachers">' + h(t('Teachers', 'المعلمون')) + '</option></select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Publish announcement', 'نشر إعلان')) + '</button></form></div>');

    content.querySelectorAll('[data-confirm]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api.req('/api/admin/booking-requests/' + b.dataset.confirm, { method: 'PUT', body: { status: 'confirmed' } }); toast(t('Booking confirmed.', 'تم تأكيد الحجز.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-reject]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api.req('/api/admin/booking-requests/' + b.dataset.reject, { method: 'PUT', body: { status: 'rejected' } }); toast(t('Booking rejected.', 'تم رفض الحجز.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-approve]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api.req('/api/enrolments/' + b.dataset.approve, { method: 'PUT', body: { status: 'active' } }); toast(t('Enrolment approved.', 'تمت الموافقة على التسجيل.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    var form = document.getElementById('adminCreateAccountForm');
    content.querySelectorAll('[data-create]').forEach(function (b) {
      b.addEventListener('click', function () {
        var booking = bookings.find(function (x) { return x.id === b.dataset.create; });
        if (!booking || !form) return;
        form.elements.full_name.value = booking.full_name || '';
        form.elements.email.value = booking.email || '';
        if (booking.course) {
          var match = Array.prototype.find.call(form.elements.course_id.options, function (o) { return (o.dataset.en || o.text) === booking.course; });
          if (match) form.elements.course_id.value = match.value;
        }
        // The form lives in the Accounts view: switch to it first, then
        // scroll/focus once it is visible (hash is preserved on reload).
        location.hash = '#accounts';
        setTimeout(function () {
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          form.elements.password.focus();
        }, 0);
      });
    });
    content.querySelectorAll('[data-save-course]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.saveCourse;
        var value = content.querySelector('[data-teacher-for="' + id + '"]').value;
        try { await api.req('/api/courses/' + id, { method: 'PUT', body: { teacher_id: value || null } }); toast(t('Teacher saved.', 'تم حفظ المعلم.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-save-user]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.saveUser;
        var body = { role: content.querySelector('[data-role-for="' + id + '"]').value };
        var pwInput = content.querySelector('[data-pw-for="' + id + '"]');
        if (pwInput.value) body.password = pwInput.value;
        try { await api.req('/api/admin/users/' + id, { method: 'PUT', body: body }); toast(t('User saved.', 'تم حفظ المستخدم.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-delete-booking]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await confirmDlg('Delete this booking request? This cannot be undone.', 'حذف طلب الحجز هذا؟ لا يمكن التراجع عن هذا.'))) return;
        try { await api.req('/api/admin/booking-requests/' + b.dataset.deleteBooking, { method: 'DELETE' }); toast(t('Booking deleted.', 'تم حذف الطلب.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-delete-course]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await confirmDlg('Delete this course? Enrolments for it stay as they are.', 'حذف هذه الدورة؟ التسجيلات فيها تبقى كما هي.'))) return;
        try { await api.req('/api/courses/' + b.dataset.deleteCourse, { method: 'DELETE' }); toast(t('Course deleted.', 'تم حذف الدورة.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-delete-user]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await confirmDlg('Delete this user? Their enrolments are removed too.', 'حذف هذا المستخدم؟ تسجيلاته تُحذف أيضًا.'))) return;
        try { await api.req('/api/admin/users/' + b.dataset.deleteUser, { method: 'DELETE' }); toast(t('User deleted.', 'تم حذف المستخدم.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-remove-enrolment]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!(await confirmDlg('Remove this enrolment?', 'إزالة هذا التسجيل؟'))) return;
        try { await api.req('/api/enrolments/' + b.dataset.removeEnrolment, { method: 'DELETE' }); toast(t('Enrolment removed.', 'تمت إزالة التسجيل.'), 'success'); refreshCurrent(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    content.querySelectorAll('[data-booking-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.querySelectorAll('[data-booking-tab]').forEach(function (b) { b.classList.toggle('active', b === btn); });
        var wanted = btn.dataset.bookingTab;
        content.querySelectorAll('[data-booking-status]').forEach(function (row) { row.hidden = !(wanted === 'all' || row.dataset.bookingStatus === wanted); });
      });
    });
    var stuSearch = document.getElementById('adminStudentSearch');
    if (stuSearch) stuSearch.addEventListener('input', function () {
      var q = stuSearch.value.trim().toLowerCase();
      document.querySelectorAll('#view-students [data-search-text]').forEach(function (row) { row.hidden = !!q && row.dataset.searchText.indexOf(q) < 0; });
    });
    var pplSearch = document.getElementById('adminPeopleSearch'), pplRole = document.getElementById('adminPeopleRole');
    var applyPeopleFilter = function () {
      var q = pplSearch ? pplSearch.value.trim().toLowerCase() : '';
      var r = pplRole ? pplRole.value : '';
      document.querySelectorAll('#view-people [data-search-text]').forEach(function (row) {
        row.hidden = (!!q && row.dataset.searchText.indexOf(q) < 0) || (!!r && row.dataset.roleRow !== r);
      });
    };
    if (pplSearch) pplSearch.addEventListener('input', applyPeopleFilter);
    if (pplRole) pplRole.addEventListener('change', applyPeopleFilter);
    var adminAnn = document.getElementById('adminAnnouncement');
    if (adminAnn) adminAnn.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = adminAnn.querySelector('button[type="submit"]');
      setBusy(btn, true);
      try { await api.req('/api/announcements', { method: 'POST', body: { title: adminAnn.elements.title.value.trim(), body: adminAnn.elements.body.value.trim(), audience: adminAnn.elements.audience.value } }); toast(t('Announcement published.', 'تم نشر الإعلان.'), 'success'); adminAnn.reset(); refreshCurrent(); }
      catch (err) { toast(err.message, 'error'); }
      setBusy(btn, false);
    });
    var enrolForm = document.getElementById('adminEnrolForm');
    if (enrolForm) enrolForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api.req('/api/admin/enrolments', { method: 'POST', body: { student_id: enrolForm.elements.student_id.value, course_id: enrolForm.elements.course_id.value, status: 'active' } });
        toast(t('Student enrolled.', 'تم تسجيل الطالب.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
    });
    var teacherForm = document.getElementById('adminCreateTeacherForm');
    if (teacherForm) teacherForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        var tu = await api.req('/api/admin/users', { method: 'POST', body: {
          full_name: teacherForm.elements.full_name.value.trim(), username: teacherForm.elements.username.value.trim() || null,
          email: teacherForm.elements.email.value.trim(), password: teacherForm.elements.password.value, role: 'teacher' } });
        var tok = document.getElementById('adminCreateTeacherOk');
        if (tok) { tok.hidden = false; tok.textContent = (lang === 'ar' ? 'تم إنشاء حساب المعلم ' : 'Teacher account created for ') + tu.user.email + ' ✔'; }
        teacherForm.reset(); refreshCurrent();
      } catch (err) { toast((lang === 'ar' ? 'فشل إنشاء المعلم: ' : 'Teacher creation failed: ') + err.message, 'error'); }
    });
    var courseForm = document.getElementById('adminCreateCourseForm');
    if (courseForm) {
      var titleInput = document.getElementById('adminCourseTitleEn');
      var slugInput = document.getElementById('adminCourseSlug');
      if (titleInput && slugInput) {
        titleInput.addEventListener('input', function () {
          if (slugInput.dataset.edited) return;
          slugInput.value = titleInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        });
        slugInput.addEventListener('input', function () { slugInput.dataset.edited = '1'; });
      }
      courseForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          var cc = await api.req('/api/courses', { method: 'POST', body: {
            title_en: courseForm.elements.title_en.value.trim(), title_ar: courseForm.elements.title_ar.value.trim() || null,
            slug: courseForm.elements.slug.value.trim(), level_id: courseForm.elements.level_id.value || null,
            duration_weeks: courseForm.elements.duration_weeks.value ? Number(courseForm.elements.duration_weeks.value) : null,
            teacher_id: courseForm.elements.teacher_id.value || null, is_published: courseForm.elements.is_published.checked } });
          var cok = document.getElementById('adminCreateCourseOk');
          if (cok) { cok.hidden = false; cok.textContent = (lang === 'ar' ? 'تم إنشاء الدورة ' : 'Course created: ') + cc.course.title_en + ' ✔'; }
          courseForm.reset(); refreshCurrent();
        } catch (err) { toast((lang === 'ar' ? 'فشل إنشاء الدورة: ' : 'Course creation failed: ') + err.message, 'error'); }
      });
    }
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        var created = await api.req('/api/admin/users', { method: 'POST', body: {
          full_name: form.elements.full_name.value.trim(), email: form.elements.email.value.trim(),
          password: form.elements.password.value, role: 'student'
        }});
        if (form.elements.course_id.value) {
          await api.req('/api/admin/enrolments', { method: 'POST', body: { student_id: created.user.id, course_id: form.elements.course_id.value, status: 'active' } });
        }
        toast(t('Account created for ', 'تم إنشاء حساب ') + created.user.email, 'success');
        location.hash = '#accounts';
        refreshCurrent();
      } catch (err) { toast((lang === 'ar' ? 'فشل إنشاء الحساب: ' : 'Account creation failed: ') + err.message, 'error'); }
    });

  }

  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (err) { content.innerHTML = '<div class="dash-error"><p>' + h(t('Could not load your workspace.', 'تعذّر تحميل مساحة العمل.')) + '</p><p class="muted">' + h(err.message) + '</p></div>'; }); });
})();
