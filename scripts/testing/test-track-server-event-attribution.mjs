/**
 * src/lib/analytics/serverEventAttribution.ts の normalizeServerEventAttribution()
 * 単体テスト(ブラウザ・サーバー・DB不要)。
 *
 * Codexレビュー指摘対応(16巡目、最重要): src/app/auth/callback/route.tsのOAuth
 * signup完了イベント(signup_oauth_completed)は、複数タブが同じlv_aid cookieを
 * 共有している場合にどのタブが実際にOAuthを開始したかの手がかりを一切持たず、
 * scripts/testing/social-acquisition-snapshot.mjsのfindAttribution()が行自身の
 * source/campaign一致による判定を使えないまま、時系列最新のvisitへ誤って帰属して
 * しまっていた(=タブAでOAuth完了してもタブBのvisitへsignupが付け替わる)。
 *
 * 対応として、signup/loginページがOAuth開始タブ自身のsource/campaign
 * (src/lib/analytics/track.tsのbuildOAuthAttributionQuery())をredirectTo URLに
 * 埋め込み、route.tsがOAuthラウンドトリップ後にそれを読み取ってtrackServerEvent()の
 * source/campaignオプションへそのまま渡す設計にした。trackServerEvent()自体は
 * "@/lib/supabase/admin"(path alias)をimportしておりプレーンなnode実行から直接
 * importできないため、その正規化ロジック(100文字切り詰め・null既定値)だけを
 * import不要な純粋関数として切り出したnormalizeServerEventAttribution()を、
 * src/lib/auth/googleOauthSignup.tsと同じパターンで直接検証する。
 *
 * 実際のGoogle OAuthラウンドトリップ自体(redirectTo→OAuth provider→callback)は
 * 自動テストで再現できないため対象外。URL round trip自体は既存のnext=パラメータが
 * 同じ仕組みで問題なく往復していることで経路自体の妥当性を担保する。
 *
 * 使い方: node scripts/testing/test-track-server-event-attribution.mjs
 */
import { normalizeServerEventAttribution } from "../../src/lib/analytics/serverEventAttribution.ts";

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

// ── source/campaignが渡された場合、そのまま(トップレベル列として)保存される値を返す ──
assertEqual(
  normalizeServerEventAttribution("x", "campOAuthAttrTest"),
  { source: "x", campaign: "campOAuthAttrTest" },
  "source/campaignを渡すとそのまま返す(route.tsがtrackServerEvent()のsource/campaignとして使う値)"
);

// ── 100文字を超える値は/api/analytics/events(クライアント側送信経路)と同じ
//    「未信用のまま100文字に切り詰めて保存」方針で切り詰められる(このURLクエリ
//    パラメータはOAuthラウンドトリップを経由するため、理論上第三者が改変したURLで
//    このエンドポイントを直接叩くことも可能であり、素通しにしない) ──
{
  const longSource = "s".repeat(150);
  const longCampaign = "c".repeat(150);
  assertEqual(
    normalizeServerEventAttribution(longSource, longCampaign),
    { source: longSource.slice(0, 100), campaign: longCampaign.slice(0, 100) },
    "100文字を超えるsource/campaignは、クライアント側送信経路と同じく100文字に切り詰められる"
  );
}

// ── source/campaignを渡さない(undefined)場合は従来どおりnullのまま(既存呼び出し元
//    (五単語/十単語追加マイルストーン等)との後方互換の回帰確認) ──
assertEqual(
  normalizeServerEventAttribution(undefined, undefined),
  { source: null, campaign: null },
  "source/campaignを渡さない場合は従来どおりnullのまま(既存呼び出し元との後方互換)"
);

// ── nullを明示的に渡した場合もnullのまま ──
assertEqual(
  normalizeServerEventAttribution(null, null),
  { source: null, campaign: null },
  "source/campaignにnullを明示的に渡してもnullのまま"
);

// ── 文字列以外の値が混入しても例外を投げず安全にnullへフォールバックする ──
assertEqual(
  normalizeServerEventAttribution(123, {}),
  { source: null, campaign: null },
  "source/campaignが文字列以外の場合は例外を投げずnullへフォールバックする"
);

console.log(
  fail === 0
    ? "\n=== test:track-server-event-attribution: ALL CHECKS PASSED ==="
    : "\n=== test:track-server-event-attribution: FAILED ==="
);
process.exit(fail === 0 ? 0 : 1);
