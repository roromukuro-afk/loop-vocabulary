-- Issue #81:
-- 単語帳共有機能(share_code/is_shared)のschema列を明示的に追加する。
--
-- 旧005_wordbook_share.sqlは本番へ未適用のまま履歴資料として残し、
-- 直接編集しない。ただしCI・`supabase db reset`・新規Supabaseプロジェクトの
-- 立ち上げ等でmigrationがゼロから再生される場合、005がこのmigrationより
-- 先に実行され、share_code/is_shared(および同名のunique制約
-- word_books_share_code_key)が既に作成された状態でこのmigrationが実行
-- される。この「フレッシュ再生」シナリオはword_booksが0行(実データが
-- 存在しない)であることで判別でき、005の列定義(share_code text UNIQUE・
-- is_shared boolean NOT NULL DEFAULT false)がこのmigrationの要求する契約と
-- 一致するため、追加のDDLなしで安全にスキップできる。
--
-- 一方、両列のいずれかが既に存在し、かつword_booksに1行以上の実データが
-- ある場合(本番相当・legacy drift)は、そのschemaが一見互換に見えても
-- 自動修復・自動受理はせず、個別監査が必要である旨を明示するRAISE
-- EXCEPTIONで中断する(型・nullable・default等をこの場で推測・受理しない)。
-- 本番は読み取り専用確認により、share_code/is_sharedのいずれも不存在で
-- あることを確認済み。
do $$
declare
  columns_exist boolean;
  has_existing_rows boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name in ('share_code', 'is_shared')
  ) into columns_exist;

  if not columns_exist then
    alter table public.word_books
      add column share_code text,
      add column is_shared boolean not null default false;

    create unique index word_books_share_code_key
      on public.word_books (share_code)
      where share_code is not null;
    return;
  end if;

  select exists (select 1 from public.word_books limit 1) into has_existing_rows;

  if has_existing_rows then
    raise exception using
      errcode = '55000',
      message = 'wordbook sharing columns already exist with data; audit legacy schema and data before applying this migration';
  end if;

  -- 列は既に存在するがword_booksは0行(フレッシュ再生シナリオ、005が
  -- 先に実行済み)。005の列定義が既にこのmigrationの契約と一致するため、
  -- 追加のDDLは不要。
end
$$;
