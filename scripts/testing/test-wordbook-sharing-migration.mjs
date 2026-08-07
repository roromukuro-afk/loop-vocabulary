/**
 * Issue #81: supabase/migrations/20260807063932_add_wordbook_sharing_fields.sql
 * のfail-closed guard設計を検証する。
 *
 * ## なぜソースファイル確認方式なのか
 * このリポジトリには専用のローカル使い捨てPostgres環境が無く
 * (supabase migration list --local は接続エラーになる)、本番/共有Supabase
 * プロジェクトを構文テストに使うことは許可されていない。そのため、
 * migrationファイルのSQLテキストを直接検証する決定論的なテストとする。
 * 実DBへの接続・DDL実行・DML実行はいずれも一切発生しない。
 *
 * コメント内の文字列を誤って実コード上の危険パターンとして検出しないよう、
 * `--`行コメントと`/* ... *\/`ブロックコメントを除去した後のSQLに対して検証する。
 *
 * 既存の006_notify_settings.sql検証(test-notification-preferences-migration.mjs)
 * で、origin/main比較・git履歴比較のいずれもshallow/partial cloneで失敗し得ることが
 * Codexレビューで実際に確認されたため、この既存005検証もgitコマンドを一切使わず、
 * 005_wordbook_share.sqlの現在のファイル内容を直接検証する完全に自己完結した
 * 方式を最初から採用する。
 *
 * 使い方: node scripts/testing/test-wordbook-sharing-migration.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");
const NEW_MIGRATION_FILENAME = "20260807063932_add_wordbook_sharing_fields.sql";
const MIGRATION_PATH = resolve(MIGRATIONS_DIR, NEW_MIGRATION_FILENAME);
const LEGACY_MIGRATION_PATH = resolve(MIGRATIONS_DIR, "005_wordbook_share.sql");

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function main() {
  // --- 1. filenameがtimestamp形式であること(手作業でtimestampを決めていないことの
  //         間接確認: supabase migration newが生成する14桁数字プレフィックス) ---
  if (/^\d{14}_add_wordbook_sharing_fields\.sql$/.test(NEW_MIGRATION_FILENAME)) {
    ok(`migrationファイル名が14桁timestampプレフィックス形式(${NEW_MIGRATION_FILENAME})`);
  } else {
    bad(`migrationファイル名がtimestamp形式になっていない: ${NEW_MIGRATION_FILENAME}`);
  }
  const filesInDir = readdirSync(MIGRATIONS_DIR);
  if (filesInDir.includes(NEW_MIGRATION_FILENAME)) {
    ok("新migrationファイルがsupabase/migrations/配下に実在する");
  } else {
    bad("新migrationファイルがsupabase/migrations/配下に見つからない");
  }

  const rawSource = readFileSync(MIGRATION_PATH, "utf8");
  const source = stripSqlComments(rawSource);
  const guardBlockMatch = source.match(/do \$\$([\s\S]*)\$\$;/);
  const guardBlock = guardBlockMatch ? guardBlockMatch[1] : "";

  // --- 2. 既存の005_wordbook_share.sqlを変更していないこと(gitに依存しない
  //         直接コンテンツ検証) ---
  const legacySource = readFileSync(LEGACY_MIGRATION_PATH, "utf8");
  const legacyMatchesExpectedContent =
    /ALTER TABLE public\.word_books\s*\n\s*ADD COLUMN IF NOT EXISTS share_code text UNIQUE,\s*\n\s*ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;/.test(legacySource)
    && /CREATE INDEX IF NOT EXISTS word_books_share_code_idx ON public\.word_books \(share_code\)\s*\n\s*WHERE share_code IS NOT NULL;/.test(legacySource);
  if (legacyMatchesExpectedContent) {
    ok("既存の005_wordbook_share.sqlは元の構成のまま変更されていない(gitに依存しないファイル内容の直接検証)");
  } else {
    bad("005_wordbook_share.sqlの内容が想定と異なる。編集されている可能性がある");
  }

  // --- 3. share_codeが存在する場合、text型以外ならRAISE EXCEPTION ---
  const shareCodeGuard = /if share_code_type <> 'text' then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (shareCodeGuard) {
    ok("share_codeが既に存在する場合、text型でなければRAISE EXCEPTIONで中断する");
  } else {
    bad("share_codeの型チェックによるRAISE EXCEPTIONが見つからない");
  }

  // --- 4. is_sharedが存在する場合、boolean・NOT NULL・DEFAULT false以外ならRAISE EXCEPTION
  //         (column_defaultがNULLの場合に`<>`ではNULL(=falseとして扱われ、guardを
  //         すり抜けてしまう)ため、IS DISTINCT FROMで比較しNULLも確実に不一致として
  //         検出すること) ---
  const isSharedGuard = /if is_shared_type <> 'boolean'\s*\n\s*or is_shared_nullable <> 'NO'\s*\n\s*or is_shared_default is distinct from 'false' then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (isSharedGuard) {
    ok("is_sharedが既に存在する場合、boolean・NOT NULL・DEFAULT false以外ならRAISE EXCEPTIONで中断する(IS DISTINCT FROMでNULL defaultも検出)");
  } else {
    bad("is_sharedの契約チェックによるRAISE EXCEPTIONが見つからない");
  }

  // --- 4b. is_shared_defaultの比較に素の`<>`(NULLに対しNULLを返し、guardを
  //          すり抜けさせてしまう)を使っていないこと ---
  const usesUnsafeNullComparison = /is_shared_default\s*<>\s*'false'/.test(guardBlock);
  if (!usesUnsafeNullComparison) {
    ok("is_shared_defaultの比較で素の<>を使っていない(NULL defaultをすり抜けさせない)");
  } else {
    bad("is_shared_defaultの比較に素の<>が残っている(NULL default時にguardをすり抜ける禁止パターン)");
  }

  // --- 4c. share_codeのunique index判定がindkeyの列数を1に限定していること
  //          (share_codeを含む複合unique indexを誤って「既存の単独unique」と
  //          みなさないため) ---
  const restrictsToSingleColumnIndex = /and i\.indisunique\s*\n\s*and array_length\(i\.indkey, 1\) = 1/.test(guardBlock);
  if (restrictsToSingleColumnIndex) {
    ok("share_codeのunique index判定が単一列のindexのみを対象にする(複合unique indexを誤検知しない)");
  } else {
    bad("share_codeのunique index判定に単一列限定の条件(array_length(i.indkey, 1) = 1)が見つからない");
  }

  // --- 4d. share_codeのunique index判定がpredicateも検証していること
  //          (`WHERE source_type = 'material'`のような弱いpredicateを持つ
  //          既存indexを、対象外の行同士の重複を防げないにもかかわらず
  //          「既存の有効なunique」と誤認しないため) ---
  const validatesIndexPredicate = /i\.indpred is null\s*\n\s*or lower\(regexp_replace\(pg_get_expr\(i\.indpred, i\.indrelid\), '\[\\s\(\)\]', '', 'g'\)\) = 'share_codeisnotnull'/.test(guardBlock);
  if (validatesIndexPredicate) {
    ok("share_codeのunique index判定がpredicateも検証する(predicate無し、またはshare_code IS NOT NULLと同値の場合のみ既存とみなす)");
  } else {
    bad("share_codeのunique index判定にpredicate検証(indpred is null または share_code IS NOT NULL相当)が見つからない");
  }

  // --- 5. 例外を握りつぶすハンドラが無いこと ---
  const hasSwallowingExceptionHandler = /exception\s+when\s+/i.test(guardBlock);
  if (!hasSwallowingExceptionHandler) {
    ok("guard内に例外を握りつぶすEXCEPTION WHENハンドラが無く、RAISEがそのままmigrationを中断させる");
  } else {
    bad("guard内にEXCEPTION WHENハンドラが存在し、RAISEが握りつぶされる可能性がある");
  }

  // --- 6. 列不存在の場合だけADD COLUMNすること(新規share_code) ---
  const addsShareCodeOnlyWhenMissing = /else\s*\n\s*execute 'alter table public\.word_books add column share_code text';\s*\n\s*end if;/.test(guardBlock);
  if (addsShareCodeOnlyWhenMissing) {
    ok("share_code不存在の場合のみADD COLUMN(text)を実行する");
  } else {
    bad("share_code不存在時のADD COLUMN分岐が想定した形で見つからない");
  }

  // --- 7. 列不存在の場合だけADD COLUMNすること(新規is_shared、default false) ---
  const addsIsSharedOnlyWhenMissing = /else\s*\n\s*execute 'alter table public\.word_books add column is_shared boolean not null default false';\s*\n\s*end if;/.test(guardBlock);
  if (addsIsSharedOnlyWhenMissing) {
    ok("is_shared不存在の場合のみADD COLUMN(boolean not null default false)を実行する");
  } else {
    bad("is_shared不存在時のADD COLUMN分岐が想定した形で見つからない");
  }

  // --- 8. DEFAULT trueが存在しないこと ---
  const hasDefaultTrue = /default\s+true/i.test(source);
  if (!hasDefaultTrue) {
    ok("DEFAULT trueが存在しない");
  } else {
    bad("DEFAULT trueが検出された");
  }

  // --- 9. ADD COLUMN IF NOT EXISTSが存在しないこと(guardが列不存在を判別するため
  //         不要であり、むしろschema driftを隠す方向に働く) ---
  const hasIfNotExists = /add column if not exists/i.test(source);
  if (!hasIfNotExists) {
    ok("ADD COLUMN IF NOT EXISTSが存在しない(guardが列の状態を判別するため不要)");
  } else {
    bad("ADD COLUMN IF NOT EXISTSが検出された(guardと矛盾し、schema driftを隠す禁止パターン)");
  }

  // --- 10. 既存行を公開するUPDATEが存在しないこと(無条件UPDATE禁止) ---
  const hasUpdateStatement = /update\s+public\.word_books/i.test(source);
  if (!hasUpdateStatement) {
    ok("UPDATE public.word_booksが存在しない(既存行を公開状態へ変更しない)");
  } else {
    bad("UPDATE public.word_booksが検出された(既存データを勝手に変更する禁止パターン)");
  }

  // --- 11. share_codeの一括生成(gen_random_uuid/encode/random等によるUPDATE)が
  //          存在しないこと ---
  const hasBulkCodeGeneration = /gen_random_uuid\(\)|encode\(|md5\(|random\(\)/i.test(source);
  if (!hasBulkCodeGeneration) {
    ok("share_codeの一括生成コードが存在しない(コード生成はアプリケーション層のみ)");
  } else {
    bad("share_codeの一括生成らしきコードが検出された");
  }

  // --- 12. unique enforcementが存在すること(既存unique有無を判定したうえで
  //          1本だけ作成する設計) ---
  const checksExistingUnique = /select exists \(\s*\n\s*select 1\s*\n\s*from pg_index/.test(guardBlock);
  const createsUniqueIndexOnlyWhenMissing = /if not has_unique_on_share_code then\s*\n\s*execute\s*\n\s*'create unique index word_books_share_code_key '\s*\n\s*'on public\.word_books \(share_code\) '\s*\n\s*'where share_code is not null';\s*\n\s*end if;/.test(guardBlock);
  if (checksExistingUnique && createsUniqueIndexOnlyWhenMissing) {
    ok("既存unique index/constraintの有無をpg_indexで確認し、無い場合だけpartial unique indexを1本作成する");
  } else {
    bad("share_codeのunique enforcement(既存確認+条件付き作成)が想定した形で見つからない");
  }

  // --- 13. 重複既存share_codeを黙って修正するコード(DISTINCT ON・重複行の
  //          DELETE/UPDATE等)が存在しないこと。重複がある場合はCREATE UNIQUE
  //          INDEX自体が自然に失敗し、migrationが中断される設計。 ---
  const hasDuplicateAutoFix = /delete\s+from\s+public\.word_books|distinct\s+on\s*\(share_code\)/i.test(source);
  if (!hasDuplicateAutoFix) {
    ok("重複既存share_codeを黙って修正するコードが存在しない(unique index作成の自然な失敗に委ねる設計)");
  } else {
    bad("重複share_codeを自動修正するコードらしきものが検出された");
  }

  // --- 14. RLS変更が存在しないこと ---
  const hasRlsChange = /row level security|create policy|alter policy|drop policy/i.test(source);
  if (!hasRlsChange) {
    ok("RLS(Row Level Security)の変更が存在しない");
  } else {
    bad("RLSに関する変更らしきものが検出された");
  }

  console.log(`\n=== test:wordbook-sharing-migration RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
