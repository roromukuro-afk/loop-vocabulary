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
  share_code_nullable text;
  share_code_default text;
  share_code_is_generated text;
  is_shared_exists boolean;
  is_shared_type text;
  is_shared_nullable text;
  is_shared_default text;
  has_unique_on_share_code boolean;
  share_code_key_relation_exists boolean;
begin
  -- --- share_code: text・nullable・DEFAULT無し(NULL)であることを検査する。
  -- アプリケーション層(POST /api/wordbook/[id]/share)は未共有行を
  -- share_code IS NULLで判別し、新規割当UPDATEも.is("share_code", null)の
  -- compare-and-setに依存している。既存のshare_codeがNOT NULL(かつdefault
  -- 無し)だと、通常のwordbook作成・共有インポートがshare_codeを指定せずに
  -- insertするため即座にNOT NULL制約違反で失敗し、共有の新規割当も一切
  -- 機能しなくなる。また、NULL以外のDEFAULT(例: DEFAULT 'fixed')が設定
  -- されている場合も、share_code無指定のinsertが全て同じ値を持つことになり、
  -- 「未共有行はshare_code IS NULL」という前提が崩れ、unique制約にも
  -- 抵触しうる。型・nullableに加えてDEFAULTがNULLであることも契約として
  -- 検査する。generated column(GENERATED ALWAYS AS ... STORED)である場合、
  -- information_schemaの型・nullable・DEFAULTだけを見ると"text・nullable・
  -- DEFAULT無し"に見えてしまうことがあるが、生成列へは値をUPDATEできず
  -- Postgresがエラーを返すため、共有機能自体が全面的に使用不能になる。
  -- is_generatedも契約として検査する。 ---
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'word_books'
      and column_name = 'share_code'
  ) into share_code_exists;

  if share_code_exists then
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
          'word_books.share_code already exists with unexpected contract (type=%s, nullable=%s, default=%s, generated=%s; expected text, nullable, no default, not generated); audit before applying this migration',
          share_code_type, share_code_nullable, coalesce(share_code_default, 'null'), share_code_is_generated
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
  -- 重複を見逃したまま「既存の有効なunique」とみなしてしまうため対象外とする。
  -- 列数の判定はindnkeyatts(実際にunique制約へ参加するkey列数。INCLUDE句の
  -- covering列を含まない)を使う。array_length(indkey,1)はINCLUDE列も
  -- 数えてしまうため、例えば`UNIQUE (share_code) INCLUDE (user_id)`のような
  -- 実質的に単一列unique indexを誤って「複数列」と判定してしまう。
  -- indkey[0]はkey列(INCLUDE列より必ず前)の先頭を指すため、indnkeyatts=1と
  -- 組み合わせることで「keyがshare_code一列だけ」を正確に判定できる。 ---
  select exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
    where n.nspname = 'public'
      and c.relname = 'word_books'
      and a.attname = 'share_code'
      and i.indisunique
      and i.indisvalid
      and i.indnkeyatts = 1
      and (
        i.indpred is null
        or lower(regexp_replace(pg_get_expr(i.indpred, i.indrelid), '[\s()]', '', 'g')) = 'share_codeisnotnull'
      )
  ) into has_unique_on_share_code;

  if not has_unique_on_share_code then
    -- CREATE UNIQUE INDEXがこれから作成しようとしている名前
    -- (word_books_share_code_key)を、既存の(無効・条件不一致等の)relationが
    -- 既に占有していないか事前に確認する。占有されている場合、CREATE UNIQUE
    -- INDEXは「relation already exists」という不明瞭なnative errorで
    -- 失敗するだけになってしまう。このmigrationはfail-closedの方針上、
    -- 素性の分からない既存relationを黙って削除・上書きしたりはしないため、
    -- 監査が必要である旨を明示するRAISE EXCEPTIONで中断する。
    select exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'word_books_share_code_key'
    ) into share_code_key_relation_exists;

    if share_code_key_relation_exists then
      raise exception using
        errcode = '55000',
        message = 'a relation named public.word_books_share_code_key already exists but does not satisfy the expected unique-enforcement contract (e.g. an invalid index left by a failed CREATE UNIQUE INDEX CONCURRENTLY, or an index with a different predicate/columns); audit and resolve manually before applying this migration';
    end if;

    execute
      'create unique index word_books_share_code_key '
      'on public.word_books (share_code) '
      'where share_code is not null';
  end if;

  -- --- 最終検証: is_shared=trueなのにshare_codeがNULLの行が存在しないことを
  -- 確認する。share_codeが新規追加された場合、既存のis_shared=true行は
  -- (このmigrationがADD COLUMNにDEFAULTを指定していないため)自動的に
  -- share_code=NULLになる。このような行はUI上「共有中」と表示されながら
  -- 実際にはコピーできるURLが存在せず、/share/[code]ページも成立しない
  -- 壊れた状態になる。既存データを勝手に修正(share_code自動生成や
  -- is_shared=falseへのUPDATE)せず、検出した場合はRAISE EXCEPTIONで
  -- 中断し、監査を促す。 ---
  if exists (
    select 1 from public.word_books where is_shared = true and share_code is null
  ) then
    raise exception using
      errcode = '55000',
      message = 'one or more word_books rows have is_shared = true but share_code IS NULL after applying this migration (e.g. share_code newly added while is_shared already had true rows); audit and resolve manually (e.g. disable sharing for those rows) before applying this migration';
  end if;
end
$$;
