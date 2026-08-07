-- Issue #81:
-- 単語帳共有機能(share_code/is_shared)のschema列を明示的に追加する。
--
-- 旧005_wordbook_share.sqlは本番へ未適用のまま履歴資料として残し、
-- 直接編集しない。
--
-- 部分的なschema driftにもfail-closedで対応する: share_code/is_sharedの
-- いずれかが既に存在する環境では、その列の型・制約が期待どおりかを検査し、
-- 一致しない場合は既存データを一切変更せずRAISE EXCEPTIONで中断する。
-- 既存値の意味が不明なschemaを黙って上書き・変更しない
-- (nullable→NOT NULL化しない、DEFAULT true→falseへ変更しない、
-- NULL値をUPDATEで埋めない)。
do $$
declare
  share_code_exists boolean;
  share_code_type text;
  is_shared_exists boolean;
  is_shared_type text;
  is_shared_nullable text;
  is_shared_default text;
  has_unique_on_share_code boolean;
begin
  -- --- share_code: text であること以外は問わない ---
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'share_code'
  ) into share_code_exists;

  if share_code_exists then
    select data_type into share_code_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'share_code';

    if share_code_type <> 'text' then
      raise exception using
        errcode = '55000',
        message = format(
          'word_books.share_code already exists with unexpected type %s (expected text); audit before applying this migration',
          share_code_type
        );
    end if;
  else
    execute 'alter table public.word_books add column share_code text';
  end if;

  -- --- is_shared: boolean・NOT NULL・DEFAULT falseの契約を厳密に検査 ---
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'is_shared'
  ) into is_shared_exists;

  if is_shared_exists then
    select data_type, is_nullable, column_default
    into is_shared_type, is_shared_nullable, is_shared_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'is_shared';

    if is_shared_type <> 'boolean'
       or is_shared_nullable <> 'NO'
       or is_shared_default is distinct from 'false' then
      raise exception using
        errcode = '55000',
        message = format(
          'word_books.is_shared already exists with unexpected contract (type=%s, nullable=%s, default=%s; expected boolean NOT NULL DEFAULT false); audit before applying this migration',
          is_shared_type, is_shared_nullable, coalesce(is_shared_default, 'null')
        );
    end if;
  else
    execute 'alter table public.word_books add column is_shared boolean not null default false';
  end if;

  -- --- share_codeのunique enforcement: share_code単独のunique index/constraintが
  -- 既に存在する場合は冗長な2本目を作らない。存在しない場合のみ1本作成する。
  -- share_codeを含む複合unique index(例: (share_code, user_id))は
  -- share_code自体の一意性を保証しないため、既存とはみなさない
  -- (array_length(i.indkey, 1) = 1で単一列のindexのみを対象とする)。
  -- さらに、predicateが無い(全行対象)か、このmigrationが作成するものと同じ
  -- `share_code IS NOT NULL`と同値である場合のみ「既存とみなす」。
  -- 例えば`WHERE source_type = 'material'`のような弱いpredicateを持つ
  -- 既存unique indexは、対象外の行同士でのshare_code重複を防げないため、
  -- 既存とはみなさず新規にindexを作成する。
  -- 既存の重複share_codeがある場合、このCREATE UNIQUE INDEX自体が失敗する
  -- ため、データを勝手に修正することはしない(失敗時は既存データへの変更
  -- なくmigrationが中断されるだけ)。
  -- indisvalidも検査する: CREATE UNIQUE INDEX CONCURRENTLYが途中で失敗した
  -- 場合など、indisunique=trueのままindisvalid=falseのindexが残ることがある。
  -- このようなindexはbuild時に全行を検証しきれていない可能性があり、既存の
  -- 重複を見逃したまま「既存の有効なunique」とみなしてしまうため対象外とする。 ---
  select exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
    where n.nspname = 'public'
      and c.relname = 'word_books'
      and a.attname = 'share_code'
      and i.indisunique
      and i.indisvalid
      and array_length(i.indkey, 1) = 1
      and (
        i.indpred is null
        or lower(regexp_replace(pg_get_expr(i.indpred, i.indrelid), '[\s()]', '', 'g')) = 'share_codeisnotnull'
      )
  ) into has_unique_on_share_code;

  if not has_unique_on_share_code then
    execute
      'create unique index word_books_share_code_key '
      'on public.word_books (share_code) '
      'where share_code is not null';
  end if;
end
$$;
