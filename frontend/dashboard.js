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
      back.innerHTML = '<div class="dash-dialog" role="dialog" aria-modal="true" aria-label="' + h(t(titleEn, titleAr)) + '"><h2 class="dash-dialog-title">' + h(t(titleEn, titleAr)) + '</h2><p>' + h(t(bodyEn, bodyAr)) + '</p>'
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
    var cls = { pending: 'badge-pending', confirmed: 'badge-confirmed', rejected: 'badge-rejected', active: 'badge-active', completed: 'badge-graded', cancelled: 'badge-cancelled', present: 'badge-present', absent: 'badge-absent', late: 'badge-pending', excused: 'badge-submitted', submitted: 'badge-submitted', graded: 'badge-graded', published: 'badge-published', unpublished: 'badge-unpublished' }[s] || '';
    var labels = { pending: ['Pending', 'معلّقة'], confirmed: ['Confirmed', 'مؤكدة'], rejected: ['Rejected', 'مرفوضة'], active: ['Active', 'نشطة'], completed: ['Completed', 'مكتملة'], cancelled: ['Cancelled', 'ملغاة'], present: ['Present', 'حاضر'], absent: ['Absent', 'غائب'], late: ['Late', 'متأخر'], excused: ['Excused', 'بعذر'], submitted: ['Submitted', 'مُسلَّمة'], graded: ['Graded', 'مصححة'], published: ['Published', 'منشورة'], unpublished: ['Not published', 'غير منشورة'] };
    var lab = labels[s] ? t(labels[s][0], labels[s][1]) : s;
    return '<span class="badge ' + cls + '">' + h(lab) + '</span>';
  }
  // Mobile stacked tables: copy each header cell's text onto its column's
  // cells as data-label, so the phone card layout can label every value.
  function labelTableCells() {
    content.querySelectorAll('.dash-table-scroll table').forEach(function (tbl) {
      var heads = [];
      var first = tbl.querySelector('tr');
      if (first) first.querySelectorAll('th').forEach(function (th) { heads.push(th.textContent.trim()); });
      tbl.querySelectorAll('tr').forEach(function (row, i) {
        if (i === 0) return;
        Array.prototype.forEach.call(row.children, function (cell, j) {
          if (cell.tagName === 'TD') cell.setAttribute('data-label', heads[j] || '');
        });
      });
    });
  }
  // Readable level names: levels are {id, code, name_en, name_ar}. Never
  // show a raw level_id — map through this list; unknown ids render '—'.
  function levelName(levelId, levels) {
    var found = null;
    (levels || []).forEach(function (l) { if (String(l.id) === String(levelId)) found = l; });
    if (!found) return '—';
    return found.code + ' — ' + (lang === 'ar' ? found.name_ar || found.name_en : found.name_en);
  }
  function levelNameByCode(code, levels) {
    var found = null;
    (levels || []).forEach(function (l) { if (String(l.code) === String(code)) found = l; });
    if (!found) return code || '—';
    return found.code + ' — ' + (lang === 'ar' ? found.name_ar || found.name_en : found.name_en);
  }
  function setBusy(btn, busy) { if (btn) btn.disabled = !!busy; }
  async function refreshCurrent() {
    if (!currentMe) return;
    if (role === 'student') await renderStudent(currentMe);
    else if (role === 'teacher') await renderTeacher(currentMe);
    else await renderAdmin(currentMe);
    accountCard();
    showView(false);
  }
  window.__onLangChange = function () { if (ready) location.reload(); };

  function card(label, value, note) {
    return '<div class="card"><h2 class="dash-card-title">' + h(label) + '</h2><p class="price">' + h(value) + '</p><p class="muted">' + h(note || '') + '</p></div>';
  }
  // Every dashboard table renders inside a horizontally scrollable region:
  // on a phone the table keeps its full width (no crushed/wrapped columns,
  // no cut-off action buttons) and the user scrolls it inside the viewport.
  // The hint below the table is shown on narrow screens only (see dashboard.css).
  function table(headers, rows, emptyText) {
    if (!rows.length) return '<div class="dash-empty"><p>' + h(emptyText) + '</p></div>';
    return '<div class="dash-table-scroll" tabindex="0" role="region" aria-label="' + h(t('Table', 'جدول')) + '"><table><tr>' + headers.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' + rows.join('') + '</table></div>';
  }
  /* ----- Homework: the teacher either attaches a file or writes questions ---
     The browser only ever sees question prompts/options; the accepted answers
     stay on the server, so a student cannot read the key from DevTools. */
  var HW_TYPES = [
    { value: 'multiple_choice', en: 'Choose the correct answer', ar: 'اختر الإجابة الصحيحة' },
    { value: 'fill_blank', en: 'Complete the sentence', ar: 'أكمل الجملة' },
    { value: 'translate', en: 'Translate', ar: 'ترجم' },
    { value: 'short_answer', en: 'Short answer', ar: 'إجابة قصيرة' }
  ];
  function hwTypeLabel(type) {
    var found = null;
    HW_TYPES.forEach(function (x) { if (x.value === type) found = x; });
    return found ? t(found.en, found.ar) : type;
  }
  function hwKindLabel(a) {
    if (a.questions && a.questions.length) return a.questions.length + ' ' + t('questions', 'أسئلة');
    if (a.has_file) return t('File homework', 'واجب بملف');
    return t('Written answer', 'إجابة مكتوبة');
  }
  function hwFileButton(a) {
    if (!a.has_file) return '';
    return '<button type="button" class="btn small outline" data-hw-file="' + h(a.id) + '" data-hw-name="' + h(a.title) + '">'
      + h(t('Open homework file', 'افتح ملف الواجب')) + '</button>';
  }
  // Plain <a href> cannot send the Bearer token, so the file is fetched with
  // the token and handed to the browser as a local blob.
  async function openHomeworkFile(id, name) {
    var res = await fetch(api.base() + '/api/assignment-files/' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('bbc-token') || '') }
    });
    if (!res.ok) {
      var data = await res.json().catch(function () { return {}; });
      throw new Error(data.error || t('Could not open the file.', 'تعذّر فتح الملف.'));
    }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name || 'homework';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }
  function bindHomeworkFileButtons(scope) {
    (scope || content).querySelectorAll('[data-hw-file]').forEach(function (b) {
      b.addEventListener('click', async function () {
        setBusy(b, true);
        try { await openHomeworkFile(b.dataset.hwFile, b.dataset.hwName); }
        catch (err) { toast(err.message, 'error'); }
        setBusy(b, false);
      });
    });
  }
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var s = String(reader.result || '');
        var comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : '');
      };
      reader.onerror = function () { reject(new Error(t('Could not read the file.', 'تعذّر قراءة الملف.'))); };
      reader.readAsDataURL(file);
    });
  }
  // Matching rules on the server: case, spacing and punctuation are ignored.
  var hwSeq = 0;
  function hwQuestionBlock() {
    hwSeq++;
    return '<div class="hw-q" data-q data-seq="' + hwSeq + '">'
      + '<div class="hw-q-head"><span class="hw-q-num" data-q-num></span>'
      + '<button type="button" class="hw-q-remove" data-q-remove aria-label="' + h('Remove question') + '">×</button></div>'
      + '<div class="hw-q-row">'
      + '<div class="field"><label>' + h(t('Question type', 'نوع السؤال')) + ' <select data-q-type>'
      + HW_TYPES.map(function (x) { return '<option value="' + x.value + '">' + h(t(x.en, x.ar)) + '</option>'; }).join('')
      + '</select></label></div>'
      + '<div class="field field-wide"><label>' + h(t('Question', 'السؤال')) + ' <input data-q-prompt maxlength="1000" required></label></div>'
      + '</div><div data-q-extra></div></div>';
  }
  function hwRenderQuestionExtra(block) {
    var type = block.querySelector('[data-q-type]').value;
    var extra = block.querySelector('[data-q-extra]');
    var seq = block.dataset.seq;
    if (type === 'multiple_choice') {
      extra.innerHTML = '<fieldset class="hw-options"><legend>' + h(t('Options — mark the correct one', 'الخيارات — حدد الصحيحة')) + '</legend>'
        + ['A', 'B', 'C', 'D'].map(function (letter, i) {
          return '<label class="hw-option"><input type="radio" name="hwCorrect' + seq + '" data-q-correct value="' + i + '">'
            + '<input data-q-option maxlength="300" placeholder="' + h(t('Option ' + letter, 'الخيار ' + letter)) + '"></label>';
        }).join('') + '</fieldset>'
        + '<p class="muted small">' + h(t('Fill all four options, then mark the correct one.', 'املأ الخيارات الأربعة ثم حدد الصحيح.')) + '</p>';
    } else if (type === 'fill_blank') {
      extra.innerHTML = '<div class="field"><label>' + h(t('Correct answer(s), comma separated', 'الإجابات الصحيحة، مفصولة بفاصلة')) + ' <input data-q-answers maxlength="400" dir="ltr" placeholder="is, was"></label></div>'
        + '<p class="muted small">' + h(t('Write the sentence and use ___ where the blank is. Matching ignores case and punctuation.', 'اكتب الجملة وضع ___ مكان الفراغ. المقارنة تتجاهل حالة الأحرف وعلامات الترقيم.')) + '</p>';
    } else if (type === 'translate') {
      extra.innerHTML = '<div class="field"><label>' + h(t('Accepted translation(s), comma separated', 'الترجمات المقبولة، مفصولة بفاصلة')) + ' <input data-q-answers maxlength="400" dir="ltr"></label></div>'
        + '<p class="muted small">' + h(t('The translation is marked automatically against these answers; matching ignores case and punctuation.', 'تُصحح الترجمة تلقائيًا مقابل هذه الإجابات، وتتجاهل المقارنة حالة الأحرف وعلامات الترقيم.')) + '</p>';
    } else {
      extra.innerHTML = '<p class="muted small">' + h(t('The student writes a free answer and you mark it yourself.', 'يكتب الطالب إجابة حرة وتصححها أنت.')) + '</p>';
    }
  }
  function hwRenumber(scope) {
    scope.querySelectorAll('[data-q]').forEach(function (block, i) {
      var num = block.querySelector('[data-q-num]');
      if (num) num.textContent = t('Question ', 'السؤال ') + (i + 1);
    });
    var count = scope.querySelectorAll('[data-q]').length;
    var label = document.getElementById('hwQuestionCount');
    if (label) label.textContent = count ? count + ' ' + t('question(s) added', 'سؤالًا مضافًا') : t('No questions yet', 'لا أسئلة بعد');
  }
  function collectHomeworkQuestions(scope) {
    var blocks = Array.prototype.slice.call(scope.querySelectorAll('[data-q]'));
    if (!blocks.length) throw new Error(t('Add at least one question.', 'أضف سؤالًا واحدًا على الأقل.'));
    return blocks.map(function (block, i) {
      var n = i + 1;
      var type = block.querySelector('[data-q-type]').value;
      var prompt = block.querySelector('[data-q-prompt]').value.trim();
      if (!prompt) throw new Error(t('Question ' + n + ' needs its text.', 'السؤال ' + n + ' يحتاج نصًا.'));
      if (type === 'multiple_choice') {
        var options = Array.prototype.map.call(block.querySelectorAll('[data-q-option]'), function (inp) { return inp.value.trim(); });
        if (options.some(function (o) { return !o; })) throw new Error(t('Question ' + n + ': fill all four options.', 'السؤال ' + n + ': املأ الخيارات الأربعة.'));
        var checked = block.querySelector('[data-q-correct]:checked');
        if (!checked) throw new Error(t('Question ' + n + ': mark the correct option.', 'السؤال ' + n + ': حدد الخيار الصحيح.'));
        return { type: type, prompt: prompt, options: options, correct: Number(checked.value) };
      }
      if (type === 'fill_blank' || type === 'translate') {
        var answers = block.querySelector('[data-q-answers]').value.split(/[,،\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!answers.length) throw new Error(t('Question ' + n + ': add at least one correct answer.', 'السؤال ' + n + ': أضف إجابة صحيحة واحدة على الأقل.'));
        return { type: type, prompt: prompt, answers: answers };
      }
      return { type: type, prompt: prompt };
    });
  }
  function hwStatusOf(a) {
    return !a.submission ? 'pending' : (a.submission.grade != null ? 'graded' : 'submitted');
  }
  function hwStatusChip(a) {
    var st = hwStatusOf(a);
    var label = st === 'pending' ? t('Not submitted', 'لم يُسلَّم')
      : st === 'graded' ? t('Graded', 'مصححة') + ': ' + a.submission.grade + ' / 100'
        : t('Submitted', 'تم التسليم');
    return '<span class="badge badge-' + st + '">' + h(label) + '</span>';
  }
  function hwAutoNote(a) {
    return a.submission && a.submission.auto_total
      ? '<p class="muted small">' + h(t('Auto-marked: ', 'التصحيح التلقائي: ') + a.submission.auto_score + ' / ' + a.submission.auto_total + t('. Your teacher confirms the final grade.', '. درجتك النهائية يحددها معلمك.')) + '</p>'
      : '';
  }
  // The student's own answers, with a choice shown as the option text.
  function hwAnswerList(a) {
    var answers = (a.submission && a.submission.answers) || [];
    if (!answers.length) return '';
    var qs = a.questions || [];
    return '<ol class="hw-answer-list">' + answers.map(function (x) {
      var q = qs.filter(function (y) { return y.id === x.question_id; })[0];
      var shown = x.answer || '—';
      if (q && q.type === 'multiple_choice' && /^\d+$/.test(String(x.answer))) shown = (q.options || [])[Number(x.answer)] || shown;
      var prompt = q ? '<span class="hw-answer-q">' + h(q.prompt) + '</span><br>' : '';
      return '<li>' + prompt + h(shown) + '</li>';
    }).join('') + '</ol>';
  }
  // Question controls (or the written-answer box) for one assignment.
  function hwAnswerFields(a) {
    var qs = a.questions || [];
    var mine = (a.submission && a.submission.answers) || [];
    function previous(qid) {
      var found = mine.filter(function (x) { return x.question_id === qid; })[0];
      return found ? String(found.answer == null ? '' : found.answer) : '';
    }
    var fields;
    if (qs.length) {
      fields = qs.map(function (q, i) {
        var prev = previous(q.id);
        var control;
        if (q.type === 'multiple_choice') {
          control = '<div class="hw-choices">' + (q.options || []).map(function (o, oi) {
            return '<label class="hw-choice"><input type="radio" name="ans_' + h(a.id) + '_' + h(q.id) + '" value="' + oi + '"' + (prev === String(oi) ? ' checked' : '') + '> <span>' + h(o) + '</span></label>';
          }).join('') + '</div>';
        } else if (q.type === 'short_answer') {
          control = '<textarea rows="2" maxlength="5000" data-hw-answer="' + h(q.id) + '">' + h(prev) + '</textarea>';
        } else {
          control = '<input maxlength="5000" data-hw-answer="' + h(q.id) + '" value="' + h(prev) + '">';
        }
        return '<div class="hw-question"><p class="hw-question-prompt"><span class="hw-question-no">' + (i + 1) + '.</span> ' + h(q.prompt)
          + ' <span class="hw-type">' + h(hwTypeLabel(q.type)) + '</span></p>' + control + '</div>';
      }).join('');
    } else {
      fields = (a.has_file ? '<p class="muted">' + h(t('Do the homework in the file, then write your answer here.', 'حل الواجب في الملف ثم اكتب إجابتك هنا.')) + '</p>' : '')
        + '<div class="field"><label>' + h(t('Your answer', 'إجابتك')) + ' <textarea rows="3" maxlength="5000" data-hw-text required></textarea></label></div>';
    }
    return fields;
  }
  // One place binds the submit handlers for every homework form on the page,
  // including the forms rendered inside an opened homework.
  function bindHomeworkForms(root, asg) {
    root.querySelectorAll('[data-hw-form]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var id = form.dataset.hwForm;
        var assignment = null;
        asg.forEach(function (a) { if (a.id === id) assignment = a; });
        if (!assignment) return;
        var body;
        if ((assignment.questions || []).length) {
          var answers = assignment.questions.map(function (q) {
            var value = '';
            if (q.type === 'multiple_choice') {
              var checked = form.querySelector('input[name="ans_' + id + '_' + q.id + '"]:checked');
              value = checked ? checked.value : '';
            } else {
              var input = form.querySelector('[data-hw-answer="' + q.id + '"]');
              value = input ? input.value.trim() : '';
            }
            return { question_id: q.id, answer: value };
          });
          if (!answers.some(function (x) { return x.answer; })) { toast(t('Answer at least one question.', 'أجب عن سؤال واحد على الأقل.'), 'error'); return; }
          body = { assignment_id: id, answers: answers };
        } else {
          var text = form.querySelector('[data-hw-text]');
          if (!text || !text.value.trim()) { toast(t('Write your answer first.', 'اكتب إجابتك أولًا.'), 'error'); return; }
          body = { assignment_id: id, content_text: text.value.trim() };
        }
        var sbtn = form.querySelector('button[type="submit"]');
        setBusy(sbtn, true);
        try {
          await api.req('/api/submissions', { method: 'POST', body: body });
          toast(t('Homework submitted.', 'تم تسليم الواجب.'), 'success');
          refreshCurrent();
        } catch (err) { toast(err.message, 'error'); setBusy(sbtn, false); }
      });
    });
  }

  // Teacher side: one section, two ways to build the same homework.
  function homeworkTeacherView(asg, cmap, courseOpts) {
    var baseFields = '<div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="300"></label></div>'
      + '<div class="field"><label>' + h(t('Description', 'الوصف')) + ' <textarea name="description" rows="2"></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Due date', 'تاريخ التسليم')) + ' <input type="date" name="due_date"></label></div>';
    var upload = '<div class="card" data-hw-panel="file">'
      + '<h2 class="dash-card-title">' + h(t('Upload homework as a file', 'ارفع الواجب كملف')) + '</h2>'
      + '<p class="muted">' + h(t('Upload a PDF or an image of the homework. Only you and the students enrolled in the course can open it — there is no public link.', 'ارفع ملف الواجب بصيغة PDF أو صورة. لا يفتحه إلا أنت وطلاب الدورة المسجلون فيها — لا يوجد رابط عام.')) + '</p>'
      + '<form id="hwUpload" class="dash-section">' + baseFields
      + '<div class="field"><label>' + h(t('Homework file', 'ملف الواجب')) + ' <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required></label>'
      + '<p class="muted small">' + h(t('PDF, PNG, JPEG or WebP · up to 2 MB. The file type is checked on the server, not just by its name.', 'PDF أو PNG أو JPEG أو WebP · حتى 2 ميغابايت. يُتحقق من نوع الملف على الخادم وليس من اسمه فقط.')) + '</p></div>'
      + '<button class="btn small" type="submit">' + h(t('Upload homework', 'رفع الواجب')) + '</button></form></div>';
    var questions = '<div class="card" data-hw-panel="questions" hidden>'
      + '<h2 class="dash-card-title">' + h(t('Create the questions yourself', 'أنشئ الأسئلة بنفسك')) + '</h2>'
      + '<p class="muted">' + h(t('Build a real homework: choose the correct answer, complete the sentence, translate, or a short answer. Choose, complete and translate are marked automatically; you confirm the final grade.', 'ابنِ واجبًا حقيقيًا: اختر الإجابة الصحيحة، أكمل الجملة، ترجم، أو إجابة قصيرة. تُصحح أسئلة الاختيار والإكمال والترجمة تلقائيًا، وتؤكد أنت الدرجة النهائية.')) + '</p>'
      + '<form id="hwQuestionsForm" class="dash-section">' + baseFields
      + '<div class="hw-builder"><div class="hw-builder-head"><strong>' + h(t('Questions', 'الأسئلة')) + '</strong> <span class="muted small" id="hwQuestionCount"></span></div>'
      + '<div id="hwQuestionList"></div>'
      + '<button type="button" class="btn small outline" id="hwAddQuestion">' + h(t('+ Add question', '+ إضافة سؤال')) + '</button></div>'
      + '<button class="btn small" type="submit">' + h(t('Create homework', 'إنشاء الواجب')) + '</button></form></div>';
    var list = '<div class="card"><h2 class="dash-card-title">' + h(t('Published homework', 'الواجبات المنشورة')) + '</h2>'
      + (asg.length ? asg.map(function (a) {
        var c = cmap[a.course_id];
        return '<div class="hw-card"><div class="hw-card-main"><strong>' + h(a.title) + '</strong>'
          + '<p class="muted small">' + h(c ? (lang === 'ar' ? c.title_ar || c.title_en : c.title_en) : '') + ' · ' + h(hwKindLabel(a))
          + (a.due_date ? ' · ' + h(t('Due ', 'التسليم ') + a.due_date) : '') + '</p></div>'
          + '<div class="hw-card-actions">' + hwFileButton(a) + '</div></div>';
      }).join('') : '<p class="muted">' + h(t('No homework yet.', 'لا توجد واجبات بعد.')) + '</p>') + '</div>';
    return '<div class="dash-tabs" role="tablist">'
      + '<button type="button" class="active" data-hw-mode="file">' + h(t('Upload a file', 'ارفع ملفًا')) + '</button>'
      + '<button type="button" data-hw-mode="questions">' + h(t('Create questions', 'أنشئ الأسئلة')) + '</button></div>'
      + upload + questions + list;
  }

  function dashFor(r) { return r === 'admin' ? 'dashboard-admin.html' : r === 'teacher' ? 'dashboard-teacher.html' : 'dashboard-student.html'; }
  function heading(me, note) {
    return '<p class="dash-welcome"><strong>' + h(t('Welcome, ', 'مرحبًا، ') + (me.full_name || '')) + '</strong></p><p class="muted">' + h(note) + '</p>';
  }


  // --- Dashboard shell: one view ("page") per section, hash-routed ---
  function view(id, titleEn, titleAr, inner) {
    return '<section class="dash-view" id="view-' + id + '" data-view="' + id + '" hidden><h2 class="dash-view-title" id="view-' + id + '-title">' + h(t(titleEn, titleAr)) + '</h2>' + inner + '</section>';
  }
  function showView(focusIt) {
    var views = Array.prototype.slice.call(content.querySelectorAll('.dash-view'));
    if (!views.length) return;
    // A route may carry an id: #perform/<assignmentId> opens a detail view.
    var hash = (location.hash || '').replace(/^#/, '');
    var route = hash.split('/')[0];
    var target = null;
    for (var i = 0; i < views.length; i++) { if (views[i].dataset.view === route) { target = views[i]; break; } }
    if (!target) target = views[0];
    views.forEach(function (v) { v.hidden = (v !== target); });    var nav = document.getElementById('dashNav');
    // Detail pages have no nav link of their own: highlight their parent list.
    var navView = target.dataset.view === 'perform' ? 'homework' : (target.dataset.view === 'lesson' ? 'lessons' : target.dataset.view);
    if (nav) nav.querySelectorAll('a').forEach(function (a) {
      var isActive = a.getAttribute('href') === '#' + navView;
      a.classList.toggle('active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var pt = document.getElementById('appPageTitle'), cr = document.getElementById('appCrumb');
    var hd = target.querySelector('.dash-view-title');
    if (pt && hd) pt.textContent = hd.textContent;
    if (cr && hd) cr.textContent = hd.textContent;
    if (focusIt) {
      var shellTitle = document.getElementById('appPageTitle');
      if (shellTitle) { shellTitle.tabIndex = -1; shellTitle.focus(); }
    }
  }
  function wireDashChrome() {
    var btn = document.getElementById('dashMenuBtn'), sidebar = document.getElementById('dashSidebar'), nav = document.getElementById('dashNav'), scrim = document.getElementById('dashScrim');
    var closeMenu = function (restoreFocus) {
      var wasOpen = sidebar && sidebar.classList.contains('open');
      if (sidebar) sidebar.classList.remove('open');
      if (scrim) scrim.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (restoreFocus && wasOpen && btn) btn.focus();
    };
    if (btn && sidebar) {
      btn.addEventListener('click', function () {
        var open = sidebar.classList.toggle('open');
        if (scrim) scrim.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { var first = sidebar.querySelector('a'); if (first) first.focus(); }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
      if (scrim) scrim.addEventListener('click', function () { closeMenu(true); });
      var drawerClose = document.getElementById('dashDrawerClose');
      if (drawerClose) drawerClose.addEventListener('click', function () { closeMenu(true); });
    }
    if (nav) nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { if (window.matchMedia('(max-width: 1023px)').matches) closeMenu(false); });
    });
    var out = document.getElementById('logoutBtn');
    if (out) out.addEventListener('click', function () {
      localStorage.removeItem('bbc-token');
      localStorage.removeItem('bbc-user');
      location.href = 'index.html';
    });
    window.addEventListener('hashchange', function () {
      closeMenu(false);
      if (window.__fillDashDetail) window.__fillDashDetail();
      showView(true);
    });
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
    var roleLab = { student: t('Student', 'طالب'), teacher: t('Teacher', 'معلم'), admin: t('Admin', 'مسؤول') }[(currentMe || {}).role] || (currentMe || {}).role || '';
    sec.innerHTML = '<h2 class="dash-view-title">' + h(t('Account', 'الحساب')) + '</h2>'
      + (currentMe ? '<div class="card"><h2 class="dash-card-title">' + h(t('Profile', 'الملف الشخصي')) + '</h2><p><strong>' + h(currentMe.full_name || '') + '</strong></p><p class="muted">' + h(currentMe.email || '') + (roleLab ? ' · ' + h(roleLab) : '') + '</p></div>' : '')
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Change password', 'تغيير كلمة المرور')) + '</h2>'
      + '<form id="accountPassword" class="dash-form">'
      + '<div class="field"><label for="accountCurrent">' + h(t('Current password', 'كلمة المرور الحالية')) + ' <span class="dash-req" aria-hidden="true">*</span></label><input id="accountCurrent" type="password" name="current_password" required autocomplete="current-password"></div>'
      + '<div class="field"><label for="accountNew">' + h(t('New password', 'كلمة المرور الجديدة')) + ' <span class="dash-req" aria-hidden="true">*</span></label><input id="accountNew" type="password" name="new_password" required minlength="8" autocomplete="new-password"><p class="dash-help">' + h(t('At least 8 characters.', '8 أحرف على الأقل.')) + '</p></div>'
      + '<div class="field"><label for="accountConfirm">' + h(t('Confirm new password', 'تأكيد كلمة المرور الجديدة')) + ' <span class="dash-req" aria-hidden="true">*</span></label><input id="accountConfirm" type="password" name="confirm_password" required minlength="8" autocomplete="new-password"></div>'
      + '<button class="btn" type="submit">' + h(t('Change password', 'تغيير كلمة المرور')) + '</button>'
      + '<p id="accountPasswordErr" class="dash-inline-error" hidden role="alert"></p>'
      + '<p id="accountPasswordOk" class="dash-inline-success" hidden></p></form></div>';
    content.appendChild(sec);
    var form = sec.querySelector('#accountPassword');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var okMsg = sec.querySelector('#accountPasswordOk');
      var errMsg = sec.querySelector('#accountPasswordErr');
      if (errMsg) errMsg.hidden = true;
      if (okMsg) okMsg.hidden = true;
      if (form.elements.new_password.value !== form.elements.confirm_password.value) {
        if (errMsg) { errMsg.hidden = false; errMsg.textContent = t('New passwords do not match.', 'كلمتا المرور الجديدتان غير متطابقتين.'); }
        form.elements.confirm_password.focus();
        return;
      }
      var sbtn = form.querySelector('button[type="submit"]');
      setBusy(sbtn, true);
      try {
        await api.req('/api/profile/password', { method: 'POST', body: { current_password: form.elements.current_password.value, new_password: form.elements.new_password.value } });
        form.reset();
        if (okMsg) { okMsg.hidden = false; okMsg.textContent = t('Password changed. It works from your next login.', 'تم تغيير كلمة المرور. ستُستخدم عند تسجيل الدخول القادم.'); }
      } catch (err) {
        if (errMsg) { errMsg.hidden = false; errMsg.textContent = err.message; }
        toast(err.message, 'error');
      }
      setBusy(sbtn, false);
    });
  }

  // Button style helper: primary red button
  function btn(href, textEn, textAr, classes) {
    classes = classes || '';
    return '<a class="btn ' + classes + '" href="' + href + '">' + h(t(textEn, textAr)) + '</a>';
  }

  // Section wrapper with heading and action buttons at the end
  function sectionWithButtons(titleEn, titleAr, content, buttonHtml) {
    return '<div class="dash-section"><span class="eyebrow page-eyebrow">BBC Academy</span>' + '<h2 class="dash-section-title">' + h(t(titleEn, titleAr)) + '</h2>' + content + (buttonHtml ? '<div class="dash-actions">' + buttonHtml + '</div>' : '') + '</div>';
  }


  // --- Overview helper: summary cards shown at the top of every dashboard ---
  function overview(titleEn, titleAr, value, noteEn, noteAr) {
    var note = t(noteEn || '', noteAr || '');
    return '<div class="dash-metric"><span class="dash-metric-label">' + h(t(titleEn, titleAr)) + '</span><strong class="dash-metric-value">' + h(value) + '</strong>' + (note ? '<span class="dash-metric-note">' + h(note) + '</span>' : '') + '</div>';
  }

  // --- Helper: section wrapper with eyebrown heading ---
  function section(titleEn, titleAr, content) {
    return '<div class="dash-section"><span class="eyebrow page-eyebrow">BBC Academy</span>' + '<h2 class="dash-section-title">' + h(t(titleEn, titleAr)) + '</h2>' + content + '</div>';
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
    var stuLevels = [];
    try { stuLevels = (await api.req('/api/levels')).levels || []; } catch (e) { stuLevels = []; }
    var latest = place[0];
    var present = att.filter(function (a) { return a.status === 'present'; }).length;
    var graded = asg.filter(function (a) { return a.submission && a.submission.grade != null; }).length;
    var openAsg = asg.filter(function (a) { return !a.submission; });
    var courseTitle = function (id) { var c = cmap[id]; return c ? (lang === 'ar' ? c.title_ar || c.title_en : c.title_en) : ''; };
    function hwMeta(a) {
      return hwKindLabel(a) + (a.due_date ? ' · ' + t('Due ', 'التسليم ') + a.due_date : '');
    }
    // One homework as a row in a list: title, its info, status, and the way in.
    function hwRow(a) {
      var st = hwStatusOf(a);
      return '<div class="dash-row-card" data-hw-status="' + st + '"><div class="dash-row-main"><strong>' + h(a.title) + '</strong>'
        + '<p class="muted small">' + h(courseTitle(a.course_id)) + ' · ' + h(hwMeta(a)) + '</p></div>'
        + '<div class="dash-row-side">' + hwStatusChip(a)
        + '<a class="btn small" href="#perform/' + h(a.id) + '">' + h(st === 'graded' ? t('Review homework', 'مراجعة الواجب') : t('Perform homework', 'أداء الواجب')) + '</a></div></div>';
    }
    function backLink(hash, en, ar) {
      return '<a class="btn small outline" href="#' + hash + '">' + h(t(en, ar)) + '</a>';
    }
    function lessonPage(l) {
      var n = lessons.indexOf(l) + 1;
      var links = [];
      if (l.content_url) links.push('<a class="btn small" href="' + h(l.content_url) + '" target="_blank" rel="noopener">' + h(t('Open lesson content', 'افتح محتوى الدرس')) + '</a>');
      if (l.material_url) links.push('<a class="btn small outline" href="' + h(l.material_url) + '" target="_blank" rel="noopener">' + h(t('Open the material', 'افتح المادة')) + '</a>');
      if (l.live_class_url) links.push('<a class="btn small outline" href="' + h(l.live_class_url) + '" target="_blank" rel="noopener">' + h(t('Join the live class', 'انضم إلى الحصة المباشرة')) + '</a>');
      var hw = asg.filter(function (a) { return String(a.course_id) === String(l.course_id); });
      return backLink('lessons', 'Back to lessons', 'العودة إلى الدروس')
        + '<div class="card"><div class="hw-block-head"><div><h3 class="hw-block-title">' + h(lang === 'ar' ? l.title_ar || l.title_en : l.title_en) + '</h3>'
        + '<p class="muted small">' + h(courseTitle(l.course_id)) + ' · ' + h(t('Lesson ', 'الدرس ') + (l.order_no || n)) + '</p></div></div>'
        + (links.length
          ? '<div class="hw-page-actions">' + links.join('') + '</div>'
          : '<p class="muted">' + h(t('Your teacher has not added content to this lesson yet.', 'لم يضف معلمك محتوى لهذا الدرس بعد.')) + '</p>')
        + '</div>'
        + '<div class="card"><h2 class="dash-card-title">' + h(t('Homework for this course', 'واجبات هذه الدورة')) + '</h2>'
        + (hw.length
          ? '<div class="dash-row-list">' + hw.map(hwRow).join('') + '</div>'
          : '<p class="muted">' + h(t('No homework for this course yet.', 'لا توجد واجبات لهذه الدورة بعد.')) + '</p>')
        + '</div>';
    }
    // The homework itself: the form to perform it, or the marked work after.
    function performPage(a) {
      var head = '<div class="hw-block-head"><div><h3 class="hw-block-title">' + h(a.title) + '</h3>'
        + '<p class="muted small">' + h(courseTitle(a.course_id)) + ' · ' + h(hwMeta(a)) + '</p></div>' + hwStatusChip(a) + '</div>';
      var back = '<div class="hw-back-row">' + backLink('homework', 'Back to homework', 'العودة إلى الواجبات') + backLink('lessons', 'Back to lessons', 'العودة إلى الدروس') + '</div>';
      if (hwStatusOf(a) === 'graded') {
        var mine = hwAnswerList(a);
        var written = !mine && a.submission.content_text ? '<p class="hw-answer-text">' + h(a.submission.content_text) + '</p>' : '';
        return back + '<div class="card">' + head
          + (a.submission.feedback ? '<p><strong>' + h(t('Teacher feedback', 'ملاحظات المعلم')) + ':</strong> ' + h(a.submission.feedback) + '</p>' : '')
          + hwAutoNote(a)
          + '<h2 class="dash-card-title">' + h(t('Your answers', 'إجاباتك')) + '</h2>'
          + (mine || written || '<p class="muted">—</p>')
          + '</div>';
      }
      return back + '<form class="card hw-submit" data-hw-form="' + h(a.id) + '">' + head
        + (a.has_file ? '<p>' + hwFileButton(a) + '</p>' : '')
        + hwAnswerFields(a) + hwAutoNote(a)
        + '<button class="btn small" type="submit">' + h(t('Submit homework', 'تسليم الواجب')) + '</button></form>';
    }
    function fillDetail() {
      var parts = (location.hash || '').replace(/^#/, '').split('/');
      var id = parts[1] || '';
      if (parts[0] === 'lesson') {
        var l = lessons.filter(function (x) { return String(x.id) === id; })[0];
        var box = document.getElementById('studentLessonDetail');
        var ttl = document.getElementById('view-lesson-title');
        if (box) box.innerHTML = l ? lessonPage(l) : '<div class="card"><p class="muted">' + h(t('This lesson is not available.', 'هذا الدرس غير متاح.')) + '</p></div>';
        if (ttl) ttl.textContent = l ? (lang === 'ar' ? l.title_ar || l.title_en : l.title_en) : t('Lesson', 'الدرس');
        if (box) bindHomeworkFileButtons(box);
      } else if (parts[0] === 'perform') {
        var a = asg.filter(function (x) { return String(x.id) === id; })[0];
        var pbox = document.getElementById('studentHomeworkDetail');
        var pttl = document.getElementById('view-perform-title');
        if (pbox) {
          pbox.innerHTML = a ? performPage(a) : '<div class="card"><p class="muted">' + h(t('This homework is not available.', 'هذا الواجب غير متاح.')) + '</p></div>';
          bindHomeworkFileButtons(pbox);
          bindHomeworkForms(pbox, asg);
        }
        if (pttl) pttl.textContent = a ? a.title : t('Homework', 'الواجب');
      }
    }
    content.innerHTML = view('overview', 'Overview', 'نظرة عامة', heading(me, t('Your course, progress and homework in one place.', 'دورتك وتقدمك وواجباتك في مكان واحد.'))
      + '<div class="dash-statgrid">'
      + overview('My courses', 'دوراتي', enr.length, 'enrolments', 'تسجيل')
      + overview('My level', 'مستواي', latest ? levelNameByCode(latest.recommended_level, stuLevels) : '—', latest ? 'placement result' : 'not taken yet', latest ? 'نتيجة اختبار المستوى' : 'لم تُجرَ بعد')
      + overview('Attendance', 'الحضور', present + ' / ' + att.length, 'lessons attended', 'حصة حضرتها')
      + '</div>'
      + '<p class="muted">' + h(t('Grades: ', 'الدرجات: ') + graded + ' / ' + asg.length) + '</p>'
      + (function () {
        var firstEnr = enr.find(function (e) { return e.status === 'active' || e.status === 'pending'; }) || enr[0];
        var firstCourse = firstEnr ? cmap[firstEnr.course_id] : null;
        var cont = firstCourse ? '<a class="btn small" href="course.html?id=' + h(firstCourse.slug || firstCourse.id) + '">' + h(t('Continue learning', 'واصل التعلّم')) + '</a>' : '';
        var steps = [];
        if (!place.length) steps.push('<li>' + h(t('Take the placement test to get your level.', 'أجرِ اختبار تحديد المستوى لمعرفة مستواك.')) + ' <a href="levels.html">' + h(t('Placement test', 'اختبار تحديد المستوى')) + '</a></li>');
        if (openAsg.length) steps.push('<li>' + h(t(openAsg.length + ' homework task(s) waiting for you.', openAsg.length + ' واجب بانتظارك.')) + ' <a href="#homework">' + h(t('Open homework', 'افتح الواجبات')) + '</a></li>');
        if (!enr.length) steps.push('<li>' + h(t('You are not enrolled in any course yet. Book a seat to get started.', 'لست مسجلًا في أي دورة بعد. احجز مقعدًا للبدء.')) + ' <a href="booking.html">' + h(t('Book a seat', 'احجز مقعدًا')) + '</a></li>');
        return '<div class="card dash-next"><h2 class="dash-card-title">' + h(t('Next steps', 'الخطوات التالية')) + '</h2>' + (cont ? '<p>' + cont + '</p>' : '') + (steps.length ? '<ul>' + steps.join('') + '</ul>' : '<p class="muted">' + h(t('You are on track. Keep going with your enrolled courses.', 'أنت على المسار الصحيح. واصل في دوراتك المسجلة.')) + '</p>') + '</div>';
      })())
      + view('courses', 'My courses', 'دوراتي', '<div class="card">'
      + table([t('Course', 'الدورة'), t('Level', 'المستوى'), t('Status', 'الحالة'), t('Lessons', 'الدروس'), t('Assignments', 'الواجبات'), ''], enr.map(function (e) {
        var c = cmap[e.course_id];
        if (!c) return '<tr><td>—</td><td></td><td>' + badge(e.status) + '</td><td></td><td></td><td></td></tr>';
        var lc = lessons.filter(function (l) { return l.course_id === c.id; }).length;
        var ac = asg.filter(function (a) { return a.course_id === c.id; }).length;
        return '<tr><td>' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</td><td>' + h(levelName(c.level_id, stuLevels)) + '</td><td>' + badge(e.status) + '</td><td>' + lc + '</td><td>' + ac + '</td><td><a class="btn small" href="course.html?id=' + h(c.slug || c.id) + '">' + h(t('Open course', 'افتح الدورة')) + '</a></td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>')
      + view('progress', 'My progress', 'تقدّمي', '<div class="card"><h2 class="dash-card-title">' + h(t('Placement & level', 'تحديد المستوى')) + '</h2>'
      + (latest ? '<p>' + h(t('Latest result: ', 'آخر نتيجة: ')) + latest.score + ' / ' + latest.total + ' — ' + h(t('Recommended level: ', 'المستوى الموصى به: ')) + h(levelNameByCode(latest.recommended_level, stuLevels)) + '</p>' : '<p class="muted">' + h(t('No placement test taken yet.', 'لم تُجرَ اختبار تحديد مستوى بعد.')) + ' <a href="levels.html">' + h(t('Take the placement test', 'أجرِ اختبار تحديد المستوى')) + '</a></p>') + '</div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Attendance', 'الحضور')) + '</h2><p>' + h(t('Present: ', 'الحاضر: ')) + present + ' / ' + att.length + '</p><p class="muted">' + h(t('Attendance counts only records marked present, out of all recorded attendance days for you. Absent, late and excused days are not counted as present.', 'الحضور يحسب فقط الأيام المسجلة كحاضر، من مجموع أيام الحضور المسجلة لك. أيام الغياب والتأخر والعذر لا تُحسب كحاضر.')) + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Grades', 'الدرجات')) + '</h2>'
      + table([t('Task', 'المهمة'), t('Grade', 'الدرجة'), t('Feedback', 'ملاحظات')], asg.filter(function (a) { return a.submission && a.submission.grade != null; }).map(function (a) {
        return '<tr><td>' + h(a.title) + '</td><td>' + h(a.submission.grade) + ' / 100</td><td>' + h(a.submission.feedback || '') + '</td></tr>';
      }), t('No grades returned yet.', 'لا توجد درجات بعد.')) + '</div>')
      + view('homework', 'Homework', 'الواجبات', '<div class="card"><div class="dash-tabs" role="tablist">'
      + ['all', 'pending', 'submitted', 'graded'].map(function (s) { return '<button type="button" data-hw-tab="' + s + '" class="' + (s === 'all' ? 'active' : '') + '">' + h(s === 'all' ? t('All', 'الكل') : s === 'pending' ? t('Pending', 'بانتظار التسليم') : s === 'submitted' ? t('Submitted', 'مُسلَّمة') : t('Graded', 'مصححة')) + '</button>'; }).join('') + '</div>'
      + '<p class="muted">' + h(t('Pick a homework to perform it. The questions open on their own page.', 'اختر واجبًا لأدائه. تُفتح الأسئلة في صفحة خاصة.')) + '</p>'
      + (asg.length
        ? '<div class="dash-row-list">' + asg.map(hwRow).join('') + '</div>'
        : '<div class="dash-empty"><p>' + h(t('No homework yet.', 'لا توجد واجبات بعد.')) + '</p></div>')
      + '</div>')
      + view('lessons', 'Lessons', 'الدروس', '<div class="card">'
      + '<p class="muted">' + h(t('Open a lesson to see its material and the homework for its course.', 'افتح درسًا لترى مادته وواجبات دورته.')) + '</p>'
      + (lessons.length
        ? '<div class="dash-row-list">' + lessons.map(function (l, i) {
          return '<div class="dash-row-card"><div class="dash-row-main"><strong>' + h(lang === 'ar' ? l.title_ar || l.title_en : l.title_en) + '</strong>'
            + '<p class="muted small">' + h(courseTitle(l.course_id)) + ' · ' + h(t('Lesson ', 'الدرس ') + (l.order_no || i + 1)) + '</p></div>'
            + '<div class="dash-row-side"><a class="btn small" href="#lesson/' + h(l.id) + '">' + h(t('Open this lesson', 'افتح هذا الدرس')) + '</a></div></div>';
        }).join('') + '</div>'
        : '<div class="dash-empty"><p>' + h(t('No lessons yet.', 'لا توجد دروس بعد.')) + '</p></div>')
      + '</div>')
      + view('lesson', 'Lesson', 'الدرس', '<div id="studentLessonDetail"></div>')
      + view('perform', 'Homework', 'الواجب', '<div id="studentHomeworkDetail"></div>')
      + view('announcements', 'Announcements', 'الإعلانات', '<div class="card">'
      + (ann.length ? ann.slice(0, 5).map(function (a) {
        return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body).replace(/\n/g, '<br>') + '</span></p>';
      }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div>');

    labelTableCells();
    content.querySelectorAll('[data-hw-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.querySelectorAll('[data-hw-tab]').forEach(function (x) { x.classList.toggle('active', x === btn); });
        var wanted = btn.dataset.hwTab;
        content.querySelectorAll('[data-hw-status]').forEach(function (row) { row.hidden = !(wanted === 'all' || row.dataset.hwStatus === wanted); });
      });
    });
    bindHomeworkFileButtons();
    bindHomeworkForms(content, asg);
    // Detail views (#lesson/<id>, #perform/<id>) are filled from the data this
    // dashboard already loaded, and refilled on every hash change.
    window.__fillDashDetail = fillDetail;
    fillDetail();
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
    var teaLevels = [];
    try { teaLevels = (await api.req('/api/levels')).levels || []; } catch (e) { teaLevels = []; }
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
      + '<div class="dash-statgrid">'
      + overview('My courses', 'دوراتي', courses.length, '', '')
      + overview('Students', 'الطلاب', Object.keys(students).length, 'across your courses', 'في دوراتك')
      + overview('To grade', 'بانتظار التصحيح', ungraded, 'submissions', 'تسليم')
      + '</div>'
      + '<div class="card dash-next"><h2 class="dash-card-title">' + h(t('Needs attention', 'يحتاج انتباهك')) + '</h2>'
      + (ungraded ? '<p>' + h(t(ungraded + ' submission(s) waiting for grading.', ungraded + ' تسليم بانتظار التصحيح.')) + ' <a class="btn small" href="#grading">' + h(t('Open grading', 'افتح التصحيح')) + '</a></p>' : '<p class="muted">' + h(t('Nothing waiting for grading right now.', 'لا يوجد شيء بانتظار التصحيح الآن.')) + '</p>') + '</div>')
      + view('classes', 'My classes', 'حصصي', '<div class="card">'
      + table([t('Class', 'الحصة'), t('Level', 'المستوى'), t('Students', 'الطلاب')], courses.map(function (c) {
        return '<tr><td>' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</td><td>' + h(levelName(c.level_id, teaLevels)) + '</td><td>' + enr.filter(function (e) { return e.course_id === c.id; }).length + '</td></tr>';
      }), t('No courses assigned yet.', 'لا توجد دورات مسندة بعد.')) + '</div>')
      + view('grading', 'Submissions to grade', 'تسليمات للتصحيح', '<div class="card"><div class="dash-tabs" role="tablist">'
      + ['all', 'pending', 'graded'].map(function (s) { return '<button type="button" data-grade-tab="' + s + '" class="' + (s === 'all' ? 'active' : '') + '">' + h(s === 'all' ? t('All', 'الكل') : s === 'pending' ? t('Pending', 'بانتظار التصحيح') : t('Graded', 'مصححة')) + '</button>'; }).join('') + '</div>'
      + table([t('Student', 'الطالب'), t('Task', 'المهمة'), t('Status', 'الحالة'), t('Grade', 'الدرجة'), t('Feedback', 'ملاحظات'), ''], subs.map(function (s) {
        var a = amap[s.assignment_id];
        var st = s.grade == null ? 'pending' : 'graded';
        var answers = Array.isArray(s.answers) ? s.answers : [];
        var qs = (a && Array.isArray(a.questions)) ? a.questions : [];
        var answerBox = answers.length
          ? '<details class="hw-answers"><summary>' + h(t('View answers', 'اعرض الإجابات')) + '</summary><ol>' + answers.map(function (x, i) {
            var q = qs.filter(function (y) { return y.id === x.question_id; })[0];
            var shown = x.answer || '—';
            // A choice is stored as an index; show the option the student picked.
            if (q && q.type === 'multiple_choice' && /^\d+$/.test(String(x.answer))) shown = (q.options || [])[Number(x.answer)] || shown;
            return '<li><span class="hw-answer-q">Q' + (i + 1) + '</span> ' + h(shown) + '</li>';
          }).join('') + '</ol></details>'
          : '';
        var autoNote = s.auto_total ? '<br><span class="muted small">' + h(t('Auto-marked ', 'تلقائي ') + s.auto_score + ' / ' + s.auto_total) + '</span>' : '';
        return '<tr data-grade-status="' + st + '"><td>' + h(s.student_name || s.student_id) + '</td><td>' + h(a ? a.title : '') + autoNote + answerBox + '</td><td>' + badge(st === 'pending' ? 'pending' : 'graded') + '</td><td><input type="number" min="0" max="100" style="width:80px" value="' + h(s.grade == null ? '' : s.grade) + '" data-grade="' + h(s.id) + '" aria-label="' + h(t('Grade 0-100', 'الدرجة من 0 إلى 100')) + '"></td><td><input data-feedback="' + h(s.id) + '" value="' + h(s.feedback || '') + '" aria-label="' + h(t('Feedback', 'ملاحظات')) + '"></td><td><button class="btn small" data-grade-btn="' + h(s.id) + '">' + h(t('Save', 'حفظ')) + '</button></td></tr>';
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
      + '<div class="field"><label>' + h(t('Student', 'الطالب')) + ' <select name="student_id" required>' + studentOpts(courses.length ? courses[0].id : '') + '</select></label></div>'
      + '<div class="field"><label>' + h(t('Status', 'الحالة')) + ' <select name="status"><option value="present">' + h(t('Present', 'حاضر')) + '</option><option value="absent">' + h(t('Absent', 'غائب')) + '</option><option value="late">' + h(t('Late', 'متأخر')) + '</option><option value="excused">' + h(t('Excused', 'بعذر')) + '</option></select></label></div>'
      + '<div class="field"><label>' + h(t('Date', 'التاريخ')) + ' <input type="date" name="attended_on" value="' + new Date().toLocaleDateString('en-CA') + '"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Save attendance', 'حفظ الحضور')) + '</button></form></div>'
      + '<div class="card">'
      + table([t('Student', 'الطالب'), t('Course', 'الدورة'), t('Status', 'الحالة'), t('Date', 'التاريخ')], att.slice(0, 30).map(function (a) {
        var c = cmap[a.course_id];
        return '<tr><td>' + h(a.student_name || a.student_id) + '</td><td>' + h(c ? c.title_en : '') + '</td><td>' + badge(a.status) + '</td><td>' + h(a.attended_on || '') + '</td></tr>';
      }), t('No attendance records yet.', 'لا توجد سجلات حضور بعد.')) + '</div>')
      + view('announcements', 'Announcements', 'الإعلانات', '<div class="card">'
      + '<form id="teacherAnnouncement"><div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required></label></div>'
      + '<div class="field"><label>' + h(t('Body', 'النص')) + ' <textarea name="body" rows="3" required></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Audience', 'الجمهور')) + ' <select name="audience"><option value="all">' + h(t('Everyone', 'الجميع')) + '</option><option value="students">' + h(t('Students', 'الطلاب')) + '</option></select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Publish', 'نشر')) + '</button></form></div>'
      + '<div class="card">'
      + (ann.length ? ann.slice(0, 5).map(function (a) { return '<p><strong>' + h(a.title) + '</strong><br><span class="muted">' + h(a.body) + '</span></p>'; }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>') + '</div>')
      + view('assignments', 'Homework', 'الواجبات', courses.length
        ? homeworkTeacherView(asg, cmap, courseOpts)
        : noCourseNote)
      + view('lessons', 'New lesson', 'درس جديد', courses.length
        ? '<div class="card"><form id="teacherLesson"><div class="field"><label>' + h(t('Course', 'الدورة')) + ' <select name="course_id" required>' + courseOpts + '</select></label></div>'
          + '<div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required maxlength="200"></label></div>'
          + '<div class="field"><label>' + h(t('Live class link', 'رابط الحصة المباشرة')) + ' <input name="live_class_url" type="url" dir="ltr" placeholder="https://meet.google.com/..."></label></div>'
          + '<div class="field"><label>' + h(t('Lesson number', 'رقم الدرس')) + ' <input type="number" name="order_no" min="1" value="1"></label></div>'
          + '<button class="btn small" type="submit">' + h(t('Add lesson', 'إضافة الدرس')) + '</button></form></div>'
        : noCourseNote);

    labelTableCells();
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
        var abtn = attForm.querySelector('button[type="submit"]');
        setBusy(abtn, true);
        try {
          await api.req('/api/attendance', { method: 'POST', body: { course_id: courseSel.value, student_id: studentSel.value, status: attForm.elements.status.value, attended_on: attForm.elements.attended_on.value || null } });
          toast(t('Attendance saved.', 'تم حفظ الحضور.'), 'success'); refreshCurrent();
        } catch (err) { toast(err.message, 'error'); }
        setBusy(abtn, false);
      });
    }
    var annForm = document.getElementById('teacherAnnouncement');
    if (annForm) annForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var anbtn = annForm.querySelector('button[type="submit"]');
      setBusy(anbtn, true);
      try {
        await api.req('/api/announcements', { method: 'POST', body: { title: annForm.elements.title.value.trim(), body: annForm.elements.body.value.trim(), audience: annForm.elements.audience.value } });
        toast(t('Announcement published.', 'تم نشر الإعلان.'), 'success'); annForm.reset(); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
      setBusy(anbtn, false);
    });
    bindHomeworkFileButtons();
    // Two modes under the same Homework section.
    content.querySelectorAll('[data-hw-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.querySelectorAll('[data-hw-mode]').forEach(function (x) { x.classList.toggle('active', x === btn); });
        content.querySelectorAll('[data-hw-panel]').forEach(function (panel) { panel.hidden = panel.dataset.hwPanel !== btn.dataset.hwMode; });
      });
    });
    var qList = document.getElementById('hwQuestionList');
    var qForm = document.getElementById('hwQuestionsForm');
    var addQBtn = document.getElementById('hwAddQuestion');
    if (qList && addQBtn) {
      var addQuestion = function () {
        qList.insertAdjacentHTML('beforeend', hwQuestionBlock());
        var block = qList.lastElementChild;
        hwRenderQuestionExtra(block);
        block.querySelector('[data-q-type]').addEventListener('change', function () { hwRenderQuestionExtra(block); });
        block.querySelector('[data-q-remove]').addEventListener('click', function () { block.remove(); hwRenumber(qList); });
        hwRenumber(qList);
        var prompt = block.querySelector('[data-q-prompt]');
        if (prompt) prompt.focus();
      };
      addQBtn.addEventListener('click', addQuestion);
      addQuestion();
    }
    if (qForm) qForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var questions;
      try { questions = collectHomeworkQuestions(qList); } catch (err) { toast(err.message, 'error'); return; }
      var qbtn = qForm.querySelector('button[type="submit"]');
      setBusy(qbtn, true);
      try {
        await api.req('/api/assignments', { method: 'POST', body: {
          course_id: qForm.elements.course_id.value,
          title: qForm.elements.title.value.trim(),
          description: qForm.elements.description.value.trim() || null,
          due_date: qForm.elements.due_date.value || null,
          questions: questions
        }});
        toast(t('Homework created.', 'تم إنشاء الواجب.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); setBusy(qbtn, false); }
    });
    var uploadForm = document.getElementById('hwUpload');
    if (uploadForm) uploadForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var file = uploadForm.elements.file.files && uploadForm.elements.file.files[0];
      if (!file) { toast(t('Choose a file first.', 'اختر ملفًا أولًا.'), 'error'); return; }
      if (['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) < 0) {
        toast(t('Only PDF, PNG, JPEG or WebP files are allowed.', 'يُسمح فقط بملفات PDF أو PNG أو JPEG أو WebP.'), 'error'); return;
      }
      if (file.size > 2 * 1024 * 1024) { toast(t('The file must be 2 MB or smaller.', 'يجب أن يكون حجم الملف 2 ميغابايت أو أقل.'), 'error'); return; }
      var ubtn = uploadForm.querySelector('button[type="submit"]');
      setBusy(ubtn, true);
      try {
        var base64 = await readFileAsBase64(file);
        await api.req('/api/assignments', { method: 'POST', body: {
          course_id: uploadForm.elements.course_id.value,
          title: uploadForm.elements.title.value.trim(),
          description: uploadForm.elements.description.value.trim() || null,
          due_date: uploadForm.elements.due_date.value || null,
          file: { name: file.name, type: file.type, data: base64 }
        }});
        toast(t('Homework uploaded.', 'تم رفع الواجب.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); setBusy(ubtn, false); }
    });
    var lessonForm = document.getElementById('teacherLesson');
    if (lessonForm) lessonForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var lbtn = lessonForm.querySelector('button[type="submit"]');
      setBusy(lbtn, true);
      try {
        await api.req('/api/lessons', { method: 'POST', body: {
          course_id: lessonForm.elements.course_id.value,
          title_en: lessonForm.elements.title.value.trim(),
          live_class_url: lessonForm.elements.live_class_url.value.trim() || null,
          order_no: Number(lessonForm.elements.order_no.value) || 1
        }});
        toast(t('Lesson added.', 'تمت إضافة الدرس.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
      setBusy(lbtn, false);
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
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Needs your attention', 'يحتاج انتباهك')) + '</h2>' + needsHtml + '</div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Quick actions', 'إجراءات سريعة')) + '</h2><div class="dash-actions"><a class="btn" href="#accounts">' + h(t('Add student', 'إضافة طالب')) + '</a><a class="btn quiet" href="#people">' + h(t('Add teacher', 'إضافة معلم')) + '</a><a class="btn quiet" href="#courses">' + h(t('Create course', 'إنشاء دورة')) + '</a><a class="btn quiet" href="#bookings">' + h(t('Review bookings', 'مراجعة الطلبات')) + '</a></div></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Recent bookings', 'أحدث الطلبات')) + '</h2>'
      + table([t('Name', 'الاسم'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], recentBookings.map(function (b) {
        return '<tr><td>' + h(b.full_name) + '</td><td>' + h(b.course || '') + '</td><td>' + badge(b.status) + '</td><td>' + (b.status === 'pending' ? '<button class="btn small" data-confirm="' + h(b.id) + '">' + h(t('Confirm', 'تأكيد')) + '</button>' : '') + '</td></tr>';
      }), t('No booking requests yet.', 'لا توجد طلبات حجز بعد.')) + '</div>')
      + view('students', 'Students', 'الطلاب', '<div class="dash-filterbar"><label>' + h(t('Search students', 'ابحث في الطلاب')) + ' <input type="search" id="adminStudentSearch" placeholder="' + h(t('Name, email or username', 'الاسم أو البريد أو اسم المستخدم')) + '"></label></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Enrol a student', 'تسجيل طالب في دورة')) + '</h2>'
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
      + '<div id="adminCreateAccountOk" class="success" hidden></div></div>')
      + view('people', 'People', 'الأشخاص', '<div class="dash-filterbar"><label>' + h(t('Search people', 'ابحث في الأشخاص')) + ' <input type="search" id="adminPeopleSearch" placeholder="' + h(t('Name, email or username', 'الاسم أو البريد أو اسم المستخدم')) + '"></label><label>' + h(t('Role', 'الدور')) + ' <select id="adminPeopleRole"><option value="">' + h(t('All roles', 'كل الأدوار')) + '</option><option value="student">' + h(t('Student', 'طالب')) + '</option><option value="teacher">' + h(t('Teacher', 'معلم')) + '</option><option value="admin">' + h(t('Admin', 'مسؤول')) + '</option></select></label></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Create a teacher', 'إنشاء حساب معلم')) + '</h2>'
      + '<form id="adminCreateTeacherForm"><div class="field"><label>' + h(t('Full name', 'الاسم الكامل')) + ' <input name="full_name" required></label></div>'
      + '<div class="field"><label>' + h(t('Username (optional)', 'اسم المستخدم (اختياري)')) + ' <input name="username"></label></div>'
      + '<div class="field"><label>' + h(t('Email', 'البريد الإلكتروني')) + ' <input name="email" type="email" required></label></div>'
      + '<div class="field"><label>' + h(t('Password (8+ characters)', 'كلمة المرور (8 أحرف فأكثر)')) + ' <input name="password" type="password" required minlength="8"></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Create teacher', 'إنشاء معلم')) + '</button></form>'
      + '<div id="adminCreateTeacherOk" class="success" hidden></div></div>'
      + '<div class="card">'
      + table([t('Name', 'الاسم'), t('Email', 'البريد'), t('Role', 'الدور'), t('New password', 'كلمة مرور جديدة'), ''], users.map(function (u) {
        return '<tr data-search-text="' + h((u.full_name + ' ' + u.email + ' ' + (u.username || '')).toLowerCase()) + '" data-role-row="' + h(u.role) + '"><td>' + h(u.full_name) + '</td><td>' + h(u.email) + '</td>'
          + '<td><select data-role-for="' + h(u.id) + '">' + ['student', 'teacher', 'admin'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + h(r) + '</option>'; }).join('') + '</select></td>'
          + '<td><input type="password" data-pw-for="' + h(u.id) + '" placeholder="' + h(t('8+ characters', '8 أحرف فأكثر')) + '" style="width:150px"></td>'
          + '<td><button class="btn small" data-save-user="' + h(u.id) + '">' + h(t('Save', 'حفظ')) + '</button>' + (u.id === me.id ? '' : ' <button class="btn small outline" data-delete-user="' + h(u.id) + '">' + h(t('Delete', 'حذف')) + '</button>') + '</td></tr>';
      }), t('No users yet.', 'لا يوجد مستخدمون بعد.')) + '</div>')
      + view('courses', 'Courses and teachers', 'الدورات والمعلمون', '<div class="card"><h2 class="dash-card-title">' + h(t('Create a course', 'إنشاء دورة')) + '</h2>'
      + '<form id="adminCreateCourseForm" class="dash-form">'
      + '<fieldset class="dash-fieldset"><legend>' + h(t('1. Course information', '1. معلومات الدورة')) + '</legend>'
      + '<div class="dash-form-grid">'
      + '<div class="field"><label for="adminCourseTitleEn">' + h(t('Title (English)', 'العنوان بالإنجليزية')) + ' <span class="dash-req" aria-hidden="true">*</span></label><input name="title_en" id="adminCourseTitleEn" required></div>'
      + '<div class="field"><label for="courseTitleAr">' + h(t('Title (Arabic)', 'العنوان بالعربية')) + ' <span class="dash-opt">' + h(t('(optional)', '(اختياري)')) + '</span></label><input name="title_ar" id="courseTitleAr"></div>'
      + '</div>'
      + '<div class="field"><label for="adminCourseSlug">' + h(t('Slug', 'المعرّف')) + ' <span class="dash-req" aria-hidden="true">*</span></label><input name="slug" id="adminCourseSlug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" dir="ltr"><p class="dash-help">' + h(t('Lowercase letters, numbers and hyphens only. Used in the course link; it fills in from the English title until you edit it.', 'أحرف صغيرة وأرقام وشرطات فقط. يُستخدم في رابط الدورة، ويُملأ تلقائيًا من العنوان الإنجليزي حتى تعدّله.')) + '</p></div>'
      + '</fieldset>'
      + '<fieldset class="dash-fieldset"><legend>' + h(t('2. Level and duration', '2. المستوى والمدة')) + '</legend>'
      + '<div class="dash-form-grid">'
      + '<div class="field"><label for="courseLevel">' + h(t('Level', 'المستوى')) + ' <span class="dash-opt">' + h(t('(optional)', '(اختياري)')) + '</span></label><select name="level_id" id="courseLevel"><option value="">' + h(t('No level', 'بدون مستوى')) + '</option>' + levels.map(function (l) { return '<option value="' + h(l.id) + '">' + h(l.code) + ' — ' + h(lang === 'ar' ? l.name_ar || l.name_en : l.name_en) + '</option>'; }).join('') + '</select></div>'
      + '<div class="field"><label for="courseWeeks">' + h(t('Duration (weeks)', 'المدة (بالأسابيع)')) + ' <span class="dash-opt">' + h(t('(optional)', '(اختياري)')) + '</span></label><input name="duration_weeks" id="courseWeeks" type="number" min="1" step="1" inputmode="numeric"></div>'
      + '</div></fieldset>'
      + '<fieldset class="dash-fieldset"><legend>' + h(t('3. Teacher assignment', '3. إسناد المعلم')) + '</legend>'
      + '<div class="field"><label for="courseTeacher">' + h(t('Teacher', 'المعلم')) + ' <span class="dash-opt">' + h(t('(optional)', '(اختياري)')) + '</span></label><select name="teacher_id" id="courseTeacher"><option value="">' + h(t('Unassigned', 'غير مسند')) + '</option>' + users.filter(function (u) { return u.role === 'teacher'; }).map(function (u) { return '<option value="' + h(u.id) + '">' + h(u.full_name) + '</option>'; }).join('') + '</select><p class="dash-help">' + h(t('Teachers are listed by name. Leave unassigned if no teacher is chosen yet.', 'المعلمون معروضون بالاسم. اتركه غير مسند إن لم يُختر معلم بعد.')) + '</p></div>'
      + '</fieldset>'
      + '<fieldset class="dash-fieldset"><legend>' + h(t('4. Visibility', '4. الظهور')) + '</legend>'
      + '<div class="field"><label class="dash-switch"><input name="is_published" id="coursePublished" type="checkbox" checked><span class="dash-switch-track" aria-hidden="true"><span class="dash-switch-knob"></span></span><span>' + h(t('Published (visible to everyone)', 'منشورة (ظاهرة للجميع)')) + '</span></label></div>'
      + '</fieldset>'
      + '<button class="btn" type="submit">' + h(t('Create course', 'إنشاء دورة')) + '</button></form>'
      + '<div id="adminCreateCourseOk" class="success" hidden></div></div>'
      + '<div class="card">'
      + table([t('Course', 'الدورة'), t('Level', 'المستوى'), t('Duration', 'المدة'), t('Teacher', 'المعلم'), t('Status', 'الحالة'), ''], courses.map(function (c) {
        var opts = '<option value="">' + h(t('Unassigned', 'غير مسند')) + '</option>' + users.filter(function (u) { return u.role === 'teacher'; }).map(function (u) {
          return '<option value="' + h(u.id) + '"' + (c.teacher_id === u.id ? ' selected' : '') + '>' + h(u.full_name) + '</option>';
        }).join('');
        return '<tr><td>' + h(lang === 'ar' ? c.title_ar || c.title_en : c.title_en) + '</td><td>' + h(levelName(c.level_id, levels)) + '</td><td>' + h(c.duration_weeks ? c.duration_weeks + ' ' + t('weeks', 'أسابيع') : '—') + '</td><td><select data-teacher-for="' + h(c.id) + '">' + opts + '</select></td>'
          + '<td>' + (('is_published' in c) ? badge(c.is_published ? 'published' : 'unpublished') : '—') + '</td>'
          + '<td><button class="btn small" data-save-course="' + h(c.id) + '">' + h(t('Save', 'حفظ')) + '</button> <button class="btn small outline" data-delete-course="' + h(c.id) + '">' + h(t('Delete', 'حذف')) + '</button></td></tr>';
      }), t('No courses yet.', 'لا توجد دورات بعد.')) + '</div>')
      + view('enrolments', 'Recent enrolments', 'أحدث التسجيلات', '<div class="card">'
      + table([t('Student', 'الطالب'), t('Course', 'الدورة'), t('Status', 'الحالة'), ''], enr.slice(0, 20).map(function (e) {
        var c = cmap[e.course_id];
        var approve = e.status === 'pending' ? '<button class="btn small" data-approve="' + h(e.id) + '">' + h(t('Approve', 'موافقة')) + '</button>' : '';
        return '<tr><td>' + h(e.student_name || e.student_id) + '</td><td>' + h(c ? c.title_en : e.course_id) + '</td><td>' + badge(e.status) + '</td><td>' + approve + ' <button class="btn small outline" data-remove-enrolment="' + h(e.id) + '">' + h(t('Remove', 'إزالة')) + '</button></td></tr>';
      }), t('No enrolments yet.', 'لا توجد تسجيلات بعد.')) + '</div>')
      + view('reports', 'Reports', 'التقارير', '<div class="card"><h2 class="dash-card-title">' + h(t('Academy summary (real counts only)', 'ملخص الأكاديمية (أعداد حقيقية فقط)')) + '</h2>'
      + '<div class="dash-statgrid">' + overview('Students', 'الطلاب', students.length, '', '') + overview('Teachers', 'المعلمون', teachers.length, '', '') + overview('Courses', 'الدورات', courses.length, '', '') + overview('Enrolments', 'التسجيلات', enr.length, '', '') + '</div>'
      + '<p>' + h(t('Bookings: ', 'الطلبات: ')) + ['pending', 'confirmed', 'rejected'].map(function (s) { return s + ': ' + bookings.filter(function (b) { return b.status === s; }).length; }).join(' · ') + '</p>'
      + '<p>' + h(t('Enrolments: ', 'التسجيلات: ')) + ['pending', 'active', 'completed', 'cancelled'].map(function (s) { return s + ': ' + enr.filter(function (e) { return e.status === s; }).length; }).join(' · ') + '</p>'
      + '<p class="muted">' + h(t('No charts or exports are offered: this summary uses only counts already available to the admin.', 'لا توجد رسوم بيانية أو تصدير: هذا الملخص يستخدم فقط الأعداد المتاحة للمسؤول.')) + '</p></div>')
      + view('operations', 'Academic operations', 'العمليات الأكاديمية', '<div class="card"><h2 class="dash-card-title">' + h(t('Levels', 'المستويات')) + '</h2><p>' + levels.map(function (l) { return h(l.code) + ' — ' + h(lang === 'ar' ? l.name_ar || l.name_en : l.name_en); }).join(' · ') + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Lessons', 'الدروس')) + '</h2><p>' + h(t('Total lessons: ', 'إجمالي الدروس: ')) + (ops.lessons == null ? h(t('could not load', 'تعذّر التحميل')) : ops.lessons.length) + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Assignments', 'الواجبات')) + '</h2><p>' + h(t('Total assignments: ', 'إجمالي الواجبات: ')) + (ops.assignments == null ? h(t('could not load', 'تعذّر التحميل')) : ops.assignments.length) + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Submissions', 'التسليمات')) + '</h2><p>' + h(t('Total submissions: ', 'إجمالي التسليمات: ')) + (ops.submissions == null ? h(t('could not load', 'تعذّر التحميل')) : ops.submissions.length) + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Attendance records', 'سجلات الحضور')) + '</h2><p>' + h(t('Total records: ', 'إجمالي السجلات: ')) + (ops.attendance == null ? h(t('could not load', 'تعذّر التحميل')) : ops.attendance.length) + '</p></div>'
      + '<div class="card"><h2 class="dash-card-title">' + h(t('Announcements', 'الإعلانات')) + '</h2>'
      + (ops.announcements == null ? '<p class="muted">' + h(t('Could not load announcements.', 'تعذّر تحميل الإعلانات.')) + '</p>'
        : (ops.announcements.length ? ops.announcements.slice(0, 10).map(function (a) { return '<p><strong>' + h(a.title) + '</strong> <span class="muted">(' + h(a.audience || 'all') + ')</span><br><span class="muted">' + h(a.body) + '</span></p>'; }).join('') : '<p class="muted">' + h(t('No announcements yet.', 'لا توجد إعلانات بعد.')) + '</p>'))
      + '<form id="adminAnnouncement" class="dash-section"><div class="field"><label>' + h(t('Title', 'العنوان')) + ' <input name="title" required></label></div>'
      + '<div class="field"><label>' + h(t('Body', 'النص')) + ' <textarea name="body" rows="3" required></textarea></label></div>'
      + '<div class="field"><label>' + h(t('Audience', 'الجمهور')) + ' <select name="audience"><option value="all">' + h(t('Everyone', 'الجميع')) + '</option><option value="students">' + h(t('Students', 'الطلاب')) + '</option><option value="teachers">' + h(t('Teachers', 'المعلمون')) + '</option></select></label></div>'
      + '<button class="btn small" type="submit">' + h(t('Publish announcement', 'نشر إعلان')) + '</button></form></div>');

    labelTableCells();
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
      var ebtn = enrolForm.querySelector('button[type="submit"]');
      setBusy(ebtn, true);
      try {
        await api.req('/api/admin/enrolments', { method: 'POST', body: { student_id: enrolForm.elements.student_id.value, course_id: enrolForm.elements.course_id.value, status: 'active' } });
        toast(t('Student enrolled.', 'تم تسجيل الطالب.'), 'success'); refreshCurrent();
      } catch (err) { toast(err.message, 'error'); }
      setBusy(ebtn, false);
    });
    var teacherForm = document.getElementById('adminCreateTeacherForm');
    if (teacherForm) teacherForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var tbtn = teacherForm.querySelector('button[type="submit"]');
      setBusy(tbtn, true);
      try {
        var tu = await api.req('/api/admin/users', { method: 'POST', body: {
          full_name: teacherForm.elements.full_name.value.trim(), username: teacherForm.elements.username.value.trim() || null,
          email: teacherForm.elements.email.value.trim(), password: teacherForm.elements.password.value, role: 'teacher' } });
        toast(t('Teacher account created for ', 'تم إنشاء حساب المعلم ') + tu.user.email, 'success');
        var tok = document.getElementById('adminCreateTeacherOk');
        if (tok) { tok.hidden = false; tok.textContent = (lang === 'ar' ? 'تم إنشاء حساب المعلم ' : 'Teacher account created for ') + tu.user.email + ' ✔'; }
        teacherForm.reset(); refreshCurrent();
      } catch (err) { toast((lang === 'ar' ? 'فشل إنشاء المعلم: ' : 'Teacher creation failed: ') + err.message, 'error'); }
      setBusy(tbtn, false);
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
        var cbtn = courseForm.querySelector('button[type="submit"]');
        setBusy(cbtn, true);
        try {
          var cc = await api.req('/api/courses', { method: 'POST', body: {
            title_en: courseForm.elements.title_en.value.trim(), title_ar: courseForm.elements.title_ar.value.trim() || null,
            slug: courseForm.elements.slug.value.trim(), level_id: courseForm.elements.level_id.value || null,
            duration_weeks: courseForm.elements.duration_weeks.value ? Number(courseForm.elements.duration_weeks.value) : null,
            teacher_id: courseForm.elements.teacher_id.value || null, is_published: courseForm.elements.is_published.checked } });
          toast(t('Course created: ', 'تم إنشاء الدورة ') + cc.course.title_en, 'success');
          var cok = document.getElementById('adminCreateCourseOk');
          if (cok) { cok.hidden = false; cok.textContent = (lang === 'ar' ? 'تم إنشاء الدورة ' : 'Course created: ') + cc.course.title_en + ' ✔'; }
          courseForm.reset(); refreshCurrent();
        } catch (err) { toast((lang === 'ar' ? 'فشل إنشاء الدورة: ' : 'Course creation failed: ') + err.message, 'error'); }
        setBusy(cbtn, false);
      });
    }
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var fbtn = form.querySelector('button[type="submit"]');
      setBusy(fbtn, true);
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
      setBusy(fbtn, false);
    });

  }

  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (err) { content.innerHTML = '<div class="dash-error"><p>' + h(t('Could not load your workspace.', 'تعذّر تحميل مساحة العمل.')) + '</p><p class="muted">' + h(err.message) + '</p></div>'; }); });
})();
