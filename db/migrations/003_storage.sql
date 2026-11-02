-- 003_storage.sql — Storage buckets (optional). Run in Supabase SQL Editor.
-- Avatars: public read, authenticated upload. Materials: private-ish
-- (authenticated read) — tighten further once real class rosters exist.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS avatars_upload ON storage.objects;
CREATE POLICY avatars_upload ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS materials_read ON storage.objects;
CREATE POLICY materials_read ON storage.objects FOR SELECT USING (bucket_id = 'materials' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS materials_upload ON storage.objects;
CREATE POLICY materials_upload ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials' AND auth.role() = 'authenticated');
