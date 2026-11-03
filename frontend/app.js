
const LANG_KEY='bbc-lang';
function getLang(){return localStorage.getItem(LANG_KEY)||'en'}
function applyLang(lang){
  localStorage.setItem(LANG_KEY,lang);
  document.documentElement.lang=lang; document.documentElement.dir=(lang==='ar'?'rtl':'ltr');
  // HARDENING: never rewrite an element that contains form controls or child
  // elements. textContent replacement on such an element DESTROYS its children
  // (this once deleted every <input> inside form labels). Translatable text
  // must live in its own leaf <span data-en data-ar>; controls are siblings.
  document.querySelectorAll('[data-en]').forEach(el=>{
    if (el.querySelector('input,select,textarea')) return;
    if (el.children.length) return;
    el.textContent = lang==='ar' ? (el.dataset.ar||el.dataset.en) : el.dataset.en;
  });
  // Placeholders: <input data-ph-en="..." data-ph-ar="...">
  if (typeof window.__onLangChange==='function') window.__onLangChange(lang);
  document.querySelectorAll('[data-alt-en]').forEach(el=>{
    el.alt = lang==='ar' ? (el.dataset.altAr||el.dataset.altEn) : el.dataset.altEn;
  });
  document.querySelectorAll('[data-ph-en]').forEach(el=>{
    el.placeholder = lang==='ar' ? (el.dataset.phAr||el.dataset.phEn) : el.dataset.phEn;
  });
  const b=document.getElementById('langBtn'); if(b) b.textContent = lang==='ar' ? 'English' : 'العربية';
  if(typeof renderCourses==='function' && document.getElementById('courseGrid')) renderCourses(window.__filter||'all',lang);
  if(typeof renderCourseDetail==='function' && document.getElementById('courseDetail')) renderCourseDetail(lang);
}
document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('langBtn'); if(b) b.addEventListener('click',()=>applyLang(getLang()==='ar'?'en':'ar'));
  applyLang(getLang());
  // filters
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    window.__filter=btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('teal'));
    btn.classList.add('teal'); renderCourses(window.__filter,getLang());
  }));
  // generic mock forms
  document.querySelectorAll('form[data-mock]').forEach(f=>f.addEventListener('submit',e=>{
    e.preventDefault(); const out=document.getElementById(f.dataset.mock); if(out){ out.hidden=false; out.scrollIntoView({behavior:'smooth'}); }
  }));
});
// Courses mock data (DEMO names, NOT real academy staff/prices)
const COURSES=[
 {id:'general-a1',level:'Beginner',en:'General English A1',ar:'الإنجليزية العامة A1',desc_en:'Speak, listen, read and write with confidence from the very first lesson.',desc_ar:'تحدث واستمع واقرأ واكتب بثقة من الدرس الأول.',weeks:8,lessons:24},
 {id:'general-a2',level:'Elementary',en:'General English A2',ar:'الإنجليزية العامة A2',desc_en:'Build everyday vocabulary, grammar and conversation for daily life.',desc_ar:'بناء مفردات وقواعد ومحادثة يومية للحياة اليومية.',weeks:8,lessons:24},
 {id:'general-b1',level:'Intermediate',en:'General English B1',ar:'الإنجليزية العامة B1',desc_en:'Discuss opinions, tell stories and handle travel and work situations.',desc_ar:'ناقش الآراء واحكِ القصص وتعامل مع مواقف السفر والعمل.',weeks:10,lessons:30},
 {id:'general-b2',level:'Intermediate',en:'General English B2',ar:'الإنجليزية العامة B2',desc_en:'Debate, present and write clearly for study and professional use.',desc_ar:'ناقش وقدّم واكتب بوضوح للدراسة والاستخدام المهني.',weeks:10,lessons:30},
 {id:'ielts',level:'Advanced',en:'IELTS Preparation',ar:'التحضير لاختبار IELTS',desc_en:'Exam strategies, timed practice and feedback on all four skills.',desc_ar:'استراتيجيات الامتحان وتدريب موقوت وملاحظات على المهارات الأربع.',weeks:6,lessons:18},
 {id:'kids',level:'Beginner',en:'English for Young Learners',ar:'الإنجليزية للصغار',desc_en:'Playful, speaking-first classes for children and teenagers.',desc_ar:'حصص ممتعة تركّز على التحدث للأطفال والمراهقين.',weeks:8,lessons:24},
 {id:'business',level:'Advanced',en:'Business English',ar:'إنجليزية الأعمال',desc_en:'Meetings, emails, presentations and interviews in professional English.',desc_ar:'اجتماعات ورسائل وعروض ومقابلات بالإنجليزية المهنية.',weeks:8,lessons:24},
 {id:'conversation',level:'Elementary',en:'Conversation Club',ar:'نادي المحادثة',desc_en:'Weekly speaking practice on real-life topics, in small groups.',desc_ar:'تدريب أسبوعي على التحدث حول مواضيع واقعية في مجموعات صغيرة.',weeks:4,lessons:8},
];
// Course sections: a course always lives in a section. Built-in sections have
// EN/AR names; a custom section keeps the name its creator typed.
const SECTIONS={
 general:{en:'General English',ar:'الإنجليزية العامة'},
 ielts:{en:'IELTS Preparation',ar:'التحضير لاختبار IELTS'},
 business:{en:'Business English',ar:'إنجليزية الأعمال'},
 conversation:{en:'Conversation Club',ar:'نادي المحادثة'},
 kids:{en:'English for Young Learners',ar:'الإنجليزية للصغار'}
};
function sectionOf(c){ if(c.sectionName) return {en:c.sectionName,ar:c.sectionName}; const sec=SECTIONS[c.section]; return sec ? sec : {en:c.section||'',ar:c.section||''}; }
function sectionName(c,lang){ const sec=sectionOf(c); return lang==='ar'?sec.ar:sec.en; }
COURSES.forEach(c=>{ if(!c.section){ if(c.id.indexOf('general')===0) c.section='general'; else if(c.id==='ielts') c.section='ielts'; else if(c.id==='business') c.section='business'; else if(c.id==='conversation') c.section='conversation'; else if(c.id==='kids') c.section='kids'; } });
// Demo-added courses, saved in this browser only (static demo, no backend yet).
try{ const saved=JSON.parse(localStorage.getItem('bbc-custom-courses')||'[]'); saved.forEach(c=>{ c.custom=true; COURSES.push(c); }); }catch(e){}
function saveCustomCourses(){ try{ localStorage.setItem('bbc-custom-courses', JSON.stringify(COURSES.filter(c=>c.custom))); }catch(e){} }
function populateSectionSelect(){
  const sel=document.getElementById('courseSection'); if(!sel) return;
  const lang=getLang(); const seen={}; let html='';
  Object.keys(SECTIONS).forEach(k=>{ html+=`<option value="${k}" data-en="${SECTIONS[k].en}" data-ar="${SECTIONS[k].ar}">${lang==='ar'?SECTIONS[k].ar:SECTIONS[k].en}</option>`; });
  COURSES.filter(c=>c.custom && c.sectionName && !seen[c.sectionName]).forEach(c=>{ seen[c.sectionName]=1; html+=`<option value="custom:${c.sectionName}" data-en="${c.sectionName}" data-ar="${c.sectionName}">${c.sectionName}</option>`; });
  html+=`<option value="__new" data-en="Create a new section…" data-ar="إنشاء قسم جديد…">${lang==='ar'?'إنشاء قسم جديد…':'Create a new section…'}</option>`;
  sel.innerHTML=html;
  const wrap=document.getElementById('newSectionWrap'); if(wrap) wrap.hidden = sel.value!=='__new';
}
window.__onLangChange=function(){ populateSectionSelect(); };
function renderCourses(filter,lang){
  const grid=document.getElementById('courseGrid'); if(!grid) return;
  const list=COURSES.filter(c=>filter==='all'||c.level===filter);
  if(!list.length){ grid.innerHTML=`<p class="muted">${lang==='ar'?'لا توجد دورات في هذا المستوى.':'No courses in this level.'}</p>`; return; }
  const lvlAr={Beginner:'مبتدئ',Elementary:'ابتدائي',Intermediate:'متوسط',Advanced:'متقدم'};
  const groups=[]; const byKey={};
  list.forEach(c=>{ const key=c.sectionName?('custom:'+c.sectionName):('built:'+(c.section||'')); if(!byKey[key]){ byKey[key]=[]; groups.push(key); } byKey[key].push(c); });
  grid.innerHTML=groups.map(key=>{
    const first=byKey[key][0];
    const title=sectionName(first,lang);
    const cards=byKey[key].map(c=>`<article class="card"><span class="tag">${lang==='ar'?(lvlAr[c.level]||c.level):c.level}</span>${c.custom?`<span class="tag">${lang==='ar'?'تجريبية':'Demo'}</span>`:''}<h3>${lang==='ar'?c.ar:c.en}</h3><p class="muted">${lang==='ar'?c.desc_ar:c.desc_en}</p><p><strong>${c.weeks}</strong> ${lang==='ar'?'أسابيع':'weeks'}${c.lessons ? ` · <strong>${c.lessons}</strong> ${lang==='ar'?'درس':'lessons'}` : ''}</p><p><a class="btn small" href="course.html?id=${c.id}">${lang==='ar'?'التفاصيل والتسجيل':'Details & enrol'}</a>${c.custom?` <button class="btn small outline" data-remove="${c.id}">${lang==='ar'?'إزالة':'Remove'}</button>`:''}</p></article>`).join('');
    return `<h2 class="course-section-title">${title}</h2><div class="grid grid3">${cards}</div>`;
  }).join('');
  grid.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!window.confirm(lang==='ar'?'إزالة هذه الدورة التجريبية؟':'Remove this demo course?')) return;
    const idx=COURSES.findIndex(c=>c.id===btn.dataset.remove);
    if(idx>=0) COURSES.splice(idx,1);
    saveCustomCourses(); renderCourses(window.__filter||'all', getLang());
  }));
}
function renderCourseDetail(lang){
  const params=new URLSearchParams(location.search); const c=COURSES.find(x=>x.id===params.get('id'))||COURSES[0];
  const el=document.getElementById('courseDetail'); if(!el) return;
  const learn = lang==='ar' ? ['التحدث والاستماع','القراءة والكتابة','المفردات والقواعد','ممارسة واقعية'] : ['Speaking & listening','Reading & writing','Vocabulary & grammar','Real-life practice'];
  const lvlAr = {Beginner:'مبتدئ',Elementary:'ابتدائي',Intermediate:'متوسط',Advanced:'متقدم'}[c.level]||c.level;
  el.innerHTML=`<span class="tag">${lang==='ar'?lvlAr:c.level}</span><h1>${lang==='ar'?c.ar:c.en}</h1><p class="muted">${lang==='ar'?c.desc_ar:c.desc_en}</p><p class="muted">${lang==='ar'?'القسم: ':'Section: '}${sectionName(c,lang)}</p><p><strong>${c.weeks}</strong> ${lang==='ar'?'أسابيع':'weeks'} · <strong>${c.lessons}</strong> ${lang==='ar'?'درس':'lessons'} · ${lang==='ar'?'الرسوم عند الاستفسار':'Fees on enquiry'}</p><div class="grid grid2"><div class="card"><h3>${lang==='ar'?'ماذا ستتعلم؟':'What you will learn'}</h3><ul>${learn.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="card"><h3>${lang==='ar'?'تفاصيل الدورة':'Course details'}</h3><p>${lang==='ar'?'مجموعات صغيرة وحصص تركّز على التحدث. تُؤكَّد المواعيد والمجموعة عند الحجز.':'Small groups and speaking-first lessons. Your schedule and group are confirmed when you book.'}</p><p><a class="btn" href="booking.html">${lang==='ar'?'احجز مقعدك':'Book your seat'}</a></p></div></div>`;
}
// Placement quiz (mock, 6 questions)
const QUIZ=[
 {q_en:'Choose the correct sentence.',q_ar:'اختر الجملة الصحيحة.',o:['I am go to school.','I go to school.','I going school.'],a:1},
 {q_en:'She ___ a teacher.',q_ar:'هي ___ معلمة.',o:['is','are','am'],a:0},
 {q_en:'Past of “go” is ___.',q_ar:'الماضي من “go” هو ___.',o:['goed','went','gone to'],a:1},
 {q_en:'“I have lived here ___ 2020.”',q_ar:'“I have lived here ___ 2020.”',o:['for','since','from'],a:1},
 {q_en:'Which is most formal?',q_ar:'أيها الأكثر رسمية؟',o:['Wanna come?','Could you please join us?','Come now!'],a:1},
 {q_en:'“Despite the rain, ___.”',q_ar:'“Despite the rain, ___.”',o:['we went out','we go yesterday','we are go'],a:0},
];
let quizIdx=0, quizScore=0;
function quizStart(){ quizIdx=0; quizScore=0; quizShow(); }
function quizShow(){
  const box=document.getElementById('quizBox'); if(!box) return;
  const lang=getLang();
  if(quizIdx>=QUIZ.length){
    const lvl=quizScore<=2?'Beginner (A1–A2)':quizScore<=4?'Intermediate (B1)':'Advanced (B2+)';
    box.innerHTML=`<div class="success"><h3>${lang==='ar'?'نتيجتك':'Your result'}</h3><p>${quizScore} / ${QUIZ.length} — <strong>${lvl}</strong></p><p>${lang==='ar'?'استخدم هذه النتيجة كدليل لاختيار مستواك.':'Use this result as a guide to choose your level.'}</p><p><a class="btn" href="courses.html">${lang==='ar'?'تصفح الدورات':'Browse courses'}</a> <button class="btn outline" onclick="quizStart()">${lang==='ar'?'إعادة الاختبار':'Retake'}</button></p></div>`; return;
  }
  const q=QUIZ[quizIdx];
  box.innerHTML=`<p><strong>${lang==='ar'?'السؤال':'Question'} ${quizIdx+1} / ${QUIZ.length}</strong></p><h3>${lang==='ar'?q.q_ar:q.q_en}</h3>`+q.o.map((o,i)=>`<button class="quiz-opt" onclick="quizAnswer(${i})">${o}</button>`).join('');
}
function quizAnswer(i){ if(i===QUIZ[quizIdx].a) quizScore++; quizIdx++; quizShow(); }

// Hamburger navigation (mobile): toggle panel, close on link click.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('menuBtn');
  const nav = document.getElementById('mainNav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }));
});

// Subtle scroll reveal (ui-ux-pro-max: 8-16px, 350ms). Content stays visible
// without JS: the .reveal hidden state only applies when this class is set.
document.addEventListener('DOMContentLoaded', () => {
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});

// Add a course: choose an existing section, or create a new one, and the
// course goes into that section. Demo only: saved in this browser.
document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('addCourseForm'); if(!form) return;
  populateSectionSelect();
  const sel=document.getElementById('courseSection');
  sel.addEventListener('change',()=>{ const wrap=document.getElementById('newSectionWrap'); if(wrap) wrap.hidden = sel.value!=='__new'; });
  form.addEventListener('submit',e=>{
    e.preventDefault(); const lang=getLang();
    const name=document.getElementById('courseName').value.trim();
    const weeks=parseInt(document.getElementById('courseWeeks').value,10);
    const lessons=parseInt(document.getElementById('courseLessons').value,10);
    if(!name || !weeks || !lessons){ alert(lang==='ar'?'املأ اسم الدورة وعدد الأسابيع والدروس.':'Please fill in the course name, weeks and lessons.'); return; }
    let sectionNameVal='', sectionKey='';
    if(sel.value==='__new'){
      sectionNameVal=document.getElementById('courseSectionNew').value.trim();
      if(!sectionNameVal){ alert(lang==='ar'?'اكتب اسم القسم الجديد.':'Please type the new section name.'); return; }
    } else if(sel.value.indexOf('custom:')===0){ sectionNameVal=sel.value.slice(7); }
    else { sectionKey=sel.value; }
    const course={ id:'custom-'+Date.now(), en:name, ar:name,
      desc_en:document.getElementById('courseDesc').value.trim()||'A new course added in the demo.',
      desc_ar:document.getElementById('courseDesc').value.trim()||'دورة جديدة أُضيفت في العرض التجريبي.',
      level:document.getElementById('courseLevel').value, weeks:weeks, lessons:lessons, custom:true };
    if(sectionNameVal) course.sectionName=sectionNameVal; else course.section=sectionKey;
    COURSES.push(course); saveCustomCourses(); populateSectionSelect();
    renderCourses(window.__filter||'all', lang);
    const ok=document.getElementById('addCourseOk'); if(ok){ ok.hidden=false; ok.textContent = lang==='ar' ? ('تمت إضافة "'+name+'" إلى قسم '+sectionName(course,lang)+' ✔') : ('"'+name+'" was added to the '+sectionName(course,lang)+' section ✔'); }
    form.reset(); populateSectionSelect();
    document.getElementById('courseGrid').scrollIntoView({behavior:'smooth'});
  });
});
