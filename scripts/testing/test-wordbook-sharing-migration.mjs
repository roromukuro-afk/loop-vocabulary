/**
 * Issue #81: supabase/migrations/20260807063932_add_wordbook_sharing_fields.sql
 * のfail-closed guard設計を検証する。
 *
 * ## 設計方針(簡素化版)
 * このmigrationが無条件に自動適用するのは、share_code/is_sharedの両方が
 * 不存在の環境だけに限定する。列が既に存在する場合、word_booksの行数で
 * 分岐する: 0行(CI・supabase db reset・新規プロジェクト立ち上げ等で
 * 旧005_wordbook_share.sqlが先に実行された「フレッシュ再生」シナリオ)
 * ならDDL不要で安全にスキップし、1行以上(本番相当・legacy drift)なら
 * そのschemaが一見互換に見えても自動修復・自動受理はせず、個別監査が
 * 必要である旨を明示するRAISE EXCEPTIONで中断する(型・nullable・default・
 * generated column・既存unique indexの互換性等をこの場で推測・受理しない)。
 * これにより、pg_catalogのedge case(UNIQUE NULLS NOT DISTINCT等)を
 * migration側で個別に判定する必要が無くなる。
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

  // --- 3. migration冒頭で、share_code・is_sharedのどちらか1列でも既に
  //         存在するかどうかをcolumns_existへ判定していること ---
  const checksColumnsExist = /select exists \(\s*\n\s*select 1\s*\n\s*from information_schema\.columns\s*\n\s*where table_schema = 'public'\s*\n\s*and table_name = 'word_books'\s*\n\s*and column_name in \('share_code', 'is_shared'\)\s*\n\s*\) into columns_exist;/.test(guardBlock);
  if (checksColumnsExist) {
    ok("share_code・is_sharedのどちらか1列でも既に存在するかをcolumns_existへ判定する");
  } else {
    bad("既存列存在チェック(columns_exist判定)が想定した形で見つからない");
  }

  // --- 4. 列が不存在の場合のみALTER TABLE+CREATE UNIQUE INDEXを実行し、
  //         returnで抜けること(列が既に存在する場合はこの分岐を通らない) ---
  const notExistsBranchAltersAndReturns = /if not columns_exist then\s*\n\s*alter table public\.word_books\s*\n\s*add column share_code text,\s*\n\s*add column is_shared boolean not null default false;\s*\n\s*\n\s*create unique index word_books_share_code_key\s*\n\s*on public\.word_books \(share_code\)\s*\n\s*where share_code is not null;\s*\n\s*return;\s*\n\s*end if;/.test(guardBlock);
  if (notExistsBranchAltersAndReturns) {
    ok("列が不存在の場合のみALTER TABLE(share_code text・is_shared boolean not null default false)とCREATE UNIQUE INDEXを実行しreturnで抜ける");
  } else {
    bad("列不存在時のALTER TABLE+CREATE UNIQUE INDEX+return分岐が想定した形で見つからない");
  }

  // --- 5. 列が既に存在する場合、word_booksの行数(has_existing_rows)で
  //         分岐すること: 1行以上ならRAISE EXCEPTION、0行(フレッシュ再生
  //         シナリオ)なら追加DDL無しで安全にスキップすること ---
  const checksExistingRows = /select exists \(select 1 from public\.word_books limit 1\) into has_existing_rows;/.test(guardBlock);
  if (checksExistingRows) {
    ok("列が既に存在する場合、word_booksの行数(has_existing_rows)を判定する");
  } else {
    bad("word_booksの行数判定(has_existing_rows)が見つからない");
  }
  const raisesWhenRowsExist = /if has_existing_rows then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (raisesWhenRowsExist) {
    ok("列が既に存在し、かつword_booksに1行以上の実データがある場合はRAISE EXCEPTIONで中断する(legacy drift扱い、自動修復しない)");
  } else {
    bad("実データ有りの場合のRAISE EXCEPTIONが見つからない");
  }
  const zeroRowBranchHasNoAlterOrIndex = (() => {
    const raiseBlockEndIdx = guardBlock.search(/message = 'wordbook sharing columns already exist with data[^']*';\s*\n\s*end if;/);
    if (raiseBlockEndIdx < 0) return false;
    const tail = guardBlock.slice(raiseBlockEndIdx);
    return !/alter table|create unique index/i.test(tail);
  })();
  if (zeroRowBranchHasNoAlterOrIndex) {
    ok("列が既に存在し、かつword_booksが0行の場合(フレッシュ再生シナリオ)は追加のALTER/CREATE INDEXを実行しない(005の列定義が既に契約と一致するため)");
  } else {
    bad("0行ケース(フレッシュ再生シナリオ)の後に想定外のALTER/CREATE INDEXが検出された");
  }

  // --- 7. 例外を握りつぶすハンドラが無いこと ---
  const hasSwallowingExceptionHandler = /exception\s+when\s+/i.test(guardBlock);
  if (!hasSwallowingExceptionHandler) {
    ok("guard内に例外を握りつぶすEXCEPTION WHENハンドラが無く、RAISEがそのままmigrationを中断させる");
  } else {
    bad("guard内にEXCEPTION WHENハンドラが存在し、RAISEが握りつぶされる可能性がある");
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

  // --- 10. profiles/word_booksへの既存行UPDATEが存在しないこと(無条件UPDATE禁止) ---
  const hasUpdateStatement = /update\s+public\.(word_books|profiles)/i.test(source);
  if (!hasUpdateStatement) {
    ok("profiles/word_booksへのUPDATEが存在しない(既存データを勝手に変更しない)");
  } else {
    bad("profiles/word_booksへのUPDATEが検出された(既存データを勝手に変更する禁止パターン)");
  }

  // --- 11. share_codeの一括生成(gen_random_uuid/encode/random等によるUPDATE)が
  //          存在しないこと ---
  const hasBulkCodeGeneration = /gen_random_uuid\(\)|encode\(|md5\(|random\(\)/i.test(source);
  if (!hasBulkCodeGeneration) {
    ok("share_codeの一括生成コードが存在しない(コード生成はアプリケーション層のみ)");
  } else {
    bad("share_codeの一括生成らしきコードが検出された");
  }

  // --- 12. partial UNIQUE index(predicate: share_code IS NOT NULL)を
  //           無条件に1本作成すること(既存互換判定を行わない簡素化版のため、
  //           guardを通過した=両列とも新規追加された場合のみ実行される) ---
  const createsPartialUniqueIndex = /create unique index word_books_share_code_key\s*\n\s*on public\.word_books \(share_code\)\s*\n\s*where share_code is not null;/.test(guardBlock);
  if (createsPartialUniqueIndex) {
    ok("share_codeにpartial unique index(word_books_share_code_key、predicate: share_code IS NOT NULL)を作成する");
  } else {
    bad("partial unique indexの作成が想定した形で見つからない");
  }

  // --- 13. RLS変更が存在しないこと ---
  const hasRlsChange = /row level security|create policy|alter policy|drop policy/i.test(source);
  if (!hasRlsChange) {
    ok("RLS(Row Level Security)の変更が存在しない");
  } else {
    bad("RLSに関する変更らしきものが検出された");
  }

  // --- 14. pg_index/pg_class等のcatalogを使った既存schemaの互換性推測ロジックが
  //           存在しないこと(簡素化の核心: 部分互換判定を一切行わず、両列不存在
  //           以外は個別監査へfail-closedで委ねる設計であることを保証する) ---
  const hasCatalogCompatGuessing = /pg_index|pg_class|pg_attribute|pg_namespace|indnkeyatts|indpred|indisvalid|indnullsnotdistinct|is_generated|information_schema\.columns[\s\S]{0,40}column_name = 'share_code'|information_schema\.columns[\s\S]{0,40}column_name = 'is_shared'/i.test(source);
  if (!hasCatalogCompatGuessing) {
    ok("pg_catalog(pg_index/pg_class/pg_attribute等)を使った既存schemaの部分互換性推測ロジックが存在しない(indnullsnotdistinct等のedge caseをmigration側で判定する必要が無い)");
  } else {
    bad("pg_catalogベースの既存schema互換性推測ロジックが検出された(簡素化方針に反する)");
  }

  console.log(`\n=== test:wordbook-sharing-migration RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
