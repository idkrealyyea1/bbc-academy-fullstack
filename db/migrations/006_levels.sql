-- 006_levels.sql — the six CEFR levels as reference data.
--
-- Why this exists: `levels` is the only table the app expects to be pre-filled,
-- because a course must be filed under a level and the "add course" form matches
-- on `name_en`. With an empty table every new course lands on level_id NULL and
-- is displayed as "Beginner", and the public level filters match nothing.
--
-- These are CEFR reference names, NOT demo content: no prices, no staff, no
-- claims about the academy. Safe to run on production. Idempotent, so running it
-- twice is a no-op update.
--
-- name_en must stay identical to the `data-en` values of the level <select> in
-- frontend/courses.html and the filter buttons on the same page.

INSERT INTO levels (code, name_en, name_ar, order_no, description_en, description_ar) VALUES
  ('A1', 'Beginner',         'مبتدئ',          1, 'First words: greetings, introductions and simple questions.', 'البداية: التحيات والتعريف بالنفس والأسئلة البسيطة.'),
  ('A2', 'Elementary',       'ابتدائي',        2, 'Everyday situations: shopping, travel, routines and past events.', 'مواقف الحياة اليومية: التسوق والسفر والروتين وأحداث الماضي.'),
  ('B1', 'Intermediate',     'متوسط',          3, 'Opinions, stories and handling most situations while travelling or working.', 'إبداء الرأي وسرد القصص والتعامل مع معظم مواقف السفر والعمل.'),
  ('B2', 'Upper intermediate', 'فوق المتوسط',  4, 'Fluent discussion, clear writing and understanding complex texts.', 'نقاش بطلاقة وكتابة واضحة وفهم النصوص المعقدة.'),
  ('C1', 'Advanced',         'متقدم',          5, 'Flexible, effective language for study and professional work.', 'لغة مرنة وفعّالة للدراسة والعمل المهني.'),
  ('C2', 'Proficiency',      'إتقان',          6, 'Near-native comprehension and precision in demanding contexts.', 'فهم ودقة قريبان من اللغة الأم في السياقات الصعبة.')
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  order_no = EXCLUDED.order_no,
  description_en = EXCLUDED.description_en,
  description_ar = EXCLUDED.description_ar;
