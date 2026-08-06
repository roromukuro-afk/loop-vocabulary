/**
 * Issue #80: supabase/migrations/20260806034305_add_notification_preferences.sql
 * のfail-closed guard設計を検証する。
 *
 * ## なぜソースファイル確認方式なのか
 * このリポジトリには専用のローカル使い捨てPostgres環境が無く
 * (supabase migration list --local は接続エラーになる)、本番/共有Supabase
 * プロジェクトを構文テストに使うことは許可されていない。そのため、
 * migrationファイルのSQLテキストを直接検証する決定論的なテストとする。
 * 実DBへの接続・DDL実行・DML実行はいずれも一切発生しない。
 *
 * コメント内の文字列(例: "旧006のDEFAULT true"という説明文)を誤って
 * 実コード上の危険パターンとして検出しないよう、`--`行コメントと
 * `/* ... *\/`ブロックコメントを除去した後のSQLに対して検証する。
 *
 * 使い方: node scripts/testing/test-notification-preferences-migration.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260806034305_add_notification_preferences.sql",
);
const LEGACY_MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/006_notify_settings.sql",
);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// `--`行コメントと `/* ... */` ブロックコメントを除去する。文字列リテラル内の
// `--`や`/*`は考慮していないが、このmigrationファイルには該当箇所が無いため
// 目的には十分(誤検出防止が目的であり、汎用SQLパーサではない)。
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function main() {
  const rawSource = readFileSync(MIGRATION_PATH, "utf8");
  const source = stripSqlComments(rawSource);

  // --- 1. guardのDO $$ ブロックが、ALTER TABLEより前に存在すること ---
  const guardIndex = source.indexOf("do $$");
  const alterIndex = source.indexOf("alter table public.profiles\n  add column notify_weekly_email");
  if (guardIndex >= 0 && alterIndex > guardIndex) {
    ok("guard(DO $$ ブロック)がALTER TABLEより前のコード位置にある");
  } else {
    bad("guardがALTER TABLEより前に存在しない、または見つからない");
  }

  // --- 2. guardが2列のどちらかの存在を確認し、存在すればRAISE EXCEPTIONすること ---
  const guardBlockMatch = source.match(/do \$\$([\s\S]*?)\$\$;/);
  const guardBlock = guardBlockMatch ? guardBlockMatch[1] : "";
  const checksExistence = /select 1\s*\n\s*from information_schema\.columns\s*\n\s*where table_schema = 'public'\s*\n\s*and table_name = 'profiles'\s*\n\s*and column_name in \(\s*\n\s*'notify_weekly_email',\s*\n\s*'notify_push_enabled'\s*\n\s*\)/.test(guardBlock);
  if (checksExistence) {
    ok("guardはnotify_weekly_email・notify_push_enabledのいずれかがprofilesに既に存在するかをinformation_schema.columnsで確認する");
  } else {
    bad("guardの列存在チェック条件が想定した形になっていない");
  }
  const raisesException = /raise exception using[\s\S]*errcode = '55000'/.test(guardBlock);
  if (raisesException) {
    ok("列が存在する場合はRAISE EXCEPTIONで中断する(errcode指定あり)");
  } else {
    bad("列存在時のRAISE EXCEPTIONが見つからない");
  }

  // --- 3. guardに例外を握りつぶすEXCEPTIONハンドラ(begin...exception when...end)が
  // 無く、RAISEした例外がそのままmigration全体を中断させること ---
  const hasSwallowingExceptionHandler = /exception\s+when\s+/i.test(guardBlock);
  if (!hasSwallowingExceptionHandler) {
    ok("guard内に例外を握りつぶすEXCEPTION WHENハンドラが無く、RAISEがそのままmigrationを中断させる");
  } else {
    bad("guard内にEXCEPTION WHENハンドラが存在し、RAISEが握りつぶされる可能性がある");
  }

  // --- 4. UPDATE public.profiles が存在しないこと(無条件UPDATE禁止) ---
  const hasUpdateStatement = /update\s+public\.profiles/i.test(source);
  if (!hasUpdateStatement) {
    ok("UPDATE public.profilesが存在しない(既存ユーザーの値を一切変更しない)");
  } else {
    bad("UPDATE public.profilesが検出された(既存値を上書きする禁止パターン)");
  }

  // --- 5. DEFAULT true が存在しないこと ---
  const hasDefaultTrue = /default\s+true/i.test(source);
  if (!hasDefaultTrue) {
    ok("DEFAULT trueが存在しない");
  } else {
    bad("DEFAULT trueが検出された(旧006と同じ自動opt-inパターン)");
  }

  // --- 6. ADD COLUMN IF NOT EXISTS が存在しないこと(schema driftを隠さない) ---
  const hasIfNotExists = /add column if not exists/i.test(source);
  if (!hasIfNotExists) {
    ok("ADD COLUMN IF NOT EXISTSが存在しない(guardが列不存在を保証するため不要、かつschema driftを隠さない)");
  } else {
    bad("ADD COLUMN IF NOT EXISTSが検出された(guardと矛盾し、schema driftを隠す禁止パターン)");
  }

  // --- 7. 新規追加列のdefaultが両方falseであること ---
  const weeklyDefaultFalse = /add column notify_weekly_email\s*\n?\s*boolean not null default false/i.test(source);
  const pushDefaultFalse = /add column notify_push_enabled\s*\n?\s*boolean not null default false/i.test(source);
  if (weeklyDefaultFalse && pushDefaultFalse) {
    ok("notify_weekly_email・notify_push_enabledとも、新規追加時のdefaultがfalseになっている");
  } else {
    bad("新規追加列のdefault falseが想定した形で見つからない");
  }

  // --- 8. 既存の006_notify_settings.sqlを変更していないこと(git管理下のoriginと比較) ---
  try {
    const diffOutput = execSync(
      `git diff --stat origin/main -- "${LEGACY_MIGRATION_PATH.replace(/\\/g, "/")}"`,
      { cwd: resolve(__dirname, "../.."), encoding: "utf8" },
    ).trim();
    if (diffOutput === "") {
      ok("既存の006_notify_settings.sqlはorigin/mainから変更されていない(git diffで確認)");
    } else {
      bad(`006_notify_settings.sqlがorigin/mainから変更されている: ${diffOutput}`);
    }
  } catch (e) {
    bad(`006_notify_settings.sqlの変更有無をgit diffで確認できなかった: ${e.message}`);
  }

  console.log(`\n=== test:notification-preferences-migration RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
