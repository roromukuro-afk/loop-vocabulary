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
 * ## guardの3分岐(Codexレビュー指摘: フレッシュ環境でのmigration再生問題への対応)
 * 1. 列が存在しない → ADD COLUMN(default false)して終了(通常の初回適用パス)
 * 2. 列は存在し、profilesに1行以上の実データがある → RAISE EXCEPTIONで中断
 *    (旧default由来かユーザー選択由来か判別できないtrue値を保護するため)
 * 3. 列は存在するがprofilesが0行(例: CI・supabase db reset・新規Supabase
 *    プロジェクトで006がこのmigrationより先に走った直後、まだ1ユーザーも
 *    存在しない場合) → 対象行が無くUPDATEは発生しないため、列defaultだけを
 *    falseへ揃えて正常終了する
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

  const guardBlockMatch = source.match(/do \$\$([\s\S]*)\$\$;/);
  const guardBlock = guardBlockMatch ? guardBlockMatch[1] : "";

  // --- 1. guardが単一のDO $$ ブロックであり、全ての分岐がその内側にあること ---
  if (guardBlock) {
    ok("guardはDO $$ ブロックとして存在する(3分岐すべてが単一のPL/pgSQLブロック内にある)");
  } else {
    bad("guardのDO $$ ブロックが見つからない");
  }

  // --- 2. 列存在チェック(columns_exist)がinformation_schema.columnsで両列を確認すること ---
  const checksExistence = /select exists \(\s*\n\s*select 1\s*\n\s*from information_schema\.columns\s*\n\s*where table_schema = 'public'\s*\n\s*and table_name = 'profiles'\s*\n\s*and column_name in \(\s*\n\s*'notify_weekly_email',\s*\n\s*'notify_push_enabled'\s*\n\s*\)\s*\n\s*\) into columns_exist/.test(guardBlock);
  if (checksExistence) {
    ok("guardはnotify_weekly_email・notify_push_enabledのいずれかがprofilesに既に存在するかをinformation_schema.columnsで確認しcolumns_existへ格納する");
  } else {
    bad("列存在チェック(columns_exist)の条件が想定した形になっていない");
  }

  // --- 3. 列が存在しない場合、ADD COLUMN(default false)して早期returnすること ---
  const notExistsBranch = /if not columns_exist then\s*\n\s*execute\s*\n\s*'alter table public\.profiles '\s*\n\s*'add column notify_weekly_email boolean not null default false, '\s*\n\s*'add column notify_push_enabled boolean not null default false';\s*\n\s*return;\s*\n\s*end if;/.test(guardBlock);
  if (notExistsBranch) {
    ok("列が存在しない場合はADD COLUMN(default false, 両列)を実行しreturnで抜ける(通常の初回適用パス)");
  } else {
    bad("列不存在時のADD COLUMN分岐が想定した形で見つからない");
  }

  // --- 4. has_existing_rowsがprofilesに1行以上あるかをexistsで確認すること ---
  const checksRows = /select exists \(select 1 from public\.profiles limit 1\) into has_existing_rows/.test(guardBlock);
  if (checksRows) {
    ok("列が既に存在する場合、has_existing_rowsでprofilesに1行以上の実データがあるかを確認する");
  } else {
    bad("has_existing_rowsの行数チェックが見つからない");
  }

  // --- 4b. 行数チェックの前にLOCK TABLE ... IN SHARE MODEを取得し、行数チェックと
  //          後続のALTER COLUMN SET DEFAULTの間に新規INSERTがコミットされる
  //          TOCTOUレースを防ぐこと(Codexレビュー指摘 P2) ---
  const lockIndex = guardBlock.indexOf("execute 'lock table public.profiles in share mode'");
  const rowsCheckIndex = guardBlock.indexOf("select exists (select 1 from public.profiles limit 1) into has_existing_rows");
  if (lockIndex >= 0 && rowsCheckIndex > lockIndex) {
    ok("行数チェックより前にLOCK TABLE public.profiles IN SHARE MODEを取得し、チェックと変更の間の新規INSERTをブロックする");
  } else {
    bad("行数チェック前のLOCK TABLEが見つからない、または位置が想定と異なる(TOCTOUレースが残る疑い)");
  }

  // --- 5. has_existing_rowsがtrueの場合のみRAISE EXCEPTIONすること(errcode指定あり) ---
  const raisesOnlyWhenRows = /if has_existing_rows then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (raisesOnlyWhenRows) {
    ok("has_existing_rowsがtrueの場合のみRAISE EXCEPTIONで中断する(列が存在するだけでは中断しない)");
  } else {
    bad("has_existing_rows条件付きのRAISE EXCEPTIONが見つからない");
  }

  // --- 6. guardに例外を握りつぶすEXCEPTIONハンドラ(exception when ... end)が
  // 無く、RAISEした例外がそのままmigration全体を中断させること ---
  const hasSwallowingExceptionHandler = /exception\s+when\s+/i.test(guardBlock);
  if (!hasSwallowingExceptionHandler) {
    ok("guard内に例外を握りつぶすEXCEPTION WHENハンドラが無く、RAISEがそのままmigrationを中断させる");
  } else {
    bad("guard内にEXCEPTION WHENハンドラが存在し、RAISEが握りつぶされる可能性がある");
  }

  // --- 7. 列が存在し、かつprofilesが0行の場合は、ADD COLUMNではなくALTER COLUMN
  //         SET DEFAULT(両列false)だけを実行して正常終了すること(実データが無く
  //         UPDATEは発生しない) ---
  const zeroRowsBranch = /execute\s*\n\s*'alter table public\.profiles '\s*\n\s*'alter column notify_weekly_email set default false, '\s*\n\s*'alter column notify_push_enabled set default false';/.test(guardBlock);
  if (zeroRowsBranch) {
    ok("列が既に存在しprofilesが0行の場合は、ADD COLUMNではなくALTER COLUMN SET DEFAULT(両列false)だけを実行する(実データ無し、UPDATE発生なし)");
  } else {
    bad("0行時のALTER COLUMN SET DEFAULT分岐が想定した形で見つからない");
  }

  // --- 8. UPDATE public.profiles が存在しないこと(無条件UPDATE禁止、EXECUTE文字列内も含む) ---
  const hasUpdateStatement = /update\s+public\.profiles/i.test(source);
  if (!hasUpdateStatement) {
    ok("UPDATE public.profilesが存在しない(既存ユーザーの値を一切変更しない)");
  } else {
    bad("UPDATE public.profilesが検出された(既存値を上書きする禁止パターン)");
  }

  // --- 9. DEFAULT true が存在しないこと ---
  const hasDefaultTrue = /default\s+true/i.test(source);
  if (!hasDefaultTrue) {
    ok("DEFAULT trueが存在しない");
  } else {
    bad("DEFAULT trueが検出された(旧006と同じ自動opt-inパターン)");
  }

  // --- 10. ADD COLUMN IF NOT EXISTS が存在しないこと(schema driftを隠さない) ---
  const hasIfNotExists = /add column if not exists/i.test(source);
  if (!hasIfNotExists) {
    ok("ADD COLUMN IF NOT EXISTSが存在しない(guardの分岐が列の状態を判別するため不要、かつschema driftを隠さない)");
  } else {
    bad("ADD COLUMN IF NOT EXISTSが検出された(guardと矛盾し、schema driftを隠す禁止パターン)");
  }

  // --- 11. 新規追加列のdefaultが両方falseであること(列不存在時のADD COLUMN分岐) ---
  const weeklyDefaultFalse = /add column notify_weekly_email boolean not null default false/i.test(source);
  const pushDefaultFalse = /add column notify_push_enabled boolean not null default false/i.test(source);
  if (weeklyDefaultFalse && pushDefaultFalse) {
    ok("notify_weekly_email・notify_push_enabledとも、新規追加時のdefaultがfalseになっている");
  } else {
    bad("新規追加列のdefault falseが想定した形で見つからない");
  }

  // --- 12. 既存の006_notify_settings.sqlを変更していないこと ---
  // Codexレビュー指摘 P2: origin/mainとの比較は、shallow clone・レビュー用
  // checkout等でorigin/mainのremote-trackingが存在しないと
  // `fatal: bad revision 'origin/main'`で失敗する(実際に再現された)。
  // そのため外部refに依存せず、このリポジトリ内で自己完結する基準を使う:
  // 新migrationファイルを最初に追加したコミットの直前(その親コミット)を
  // 基準とし、そこから現在までの間に006が変更されていないかを確認する。
  // このコミットは新migrationファイル自体から特定できるため、origin/main
  // 等のリモートrefの有無に関わらず常に存在する。
  const repoRoot = resolve(__dirname, "../..");
  try {
    const newMigrationRelPath = "supabase/migrations/20260806034305_add_notification_preferences.sql";
    const addedCommits = execSync(
      `git log --diff-filter=A --format=%H -- "${newMigrationRelPath}"`,
      { cwd: repoRoot, encoding: "utf8" },
    ).trim().split("\n").filter(Boolean);
    const firstCommit = addedCommits[addedCommits.length - 1]; // git logは新しい順、末尾が最古
    if (!firstCommit) {
      bad("新migrationファイルを追加したコミットが見つからず、006の変更有無を確認する基準を特定できなかった");
    } else {
      const baseRef = `${firstCommit}^`;
      const diffOutput = execSync(
        `git diff --stat ${baseRef} -- "${LEGACY_MIGRATION_PATH.replace(/\\/g, "/")}"`,
        { cwd: repoRoot, encoding: "utf8" },
      ).trim();
      if (diffOutput === "") {
        ok(`既存の006_notify_settings.sqlは、新migrationファイルを追加した最初のコミットの直前(${baseRef.slice(0, 7)})から変更されていない(外部refに依存しない自己完結的なgit diffで確認)`);
      } else {
        bad(`006_notify_settings.sqlが変更されている: ${diffOutput}`);
      }
    }
  } catch (e) {
    bad(`006_notify_settings.sqlの変更有無を確認できなかった: ${e.message}`);
  }

  console.log(`\n=== test:notification-preferences-migration RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
