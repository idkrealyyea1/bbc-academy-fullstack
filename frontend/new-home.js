const languageToggle = document.querySelector('#language-toggle');
const nav = document.querySelector('#site-nav');
const menuToggle = document.querySelector('#menu-toggle');
const form = document.querySelector('#enrollment-form');
const successMessage = document.querySelector('#form-success');

let language = 'ar';

function setLanguage(nextLanguage) {
  language = nextLanguage;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.body.lang = language;
  languageToggle.textContent = language === 'ar' ? 'EN' : 'عربي';
  languageToggle.setAttribute('aria-label', language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  menuToggle.setAttribute('aria-label', language === 'ar' ? 'فتح القائمة' : 'Open navigation menu');
  document.querySelector('.course-list').setAttribute('aria-label', language === 'ar' ? 'البرامج التعليمية' : 'Learning programmes');

  document.querySelectorAll('[data-ar][data-en]').forEach((element) => {
    const translated = element.dataset[language];
    if (translated !== undefined) element.innerHTML = translated;
  });
  document.querySelectorAll('[data-alt-ar][data-alt-en]').forEach((image) => {
    image.alt = image.dataset[language === 'ar' ? 'altAr' : 'altEn'];
  });
  document.querySelectorAll('.course-more').forEach((button) => {
    button.setAttribute('aria-label', button.dataset[language === 'ar' ? 'labelAr' : 'labelEn']);
  });
  const courseExpand = document.querySelector('#course-expand');
  if (courseExpand) courseExpand.textContent = language === 'ar' ? 'استكشف جميع الدورات' : 'Explore all courses';

  document.querySelector('#name').placeholder = language === 'ar' ? 'الاسم الكامل' : 'Your full name';
  document.querySelector('#message').placeholder = language === 'ar' ? 'ما الذي تأمل أن تحققه؟' : 'What would you like to achieve?';
  document.querySelector('#phone').placeholder = '+966 5X XXX XXXX';
}

languageToggle.addEventListener('click', () => setLanguage(language === 'ar' ? 'en' : 'ar'));

menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen
    ? (language === 'ar' ? 'إغلاق القائمة' : 'Close navigation menu')
    : (language === 'ar' ? 'فتح القائمة' : 'Open navigation menu'));
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.focus();
  }
});

document.querySelectorAll('.course-more').forEach((button) => {
  button.addEventListener('click', () => {
    const row = button.closest('.course-row');
    const willOpen = !row.classList.contains('open');
    document.querySelectorAll('.course-row').forEach((item) => {
      item.classList.remove('open');
      item.querySelector('.course-more').setAttribute('aria-expanded', 'false');
    });
    if (willOpen) {
      row.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    }
  });
});


form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  successMessage.classList.add('visible');
  successMessage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
});

document.querySelector('#current-year').textContent = new Date().getFullYear();

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('in-view'));
}
