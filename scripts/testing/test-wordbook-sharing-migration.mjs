/**
 * Issue #81: supabase/migrations/20260807063932_add_wordbook_sharing_fields.sql
 * のfail-closed guard設計を検証する。
 *
 * ## 設計方針(3分岐版)
 * A. share_code/is_sharedの両方が不存在 → 通常の新規適用(ALTER TABLE +
 *    partial unique index作成)。
 * B. word_booksに1行以上の実データがある → schema・列の存在状況に関わらず
 *    RAISE EXCEPTION(自動修復・自動受理しない)。
 * C. word_booksが0行、かつ列が既に存在する → 旧005が実際に作成する既知の
 *    signature(share_code text・nullable・default無し・非generated /
 *    is_shared boolean・NOT NULL・DEFAULT false・非generated / 単一列
 *    UNIQUE制約word_books_share_code_key(NULLS NOT DISTINCTではない)/
 *    冗長なpartial index word_books_share_code_idx)と隅々まで厳密一致する
 *    場合のみno-opでbypassする。1箇所でも一致しなければRAISE EXCEPTION
 *    (部分的な列存在・型不一致・generated column・UNIQUE制約欠如・
 *    NULLS NOT DISTINCT等のmalformed/partial schemaを「0行だから安全」と
 *    誤ってbypassしない)。ここで検証するのは「あらゆる互換schema」ではなく、
 *    旧005という既知・固定のmigrationが実際に作る一意のsignatureだけである。
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

  // --- 3. share_code_exists / is_shared_exists をそれぞれ独立に判定していること ---
  const checksShareCodeExists = /select exists \(\s*\n\s*select 1\s*\n\s*from information_schema\.columns\s*\n\s*where table_schema = 'public'\s*\n\s*and table_name = 'word_books'\s*\n\s*and column_name = 'share_code'\s*\n\s*\) into share_code_exists;/.test(guardBlock);
  const checksIsSharedExists = /select exists \(\s*\n\s*select 1\s*\n\s*from information_schema\.columns\s*\n\s*where table_schema = 'public'\s*\n\s*and table_name = 'word_books'\s*\n\s*and column_name = 'is_shared'\s*\n\s*\) into is_shared_exists;/.test(guardBlock);
  if (checksShareCodeExists && checksIsSharedExists) {
    ok("share_code_exists・is_shared_existsをそれぞれ独立に判定する(片方だけの存在を区別できる)");
  } else {
    bad("share_code_exists/is_shared_existsの独立判定が想定した形で見つからない");
  }

  // --- 4. 分岐A: 両方とも不存在の場合のみALTER TABLE+CREATE UNIQUE INDEXを
  //         実行しreturnで抜けること ---
  const branchAAltersAndReturns = /if not share_code_exists and not is_shared_exists then\s*\n\s*alter table public\.word_books\s*\n\s*add column share_code text,\s*\n\s*add column is_shared boolean not null default false;\s*\n\s*\n\s*create unique index word_books_share_code_key\s*\n\s*on public\.word_books \(share_code\)\s*\n\s*where share_code is not null;\s*\n\s*return;\s*\n\s*end if;/.test(guardBlock);
  if (branchAAltersAndReturns) {
    ok("分岐A(両列不存在)の場合のみALTER TABLE(share_code text・is_shared boolean not null default false)とCREATE UNIQUE INDEXを実行しreturnで抜ける");
  } else {
    bad("分岐A(両列不存在)のALTER TABLE+CREATE UNIQUE INDEX+return分岐が想定した形で見つからない");
  }

  // --- 5. 分岐B: word_booksの行数(has_existing_rows)を判定し、実データが
  //         あればschema詳細を問わずRAISE EXCEPTIONすること ---
  const checksExistingRows = /select exists \(select 1 from public\.word_books limit 1\) into has_existing_rows;/.test(guardBlock);
  if (checksExistingRows) {
    ok("word_booksの行数(has_existing_rows)を判定する");
  } else {
    bad("word_booksの行数判定(has_existing_rows)が見つからない");
  }
  const branchBRaises = /if has_existing_rows then\s*\n\s*raise exception using\s*\n\s*errcode = '55000',\s*\n\s*message = 'wordbook sharing columns already exist with data/.test(guardBlock);
  if (branchBRaises) {
    ok("分岐B: word_booksに1行以上の実データがある場合、schema・列の存在状況に関わらずRAISE EXCEPTIONで中断する(legacy drift扱い、自動修復しない)");
  } else {
    bad("分岐B(実データ有りのRAISE EXCEPTION)が見つからない");
  }

  // --- 6. 分岐C冒頭: 片方だけ存在する場合(malformed/partial)は0行でも
  //         即座にabortすること(share_codeだけ存在+0行 / is_sharedだけ存在+0行
  //         の両方をこの1つの条件でカバーする) ---
  const partialExistsAborts = /if not share_code_exists or not is_shared_exists then\s*\n\s*raise exception using\s*\n\s*errcode = '55000',\s*\n\s*message = 'wordbook sharing columns partially exist/.test(guardBlock);
  if (partialExistsAborts) {
    ok("分岐C: 片方だけ存在する場合(share_codeのみ、またはis_sharedのみ)は0行でも即座にRAISE EXCEPTIONで中断する");
  } else {
    bad("片方だけ存在する場合のRAISE EXCEPTIONが見つからない");
  }

  // --- 7. share_codeの厳密signature検証: text・nullable・DEFAULT無し・
  //          非generatedのいずれかを満たさなければRAISE EXCEPTIONすること
  //          (wrong type・NOT NULL・DEFAULTあり・generated columnのいずれも
  //          このAND条件でabortされる) ---
  const shareCodeExactSignature = /if share_code_type <> 'text'\s*\n\s*or share_code_nullable <> 'YES'\s*\n\s*or share_code_default is not null\s*\n\s*or share_code_is_generated <> 'NEVER' then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (shareCodeExactSignature) {
    ok("share_codeの厳密signature検証(text・nullable・DEFAULT無し・非generated)を満たさない場合はRAISE EXCEPTIONで中断する(wrong type/NOT NULL/DEFAULT有り/generated columnをすべて拒否)");
  } else {
    bad("share_codeの厳密signature検証が想定した形で見つからない");
  }

  // --- 8. is_sharedの厳密signature検証: boolean・NOT NULL・DEFAULT false・
  //          非generatedのいずれかを満たさなければRAISE EXCEPTIONすること
  //          (nullable・default欠如・DEFAULT true・generated columnのいずれも
  //          このAND条件でabortされる)。column_defaultの表記差異
  //          (false / false::boolean等)は正規化してから比較すること ---
  const normalizesIsSharedDefault = /is_shared_default_normalized := lower\(regexp_replace\(trim\(coalesce\(is_shared_default, ''\)\), '::\\s\*boolean\\s\*\$', ''\)\);/.test(guardBlock);
  if (normalizesIsSharedDefault) {
    ok("is_shared_defaultの表記差異(false / false::boolean等)を正規化してから比較する");
  } else {
    bad("is_shared_defaultの正規化処理が見つからない");
  }
  const isSharedExactSignature = /if is_shared_type <> 'boolean'\s*\n\s*or is_shared_nullable <> 'NO'\s*\n\s*or is_shared_default_normalized <> 'false'\s*\n\s*or is_shared_is_generated <> 'NEVER' then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (isSharedExactSignature) {
    ok("is_sharedの厳密signature検証(boolean・NOT NULL・正規化後DEFAULT false・非generated)を満たさない場合はRAISE EXCEPTIONで中断する(nullable/default欠如/DEFAULT true/generated columnをすべて拒否)");
  } else {
    bad("is_sharedの厳密signature検証が想定した形で見つからない");
  }

  // --- 9. 旧005が自動生成する単一列UNIQUE制約(word_books_share_code_key)の
  //          存在・性質(単一key列・valid・unique・NULLS NOT DISTINCTではない)
  //          をpg_constraint/pg_indexで厳密に検証すること。あらゆる互換unique
  //          indexを広く認識しようとせず、既知のconstraint名だけを確認対象と
  //          すること。 ---
  const checksLegacyUniqueConstraint = /from pg_constraint con\s*\n\s*join pg_class c on c\.oid = con\.conrelid\s*\n\s*join pg_namespace n on n\.oid = c\.relnamespace\s*\n\s*join pg_index i on i\.indexrelid = con\.conindid\s*\n\s*join pg_attribute a on a\.attrelid = c\.oid and a\.attnum = con\.conkey\[1\]\s*\n\s*where n\.nspname = 'public'\s*\n\s*and c\.relname = 'word_books'\s*\n\s*and con\.conname = 'word_books_share_code_key'\s*\n\s*and con\.contype = 'u'\s*\n\s*and array_length\(con\.conkey, 1\) = 1\s*\n\s*and a\.attname = 'share_code'\s*\n\s*and i\.indisvalid\s*\n\s*and i\.indisunique\s*\n\s*and coalesce\(i\.indnullsnotdistinct, false\) = false\s*\n\s*\) into legacy_unique_ok;/.test(guardBlock);
  if (checksLegacyUniqueConstraint) {
    ok("旧005が作る既知のUNIQUE制約(word_books_share_code_key)の存在・性質(単一key列・valid・unique・NULLS NOT DISTINCTではない)をpg_constraint/pg_indexで厳密に検証する");
  } else {
    bad("旧005 UNIQUE制約の厳密検証(legacy_unique_ok判定)が想定した形で見つからない");
  }
  const rejectsNullsNotDistinct = /coalesce\(i\.indnullsnotdistinct, false\) = false/.test(guardBlock);
  if (rejectsNullsNotDistinct) {
    ok("indnullsnotdistinct=falseであることを要求する(UNIQUE NULLS NOT DISTINCTを既存の有効なunique制約として受理しない。複数の未共有wordbookがshare_code=NULLを持てなくなるため)");
  } else {
    bad("indnullsnotdistinct検証が見つからない");
  }

  // --- 10. 旧005が追加で作成する冗長なpartial index
  //           (word_books_share_code_idx、predicate: share_code IS NOT NULL)
  //           も、fresh replay signatureの一部として厳密に検証すること ---
  const checksLegacyPartialIndex = /from pg_index i\s*\n\s*join pg_class c on c\.oid = i\.indrelid\s*\n\s*join pg_namespace n on n\.oid = c\.relnamespace\s*\n\s*join pg_class ic on ic\.oid = i\.indexrelid\s*\n\s*join pg_attribute a on a\.attrelid = c\.oid and a\.attnum = i\.indkey\[0\]\s*\n\s*where n\.nspname = 'public'\s*\n\s*and c\.relname = 'word_books'\s*\n\s*and ic\.relname = 'word_books_share_code_idx'\s*\n\s*and i\.indisvalid\s*\n\s*and array_length\(i\.indkey, 1\) = 1\s*\n\s*and a\.attname = 'share_code'\s*\n\s*and i\.indpred is not null\s*\n\s*and lower\(regexp_replace\(pg_get_expr\(i\.indpred, i\.indrelid\), '\[\\s\(\)\]', '', 'g'\)\) = 'share_codeisnotnull'\s*\n\s*\) into legacy_partial_index_ok;/.test(guardBlock);
  if (checksLegacyPartialIndex) {
    ok("旧005が作る冗長なpartial index(word_books_share_code_idx、predicate: share_code IS NOT NULL)の存在をfresh replay signatureの一部として厳密に検証する");
  } else {
    bad("旧005 partial indexの厳密検証(legacy_partial_index_ok判定)が想定した形で見つからない");
  }

  // --- 11. 共有列(share_code/is_shared)を参照する追加CHECK制約が存在しない
  //           ことを、pg_constraint.contype='c'(CHECK)とconkey/pg_attributeで
  //           厳密に検証すること。information_schemaの単純な
  //           constraint_type='CHECK'判定(Postgresのバージョンによっては
  //           NOT NULLもCHECKとして表現され誤検知しうる)は使わないこと。
  //           制約名やpg_get_constraintdef()の文字列一致でも判定しないこと。 ---
  const checksNoShareColumnCheckConstraints = /from pg_constraint con\s*\n\s*join pg_class c on c\.oid = con\.conrelid\s*\n\s*join pg_namespace n on n\.oid = c\.relnamespace\s*\n\s*where n\.nspname = 'public'\s*\n\s*and c\.relname = 'word_books'\s*\n\s*and con\.contype = 'c'\s*\n\s*and exists \(\s*\n\s*select 1\s*\n\s*from unnest\(con\.conkey\) as constrained_attnum\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = c\.oid\s*\n\s*and a\.attnum = constrained_attnum\s*\n\s*where a\.attname in \('share_code', 'is_shared'\)\s*\n\s*\)\s*\n\s*\) into legacy_check_constraints_absent;/.test(guardBlock);
  if (checksNoShareColumnCheckConstraints) {
    ok("share_code/is_sharedを参照する追加CHECK制約(pg_constraint.contype='c')が存在しないことを、conkey/pg_attributeで厳密に検証する(information_schemaの単純CHECK判定やconstraint名の文字列一致に依存しない)");
  } else {
    bad("共有列を参照するCHECK制約の不在検証(legacy_check_constraints_absent判定)が想定した形で見つからない");
  }
  const usesContypeCNotInformationSchema = /con\.contype = 'c'/.test(guardBlock) && !/constraint_type\s*=\s*'CHECK'/i.test(source);
  if (usesContypeCNotInformationSchema) {
    ok("CHECK制約の判定にpg_constraint.contype='c'を使用し、information_schemaのconstraint_type='CHECK'表現(NOT NULLを誤ってCHECKとして検出しうる)を使っていない");
  } else {
    bad("CHECK制約判定がinformation_schemaのconstraint_type='CHECK'を使っている疑いがある(NOT NULLを誤検知しうる禁止パターン)");
  }

  // --- 11b. word_books_share_code_key以外に、share_code/is_sharedの
  //           いずれかを参照する追加のunique index(named UNIQUE制約由来か
  //           素のCREATE UNIQUE INDEXかを問わない)が存在しないことを、
  //           pg_indexで直接厳密に検証すること。legacy_unique_okは既知の
  //           constraint名の存在・性質しか見ないため、別名の追加unique
  //           index(例: 別名のUNIQUE NULLS NOT DISTINCT)を独立に検出する
  //           必要がある。indkey(直接key列)だけでなく、式index・partial
  //           indexのpredicateがpg_dependへ記録する列依存も検出すること
  //           (indkeyだけでは`((coalesce(share_code, '')))`のような式
  //           indexの依存を見逃す)。 ---
  const checksNoExtraUniqueIndexesDirect = /exists \(\s*\n\s*select 1\s*\n\s*from unnest\(i\.indkey\) as constrained_attnum\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = c\.oid\s*\n\s*and a\.attnum = constrained_attnum\s*\n\s*where a\.attname in \('share_code', 'is_shared'\)\s*\n\s*\)/.test(guardBlock);
  const checksNoExtraUniqueIndexesViaPgDepend = /from pg_depend d\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = d\.refobjid\s*\n\s*and a\.attnum = d\.refobjsubid\s*\n\s*where d\.classid = 'pg_class'::regclass\s*\n\s*and d\.objid = i\.indexrelid\s*\n\s*and d\.refclassid = 'pg_class'::regclass\s*\n\s*and d\.refobjid = c\.oid\s*\n\s*and d\.refobjsubid > 0\s*\n\s*and a\.attname in \('share_code', 'is_shared'\)/.test(guardBlock);
  const checksNoExtraUniqueIndexesGate = /from pg_index i\s*\n\s*join pg_class c on c\.oid = i\.indrelid\s*\n\s*join pg_namespace n on n\.oid = c\.relnamespace\s*\n\s*join pg_class ic on ic\.oid = i\.indexrelid\s*\n\s*where n\.nspname = 'public'\s*\n\s*and c\.relname = 'word_books'\s*\n\s*and i\.indisunique\s*\n\s*and ic\.relname <> 'word_books_share_code_key'\s*\n\s*and \(/.test(guardBlock)
    && / into legacy_no_extra_unique_ok;/.test(guardBlock);
  if (checksNoExtraUniqueIndexesDirect && checksNoExtraUniqueIndexesViaPgDepend && checksNoExtraUniqueIndexesGate) {
    ok("word_books_share_code_key以外にshare_code/is_sharedを参照する追加のunique index(named制約由来・素のCREATE UNIQUE INDEXいずれも)が存在しないことを、直接key列(indkey)と式/predicateの列依存(pg_depend)の両方でpg_indexベースに厳密に検証する");
  } else {
    bad("追加unique indexの不在検証(legacy_no_extra_unique_ok判定、indkey/pg_dependの両方の依存経路)が想定した形で見つからない");
  }

  // --- 11c. share_code/is_sharedのいずれかを参照するEXCLUSION制約
  //           (pg_constraint.contype='x')が存在しないことを検証すること。
  //           EXCLUSION制約のbacking indexはindisunique=falseで記録される
  //           ため、legacy_no_extra_unique_okのindisunique条件では検出
  //           できない独立した抜け道であり、別途検証する必要がある。
  //           直接列参照(conkey)と、式による間接参照
  //           (conkeyには0が入り、実際の列依存はEXCLUSION制約の
  //           backing index=con.conindidに対するpg_dependとして記録される)
  //           の両方を検出すること。 ---
  const checksNoExclusionConstraintsDirect = /and con\.contype = 'x'\s*\n\s*and \(\s*\n\s*exists \(\s*\n\s*select 1\s*\n\s*from unnest\(con\.conkey\) as constrained_attnum\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = c\.oid\s*\n\s*and a\.attnum = constrained_attnum\s*\n\s*where a\.attname in \('share_code', 'is_shared'\)\s*\n\s*\)/.test(guardBlock);
  const checksNoExclusionConstraintsViaPgDepend = /or exists \(\s*\n\s*select 1\s*\n\s*from pg_depend d\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = d\.refobjid\s*\n\s*and a\.attnum = d\.refobjsubid\s*\n\s*where d\.classid = 'pg_class'::regclass\s*\n\s*and d\.objid = con\.conindid\s*\n\s*and d\.refclassid = 'pg_class'::regclass\s*\n\s*and d\.refobjid = c\.oid\s*\n\s*and d\.refobjsubid > 0\s*\n\s*and a\.attname in \('share_code', 'is_shared'\)\s*\n\s*\)\s*\n\s*\)\s*\n\s*\) into legacy_no_exclusion_constraints_ok;/.test(guardBlock);
  if (checksNoExclusionConstraintsDirect && checksNoExclusionConstraintsViaPgDepend) {
    ok("share_code/is_sharedを参照するEXCLUSION制約(pg_constraint.contype='x')が存在しないことを、直接列参照(conkey)とcon.conindid経由のpg_depend(式による間接参照)の両方で厳密に検証する(indisunique=falseで記録されるためlegacy_no_extra_unique_okでは検出できない独立した抜け道)");
  } else {
    bad("EXCLUSION制約の不在検証(legacy_no_exclusion_constraints_ok判定、conkey/pg_dependの両方の依存経路)が想定した形で見つからない");
  }

  // --- 11d. share_code/is_sharedのいずれかを参照するFOREIGN KEY制約
  //           (pg_constraint.contype='f')が存在しないことを検証すること。
  //           FOREIGN KEY制約は式ではなく実列のみを参照できるため、
  //           conkeyへの直接列チェックのみで十分(pg_dependのfallback
  //           不要)であることを実PostgreSQL 18.4で確認済み。 ---
  const checksNoForeignKeys = /and con\.contype = 'f'\s*\n\s*and exists \(\s*\n\s*select 1\s*\n\s*from unnest\(con\.conkey\) as constrained_attnum\s*\n\s*join pg_attribute a\s*\n\s*on a\.attrelid = c\.oid\s*\n\s*and a\.attnum = constrained_attnum\s*\n\s*where a\.attname in \('share_code', 'is_shared'\)\s*\n\s*\)\s*\n\s*\) into legacy_no_foreign_keys_ok;/.test(guardBlock);
  if (checksNoForeignKeys) {
    ok("share_code/is_sharedを参照するFOREIGN KEY制約(pg_constraint.contype='f')が存在しないことを、conkey/pg_attributeで厳密に検証する(存在すると生成したshare_codeが参照先に無い限り23503で共有作成が失敗するため)");
  } else {
    bad("FOREIGN KEY制約の不在検証(legacy_no_foreign_keys_ok判定)が想定した形で見つからない");
  }

  // --- 12. legacy_unique_ok・legacy_partial_index_ok・
  //           legacy_check_constraints_absent・legacy_no_extra_unique_ok・
  //           legacy_no_exclusion_constraints_ok・legacy_no_foreign_keys_okの
  //           いずれかがfalseならRAISE EXCEPTIONで中断すること(unique制約
  //           欠如・NULLS NOT DISTINCT・partial index欠如/不一致・共有列を
  //           参照するCHECK制約の存在・別名の追加unique indexの存在・
  //           EXCLUSION制約の存在・FOREIGN KEY制約の存在のいずれも拒否) ---
  const raisesWhenLegacySignatureMismatch = /if not legacy_unique_ok or not legacy_partial_index_ok or not legacy_check_constraints_absent or not legacy_no_extra_unique_ok or not legacy_no_exclusion_constraints_ok or not legacy_no_foreign_keys_ok then\s*\n\s*raise exception using\s*\n\s*errcode = '55000'/.test(guardBlock);
  if (raisesWhenLegacySignatureMismatch) {
    ok("legacy_unique_ok・legacy_partial_index_ok・legacy_check_constraints_absent・legacy_no_extra_unique_ok・legacy_no_exclusion_constraints_ok・legacy_no_foreign_keys_okのいずれかがfalseならRAISE EXCEPTIONで中断する(1箇所でも旧005のsignatureと一致しなければno-op bypassしない)");
  } else {
    bad("legacy signature不一致時のRAISE EXCEPTIONが見つからない");
  }

  // --- 12. 例外を握りつぶすハンドラが無いこと ---
  const hasSwallowingExceptionHandler = /exception\s+when\s+/i.test(guardBlock);
  if (!hasSwallowingExceptionHandler) {
    ok("guard内に例外を握りつぶすEXCEPTION WHENハンドラが無く、RAISEがそのままmigrationを中断させる");
  } else {
    bad("guard内にEXCEPTION WHENハンドラが存在し、RAISEが握りつぶされる可能性がある");
  }

  // --- 13. DEFAULT trueが存在しないこと ---
  const hasDefaultTrue = /default\s+true/i.test(source);
  if (!hasDefaultTrue) {
    ok("DEFAULT trueが存在しない");
  } else {
    bad("DEFAULT trueが検出された");
  }

  // --- 14. ADD COLUMN IF NOT EXISTSが存在しないこと(guardが列不存在を判別するため
  //          不要であり、むしろschema driftを隠す方向に働く) ---
  const hasIfNotExists = /add column if not exists/i.test(source);
  if (!hasIfNotExists) {
    ok("ADD COLUMN IF NOT EXISTSが存在しない(guardが列の状態を判別するため不要)");
  } else {
    bad("ADD COLUMN IF NOT EXISTSが検出された(guardと矛盾し、schema driftを隠す禁止パターン)");
  }

  // --- 15. profiles/word_booksへの既存行UPDATEが存在しないこと(無条件UPDATE禁止) ---
  const hasUpdateStatement = /update\s+public\.(word_books|profiles)/i.test(source);
  if (!hasUpdateStatement) {
    ok("profiles/word_booksへのUPDATEが存在しない(既存データを勝手に変更しない)");
  } else {
    bad("profiles/word_booksへのUPDATEが検出された(既存データを勝手に変更する禁止パターン)");
  }

  // --- 16. DROP文が存在しないこと(0行bypass時にnormalizationのためDROPで
  //           修復しようとしない) ---
  const hasDropStatement = /\bdrop\s+(column|index|constraint|table)\b/i.test(source);
  if (!hasDropStatement) {
    ok("DROP文が存在しない(0行bypass時であってもmalformed schemaをDROPで修復しない)");
  } else {
    bad("DROP文が検出された(既存schemaを勝手に修復する禁止パターン)");
  }

  // --- 17. share_codeの一括生成(gen_random_uuid/encode/random等によるUPDATE)が
  //           存在しないこと ---
  const hasBulkCodeGeneration = /gen_random_uuid\(\)|encode\(|md5\(|random\(\)/i.test(source);
  if (!hasBulkCodeGeneration) {
    ok("share_codeの一括生成コードが存在しない(コード生成はアプリケーション層のみ)");
  } else {
    bad("share_codeの一括生成らしきコードが検出された");
  }

  // --- 18. RLS変更が存在しないこと ---
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
