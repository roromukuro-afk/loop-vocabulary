/**
 * /api/admin/materials・/api/admin/materials/[id] の検証。
 *
 * 以前はMaterialAdminTable.tsxがブラウザから直接Supabaseクライアントで
 * `materials`テーブルへ書き込んでおり、サーバー側のフック地点が存在しなかった
 * (IndexNowページ個別即時通知にはサーバールートが必要なため、この2ファイルを新設した)。
 *
 * このテストが検証するのは認証・認可・CRUD・実DB状態の一致のみ。IndexNowへの
 * 実際の外部送信は検証しない(このテストプロセスからは観測できないサーバー内部の
 * after()フックで非同期に発火するため、かつテストの度に実際のIndexNow APIへ
 * 送信するのは不必要な外部呼び出しになる)。IndexNow送信要否の判定ロジック
 * (isEffectivelyPublicMaterial)自体はtest:materials-visibilityで、送信処理
 * 自体(submitUrlsToIndexNow)はtest:indexnow-submitで、それぞれネットワーク非依存の
 * 単体テストとして別途検証済み。
 *
 * 使い方: node scripts/testing/test-admin-materials-api.mjs
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
  let createdId = null; // raw fetch経由で作成した教材のID
  let uiCreatedId = null; // UIのフォーム操作経由で作成した教材のID(finallyで独立に後片付けする)

  try {
    const adminCookie = await cookieHeaderFor(
      browser, baseUrl,
      TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey],
    );
    const nonAdminCookie = await cookieHeaderFor(
      browser, baseUrl,
      TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey],
    );

    console.log("\n--- 認証・認可 ---");
    {
      const res = await fetch(`${baseUrl}/api/admin/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "TEST_未認証" }),
      });
      if (res.status === 401) ok("未認証(Cookie無し)では401になる");
      else bad(`未認証時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: nonAdminCookie },
        body: JSON.stringify({ title: "TEST_非管理者" }),
      });
      if (res.status === 403) ok("管理者以外のログイン済みユーザーでは403になる");
      else bad(`非管理者時のステータスが想定外 (${res.status})`);
    }

    console.log("\n--- 管理者によるCRUD ---");
    {
      const res = await fetch(`${baseUrl}/api/admin/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({
          title: "TEST_教材APIテスト",
          publisher: "TEST出版社",
          license_status: "pending",
          is_public: false,
        }),
      });
      if (res.status !== 200) {
        bad(`新規作成が失敗した (status=${res.status})`);
      } else {
        const body = await res.json();
        createdId = body.material?.id;
        if (createdId) ok(`新規作成に成功し material.id が返る (${createdId})`);
        else bad(`新規作成のレスポンスにmaterial.idが無い: ${JSON.stringify(body)}`);
      }
    }
    if (!createdId) throw new Error("createdIdが取得できず後続テストを継続できない");

    {
      const { data } = await admin.from("materials").select("title, publisher, license_status, is_public").eq("id", createdId).maybeSingle();
      if (data?.title === "TEST_教材APIテスト" && data?.publisher === "TEST出版社" && data?.license_status === "pending" && data?.is_public === false) {
        ok("DB上の値がリクエストしたフィールドと一致する");
      } else {
        bad(`DB上の値が想定外: ${JSON.stringify(data)}`);
      }
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ is_public: true }),
      });
      const { data } = await admin.from("materials").select("is_public").eq("id", createdId).maybeSingle();
      if (res.status === 200 && data?.is_public === true) ok("is_publicのPATCHが成功しDBに反映される");
      else bad(`is_public PATCH後の状態が想定外 (status=${res.status}, is_public=${data?.is_public})`);
    }
    {
      // "approved"/"original"は選ばない: is_publicを既にtrueへ変更済みのため、
      // ここで"approved"にすると実際に公開可視性が発生し、after()経由で本物の
      // IndexNow外部送信が発火してしまう(このテスト用教材は直後に削除される)。
      // "denied"であればPATCH自体の反映確認はできつつ可視性の遷移を起こさない。
      const res = await fetch(`${baseUrl}/api/admin/materials/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ license_status: "denied" }),
      });
      const { data } = await admin.from("materials").select("license_status").eq("id", createdId).maybeSingle();
      if (res.status === 200 && data?.license_status === "denied") ok("license_statusのPATCHが成功しDBに反映される");
      else bad(`license_status PATCH後の状態が想定外 (status=${res.status}, license_status=${data?.license_status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ license_note: "TEST_許諾メモ" }),
      });
      const { data } = await admin.from("materials").select("license_note").eq("id", createdId).maybeSingle();
      if (res.status === 200 && data?.license_note === "TEST_許諾メモ") ok("license_noteのPATCHが成功しDBに反映される");
      else bad(`license_note PATCH後の状態が想定外 (status=${res.status}, license_note=${data?.license_note})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: nonAdminCookie },
        body: JSON.stringify({ is_public: false }),
      });
      if (res.status === 403) ok("非管理者はPATCHも403になる");
      else bad(`非管理者PATCHのステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${createdId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      });
      const { data } = await admin.from("materials").select("id").eq("id", createdId).maybeSingle();
      if (res.status === 200 && !data) {
        ok("DELETEが成功しDBから実際に削除される");
        createdId = null; // finallyでの二重削除試行を防ぐ
      } else {
        bad(`DELETE後の状態が想定外 (status=${res.status}, 残存レコード=${JSON.stringify(data)})`);
      }
    }
    {
      const res = await fetch(`${baseUrl}/api/admin/materials/${crypto.randomUUID()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ is_public: true }),
      });
      if (res.status === 404) ok("存在しないidへのPATCHは404になる");
      else bad(`存在しないid PATCH時のステータスが想定外 (${res.status})`);
    }

    console.log("\n--- /admin/materials 画面のUI操作(fetch()配線の実動作確認) ---");
    // 上のセクションはAPIルート自体をraw fetchで直接検証した。ここでは
    // MaterialAdminTable.tsx(以前はブラウザから直接Supabaseクライアントで書き込んで
    // いたが、サーバールート経由のfetch()呼び出しに置き換えた)自体が壊れていないか、
    // 実際のフォーム入力・ボタンクリックを通して確認する。
    {
      const uiTitle = `TEST_UI教材_${Date.now()}`;
      const page = await browser.newPage();
      page.on("dialog", (d) => d.accept()); // remove()のconfirm()を自動承認
      await login(page, baseUrl, TEST_ACCOUNTS.admin.email, process.env[TEST_ACCOUNTS.admin.passwordEnvKey]);
      await page.goto(`${baseUrl}/admin/materials`, { waitUntil: "networkidle" });

      await page.locator('[data-testid="material-create-toggle"]').click();
      await page.locator('[data-testid="material-title-input"]').fill(uiTitle);
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/api/admin/materials") && r.request().method() === "POST"),
        page.locator('[data-testid="material-create-submit"]').click(),
      ]);
      await page.waitForLoadState("networkidle");

      const { data: created } = await admin.from("materials").select("id, is_public").eq("title", uiTitle).maybeSingle();
      if (created) ok(`UIフォームからの新規作成がDBに反映される (id=${created.id})`);
      else bad("UIフォームからの新規作成がDBに反映されていない");

      // UI POST成功直後、削除テストの成否に関わらずfinallyで必ず後片付けできるよう、
      // raw fetch側のcreatedIdとは独立にここで登録する(chatgpt-codex-connectorのP2指摘対応:
      // 以前はDELETEが失敗・timeout・例外になった場合、このID自体がどこにも保持されず
      // scheduled canaryの実行のたびにTEST_UI教材_*が本番DBへ蓄積してしまっていた)。
      if (created) uiCreatedId = created.id;

      if (created) {
        const row = page.locator("tr", { hasText: uiTitle });
        await Promise.all([
          page.waitForResponse((r) => r.url().includes(`/api/admin/materials/${created.id}`) && r.request().method() === "PATCH"),
          row.locator('[data-testid="material-toggle-public"]').click(),
        ]);
        await page.waitForLoadState("networkidle");
        const { data: afterToggle } = await admin.from("materials").select("is_public").eq("id", created.id).maybeSingle();
        if (afterToggle?.is_public === true) ok("UIの公開切り替えボタンでis_publicがtrueになる");
        else bad(`UIの公開切り替え後の状態が想定外 (is_public=${afterToggle?.is_public})`);

        await Promise.all([
          page.waitForResponse((r) => r.url().includes(`/api/admin/materials/${created.id}`) && r.request().method() === "DELETE"),
          row.locator('[data-testid="material-delete"]').click(),
        ]);
        await page.waitForLoadState("networkidle");
        const { data: afterDelete } = await admin.from("materials").select("id").eq("id", created.id).maybeSingle();
        if (!afterDelete) {
          ok("UIの削除ボタンでDBから実際に削除される");
          uiCreatedId = null; // 削除済みのため、finallyでの二重削除試行を防ぐ
        } else {
          bad("UIの削除ボタンをクリックしたがDBに行が残っている");
        }
      }

      await page.close();
    }
  } finally {
    // raw fetch側・UI側、それぞれ独立に追跡したIDを取りこぼしなく後片付けする。
    // 一方の削除が失敗しても、値そのものは漏らさずID・エラー種別のみ記録し、
    // もう一方の後片付けは継続する。
    for (const [label, targetId] of [["raw fetch側", createdId], ["UI経由", uiCreatedId]]) {
      if (!targetId) continue;
      try {
        await admin.from("materials").delete().eq("id", targetId);
        ok(`テスト用教材(${label})の後片付け(削除)を実施した`);
      } catch (e) {
        bad(`テスト用教材(${label})の後片付けに失敗した (error=${e instanceof Error ? e.constructor.name : typeof e})`);
      }
    }
    // 過去の実行がDELETE失敗等で残した"TEST_UI教材_*"の残留データを、安全な完全一致prefixで
    // 追加清掃する。実際の教材タイトルがこの日本語テストマーカーと偶然一致することは
    // 現実的にないため、本番の通常教材を誤削除するリスクは無い。
    try {
      const { data: leftovers } = await admin.from("materials").select("id, title").like("title", "TEST_UI教材_%");
      if (leftovers && leftovers.length > 0) {
        await admin.from("materials").delete().like("title", "TEST_UI教材_%");
        ok(`過去実行の残留テストデータ${leftovers.length}件を追加清掃した`);
      }
    } catch (e) {
      bad(`残留テストデータの清掃に失敗した (error=${e instanceof Error ? e.constructor.name : typeof e})`);
    }
    await browser.close();
    stopDevServer(dev);
  }

  console.log(`\n=== test:admin-materials-api RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("admin-materials-api verification crashed:", e);
  process.exit(1);
});
