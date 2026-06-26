-- ============================================================
-- Loop Vocabulary - RLS修正マイグレーション
-- Supabase SQL Editor でこのファイルの内容をそのまま実行してください
-- ============================================================

-- Fix 1: is_admin() に SECURITY DEFINER を追加
-- これがないと profiles の RLS ポリシーから is_admin() が呼ばれた際に
-- 再帰的に RLS が動いてスタックオーバーフローになる
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Fix 2: materials RLS ポリシーを更新
-- 'original' (Loop Vocabularyオリジナル教材) も一般ユーザーが閲覧できるようにする
DROP POLICY IF EXISTS "materials public read" ON public.materials;
CREATE POLICY "materials public read" ON public.materials
  FOR SELECT USING (is_public = true AND license_status IN ('approved', 'original'));

-- Fix 3: material_units RLS ポリシーを更新
DROP POLICY IF EXISTS "material_units public read" ON public.material_units;
CREATE POLICY "material_units public read" ON public.material_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_units.material_id
        AND m.is_public = true
        AND m.license_status IN ('approved', 'original')
    )
  );

-- Fix 4: material_words RLS ポリシーを更新
DROP POLICY IF EXISTS "material_words public read" ON public.material_words;
CREATE POLICY "material_words public read" ON public.material_words
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_words.material_id
        AND m.is_public = true
        AND m.license_status IN ('approved', 'original')
    )
  );

-- Fix 5: 既存の materials を全て 'approved' に更新
-- (今後は seed-vocab も 'approved' で投入するが、既存データを修正)
UPDATE public.materials
SET license_status = 'approved'
WHERE license_status IN ('original', 'pending')
  AND is_public = true;

-- 確認クエリ
SELECT id, title, license_status, is_public
FROM public.materials
ORDER BY id;
