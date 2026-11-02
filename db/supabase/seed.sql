-- seed.sql — DEMO DATA ONLY. Prices are NULL (TODO for the owner).
-- Teacher rows are DEMO placeholders, not real staff. Replace before launch.
-- Safe to re-run: inserts use ON CONFLICT DO NOTHING where a unique key exists.
INSERT INTO levels (code, name_en, name_ar, order_no, description_en, description_ar) VALUES
  ('A1', 'Beginner', 'مبتدئ', 1, 'First steps: greetings, everyday words, simple sentences.', 'خطوات أولى: تحيات وكلمات يومية وجمل بسيطة.'),
  ('A2', 'Elementary', 'ابتدائي', 2, 'Everyday conversation, routine topics, short messages.', 'محادثة يومية ومواضيع روتينية ورسائل قصيرة.'),
  ('B1', 'Intermediate', 'متوسط', 3, 'Opinions, stories, travel and work situations.', 'آراء وقصص ومواقف سفر وعمل.'),
  ('B2', 'Upper Intermediate', 'فوق المتوسط', 4, 'Debate, presentations, clear writing for study and work.', 'نقاش وعروض وكتابة واضحة للدراسة والعمل.'),
  ('C1', 'Advanced', 'متقدم', 5, 'Fluent, flexible English for academic and professional use.', 'إنجليزية طليقة ومرنة للاستخدام الأكاديمي والمهني.'),
  ('C2', 'Proficiency', 'إتقان', 6, 'Near-native precision across complex topics.', 'دقة قريبة من الناطقين الأصليين في مواضيع معقدة.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO profiles (email, full_name, password_hash, role) VALUES
  ('teacher@demo.local', 'Demo Teacher (DEMO — not real staff)', 'DEMO_HASH_REPLACE_WITH_BCRYPT', 'teacher'),
  ('admin@demo.local', 'Demo Admin (DEMO)', 'DEMO_HASH_REPLACE_WITH_BCRYPT', 'admin'),
  ('student@demo.local', 'Demo Student (DEMO)', 'DEMO_HASH_REPLACE_WITH_BCRYPT', 'student')
ON CONFLICT (email) DO NOTHING;
-- NOTE: the three rows above carry a placeholder hash on purpose. For a real
-- Supabase project, create users via Supabase Auth or the backend's
-- /api/auth/register (which bcrypt-hashes passwords) instead of using these
-- rows to log in. The backend seeds working demo accounts itself at boot
-- when SEED_DEMO=true (see backend/src/db.js).

INSERT INTO courses (slug, level_id, title_en, title_ar, description_en, description_ar, duration_weeks, price_amount, price_currency, is_published)
SELECT c.slug, l.id, c.title_en, c.title_ar, c.description_en, c.description_ar, c.duration_weeks, NULL, 'ILS', TRUE
FROM (VALUES
  ('general-a1', 'A1', 'General English A1', 'الإنجليزية العامة A1', 'Speak, listen, read and write with confidence from the first lesson.', 'تحدث واستمع واقرأ واكتب بثقة من الدرس الأول.', 8),
  ('general-a2', 'A2', 'General English A2', 'الإنجليزية العامة A2', 'Everyday vocabulary, grammar and conversation for daily life.', 'مفردات وقواعد ومحادثة يومية للحياة اليومية.', 8),
  ('general-b1', 'B1', 'General English B1', 'الإنجليزية العامة B1', 'Discuss opinions, tell stories and handle travel and work situations.', 'ناقش الآراء واحكِ القصص وتعامل مع مواقف السفر والعمل.', 10),
  ('general-b2', 'B2', 'General English B2', 'الإنجليزية العامة B2', 'Debate, present and write clearly for study and professional use.', 'ناقش وقدّم واكتب بوضوح للدراسة والاستخدام المهني.', 10),
  ('ielts-prep', 'B2', 'IELTS Preparation (Demo)', 'التحضير لاختبار IELTS (تجريبي)', 'Exam strategies, timed practice and feedback on all four skills.', 'استراتيجيات الامتحان وتدريب موقوت وملاحظات على المهارات الأربع.', 6),
  ('conversation-club', 'A2', 'Conversation Club', 'نادي المحادثة', 'Weekly speaking practice on real-life topics, in small groups.', 'تدريب أسبوعي على التحدث حول مواضيع واقعية في مجموعات صغيرة.', 4)
) AS c(slug, level_code, title_en, title_ar, description_en, description_ar, duration_weeks)
JOIN levels l ON l.code = c.level_code
ON CONFLICT (slug) DO NOTHING;

INSERT INTO lessons (course_id, title_en, title_ar, order_no)
SELECT id, 'Welcome & Speaking First', 'ترحيب والتحدث أولًا', 1 FROM courses WHERE slug = 'general-b1'
UNION ALL SELECT id, 'Everyday Conversation', 'محادثة يومية', 2 FROM courses WHERE slug = 'general-b1'
UNION ALL SELECT id, 'Welcome & Speaking First', 'ترحيب والتحدث أولًا', 1 FROM courses WHERE slug = 'general-a1';

INSERT INTO placement_tests (title, total_questions) VALUES ('Placement Test', 20);
INSERT INTO announcements (title, body, audience) VALUES
  ('Welcome to BBC English Academy (Demo)', 'Demo announcement — replace with a real academy announcement before launch.', 'all');
