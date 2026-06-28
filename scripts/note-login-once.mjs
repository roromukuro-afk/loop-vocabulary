/**
 * note.com 1回限りのログインセットアップ
 * このスクリプトを1回実行してnote.comにログインするだけで、
 * 以降はnote-post-auto.mjsが完全自動で動作します。
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, "..", "note-session");
mkdirSync(SESSION_DIR, { recursive: true });

console.log("====================================");
console.log("  note.com セッション初期設定");
console.log("====================================");
console.log("\n📌 ブラウザが開きます。");
console.log("   note.com にログインしてください。");
console.log("   ログイン完了後、このスクリプトが自動で続行します。\n");

const context = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  slowMo: 50,
  viewport: { width: 1280, height: 900 },
  locale: "ja-JP",
});

const page = context.pages()[0] || await context.newPage();
await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });

console.log("========================================");
console.log("  ブラウザが開きました。");
console.log("  note.comのログイン画面が表示されています。");
console.log("  TwitterまたはGoogleでログインしてください。");
console.log("  ログイン後、自動で続行します（最大5分待機）。");
console.log("========================================\n");

// ログイン完了を2段階で検出
let isLoggedIn = false;

// ステップ1: ログインページを離れるまで待つ（5分）
try {
  await page.waitForFunction(
    () => {
      const url = window.location.href;
      return !url.includes("/login") && !url.includes("/signup") && !url.includes("/oauth");
    },
    undefined,           // arg (不要)
    { timeout: 300000, polling: 1000 }
  );

  await page.waitForTimeout(3000);

  // ステップ2: ユーザーアバターや認証要素を確認
  const userElements = await page.evaluate(() => {
    const selectors = [
      '[class*="avatar"]', '[class*="user-icon"]', '[class*="UserIcon"]',
      '[data-testid*="user"]', 'img[alt*="アバター"]', 'img[alt*="avatar"]',
      'a[href*="/dashboard"]', 'a[href*="/notes/new"]',
    ];
    for (const sel of selectors) {
      if (document.querySelector(sel)) return sel;
    }
    return null;
  });

  if (userElements || !page.url().includes("/login")) {
    isLoggedIn = true;
  }
} catch (e) {
  console.log("  タイムアウト or エラー:", e.message.slice(0, 60));
}

if (isLoggedIn) {
  console.log(`✅ ログイン完了: ${page.url()}`);
  console.log(`✅ セッション保存先: ${SESSION_DIR}`);
  console.log("\n🎉 投稿スクリプトを起動します...");
  await context.close();

  // ログイン成功後すぐに投稿自動化を実行
  const { execSync } = await import("child_process");
  try {
    console.log("\n====== 自動投稿を開始します ======\n");
    execSync("node scripts/note-post-auto.mjs", {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
    });
  } catch (e2) {
    console.error("投稿スクリプトエラー:", e2.message);
  }
} else {
  console.log("❌ ログインが確認できませんでした。");
  console.log("   ブラウザを閉じます。再度このスクリプトを実行してログインしてください。");
  await context.close();
}
