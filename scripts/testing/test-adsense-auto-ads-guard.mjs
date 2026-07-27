/**
 * AdSense Auto ads 初期化ガードの単体テスト（ブラウザ・サーバー不要）。
 *
 * 実装本体（src/lib/ads/autoAdsInitScript.ts）が生成するスクリプト文字列を、
 * vm モジュールでフェイクの window を持つコンテキストに対して2回実行し、
 * push({enable_page_level_ads:true}) がちょうど1回だけ呼ばれることを確認する。
 * これは「App Routerのクライアント側遷移でAdSenseLoaderが許可ルート↔非許可ルート間で
 * アンマウント/リマウントされ、同一ドキュメント内でinit scriptが複数回実行される」状況を
 * 直接シミュレートしている（'Only one enable_page_level_ads allowed per page' の再現条件）。
 *
 * 使い方: node scripts/testing/test-adsense-auto-ads-guard.mjs
 */
import vm from "node:vm";
import { buildAutoAdsInitScript } from "../../src/lib/ads/autoAdsInitScript.ts";

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`✅ ${label}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   got:      ${JSON.stringify(actual)}\n   expected: ${JSON.stringify(expected)}`);
  }
}

function makeFakeWindow() {
  const pushCalls = [];
  const win = {};
  win.window = win;
  win.adsbygoogle = {
    push(arg) {
      pushCalls.push(arg);
    },
  };
  return { win, pushCalls };
}

// 1. 同一ドキュメント内で2回実行（アンマウント→リマウントを模擬）しても push は1回だけ
{
  const { win, pushCalls } = makeFakeWindow();
  const script = buildAutoAdsInitScript("ca-pub-TEST123");
  const ctx = vm.createContext(win);
  vm.runInContext(script, ctx);
  vm.runInContext(script, ctx); // 2回目（remount相当）
  assertEqual(pushCalls.length, 1, "同一window内で2回実行してもpushは1回だけ");
  assertEqual(pushCalls[0], { google_ad_client: "ca-pub-TEST123", enable_page_level_ads: true }, "pushの引数が正しい");
}

// 2. 3回以上実行しても増えない（念のため）
{
  const { win, pushCalls } = makeFakeWindow();
  const script = buildAutoAdsInitScript("ca-pub-TEST123");
  const ctx = vm.createContext(win);
  for (let i = 0; i < 5; i++) vm.runInContext(script, ctx);
  assertEqual(pushCalls.length, 1, "5回実行してもpushは1回だけ");
}

// 3. 新しいドキュメント（=新しいwindowオブジェクト、実際のフルページロード相当）では
//    フラグが引き継がれないため、改めて1回pushされる（正常系が壊れていないことの確認）
{
  const { win: winA, pushCalls: callsA } = makeFakeWindow();
  const { win: winB, pushCalls: callsB } = makeFakeWindow();
  const script = buildAutoAdsInitScript("ca-pub-TEST123");
  vm.runInContext(script, vm.createContext(winA));
  vm.runInContext(script, vm.createContext(winB));
  assertEqual(callsA.length, 1, "フルページロード後の新しいwindowでもpushされる(A)");
  assertEqual(callsB.length, 1, "フルページロード後の新しいwindowでもpushされる(B)");
}

console.log(fail === 0 ? "\n=== test:adsense-auto-ads-guard: ALL CHECKS PASSED ===" : "\n=== test:adsense-auto-ads-guard: FAILED ===");
process.exit(fail === 0 ? 0 : 1);
