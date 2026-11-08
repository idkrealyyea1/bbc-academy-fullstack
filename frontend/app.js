/* ==========================================================================
   BBC English Academy — shared runtime
   • bilingual rendering (EN/AR) with RTL/LTR
   • navigation (desktop + mobile drawer), language persistence
   • public catalogue, course detail, placement quiz
   • demo-mode form feedback (never presented as a sent request)
   Connected-mode requests are owned by api.js, which runs first.
   ========================================================================== */
(function () {
  'use strict';

  var LANG_KEY = 'bbc-lang';
  function getLang() { return localStorage.getItem(LANG_KEY) || 'ar'; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tr(en, ar) { return getLang() === 'ar' ? ar : en; }
  window.esc = esc;

  /* ------------------------------- language ------------------------------- */
  function applyLanguage(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-en]').forEach(function (el) {
      // Never rewrite a node that holds a form control: replacing its content
      // would delete the control (a real bug in the previous implementation).
      if (el.querySelector('input, select, textarea')) return;
      var value = lang === 'ar' ? (el.dataset.ar != null ? el.dataset.ar : el.dataset.en) : el.dataset.en;
      if (value == null) return;
      if (el.hasAttribute('data-html')) {
        el.innerHTML = value;
      } else if (!el.children.length) {
        el.textContent = value;
      } else {
        // Preserve nested icons/marks: update only the first text node.
        var node = Array.prototype.find.call(el.childNodes, function (n) {
          return n.nodeType === 3 && n.textContent.trim();
        });
        if (node) node.textContent = value;
      }
    });

    document.querySelectorAll('[data-alt-en]').forEach(function (el) {
      el.alt = lang === 'ar' ? (el.dataset.altAr || el.dataset.altEn) : el.dataset.altEn;
    });
    document.querySelectorAll('[data-ph-en]').forEach(function (el) {
      el.placeholder = lang === 'ar' ? (el.dataset.phAr || el.dataset.phEn) : el.dataset.phEn;
    });
    document.querySelectorAll('[data-label-en]').forEach(function (el) {
      el.setAttribute('aria-label', lang === 'ar' ? (el.dataset.labelAr || el.dataset.labelEn) : el.dataset.labelEn);
    });

    document.querySelectorAll('.lang-toggle').forEach(function (btn) {
      btn.textContent = lang === 'ar' ? 'EN' : 'عربي';
      btn.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
    });
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.textContent = lang === 'ar' ? 'English' : 'العربية';
    });

    // In connected mode, never paint the demo catalogue while the real API
    // request is still in flight (or after it failed).
    var connected = !!(window.BBC_API && window.BBC_API.base && window.BBC_API.base());
    if (typeof window.renderCourses === 'function' && document.getElementById('courseGrid') && (!connected || window.__coursesLoaded)) {
      window.renderCourses(window.__filter || 'all', lang);
    }
    if (typeof window.renderCourseDetail === 'function' && document.getElementById('courseDetail') && (!connected || window.__courseLoaded)) {
      window.renderCourseDetail(lang);
    }
    if (typeof window.__quizActive !== 'undefined' && window.__quizActive && typeof window.quizShow === 'function') {
      window.quizShow();
    }
    if (typeof window.__onLangChange === 'function') window.__onLangChange(lang);
  }
  window.applyLanguage = applyLanguage;
  window.getLang = getLang;
  window.setLanguage = applyLanguage;

  /* ------------------------------- navigation ------------------------------ */
  function initNavigation() {
    var btn = document.getElementById('menuBtn');
    var nav = document.getElementById('mainNav');
    if (!btn || !nav) return;
    var scrim = null;

    function setOpen(open, restoreFocus) {
      nav.classList.toggle('open', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open
        ? (getLang() === 'ar' ? 'إغلاق القائمة' : 'Close navigation menu')
        : (getLang() === 'ar' ? 'فتح القائمة' : 'Open navigation menu'));
      document.body.classList.toggle('nav-open', open);
      if (open) {
        if (!scrim) {
          scrim = document.createElement('div');
          scrim.className = 'nav-scrim';
          scrim.setAttribute('aria-hidden', 'true');
          scrim.addEventListener('click', function () { setOpen(false, true); });
          document.body.appendChild(scrim);
        }
        scrim.hidden = false;
        var first = nav.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      } else if (scrim) {
        scrim.hidden = true;
        if (restoreFocus) btn.focus({ preventScroll: true });
      }
    }

    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'), false);
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false, false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false, true);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080 && nav.classList.contains('open')) setOpen(false, false);
    });
  }

  /* ------------------------------ demo forms ------------------------------ */
  function initDemoForms() {
    var connected = !!(window.BBC_API && window.BBC_API.base && window.BBC_API.base());
    if (connected) return; // api.js owns submission in connected mode.

    var demoMessage = function () {
      return getLang() === 'ar'
        ? 'نسخة عرض: لم يُرسل هذا النموذج ولم تُحفظ بياناتك. عند ربط الخادم سيصل الطلب إلى الأكاديمية.'
        : 'Demo mode: this form was not sent and nothing was saved. Once the API is connected, requests reach the academy.';
    };

    document.querySelectorAll('form[data-mock]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (!form.reportValidity()) return;
        e.preventDefault();
        var out = document.getElementById(form.dataset.mock);
        var submit = form.querySelector('[type="submit"]');
        if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
        form.querySelectorAll('.api-error').forEach(function (el) { el.remove(); });
        if (!out) return;
        var extra = form.dataset.mock === 'loginOk'
          ? ' <a href="dashboard-student.html">' + esc(tr('Open the demo dashboard', 'افتح اللوحة التجريبية')) + '</a>'
          : '';
        out.innerHTML = '<p>' + esc(demoMessage()) + extra + '</p>';
        out.hidden = false;
        out.setAttribute('role', 'status');
        out.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
        window.setTimeout(function () { if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); } }, 1200);
      });
    });

    var enroll = document.getElementById('enrollment-form');
    if (enroll) {
      enroll.addEventListener('submit', function (e) {
        if (!enroll.reportValidity()) return;
        e.preventDefault();
        var submit = enroll.querySelector('[type="submit"]');
        var out = document.getElementById('form-success');
        if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
        if (!out) return;
        out.innerHTML = '<p>' + esc(demoMessage()) + '</p>';
        out.hidden = false;
        out.setAttribute('role', 'status');
        out.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
        window.setTimeout(function () { if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); } }, 1200);
      });
    }
  }

  /* --------------------------- password visibility ------------------------ */
  function initPasswordToggles() {
    document.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      var input = document.getElementById(btn.getAttribute('data-pw-toggle'));
      if (!input) return;
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show
          ? (getLang() === 'ar' ? 'إخفاء' : 'Hide')
          : (getLang() === 'ar' ? 'إظهار' : 'Show');
        btn.setAttribute('aria-pressed', String(show));
      });
    });
  }

  /* -------------------------------- catalogue ------------------------------ */
  // Demo catalogue. Marked as sample content in the UI until the API provides
  // the academy's published courses. No prices, schedules or teachers invented.
  var COURSES = [
    { id: 'general-a1', level: 'Beginner', en: 'General English A1', ar: 'الإنجليزية العامة A1', desc_en: 'Start from the beginning: sounds, everyday phrases and clear sentences.', desc_ar: 'ابدأ من الأساس: الأصوات، وعبارات الحياة اليومية، وجمل واضحة.', weeks: 8, lessons: 24, section: 'general' },
    { id: 'general-a2', level: 'Elementary', en: 'General English A2', ar: 'الإنجليزية العامة A2', desc_en: 'Build everyday vocabulary, grammar and conversation for daily life.', desc_ar: 'بناء مفردات وقواعد ومحادثة يومية للحياة اليومية.', weeks: 8, lessons: 24, section: 'general' },
    { id: 'general-b1', level: 'Intermediate', en: 'General English B1', ar: 'الإنجليزية العامة B1', desc_en: 'Discuss opinions, tell stories and handle travel and work situations.', desc_ar: 'ناقش الآراء واحكِ القصص وتعامل مع مواقف السفر والعمل.', weeks: 10, lessons: 30, section: 'general' },
    { id: 'general-b2', level: 'Upper intermediate', en: 'General English B2', ar: 'الإنجليزية العامة B2', desc_en: 'Debate, present and write clearly for study and professional use.', desc_ar: 'ناقش وقدّم واكتب بوضوح للدراسة والاستخدام المهني.', weeks: 10, lessons: 30, section: 'general' },
    { id: 'ielts-prep', level: 'Advanced', en: 'Exam preparation', ar: 'التحضير للاختبارات', desc_en: 'Strategies, timed practice and feedback across all four skills.', desc_ar: 'استراتيجيات وتدريب موقوت وملاحظات على المهارات الأربع.', weeks: 6, lessons: 18, section: 'ielts' },
    { id: 'conversation', level: 'Elementary', en: 'Conversation Club', ar: 'نادي المحادثة', desc_en: 'Weekly speaking practice on real-life topics in a guided group.', desc_ar: 'تدريب أسبوعي على التحدث حول مواضيع واقعية في مجموعة موجّهة.', weeks: 4, lessons: 8, section: 'conversation' },
    { id: 'business', level: 'Upper intermediate', en: 'Business English', ar: 'إنجليزية الأعمال', desc_en: 'Meetings, emails, presentations and interviews in professional English.', desc_ar: 'اجتماعات ورسائل وعروض ومقابلات بالإنجليزية المهنية.', weeks: 8, lessons: 24, section: 'business' },
    { id: 'kids', level: 'Beginner', en: 'English for Young Learners', ar: 'الإنجليزية للصغار', desc_en: 'Playful, speaking-first classes for children and teenagers.', desc_ar: 'حصص ممتعة تركّز على التحدث للأطفال والمراهقين.', weeks: 8, lessons: 24, section: 'kids' }
  ];
  var SECTIONS = {
    general: { en: 'General English', ar: 'الإنجليزية العامة' },
    ielts: { en: 'Exam preparation', ar: 'التحضير للاختبارات' },
    business: { en: 'Business English', ar: 'إنجليزية الأعمال' },
    conversation: { en: 'Conversation Club', ar: 'نادي المحادثة' },
    kids: { en: 'English for Young Learners', ar: 'الإنجليزية للصغار' }
  };
  // Small thumbnails for the first two catalogue programmes (demo ids only;
  // API courses have no image field, so they render without one).
  var COURSE_IMAGES = {
    'general-a1': { src: 'assets/classroom-wide.jpg', en: 'Adults learning English together in a bright classroom', ar: 'بالغون يتعلّمون الإنجليزية معًا في صفّ مضيء' },
    'general-a2': { src: 'assets/hero-conversation.jpg', en: 'A learner speaking with a teacher in a classroom', ar: 'متعلّم يتحدّث مع معلّم في صف' }
  };
  var LEVEL_AR = {
    Beginner: 'مبتدئ', Elementary: 'ابتدائي', Intermediate: 'متوسط',
    'Upper intermediate': 'فوق المتوسط', Advanced: 'متقدم', Proficiency: 'إتقان'
  };

  function sectionOf(c) {
    if (c.sectionName) return { en: c.sectionName, ar: c.sectionName };
    return SECTIONS[c.section] || { en: c.section || '', ar: c.section || '' };
  }
  function sectionName(c, lang) {
    var sec = sectionOf(c);
    return lang === 'ar' ? sec.ar : sec.en;
  }
  function levelLabel(c, lang) {
    if (c.level_code) {
      var name = lang === 'ar' ? (c.level_ar || c.level_en || '') : (c.level_en || '');
      return name ? c.level_code + ' · ' + name : c.level_code;
    }
    if (c.levelLabel) return c.levelLabel;
    if (!c.level) return '';
    return lang === 'ar' ? (LEVEL_AR[c.level] || c.level) : c.level;
  }

  function setFilterState(filter) {
    document.querySelectorAll('[data-filter]').forEach(function (b) {
      var active = b.dataset.filter === filter;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  function emptyFilterMessage(lang, resetLabel) {
    return '<div class="empty-state catalogue-empty">'
      + '<h2>' + esc(lang === 'ar' ? 'لا توجد دورات في هذا المستوى' : 'No courses at this level yet') + '</h2>'
      + '<p>' + esc(lang === 'ar'
        ? 'جرّب مستوى آخر، أو تصفّح جميع البرامج المتاحة.'
        : 'Try another level, or browse the full catalogue.') + '</p>'
      + '<button class="btn outline" type="button" data-filter="all">' + esc(resetLabel) + '</button>'
      + '</div>';
  }

  function renderCourses(filter, lang) {
    lang = lang || getLang();
    var grid = document.getElementById('courseGrid');
    if (!grid) return;
    filter = filter || 'all';
    window.__filter = filter;
    setFilterState(filter);

    var list = COURSES.filter(function (c) { return filter === 'all' || c.level === filter; });
    var count = document.getElementById('courseCount');
    if (count) {
      count.textContent = lang === 'ar'
        ? (list.length === 1 ? 'برنامج واحد' : list.length + ' برامج')
        : (list.length === 1 ? '1 programme' : list.length + ' programmes');
    }
    if (!list.length) {
      grid.innerHTML = emptyFilterMessage(lang, lang === 'ar' ? 'عرض كل الدورات' : 'Show all courses');
      wireFilterButtons();
      return;
    }

    var groups = [];
    var byKey = {};
    list.forEach(function (c) {
      var key = c.sectionName ? 'custom:' + c.sectionName : 'built:' + (c.section || '');
      if (!byKey[key]) { byKey[key] = []; groups.push(key); }
      byKey[key].push(c);
    });

    grid.innerHTML = groups.map(function (key, gi) {
      var items = byKey[key];
      var title = sectionName(items[0], lang);
      var headingId = 'course-group-' + gi;
      return '<section class="course-group" aria-labelledby="' + headingId + '">'
        + '<h2 class="course-group-title" id="' + headingId + '">' + esc(title) + '</h2>'
        + '<div class="course-grid">' + items.map(function (c) {
          var lvl = levelLabel(c, lang);
          var weeks = c.weeks ? (lang === 'ar' ? esc(c.weeks) + ' أسابيع' : esc(c.weeks) + ' weeks') : '';
          return '<article class="course-card">'
            + (COURSE_IMAGES[c.id] ? '<div class="course-thumb"><img src="' + COURSE_IMAGES[c.id].src + '" alt="' + esc(lang === 'ar' ? COURSE_IMAGES[c.id].ar : COURSE_IMAGES[c.id].en) + '" loading="lazy"></div>' : '')
            + '<div class="course-card-top">'
            + (lvl ? '<span class="badge">' + esc(lvl) + '</span>' : '<span class="badge badge--muted">' + esc(lang === 'ar' ? 'حسب المستوى' : 'Level on assessment') + '</span>')
            + (weeks ? '<span class="meta">' + weeks + '</span>' : '<span></span>')
            + '</div>'
            + '<h3>' + esc(lang === 'ar' ? c.ar : c.en) + '</h3>'
            + '<p>' + esc(lang === 'ar' ? c.desc_ar : c.desc_en) + '</p>'
            + '<div class="course-meta"><span>' + esc(lang === 'ar' ? 'الرسوم عند الاستفسار' : 'Fees on enquiry') + '</span>'
            + '<a class="text-link" href="course.html?id=' + encodeURIComponent(c.id) + '">' + esc(lang === 'ar' ? 'تفاصيل الدورة' : 'Course details') + ' <span class="arrow">→</span></a></div>'
            + '</article>';
        }).join('') + '</div></section>';
    }).join('');
    wireFilterButtons();
  }
  window.renderCourses = renderCourses;

  function renderCourseDetail(lang) {
    lang = lang || getLang();
    var el = document.getElementById('courseDetail');
    if (!el) return;
    var id = new URLSearchParams(location.search).get('id');
    var c = id ? COURSES.filter(function (x) { return String(x.id) === String(id); })[0] : null;
    if (!c) {
      el.innerHTML = '<div class="empty-state">'
        + '<h1>' + esc(lang === 'ar' ? 'لم نجد هذه الدورة' : 'Course not found') + '</h1>'
        + '<p>' + esc(lang === 'ar' ? 'قد تكون الدورة غير منشورة أو أن الرابط قديم. تصفّح الكتالوج لاختيار دورة.' : 'The course may be unpublished, or this link is out of date. Browse the catalogue to choose a course.') + '</p>'
        + '<a class="btn" href="courses.html">' + esc(lang === 'ar' ? 'كل الدورات' : 'All courses') + '</a>'
        + '</div>';
      return;
    }
    var title = lang === 'ar' ? c.ar : c.en;
    var desc = lang === 'ar' ? c.desc_ar : c.desc_en;
    var lvl = levelLabel(c, lang);
    var learn = lang === 'ar'
      ? ['التحدث والاستماع في مواقف واقعية', 'القراءة والكتابة بوضوح', 'المفردات والقواعد في سياق', 'مراجعة وملاحظات من معلّمك']
      : ['Speaking and listening in real situations', 'Reading and writing with clarity', 'Vocabulary and grammar in context', 'Review and feedback from your teacher'];
    el.innerHTML = '<div class="detail-grid">'
      + '<div class="detail-main">'
      + '<div class="detail-tags">'
      + (lvl ? '<span class="badge">' + esc(lvl) + '</span>' : '')
      + '<span class="badge badge--muted">' + esc(sectionName(c, lang)) + '</span>'
      + '</div>'
      + '<h1>' + esc(title) + '</h1>'
      + '<p class="lead">' + esc(desc) + '</p>'
      + '<section class="detail-block"><h2>' + esc(lang === 'ar' ? 'ما ستتدرب عليه' : 'What you will practise') + '</h2>'
      + '<ul class="check-list">' + learn.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>'
      + '<section class="detail-block"><h2>' + esc(lang === 'ar' ? 'كيف تسير الدورة' : 'How the course runs') + '</h2>'
      + '<p>' + esc(lang === 'ar'
        ? 'حصة مباشرة مع معلّمك، وتمارين قصيرة بين الحصص، وملاحظات تساعدك على معرفة خطوتك التالية. تُؤكَّد المجموعة والمواعيد مع الأكاديمية قبل بدء الدورة.'
        : 'Live lessons with your teacher, short practice between classes, and feedback that shows your next step. Your group and schedule are confirmed with the academy before the course begins.') + '</p></section>'
      + '<div class="alert alert--note">' + esc(lang === 'ar'
        ? 'المحتوى المعروض يوضّح أسلوب الأكاديمية. تُؤكَّد تفاصيل البرنامج والرسوم والمواعيد عند التسجيل.'
        : 'This page describes the academy’s approach. Programme details, fees and schedules are confirmed at enrolment.') + '</div>'
      + '</div>'
      + '<aside class="detail-aside" aria-label="' + esc(lang === 'ar' ? 'ملخص الدورة' : 'Course summary') + '">'
      + '<h2>' + esc(lang === 'ar' ? 'لمحة سريعة' : 'At a glance') + '</h2>'
      + '<div class="spec-list">'
      + '<div><span class="k">' + esc(lang === 'ar' ? 'المستوى' : 'Level') + '</span><span class="v">' + esc(lvl || (lang === 'ar' ? 'يُحدَّد بالتقييم' : 'Assessed at entry')) + '</span></div>'
      + '<div><span class="k">' + esc(lang === 'ar' ? 'المدة' : 'Duration') + '</span><span class="v">' + (c.weeks ? esc(c.weeks) + ' ' + esc(lang === 'ar' ? 'أسابيع' : 'weeks') : '—') + '</span></div>'
      + '<div><span class="k">' + esc(lang === 'ar' ? 'الصيغة' : 'Format') + '</span><span class="v">' + esc(lang === 'ar' ? 'حصص مباشرة' : 'Live lessons') + '</span></div>'
      + '<div><span class="k">' + esc(lang === 'ar' ? 'الرسوم' : 'Fees') + '</span><span class="v">' + esc(lang === 'ar' ? 'عند الاستفسار' : 'On enquiry') + '</span></div>'
      + '</div>'
      + '<a class="btn block" href="booking.html?course=' + encodeURIComponent(c.id) + '">' + esc(lang === 'ar' ? 'احجز مقعدًا' : 'Book a seat') + '</a>'
      + '<div id="enrolSlot"></div>'
      + '<p class="help">' + esc(lang === 'ar' ? 'لا تُجمع أي مدفوعات على هذا الموقع. تؤكد الأكاديمية المقعد والرسوم معك مباشرة.' : 'No payments are collected on this site. The academy confirms your seat and fees with you directly.') + '</p>'
      + '</aside></div>';
    if (window.BBC_API && window.BBC_API.base() && typeof window.__mountEnrol === 'function') {
      window.__mountEnrol(c.id);
    }
  }
  window.renderCourseDetail = renderCourseDetail;

  function wireFilterButtons() {
    document.querySelectorAll('[data-filter]').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        window.__filter = btn.dataset.filter;
        renderCourses(window.__filter, getLang());
      });
    });
  }

  /* ------------------------------ placement quiz --------------------------- */
  // Same order and answer indexes as backend/src/server.js PLACEMENT_ANSWERS.
  // Keep the two lists in sync; the server re-scores every submission.
  var QUIZ = [
    { q_en: 'She ___ a teacher.', q_ar: 'هي ___ معلمة.', o: ['are', 'is', 'am'], a: 1 },
    { q_en: 'They ___ students.', q_ar: 'هم ___ طلاب.', o: ['are', 'is', 'am'], a: 0 },
    { q_en: 'Past of “go” is ___.', q_ar: 'الماضي من “go” هو ___.', o: ['goed', 'went', 'gone'], a: 1 },
    { q_en: '“I have lived here ___ 2020.”', q_ar: '“I have lived here ___ 2020.”', o: ['for', 'since', 'from'], a: 1 },
    { q_en: 'Which is most formal?', q_ar: 'أيها الأكثر رسمية؟', o: ['Wanna come?', 'Could you please join us?', 'Come now!'], a: 1 },
    { q_en: '“Despite the rain, ___.”', q_ar: '“Despite the rain, ___.”', o: ['we went out', 'we go yesterday', 'we are go'], a: 0 },
    { q_en: 'Choose the correct sentence.', q_ar: 'اختر الجملة الصحيحة.', o: ['I am go to school.', 'I go to school.', 'I going school.'], a: 1 },
    { q_en: 'There ___ some milk in the fridge.', q_ar: 'يوجد ___ حليب في الثلاجة.', o: ['are', 'is', 'be'], a: 1 },
    { q_en: 'He ___ TV every evening.', q_ar: 'هو ___ التلفاز كل مساء.', o: ['watches', 'watch', 'watching'], a: 0 },
    { q_en: 'If it rains, we ___ at home.', q_ar: 'إذا أمطرت، سنبقى في المنزل.', o: ['stayed', 'will stay', 'would stayed'], a: 1 },
    { q_en: 'This book is ___ than that one.', q_ar: 'هذا الكتاب ___ من ذاك.', o: ['cheaper', 'cheap', 'cheapest'], a: 0 },
    { q_en: 'I’m looking forward to ___ you.', q_ar: 'أتطلع إلى ___ أنت.', o: ['seeing', 'see', 'saw'], a: 0 },
    { q_en: 'By the time we arrived, the film ___.', q_ar: 'بحلول وصولنا، كان الفيلم ___.', o: ['had started', 'starts', 'has start'], a: 0 },
    { q_en: 'She suggested ___ a break.', q_ar: 'اقترحت ___ استراحة.', o: ['to take', 'take', 'taking'], a: 2 },
    { q_en: 'The report ___ by the manager yesterday.', q_ar: 'التقرير ___ من قبل المدير أمس.', o: ['wrote', 'was written', 'is writing'], a: 1 },
    { q_en: 'Hardly ___ the room when the phone rang.', q_ar: 'Hardly ___ the room when the phone rang.', o: ['I had entered', 'had I entered', 'I entered'], a: 1 },
    { q_en: 'Choose the correct question.', q_ar: 'اختر السؤال الصحيح.', o: ['Where you are from?', 'Where are you from?', 'Where from you are?'], a: 1 },
    { q_en: 'I’d rather you ___ smoke here.', q_ar: 'أفضّل ألا ___ تدخّن هنا.', o: ['didn’t', 'don’t', 'won’t'], a: 0 },
    { q_en: 'The word “ubiquitous” means ___.', q_ar: 'كلمة “ubiquitous” تعني ___.', o: ['rare', 'everywhere', 'expensive'], a: 1 },
    { q_en: 'Not only ___ late, but he also forgot the file.', q_ar: 'Not only ___ late, but he also forgot the file.', o: ['he was', 'was he', 'he is'], a: 1 }
  ];
  var quizIdx = 0, quizScore = 0, quizAnswers = [], quizSaved = false;
  var BAND_NOTES = {
    A1: ['You are starting out. A beginner course will give you a confident foundation.', 'أنت في البداية. دورة المبتدئ ستمنحك أساسًا واثقًا.'],
    A2: ['You can handle simple, familiar situations. Elementary practice will build range.', 'تتعامل مع مواقف بسيطة ومألوفة. تدريب المستوى الابتدائي يوسّع قدرتك.'],
    B1: ['You can communicate in everyday situations. Intermediate work will add fluency.', 'تتواصل في مواقف الحياة اليومية. مستوى المتوسط يضيف طلاقة.'],
    B2: ['You are comfortable with most topics. Upper intermediate work will sharpen accuracy.', 'أنت مرتاح في معظم المواضيع. مستوى فوق المتوسط يصقل الدقة.'],
    C1: ['You use English flexibly and effectively. Advanced work will refine nuance.', 'تستخدم الإنجليزية بمرونة وفعالية. مستوى المتقدم يصقل الفروق الدقيقة.'],
    C2: ['You have near-native command. Proficiency work will focus on precision and register.', 'لديك تحكم شبه كامل. مستوى الإتقان يركز على الدقة والمقام.']
  };
  function quizLevel(score, total) {
    var r = score / total;
    if (r < 0.25) return 'A1';
    if (r < 0.45) return 'A2';
    if (r < 0.65) return 'B1';
    if (r < 0.85) return 'B2';
    if (r < 0.95) return 'C1';
    return 'C2';
  }
  function quizStart() {
    quizIdx = 0; quizScore = 0; quizAnswers = []; quizSaved = false;
    window.__quizActive = true;
    quizShow();
  }
  function quizAnswer(i) {
    if (i === QUIZ[quizIdx].a) quizScore++;
    quizAnswers.push(i);
    quizIdx++;
    quizShow();
  }
  function quizShow() {
    var box = document.getElementById('quizBox');
    if (!box) return;
    var lang = getLang();
    if (quizIdx >= QUIZ.length) {
      var lvl = quizLevel(quizScore, QUIZ.length);
      var band = BAND_NOTES[lvl] || ['', ''];
      box.innerHTML = '<div class="quiz-result">'
        + '<p class="meta">' + esc(lang === 'ar' ? 'نتيجتك' : 'Your result') + '</p>'
        + '<p class="quiz-score">' + quizScore + '<span class="muted" style="font-size:1rem"> / ' + QUIZ.length + '</span></p>'
        + '<span class="quiz-band" id="quizLevel">' + esc(lvl) + '</span>'
        + '<h2>' + esc(lang === 'ar' ? 'نقطة بداية واضحة' : 'A clear starting point') + '</h2>'
        + '<p>' + esc(lang === 'ar' ? band[1] : band[0]) + '</p>'
        + '<p class="help">' + esc(lang === 'ar'
          ? 'هذا الاختبار دليل لتحديد المستوى وليس امتحانًا رسميًا. تؤكد الأكاديمية مستواك عند التسجيل.'
          : 'This is a placement guide, not an official exam. The academy confirms your level at enrolment.') + '</p>'
        + '<div class="btn-row"><a class="btn" href="courses.html">' + esc(lang === 'ar' ? 'تصفّح الدورات' : 'Browse courses') + '</a>'
        + '<button class="btn outline" type="button" data-quiz-restart>' + esc(lang === 'ar' ? 'إعادة الاختبار' : 'Retake the test') + '</button>'
        + '<a class="btn quiet" href="booking.html">' + esc(lang === 'ar' ? 'تحدّث مع الأكاديمية' : 'Talk to the academy') + '</a></div>'
        + '</div>';
      box.querySelector('[data-quiz-restart]').addEventListener('click', quizStart);
      if (!quizSaved && window.BBC_API && window.BBC_API.base() && localStorage.getItem('bbc-token')) {
        quizSaved = true;
        window.BBC_API.req('/api/placement-tests', { method: 'POST', body: { answers: quizAnswers } })
          .then(function (d) {
            var saved = document.getElementById('quizLevel');
            if (saved && d.result && d.result.recommended_level) saved.textContent = d.result.recommended_level;
          })
          .catch(function () { /* the guide on screen still stands; the API error is not hidden on purpose */ });
      }
      return;
    }
    var q = QUIZ[quizIdx];
    var pct = Math.round((quizIdx / QUIZ.length) * 100);
    box.innerHTML = '<div class="quiz-top"><span class="quiz-count">' + esc(lang === 'ar' ? 'السؤال' : 'Question') + ' ' + (quizIdx + 1) + ' / ' + QUIZ.length + '</span>'
      + '<span class="quiz-count">' + pct + '%</span></div>'
      + '<div class="quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(lang === 'ar' ? 'تقدم الاختبار' : 'Test progress') + '"><span style="width:' + pct + '%"></span></div>'
      + '<h2 class="quiz-question">' + esc(lang === 'ar' ? q.q_ar : q.q_en) + '</h2>'
      + '<div class="quiz-options">' + q.o.map(function (o, i) {
        return '<button class="quiz-opt" type="button" data-answer="' + i + '">' + esc(o) + '</button>';
      }).join('') + '</div>';
    box.querySelectorAll('[data-answer]').forEach(function (b) {
      b.addEventListener('click', function () { quizAnswer(Number(b.dataset.answer)); });
    });
  }
  window.quizStart = quizStart;
  window.quizAnswer = quizAnswer;
  window.quizShow = quizShow;

  /* --------------------------------- boot ---------------------------------- */
  function boot() {
    initNavigation();

    var langBtn = document.getElementById('langBtn');
    if (langBtn) langBtn.addEventListener('click', function () { applyLanguage(getLang() === 'ar' ? 'en' : 'ar'); });
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); applyLanguage(getLang() === 'ar' ? 'en' : 'ar'); });
    });

    // Default language is Arabic (the academy's primary audience); a stored
    // preference always wins. Translate before wiring content.
    applyLanguage(getLang());

    wireFilterButtons();
    var startBtn = document.getElementById('quizStartBtn');
    if (startBtn) startBtn.addEventListener('click', quizStart);

    initDemoForms();
    initPasswordToggles();

    var year = document.getElementById('current-year');
    if (year) year.textContent = new Date().getFullYear();

    if (document.getElementById('courseGrid') && !(window.BBC_API && window.BBC_API.base())) {
      renderCourses('all', getLang());
    }
    if (document.getElementById('courseDetail') && !(window.BBC_API && window.BBC_API.base())) {
      renderCourseDetail(getLang());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
