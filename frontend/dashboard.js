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
  window.__onLangChange = function () { if (ready) location.reload(); };

  function card(label, value, note) {
    return '<div class="card"><h3>' + h(label) + '</h3><p class="price">' + h(value) + '</p><p class="muted">' + h(note || '') + '</p></div>';
  }
  function table(headers, rows, emptyText) {
    if (!rows.length) return '<p class="muted">' + h(emptyText) + '</p>';
    return '<table><tr>' + headers.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' + rows.join('') + '</table>';
  }
  function dashFor(r) { return r === 'admin' ? 'dashboard-admin.html' : r === 'teacher' ? 'dashboard-teacher.html' : 'dashboard-student.html'; }
  function logoutLink() {
    var link = document.querySelector('.nav-actions a[href="login.html"]');
    if (!link) return;
    link.href = '#';
    link.textContent = t('Log out', 'خروج');
    link.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('bbc-token');
      localStorage.removeItem('bbc-user');
      location.href = 'index.html';
    });
  }
  function heading(me, note) {
    return '<span class="eyebrow page-eyebrow">BBC Academy</span><h1>' + h(t('Welcome, ', 'مرحبًا، ') + (me.full_name || '')) + '</h1><p class="muted">' + h(note) + '</p>';
  }

  // Every role gets the same account block: change your own password.
  function accountCard() {
    var card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '1rem';
    card.innerHTML = '<h3>' + h(t('Account', 'الحساب')) + '</h3>'
      + '<form id="accountPassword"><div class="field"><label>' + h(t('Current password', 'كلمة المرور الحالية')) + ' <input type="password" name="current_password" required autocomplete="current-password"></label></div>'
      + '<div class="field"><label>' + h(t('New password (8+ characters)', 'كلمة المرور الجديدة (8 أحرف فأكثر)')) + ' <input type="password" name="new_password" required minlength="8" autocomplete="new-password"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Change password', 'تغيير كلمة المرور')) + '</button>'
      + '<p id="accountPasswordOk" class="muted" hidden style="margin-top:.5rem"></p></form>';
    content.appendChild(card);
    var form = card.querySelector('#accountPassword');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var okMsg = card.querySelector('#accountPasswordOk');
      try {
        await api.req('/api/profile/password', { method: 'POST', body: { current_password: form.elements.current_password.value, new_password: form.elements.new_password.value } });
        form.reset();
        if (okMsg) { okMsg.hidden = false; okMsg.textContent = t('Password changed. It works from your next login.', 'تم تغيير كلمة المرور. ستُستخدم عند تسجيل الدخول القادم.'); }
      } catch (err) { alert(err.message); }
    });
  }

  async function boot() {
    if (!api || !api.base()) {
      content.innerHTML = heading({ full_name: '' }, t('Demo mode — connect the API to use the dashboards.', 'وضع تجريبي — اربط الـ API لاستخدام لوحات التحكم.'));
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
    logoutLink();
    if (role === 'student') await renderStudent(me);
    else if (role === 'teacher') await renderTeacher(me);
    else await renderAdmin(me);
    accountCard();
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
    content.innerHTML = heading(me, t('Your course, progress and homework in one place.', 'دورتك وتقدمك وواجباتك في مكان واحد.'))
      + '<div class="grid grid3">'
      + card(t('My courses', 'دوراتي'), enr.length, t('enrolments', 'تسجيل'))
      + card(t('My level', 'مستواي'), latest ? latest.recommended_level : '—', latest ? t('placement result', 'نتيجة اختبار المستوى') : t('not taken yet', 'لم تُجرَ بعد'))
      + card(t('Attendance', 'الحضور'), present + ' / ' + att.length, t('lessons attended', 'حصة حضرتها'))
      + '</div><div class="grid grid2" style="margin-top:1rem">'
      + '<div class="card"><h3>' + h(t('My enrolments', 'تسجيلاتي')) + '</h3>'
      + table([t('Course', 'الدورة'), t('Status', 'الحالة')], enr.map(function (e) {
        var c = cmap[e.course_id];
        return '<tr><td>' + h(c ? (lang === 'ar' ? c.title_ar || c.title_en : c.title_en) : e.course_id) + '</td><td>' + h(e.status) + '</td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>'
      + '<div class="card"><h3>' + h(t('Homework', 'الواجبات')) + '</h3>'
      + table([t('Task', 'المهمة'), t('Course', 'الدورة'), t('Status', 'الحالة')], asg.map(function (a) {
        var c = cmap[a.course_id];
        var status = a.submission ? (a.submission.grade != null ? a.submission.grade + ' / 100' : t('Submitted', 'تم التسليم')) : t('Not submitted', 'لم يُسلَّم');
        return '<tr><td>' + h(a.title) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + h(status) + '</td></tr>';
      }), t('No homework yet.', 'لا توجد واجبات بعد.'))
      + (openAsg.length
        ? '<form id="studentSubmit" style="margin-top:1rem"><div class="field"><label>' + h(t('Assignment', 'الواجب')) + ' <select name="assignment_id">' + openAsg.map(function (a) { return '<option value="' + h(a.id) + '">' + h(a.title) + '</option>'; }).join('') + '</select></label></div>'
          + '<div class="field"><label>' + h(t('Your answer', 'إجابتك')) + ' <textarea name="content_text" rows="3" required></textarea></label></div>'
          + '<button class="btn small" type="submit">' + h(t('Submit homework', 'تسليم الواجب')) + '</button></form>'
        : '') + '</div>'
      + '</div><div class="grid grid2" style="margin-top:1rem">'
      + '<div class="card"><h3>' + h(t('Lessons', 'الدروس')) + '</h3>'
      + table([t('Lesson', 'الدرس'), t('Course', 'الدورة'), ''], lessons.map(function (l) {
        var c = cmap[l.course_id];
        var join = l.live_class_url ? '<a class="btn small" href="' + h(l.live_class_url) + '" target="_blank" rel="noopener">' + h(t('Join', 'انضم')) + '</a>' : '';
        return '<tr><td>' + h(l.title_en) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + join + '</td></tr>';
      }), t('No lessons yet.', 'لا توجد دروس بعد.')) + '</div>'
      + '<div class="card"><h3>' + h(t('Announcements', 'الإعلانات')) + '</h3>'
      + (ann.length ? ann.slice(0, 5).map(function (a) {
        return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body).replace(/\n/g, '<br>') + '</span></p>';
      }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div></div>'
      + '<p class="muted" style="margin-top:1rem">' + h(t('Grades: ', 'الدرجات: ') + graded + ' / ' + asg.length) + '</p>';

    var submitForm = document.getElementById('studentSubmit');
    if (submitForm) submitForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = submitForm.elements.content_text.value.trim();
      if (!text) return;
      try {
        await api.req('/api/submissions', { method: 'POST', body: { assignment_id: submitForm.elements.assignment_id.value, content_text: text } });
        location.reload();
      } catch (err) { alert(err.message); }
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
    content.innerHTML = heading(me, t('Your classes, students and tasks for today.', 'حصصك وطلابك ومهام اليوم.'))
      + '<div class="grid grid3">' + card(t('My courses', 'دوراتي'), courses.length, '') + card(t('Students', 'الطلاب'), Object.keys(students).length, t('across your courses', 'في دوراتك')) + card(t('To grade', 'بانتظار التصحيح'), ungraded, t('submissions', 'تسليم')) + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('My classes', 'حصصي')) + '</h3>'
      + table([t('Class', 'الحصة'), t('Students', 'الطلاب')], courses.map(function (c) {
        return '<tr><td>' + h(c.title_en) + '</td><td>' + enr.filter(function (e) { return e.course_id === c.id; }).length + '</td></tr>';
      }), t('No courses assigned yet.', 'لا توجد دورات مسندة بعد.')) + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Submissions to grade', 'تسليمات للتصحيح')) + '</h3>'
      + table([t('Student', 'الطالب'), t('Task', 'المهمة'), t('Grade', 'الدرجة'), t('Feedback', 'ملاحظات'), ''], subs.map(function (s) {
        var a = amap[s.assignment_id];
        return '<tr><td>' + h(s.student_name || s.student_id) + '</td><td>' + h(a ? a.title : '') + '</td><td><input type="number" min="0" max="100" style="width:80px" value="' + h(s.grade == null ? '' : s.grade) + '" data-grade="' + h(s.id) + '"></td><td><input data-feedback="' + h(s.id) + '" value="' + h(s.feedback || '') + '"></td><td><button class="btn small" data-grade-btn="' + h(s.id) + '">' + h(t('Save', 'حفظ')) + '</button></td></tr>';
      }), t('No submissions yet.', 'لا توجد تسليمات بعد.')) + '</div>'
      + '<div class="grid grid2" style="margin-top:1rem">'
      + '<div class="card"><h3>' + h(t('Mark attendance', 'تسجيل الحضور')) + '</h3>'
      + '<form id="teacherAttendance"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Student', 'الطالب')) + ' <select name="student_id" required>' + studentOpts('') + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Status', 'الحالة')) + ' <select name="status"><option value="present">' + h(t('Present', 'حاضر')) + '</option><option value="absent">' + h(t('Absent', 'غائب')) + '</option><option value="late">' + h(t('Late', 'متأخر')) + '</option><option value="excused">' + h(t('Excused', 'بعذر')) + '</option></select></label></div>'
      + '<div class="field"><label>' + h(t('Date', 'التاريخ')) + ' <input type="date" name="attended_on" value="' + new Date().toLocaleDateString('en-CA') + '"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Save attendance', 'حفظ الحضور')) + '</button></form></div>'
      + '<div class="card"><h3>' + h(t('Post an announcement', 'نشر إعلان')) + '</h3>'
      + '<form id="teacherAnnouncement"><div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required></label></div>'
      + '<div class="field"><label>' + h(t('Body', 'النص')) + ' <textarea name="body" rows="3" required></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Audience', 'الجمهور')) + ' <select name="audience"><option value="all">' + h(t('Everyone', 'الجميع')) + '</option><option value="students">' + h(t('Students', 'الطلاب')) + '</option></select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Publish', 'نشر')) + '</button></form></div></div>'
      + (courses.length
        ? '<div class="grid grid2" style="margin-top:1rem"><div class="card"><h3>' + h(t('New assignment', 'واجب جديد')) + '</h3>'
      + '<form id="teacherAssignment"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="300"></label></div>'
      + '<div class="field"><label>' + h(t('Description', 'الوصف')) + ' <textarea name="description" rows="2"></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Due date', 'تاريخ التسليم')) + ' <input type="date" name="due_date"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create assignment', 'إنشاء الواجب')) + '</button></form></div>'
      + '<div class="card"><h3>' + h(t('New lesson', 'درس جديد')) + '</h3>'
      + '<form id="teacherLesson"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="200"></label></div>'
      + '<div class="field"><label>' + h(t('Live class link', 'رابط الحصة المباشرة')) + ' <input name="live_class_url" type="url" dir="ltr" placeholder="https://meet.google.com/..."></label></div>'
      + '<div class="field"><label>' + h(t('Lesson number', 'رقم الدرس')) + ' <input type="number" name="order_no" min="1" value="1"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Add lesson', 'إضافة الدرس')) + '</button></form></div></div>'
        : '<div class="card" style="margin-top:1rem"><h3>' + h(t('Add coursework', 'إضافة واجبات ودروس')) + '</h3><p class="muted">' + h(t('An admin must assign you a course before you can add lessons or assignments.', 'يجب أن يسند إليك المسؤول دورة قبل أن تضيف دروسًا أو واجبات.')) + '</p></div>')
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Announcements', 'الإعلانات')) + '</h3>'
      + (ann.length ? ann.slice(0, 5).map(function (a) { return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body) + '</span></p>'; }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div>';

    content.querySelectorAll('[data-grade-btn]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.gradeBtn;
        var grade = content.querySelector('[data-grade="' + id + '"]').value;
        var feedback = content.querySelector('[data-feedback="' + id + '"]').value;
        try { await api.req('/api/submissions/' + id + '/grade', { method: 'POST', body: { grade: Number(grade), feedback: feedback } }); location.reload(); }
        catch (err) { alert(err.message); }
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
          location.reload();
        } catch (err) { alert(err.message); }
      });
    }
    var annForm = document.getElementById('teacherAnnouncement');
    if (annForm) annForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api.req('/api/announcements', { method: 'POST', body: { title: annForm.elements.title.value.trim(), body: annForm.elements.body.value.trim(), audience: annForm.elements.audience.value } });
        location.reload();
      } catch (err) { alert(err.message); }
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
        location.reload();
      } catch (err) { alert(err.message); }
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
        location.reload();
      } catch (err) { alert(err.message); }
    });
  }

  async function renderAdmin(me) {
    var data = await Promise.all([
      api.req('/api/admin/users'), api.req('/api/courses?all=1'), api.req('/api/admin/booking-requests'), api.req('/api/enrolments')
    ]);
    var users = data[0].users || [], courses = data[1].courses || [], bookings = data[2].booking_requests || [], enr = data[3].enrolments || [];
    var cmap = {}; courses.forEach(function (c) { cmap[c.id] = c; });
    var students = users.filter(function (u) { return u.role === 'student'; });
    var pending = bookings.filter(function (b) { return b.status === 'pending'; });
    var courseOpts = courses.map(function (c) { return '<option value="' + h(c.id) + '" data-en="' + h(c.title_en) + '">' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</option>'; }).join('');
    content.innerHTML = heading(me, t('Students, courses and bookings at a glance.', 'الطلاب والدورات والحجوزات في لمحة.'))
      + '<div class="grid grid3">' + card(t('Students', 'الطلاب'), students.length, '') + card(t('Courses', 'الدورات'), courses.length, '') + card(t('Pending bookings', 'حجوزات معلّقة'), pending.length, '') + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Booking requests', 'طلبات الحجز')) + '</h3>'
      + table([t('Name', 'الاسم'), t('Contact', 'التواصل'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], bookings.map(function (b) {
        var actions = b.status === 'pending'
          ? '<button class="btn small" data-confirm="' + h(b.id) + '">' + h(t('Confirm', 'تأكيد')) + '</button> <button class="btn small outline" data-reject="' + h(b.id) + '">' + h(t('Reject', 'رفض')) + '</button>'
          : '';
        actions += ' <button class="btn small outline" data-create="' + h(b.id) + '">' + h(t('Create account', 'إنشاء حساب')) + '</button>';
        var contact = [b.email, b.phone].filter(Boolean).join(' · ');
        return '<tr><td>' + h(b.full_name) + '</td><td>' + h(contact) + '</td><td>' + h(b.course || '') + '</td><td>' + h(b.status) + '</td><td>' + actions + '</td></tr>';
      }), t('No booking requests yet.', 'لا توجد طلبات حجز بعد.')) + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Create a student account', 'إنشاء حساب طالب')) + '</h3>'
      + '<p class="muted">' + h(t('After confirming a booking, create the student account and enrol them in the course.', 'بعد تأكيد الحجز، أنشئ حساب الطالب وسجّله في الدورة.')) + '</p>'
      + '<form id="adminCreateAccountForm"><div class="field"><label>' + h(t('Full name', 'الاسم الكامل')) + ' <input name="full_name" required></label></div>'
      + '<div class="field"><label>' + h(t('Email', 'البريد الإلكتروني')) + ' <input name="email" type="email" required></label></div>'
      + '<div class="field"><label>' + h(t('Password (8+ characters)', 'كلمة المرور (8 أحرف فأكثر)')) + ' <input name="password" type="password" required minlength="8"></label></div>'
      + '<div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id"><option value="">' + h(t('No enrolment', 'بدون تسجيل')) + '</option>' + courseOpts + '</select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create student account', 'إنشاء حساب الطالب')) + '</button></form>'
      + '<div id="adminCreateAccountOk" class="success" hidden style="margin-top:1rem"></div></div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('People', 'الأشخاص')) + '</h3>'
      + table([t('Name', 'الاسم'), t('Email', 'البريد'), t('Role', 'الدور'), t('New password', 'كلمة مرور جديدة'), ''], users.map(function (u) {
        return '<tr><td>' + h(u.full_name) + '</td><td>' + h(u.email) + '</td>'
          + '<td><select data-role-for="' + h(u.id) + '">' + ['student', 'teacher', 'admin'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + h(r) + '</option>'; }).join('') + '</select></td>'
          + '<td><input type="password" data-pw-for="' + h(u.id) + '" placeholder="' + h(t('8+ characters', '8 أحرف فأكثر')) + '" style="width:150px"></td>'
          + '<td><button class="btn small" data-save-user="' + h(u.id) + '">' + h(t('Save', 'حفظ')) + '</button></td></tr>';
      }), t('No users yet.', 'لا يوجد مستخدمون بعد.')) + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Courses and teachers', 'الدورات والمعلمون')) + '</h3>'
      + table([t('Course', 'الدورة'), t('Teacher', 'المعلم'), ''], courses.map(function (c) {
        var opts = '<option value="">' + h(t('Unassigned', 'غير مسند')) + '</option>' + users.filter(function (u) { return u.role === 'teacher'; }).map(function (u) {
          return '<option value="' + h(u.id) + '"' + (c.teacher_id === u.id ? ' selected' : '') + '>' + h(u.full_name) + '</option>';
        }).join('');
        return '<tr><td>' + h(c.title_en) + '</td><td><select data-teacher-for="' + h(c.id) + '">' + opts + '</select></td>'
          + '<td><button class="btn small" data-save-course="' + h(c.id) + '">' + h(t('Save', 'حفظ')) + '</button></td></tr>';
      }), t('No courses yet.', 'لا توجد دورات بعد.')) + '</div>'
      + '<div class="card" style="margin-top:1rem"><h3>' + h(t('Recent enrolments', 'أحدث التسجيلات')) + '</h3>'
      + table([t('Student', 'الطالب'), t('Course', 'الدورة'), t('Status', 'الحالة')], enr.slice(0, 20).map(function (e) {
        var c = cmap[e.course_id];
        return '<tr><td>' + h(e.student_name || e.student_id) + '</td><td>' + h(c ? c.title_en : e.course_id) + '</td><td>' + h(e.status) + '</td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>';

    content.querySelectorAll('[data-confirm]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api.req('/api/admin/booking-requests/' + b.dataset.confirm, { method: 'PUT', body: { status: 'confirmed' } }); location.reload(); }
        catch (err) { alert(err.message); }
      });
    });
    content.querySelectorAll('[data-reject]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try { await api.req('/api/admin/booking-requests/' + b.dataset.reject, { method: 'PUT', body: { status: 'rejected' } }); location.reload(); }
        catch (err) { alert(err.message); }
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
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.elements.password.focus();
      });
    });
    content.querySelectorAll('[data-save-course]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.saveCourse;
        var value = content.querySelector('[data-teacher-for="' + id + '"]').value;
        try { await api.req('/api/courses/' + id, { method: 'PUT', body: { teacher_id: value || null } }); location.reload(); }
        catch (err) { alert(err.message); }
      });
    });
    content.querySelectorAll('[data-save-user]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.saveUser;
        var body = { role: content.querySelector('[data-role-for="' + id + '"]').value };
        var pwInput = content.querySelector('[data-pw-for="' + id + '"]');
        if (pwInput.value) body.password = pwInput.value;
        try { await api.req('/api/admin/users/' + id, { method: 'PUT', body: body }); location.reload(); }
        catch (err) { alert(err.message); }
      });
    });
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var okBox = document.getElementById('adminCreateAccountOk');
      try {
        var created = await api.req('/api/admin/users', { method: 'POST', body: {
          full_name: form.elements.full_name.value.trim(), email: form.elements.email.value.trim(),
          password: form.elements.password.value, role: 'student'
        }});
        if (form.elements.course_id.value) {
          await api.req('/api/admin/enrolments', { method: 'POST', body: { student_id: created.user.id, course_id: form.elements.course_id.value, status: 'active' } });
        }
        if (okBox) { okBox.hidden = false; okBox.textContent = t('Account created for ', 'تم إنشاء حساب ') + created.user.email + ' ✔'; }
        form.reset();
      } catch (err) { alert((lang === 'ar' ? 'فشل إنشاء الحساب: ' : 'Account creation failed: ') + err.message); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (err) { content.innerHTML = '<p class="api-error">' + h(err.message) + '</p>'; }); });
})();
