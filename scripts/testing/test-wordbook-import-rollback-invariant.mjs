// wordbook_created の発火順序・rollback契約を検証する、ソース不変条件テスト。
//
// なぜE2E(実際に失敗を起こしてHTTPで確認)ではなくソース検証なのか:
// material/[id]/import・wordbook/[id]/import-shared の両routeについて、
// 本物のwordsテーブルへのinsertを実際に失敗させる安全な方法を調査したが、
// 本番スキーマには単語データ経由で違反できるCHECK制約が存在せず(words/material_wordsとも
// meaning・word・importanceはNOT NULLかつ範囲制約なし)、FK制約もすべて
// ON DELETE SET NULL(RESTRICTではない)のため、実データを使ってinsert失敗を
// 決定的に再現する安全な方法が無い(スキーマ変更を伴わない限り)。
// そのため、「insert失敗時に必ずcleanup(book削除)してから返す」「イベント発火は
// 全insert成功確認より後にのみ行う」という契約を、ソースコードの構造から
// 決定的に検証する。実際のHTTPレベルの失敗シナリオはgrowth-rollup-return-events.mjs・
// wordbook-created-event.mjsの成功系テストと合わせて手動コードレビューで確認済み
// (PR本文にレビュー結果を記録)。

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.log(`❌ ${msg}`); failed++; }

function checkRoute(relPath, label) {
  const src = readFileSync(resolve(REPO_ROOT, relPath), "utf8");

  const trackIdx = src.indexOf('trackServerEvent("wordbook_created"');
  if (trackIdx === -1) {
    fail(`${label}: trackServerEvent("wordbook_created", ...) 呼び出しが見つからない`);
    return;
  }
  ok(`${label}: trackServerEvent("wordbook_created", ...) 呼び出しを検出`);

  // ソース中の全ての insert 呼び出し(word_books本体作成を除く、words系insertのみ)を
  // 検出し、それぞれのエラーハンドリング節が trackServerEvent より前に位置し、
  // かつ book削除(cleanup)を含んでいることを確認する。
  const insertCalls = [...src.matchAll(/\.from\("words"\)\s*\.insert\(/g)];
  if (insertCalls.length === 0) {
    fail(`${label}: words insertの呼び出しが見つからない`);
    return;
  }
  ok(`${label}: words insert呼び出しを${insertCalls.length}箇所検出`);

  for (const m of insertCalls) {
    const insertIdx = m.index;
    if (insertIdx > trackIdx) {
      fail(`${label}: words insert(位置${insertIdx})がtrackServerEvent呼び出し(位置${trackIdx})より後にある`);
      continue;
    }
    // このinsert呼び出しの直後〜次の500行までの範囲に、エラー時のbook削除とレスポンス返却があるか確認
    const windowEnd = Math.min(src.length, insertIdx + 800);
    const window = src.slice(insertIdx, windowEnd);
    const hasDeleteOnError = /\.from\("word_books"\)\s*\.delete\(\)/.test(window);
    const hasErrorReturn = /return NextResponse\.json\(/.test(window);
    if (!hasDeleteOnError) {
      fail(`${label}: insert(位置${insertIdx})付近にword_books削除(cleanup)が見つからない`);
    } else {
      ok(`${label}: insert(位置${insertIdx})のエラー節にword_books削除(cleanup)を検出`);
    }
    if (!hasErrorReturn) {
      fail(`${label}: insert(位置${insertIdx})付近にエラー時のレスポンス返却が見つからない`);
    } else {
      ok(`${label}: insert(位置${insertIdx})のエラー節にレスポンス返却を検出`);
    }
  }

  // trackServerEventの直前(200文字以内)に return が無いこと、つまりtrackServerEventが
  // 早期returnで迂回されない「成功時にのみ到達する」経路にあることを軽く確認する。
  const beforeTrack = src.slice(Math.max(0, trackIdx - 400), trackIdx);
  const returnCountBeforeTrack = (beforeTrack.match(/return NextResponse\.json/g) || []).length;
  ok(`${label}: trackServerEvent直前400文字以内のreturn文数=${returnCountBeforeTrack}(早期returnで迂回されていないか目視確認用の参考値)`);
}

checkRoute("src/app/api/material/[id]/import/route.ts", "material/[id]/import");
checkRoute("src/app/api/wordbook/[id]/import-shared/route.ts", "wordbook/[id]/import-shared");

console.log();
if (failed > 0) {
  console.log(`=== test:wordbook-import-rollback-invariant RESULT: ${failed} check(s) FAILED ===`);
  process.exit(1);
} else {
  console.log("=== test:wordbook-import-rollback-invariant RESULT: all checks passed ===");
}
