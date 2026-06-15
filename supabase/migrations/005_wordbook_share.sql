ALTER TABLE public.word_books
  ADD COLUMN IF NOT EXISTS share_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS word_books_share_code_idx ON public.word_books (share_code)
  WHERE share_code IS NOT NULL;
