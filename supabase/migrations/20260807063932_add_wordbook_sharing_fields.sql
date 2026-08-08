-- Issue #81:
-- 単語帳共有機能(share_code/is_shared)のschema列を明示的に追加する。
--
-- 旧005_wordbook_share.sqlは本番へ未適用のまま履歴資料として残し、
-- 直接編集しない。
--
-- fail-closed: このmigrationが自動適用するのは、share_code/is_sharedの
-- 両方が不存在の環境だけに限定する。どちらか一方でも既に存在する場合、
-- そのschemaが一見互換に見えても自動修復・自動受理はせず、個別監査が
-- 必要である旨を明示するRAISE EXCEPTIONで中断する(型・nullable・default・
-- generated column・既存unique indexの互換性等をこの場で推測・受理しない)。
-- 本番は読み取り専用確認により、share_code/is_sharedのいずれも不存在で
-- あることを確認済み。
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name in ('share_code', 'is_shared')
  ) then
    raise exception using
      errcode = '55000',
      message = 'wordbook sharing columns already exist; audit legacy schema and data before applying this migration';
  end if;

  alter table public.word_books
    add column share_code text,
    add column is_shared boolean not null default false;

  create unique index word_books_share_code_key
    on public.word_books (share_code)
    where share_code is not null;
end
$$;
