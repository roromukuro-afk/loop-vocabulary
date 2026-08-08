-- Issue #81:
-- 単語帳共有機能(share_code/is_shared)のschema列を明示的に追加する。
--
-- 旧005_wordbook_share.sqlは本番へ未適用のまま履歴資料として残し、
-- 直接編集しない。
--
-- 3分岐のfail-closed設計:
--
-- A. share_code/is_sharedの両方が不存在 → 通常の新規適用(ALTER TABLE +
--    partial unique index作成)。
-- B. word_booksに1行以上の実データがある → schema・列の存在状況に関わらず
--    RAISE EXCEPTION(自動修復・自動受理しない)。本番は読み取り専用確認に
--    より両列とも不存在であることを確認済みのため、本番適用ではこの分岐を
--    通らない。
-- C. word_booksが0行、かつ列が既に存在する → CI・`supabase db reset`・
--    新規Supabaseプロジェクトの立ち上げ等で旧005がこのmigrationより先に
--    実行された「フレッシュ再生」の可能性がある。ただし0行だからといって
--    無条件に互換とはみなさない: 旧005が実際に作成する既知のsignature
--    (share_code text・nullable・default無し / is_shared boolean・
--    NOT NULL・DEFAULT false / 単一列UNIQUE制約
--    word_books_share_code_key(NULLS NOT DISTINCTではない)/ 冗長な
--    partial index word_books_share_code_idx / share_code・is_sharedを
--    参照する追加CHECK constraintが存在しないこと)を隅々まで厳密一致で
--    検証し、1箇所でも一致しなければRAISE EXCEPTIONで中断する(部分的な
--    列存在・型不一致・generated column・UNIQUE制約欠如・NULLS NOT
--    DISTINCT・共有列を対象にした想定外のCHECK制約等のmalformed/partial
--    schemaを「0行だから安全」と誤ってbypassしない)。ここで検証するのは
--    「あらゆる互換schema」ではなく、旧005という既知・固定のmigrationが
--    実際に作る一意のsignatureだけである。一致した場合のみ、追加DDL不要
--    でno-op成功する。
do $$
declare
  share_code_exists boolean;
  is_shared_exists boolean;
  has_existing_rows boolean;
  share_code_type text;
  share_code_nullable text;
  share_code_default text;
  share_code_is_generated text;
  is_shared_type text;
  is_shared_nullable text;
  is_shared_default text;
  is_shared_default_normalized text;
  is_shared_is_generated text;
  legacy_unique_ok boolean;
  legacy_partial_index_ok boolean;
  legacy_check_constraints_absent boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'share_code'
  ) into share_code_exists;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'is_shared'
  ) into is_shared_exists;

  -- --- A: 両方とも不存在。通常の新規適用。 ---
  if not share_code_exists and not is_shared_exists then
    alter table public.word_books
      add column share_code text,
      add column is_shared boolean not null default false;

    create unique index word_books_share_code_key
      on public.word_books (share_code)
      where share_code is not null;
    return;
  end if;

  -- --- 少なくとも1列は既に存在する。B/Cの分岐にはword_booksの行数が必要。 ---
  select exists (select 1 from public.word_books limit 1) into has_existing_rows;

  -- --- B: 実データがある。schema詳細を問わずfail-closedで中断する。 ---
  if has_existing_rows then
    raise exception using
      errcode = '55000',
      message = 'wordbook sharing columns already exist with data; audit legacy schema and data before applying this migration';
  end if;

  -- --- C: 0行。旧005の既知signatureと厳密一致する場合のみno-opでbypassする。 ---

  -- 片方だけ存在する場合(malformed/partial)は即座にabortする。
  if not share_code_exists or not is_shared_exists then
    raise exception using
      errcode = '55000',
      message = 'wordbook sharing columns partially exist on an empty word_books table (only one of share_code/is_shared); audit before applying this migration';
  end if;

  -- share_code: 旧005の`text UNIQUE`と一致する契約(text・nullable・
  -- DEFAULT無し・非generated)を厳密に検査する。
  select data_type, is_nullable, column_default, is_generated
  into share_code_type, share_code_nullable, share_code_default, share_code_is_generated
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'word_books'
    and column_name = 'share_code';

  if share_code_type <> 'text'
     or share_code_nullable <> 'YES'
     or share_code_default is not null
     or share_code_is_generated <> 'NEVER' then
    raise exception using
      errcode = '55000',
      message = format(
        'word_books.share_code exists on an empty table but does not match the expected legacy signature (type=%s, nullable=%s, default=%s, generated=%s); audit before applying this migration',
        share_code_type, share_code_nullable, coalesce(share_code_default, 'null'), share_code_is_generated
      );
  end if;

  -- is_shared: 旧005の`boolean NOT NULL DEFAULT false`と一致する契約を
  -- 厳密に検査する。column_defaultの表記差異(false / false::boolean等)は
  -- 正規化してから比較する。
  select data_type, is_nullable, column_default, is_generated
  into is_shared_type, is_shared_nullable, is_shared_default, is_shared_is_generated
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'word_books'
    and column_name = 'is_shared';

  is_shared_default_normalized := lower(regexp_replace(trim(coalesce(is_shared_default, '')), '::\s*boolean\s*$', ''));

  if is_shared_type <> 'boolean'
     or is_shared_nullable <> 'NO'
     or is_shared_default_normalized <> 'false'
     or is_shared_is_generated <> 'NEVER' then
    raise exception using
      errcode = '55000',
      message = format(
        'word_books.is_shared exists on an empty table but does not match the expected legacy signature (type=%s, nullable=%s, default=%s, generated=%s); audit before applying this migration',
        is_shared_type, is_shared_nullable, coalesce(is_shared_default, 'null'), is_shared_is_generated
      );
  end if;

  -- 旧005が`share_code text UNIQUE`で自動生成する単一列UNIQUE制約
  -- (既知の名前 word_books_share_code_key)が、期待どおりの性質
  -- (share_code単独のkey・validなbacking index・NULLS NOT DISTINCTでは
  -- ない)を持って実在するかを厳密に検査する。NULLS NOT DISTINCTだと
  -- share_code=NULLの行が1件しか持てなくなり、複数の未共有wordbookが
  -- 存在できなくなるため、明示的に拒否する。ここではあらゆる互換unique
  -- indexを広く認識しようとはせず、旧005が作る既知のconstraint名だけを
  -- 確認対象とする。
  select exists (
    select 1
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_index i on i.indexrelid = con.conindid
    join pg_attribute a on a.attrelid = c.oid and a.attnum = con.conkey[1]
    where n.nspname = 'public'
      and c.relname = 'word_books'
      and con.conname = 'word_books_share_code_key'
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and a.attname = 'share_code'
      and i.indisvalid
      and i.indisunique
      and coalesce(i.indnullsnotdistinct, false) = false
  ) into legacy_unique_ok;

  -- 旧005が追加で作成する冗長なpartial index
  -- (word_books_share_code_idx、predicate: share_code IS NOT NULL)も、
  -- 「旧005が実際に先行実行された」ことのsignatureとして厳密に検査する
  -- (unique enforcementとしてではなく、fresh replay判定の一部として)。
  select exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class ic on ic.oid = i.indexrelid
    join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
    where n.nspname = 'public'
      and c.relname = 'word_books'
      and ic.relname = 'word_books_share_code_idx'
      and i.indisvalid
      and array_length(i.indkey, 1) = 1
      and a.attname = 'share_code'
      and i.indpred is not null
      and lower(regexp_replace(pg_get_expr(i.indpred, i.indrelid), '[\s()]', '', 'g')) = 'share_codeisnotnull'
  ) into legacy_partial_index_ok;

  -- 旧005はshare_code/is_sharedを参照する追加のCHECK制約を一切作成しない。
  -- 例えば`CHECK (share_code IS NULL)`や`CHECK (is_shared = false)`の
  -- ようなCHECK制約が別途追加されていた場合、上記の列型・unique制約・
  -- index検証をすべて通過しても、後続のPOST(share_codeを設定・is_sharedを
  -- trueへ更新)がCHECK違反で失敗してしまう。よって、共有列を参照する
  -- CHECK制約が一切存在しないことも、旧005 exact signatureの一部として
  -- 検証する。
  --
  -- pg_constraint.contype='c'(CHECK)のみを対象とし、conkey(制約が参照する
  -- 列)にshare_code/is_sharedが含まれるものを検出する。NOT NULL制約は
  -- contype='n'であり別種別のためここには含まれない(NOT NULL自体は既に
  -- is_sharedの契約検査で許容されている)。information_schema側の
  -- CHECK表現(table_constraints.constraint_type = 'CHECK')は、Postgresの
  -- バージョンによってはNOT NULLもCHECKとして表現されうるため使わず、
  -- pg_constraint.contypeで直接判定する。制約名やpg_get_constraintdef()の
  -- 文字列一致では判定しない(名前を変えられただけの同種CHECKを
  -- すり抜けさせないため)。VALID/NOT VALID・ENFORCED/NOT ENFORCEDの
  -- いずれであっても、共有列を参照するCHECKが存在する時点で拒否する。
  select not exists (
    select 1
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'word_books'
      and con.contype = 'c'
      and exists (
        select 1
        from unnest(con.conkey) as constrained_attnum
        join pg_attribute a
          on a.attrelid = c.oid
         and a.attnum = constrained_attnum
        where a.attname in ('share_code', 'is_shared')
      )
  ) into legacy_check_constraints_absent;

  if not legacy_unique_ok or not legacy_partial_index_ok or not legacy_check_constraints_absent then
    raise exception using
      errcode = '55000',
      message = 'wordbook sharing columns exist on an empty word_books table but the legacy unique/index/check signature does not match exactly; audit before applying this migration';
  end if;

  -- 旧005の既知signatureと厳密一致することを確認済み。追加DDL不要のno-op。
end
$$;
