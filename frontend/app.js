
const LANG_KEY='bbc-lang';
function getLang(){return localStorage.getItem(LANG_KEY)||'ar'}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
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
    const cards=byKey[key].map(c=>`<article class="card">${c.level?`<span class="tag">${esc(lang==='ar'?(lvlAr[c.level]||c.level):c.level)}</span>`:''}${c.custom?`<span class="tag">${lang==='ar'?'تجريبية':'Demo'}</span>`:''}<h3>${esc(lang==='ar'?c.ar:c.en)}</h3><p class="muted">${esc(lang==='ar'?c.desc_ar:c.desc_en)}</p><p><strong>${esc(c.weeks)}</strong> ${lang==='ar'?'أسابيع':'weeks'}${c.lessons ? ` · <strong>${esc(c.lessons)}</strong> ${lang==='ar'?'درس':'lessons'}` : ''}</p><p><a class="btn small" href="course.html?id=${encodeURIComponent(c.id)}">${lang==='ar'?'التفاصيل والتسجيل':'Details & enrol'}</a>${c.custom?` <button class="btn small outline" data-remove="${esc(c.id)}">${lang==='ar'?'إزالة':'Remove'}</button>`:''}</p></article>`).join('');
    return `<h2 class="course-section-title">${esc(title)}</h2><div class="grid grid3">${cards}</div>`;
  }).join('');
  grid.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!window.confirm(lang==='ar'?'إزالة هذه الدورة التجريبية؟':'Remove this demo course?')) return;
    const idx=COURSES.findIndex(c=>c.id===btn.dataset.remove);
    if(idx>=0) COURSES.splice(idx,1);
    saveCustomCourses(); renderCourses(window.__filter||'all', getLang());
  }));
}
function renderCourseDetail(lang){
  const params=new URLSearchParams(location.search); const id=params.get('id');
  const el=document.getElementById('courseDetail'); if(!el) return;
  const c=id ? COURSES.find(x=>x.id===id) : null;
  if(!c){
    el.innerHTML=`<h1>${lang==='ar'?'الدورة غير موجودة':'Course not found'}</h1><p class="muted">${lang==='ar'?'قد تكون الدورة غير منشورة أو أن الرابط قديم.':'The course may be unpublished, or the link is out of date.'}</p><p><a class="btn" href="courses.html">${lang==='ar'?'كل الدورات':'All courses'}</a></p>`;
    return;
  }
  const learn = lang==='ar' ? ['التحدث والاستماع','القراءة والكتابة','المفردات والقواعد','ممارسة واقعية'] : ['Speaking & listening','Reading & writing','Vocabulary & grammar','Real-life practice'];
  const lvlAr = {Beginner:'مبتدئ',Elementary:'ابتدائي',Intermediate:'متوسط',Advanced:'متقدم'}[c.level]||c.level;
  el.innerHTML=`${c.level?`<span class="tag">${esc(lang==='ar'?lvlAr:c.level)}</span>`:''}<h1>${esc(lang==='ar'?c.ar:c.en)}</h1><p class="muted">${esc(lang==='ar'?c.desc_ar:c.desc_en)}</p><p class="muted">${lang==='ar'?'القسم: ':'Section: '}${esc(sectionName(c,lang))}</p><p><strong>${esc(c.weeks)}</strong> ${lang==='ar'?'أسابيع':'weeks'}${c.lessons ? ` · <strong>${esc(c.lessons)}</strong> ${lang==='ar'?'درس':'lessons'}` : ''} · ${lang==='ar'?'الرسوم عند الاستفسار':'Fees on enquiry'}</p><div class="grid grid2"><div class="card"><h3>${lang==='ar'?'ماذا ستتعلم؟':'What you will learn'}</h3><ul>${learn.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="card"><h3>${lang==='ar'?'تفاصيل الدورة':'Course details'}</h3><p>${lang==='ar'?'مجموعات صغيرة وحصص تركّز على التحدث. تُؤكَّد المواعيد والمجموعة عند الحجز.':'Small groups and speaking-first lessons. Your schedule and group are confirmed when you book.'}</p><p><a class="btn" href="booking.html?course=${encodeURIComponent(c.id)}">${lang==='ar'?'احجز مقعدك':'Book your seat'}</a> <span id="enrolSlot"></span></p></div></div>`;
}
// Placement quiz: 20 questions, same order and answers as the API's
// PLACEMENT_ANSWERS in backend/src/server.js. Keep the two lists in sync.
const QUIZ=[
 {q_en:'She ___ a teacher.',q_ar:'هي ___ معلمة.',o:['are','is','am'],a:1},
 {q_en:'They ___ students.',q_ar:'هم ___ طلاب.',o:['are','is','am'],a:0},
 {q_en:'Past of “go” is ___.',q_ar:'الماضي من “go” هو ___.',o:['goed','went','gone'],a:1},
 {q_en:'“I have lived here ___ 2020.”',q_ar:'“I have lived here ___ 2020.”',o:['for','since','from'],a:1},
 {q_en:'Which is most formal?',q_ar:'أيها الأكثر رسمية؟',o:['Wanna come?','Could you please join us?','Come now!'],a:1},
 {q_en:'“Despite the rain, ___.”',q_ar:'“Despite the rain, ___.”',o:['we went out','we go yesterday','we are go'],a:0},
 {q_en:'Choose the correct sentence.',q_ar:'اختر الجملة الصحيحة.',o:['I am go to school.','I go to school.','I going school.'],a:1},
 {q_en:'There ___ some milk in the fridge.',q_ar:'يوجد ___ حليب في الثلاجة.',o:['are','is','be'],a:1},
 {q_en:'He ___ TV every evening.',q_ar:'هو ___ التلفاز كل مساء.',o:['watches','watch','watching'],a:0},
 {q_en:'If it rains, we ___ at home.',q_ar:'إذا أمطرت، سنبقى في المنزل.',o:['stayed','will stay','would stayed'],a:1},
 {q_en:'This book is ___ than that one.',q_ar:'هذا الكتاب ___ من ذاك.',o:['cheaper','cheap','cheapest'],a:0},
 {q_en:'I’m looking forward to ___ you.',q_ar:'أتطلع إلى ___ أنت.',o:['seeing','see','saw'],a:0},
 {q_en:'By the time we arrived, the film ___.',q_ar:'بحلول وصولنا، كان الفيلم ___.',o:['had started','starts','has start'],a:0},
 {q_en:'She suggested ___ a break.',q_ar:'اقترحت ___ استراحة.',o:['to take','take','taking'],a:2},
 {q_en:'The report ___ by the manager yesterday.',q_ar:'التقرير ___ من قبل المدير أمس.',o:['wrote','was written','is writing'],a:1},
 {q_en:'Hardly ___ the room when the phone rang.',q_ar:'Hardly ___ the room when the phone rang.',o:['I had entered','had I entered','I entered'],a:1},
 {q_en:'Choose the correct question.',q_ar:'اختر السؤال الصحيح.',o:['Where you are from?','Where are you from?','Where from you are?'],a:1},
 {q_en:'I’d rather you ___ smoke here.',q_ar:'أفضّل ألا ___ تدخّن هنا.',o:['didn’t','don’t','won’t'],a:0},
 {q_en:'The word “ubiquitous” means ___.',q_ar:'كلمة “ubiquitous” تعني ___.',o:['rare','everywhere','expensive'],a:1},
 {q_en:'Not only ___ late, but he also forgot the file.',q_ar:'Not only ___ late, but he also forgot the file.',o:['he was','was he','he is'],a:1},
];
let quizIdx=0, quizScore=0, quizAnswers=[];
function quizLevel(score,total){const r=score/total;if(r<0.25)return 'A1';if(r<0.45)return 'A2';if(r<0.65)return 'B1';if(r<0.85)return 'B2';if(r<0.95)return 'C1';return 'C2';}
function quizStart(){ quizIdx=0; quizScore=0; quizAnswers=[]; quizShow(); }
function quizShow(){
  const box=document.getElementById('quizBox'); if(!box) return;
  const lang=getLang();
  if(quizIdx>=QUIZ.length){
    const lvl=quizLevel(quizScore,QUIZ.length);
    box.innerHTML=`<div class="success"><h3>${lang==='ar'?'نتيجتك':'Your result'}</h3><p>${quizScore} / ${QUIZ.length} — <strong id="quizLevel">${lvl}</strong></p><p>${lang==='ar'?'استخدم هذه النتيجة كدليل لاختيار مستواك.':'Use this result as a guide to choose your level.'}</p><p><a class="btn" href="courses.html">${lang==='ar'?'تصفح الدورات':'Browse courses'}</a> <button class="btn outline" onclick="quizStart()">${lang==='ar'?'إعادة الاختبار':'Retake'}</button></p></div>`;
    if(window.BBC_API && window.BBC_API.base() && localStorage.getItem('bbc-token')){
      window.BBC_API.req('/api/placement-tests',{method:'POST',body:{answers:quizAnswers}})
        .then(d=>{ const saved=document.getElementById('quizLevel'); if(saved && d.result) saved.textContent=d.result.recommended_level; })
        .catch(()=>{ /* not saved; the on-screen result still stands */ });
    }
    return;
  }
  const q=QUIZ[quizIdx];
  box.innerHTML=`<p><strong>${lang==='ar'?'السؤال':'Question'} ${quizIdx+1} / ${QUIZ.length}</strong></p><h3>${lang==='ar'?q.q_ar:q.q_en}</h3>`+q.o.map((o,i)=>`<button class="quiz-opt" onclick="quizAnswer(${i})">${o}</button>`).join('');
}
function quizAnswer(i){ if(i===QUIZ[quizIdx].a) quizScore++; quizAnswers.push(i); quizIdx++; quizShow(); }

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
