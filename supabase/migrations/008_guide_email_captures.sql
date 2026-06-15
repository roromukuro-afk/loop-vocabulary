-- メールキャプチャ（ガイドページ経由の見込み客）
CREATE TABLE IF NOT EXISTS guide_email_captures (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  guide_slug  text,
  created_at  timestamptz DEFAULT now()
);

-- 重複禁止（同じメールアドレスは1件のみ保存）
CREATE UNIQUE INDEX IF NOT EXISTS guide_email_captures_email_idx
  ON guide_email_captures (email);
