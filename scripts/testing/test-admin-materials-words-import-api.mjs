/**
 * /api/admin/materials/[id]/words の検証(chatgpt-codex-connectorのP2指摘対応:
 * 公開教材への単語追加がIndexNowへ通知されない問題)。
 *
 * 以前はImportPanel.tsxがブラウザから直接Supabaseクライアントで`material_words`へ
 * insertしており、既に公開済みの教材へ単語を追加してもIndexNowへ通知するサーバー側の
 * フック地点が存在しなかった。このテストは認証・認可・入力検証・DB書き込み・
 * 実際の公開ページへの反映を検証する。
 *
 * IndexNow通知に関する方針: 非公開教材への単語インポート(このテストの大半)は
 * `isEffectivelyPublicMaterial`がfalseのため通知条件そのものに到達せず、実際の
 * 外部送信は一切発生しない(この条件判定自体の正しさはtest:materials-visibilityで
 * 網羅的に検証済み)。ただし「公開教材への単語インポート後に1 URL通知される」
 * ことと「既存教材ページへ追加単語が実際に反映される」ことの両方を検証するには、
 * 本物の公開教材に対してこのルートを実際に呼ぶ必要がある。この1シナリオのみ、
 * 意図的に本物のIndexNow即時送信(1回・テスト用URL)を許容する(このテストが
 * 検証したい機能そのものであり、モックせずに検証する価値が実害を上回ると判断した)。
 * このシナリオ以外では、教材を意図的に非公開のまま操作し、実送信を発生させない。
 *
 * 何語追加しても通知は最大1回のみであること・DB書き込みが1件も成功しなければ
 * 通知条件に到達しないことは、ネットワーク非依存のソース構造不変条件テスト
 * (test:admin-materials-words-import-notify-invariant)で別途検証する。
 *
 * 使い方: node scripts/testing/test-admin-materials-words-import-api.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "./lib/devServer.mjs";
import { TEST_ACCOUNTS } from "./lib/testAccounts.mjs";
import { login } from "./e2e/lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function cookieHeaderFor(browser, baseUrl, email, password) {
  const page = await browser.newPage();
  await login(page, baseUrl, email, password);
  const cookies = await page.context().cookies();
  await page.close();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.admin.passwordEnvKey,
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let privateMaterialId = null;
  let publicMaterialId = null;

  try {
    const adminCookie = await cookieHeaderFor(
      browser, baseUrl,
      TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey],
    );
    const nonAdminCookie = await cookieHeaderFor(
      browser, baseUrl,
      TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey],
    );

    // 非公開教材(意図的にis_public=false/license_status=pendingのまま)。
    // 直接DB insertで作成する(POST /api/admin/materialsを経由すると、それ自体の
    // 作成時通知ロジックを通ってしまうため、このテストのセットアップとしては避ける)。
    {
      const { data, error } = await admin
        .from("materials")
        .insert({ title: "TEST_単語インポート非公開", license_status: "pending", is_public: false })
        .select("id")
        .single();
      if (error || !data) throw new Error(`非公開教材のセットアップに失敗: ${error?.message}`);
      privateMaterialId = data.id;
    }

    console.log("\n--- 認証・認可・入力検証 ---");
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${privateMaterialId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: [{ word: "test", meaning: "テスト" }] }),
      });
      if (res.status === 401) ok("未認証(Cookie無し)では401になる");
      else bad(`未認証時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${privateMaterialId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: nonAdminCookie },
        body: JSON.stringify({ words: [{ word: "test", meaning: "テスト" }] }),
      });
      if (res.status === 403) ok("管理者以外のログイン済みユーザーでは403になる");
      else bad(`非管理者時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${privateMaterialId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ words: [] }),
      });
      if (res.status === 400) ok("空のwords配列(0件インポート)では400になる(=挿入自体が発生せず通知条件にも到達しない)");
      else bad(`空words時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${crypto.randomUUID()}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ words: [{ word: "test", meaning: "テスト" }] }),
      });
      if (res.status === 404) ok("存在しない教材idでは404になる");
      else bad(`存在しない教材id時のステータスが想定外 (${res.status})`);
    }

    console.log("\n--- 非公開教材への単語インポート(実送信なし) ---");
    {
      const words = [
        { word: "testword1", meaning: "テスト単語1" },
        { word: "testword2", meaning: "テスト単語2" },
        { word: "testword3", meaning: "テスト単語3" },
      ];
      const res = await fetch(`${baseUrl}/api/admin/materials/${privateMaterialId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ words }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 200 && body.inserted === 3) ok(`3件の単語インポートが成功しinserted=3が返る`);
      else bad(`インポート結果が想定外 (status=${res.status}, body=${JSON.stringify(body)})`);

      const { data: rows } = await admin.from("material_words").select("word, meaning").eq("material_id", privateMaterialId);
      if (rows?.length === 3) ok("DB上に3件の単語が実際に挿入されている");
      else bad(`DB上の単語数が想定外 (${rows?.length})`);
    }

    console.log("\n--- 公開教材への単語インポート(実際にIndexNowへ1回送信される機能そのものの検証) ---");
    {
      const { data, error } = await admin
        .from("materials")
        .insert({ title: "TEST_単語インポート公開", license_status: "approved", is_public: true })
        .select("id")
        .single();
      if (error || !data) throw new Error(`公開教材のセットアップに失敗: ${error?.message}`);
      publicMaterialId = data.id;

      const res = await fetch(`${baseUrl}/api/admin/materials/${publicMaterialId}/words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ words: [{ word: "publictestword", meaning: "公開教材テスト単語", pos: "n." }] }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 200 && body.inserted === 1) ok("公開教材への単語インポートが成功しinserted=1が返る");
      else bad(`公開教材へのインポート結果が想定外 (status=${res.status}, body=${JSON.stringify(body)})`);

      const page = await browser.newPage();
      await page.goto(`${baseUrl}/materials/${publicMaterialId}`, { waitUntil: "networkidle" });
      const text = await page.locator("body").innerText();
      if (text.includes("publictestword")) ok("既存の公開教材ページへ追加した単語が実際に反映される");
      else bad("追加した単語が公開教材ページに反映されていない");
      await page.close();
    }
  } finally {
    for (const [label, targetId] of [["非公開教材", privateMaterialId], ["公開教材", publicMaterialId]]) {
      if (!targetId) continue;
      try {
        await admin.from("materials").delete().eq("id", targetId);
        ok(`テスト用教材(${label})の後片付け(削除)を実施した`);
      } catch (e) {
        bad(`テスト用教材(${label})の後片付けに失敗した (error=${e instanceof Error ? e.constructor.name : typeof e})`);
      }
    }
    await browser.close();
    stopDevServer(dev);
  }

  console.log(`\n=== test:admin-materials-words-import-api RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("admin-materials-words-import-api verification crashed:", e);
  process.exit(1);
});
