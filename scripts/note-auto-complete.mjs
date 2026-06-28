/**
 * note.com 完全自動投稿 (実Chromeバイナリ+プロファイル版)
 * Chrome 127+ の v20 App Bound暗号化に対応:
 * → 実際のChrome.exeをPlaywrightのlaunchPersistentContextで起動
 * → Chromeが自分でcookieを復号 → note.comに自動ログイン状態
 *
 * 手順:
 * 1. Chrome停止 → ロックファイル削除
 * 2. launchPersistentContext(Chromeプロファイル, { channel: "chrome" })
 * 3. note.comはすでにログイン済み → 3記事を自動投稿
 * 4. プロフィール設定
 * 5. Chrome再起動
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync, spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(__dirname, "..", "note-articles");
const ssDir = join(__dirname, "..", "note-screenshots-final");
const imgDir = join(__dirname, "..", "note-images");
mkdirSync(ssDir, { recursive: true });
mkdirSync(imgDir, { recursive: true });

const CHROME_USER_DATA = process.env.LOCALAPPDATA + "\\Google\\Chrome\\User Data";
const CHROME_EXE = existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";

const ARTICLES = [
  {
    file: "01_wasurenai-tango-kioku.md",
    title: "英単語、何度やっても覚えられない人へ。「忘却曲線」を使ったら3ヶ月で1,000語定着した話",
    imgFile: "cover1.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app",
  },
  {
    file: "02_toeic-tango-houhou.md",
    title: "TOEIC 730点 → 900点。スコアが上がらない原因は「単語の覚え方」にありました",
    imgFile: "cover2.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app/vocab-check/toeic",
  },
  {
    file: "03_eitango-app-hikaku.md",
    title: "【2026年版】英単語アプリを本気で使い比べた結果、違いがはっきりわかった",
    imgFile: "cover3.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app",
  },
];

const PROFILE = {
  displayName: "Loop Vocabulary",
  bio: "英語学習アプリ「Loop Vocabulary」の公式note。忘却曲線を活用した英単語学習法・TOEIC/英検対策を発信中。アプリ無料🔗 https://loop-vocabulary.vercel.app",
  websiteUrl: "https://loop-vocabulary.vercel.app",
};

// ─── Chrome管理 ──────────────────────────────────────────────
async function killChrome() {
  console.log("🛑 Chrome停止中...");
  try { execSync("taskkill /F /IM chrome.exe", { stdio: "pipe" }); } catch {}
  await sleep(2500);
  // ロックファイル削除
  for (const lockFile of [
    join(CHROME_USER_DATA, "SingletonLock"),
    join(CHROME_USER_DATA, "SingletonCookie"),
    join(CHROME_USER_DATA, "Default", "LOCK"),
  ]) {
    try { if (existsSync(lockFile)) { unlinkSync(lockFile); console.log(`  🔓 ${lockFile} 削除`); } } catch {}
  }
  console.log("✅ Chrome停止完了");
}

function restartChromeNormal() {
  if (existsSync(CHROME_EXE)) {
    spawn(CHROME_EXE, [], { detached: true, stdio: "ignore" }).unref();
    console.log("✅ Chrome再起動 (通常モード)");
  }
}

// ─── テキスト整形 ─────────────────────────────────────────────
function mdToPlain(mdPath) {
  return readFileSync(mdPath, "utf-8")
    .replace(/^#\s.+\n\n?/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^-{3,}$/gm, "")
    .replace(/^\|.+\|$/gm, m =>
      m.replace(/\|/g, " ").replace(/\s{2,}/g, " ").trim()
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── タイトル入力 ─────────────────────────────────────────────
async function fillTitle(page, title) {
  const found = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[contenteditable], [data-placeholder]"));
    const el = all.find(e => {
      const ph = e.getAttribute("data-placeholder") || "";
      return (ph.includes("タイトル") || ph.includes("title")) && e.offsetHeight > 0;
    });
    if (el) { el.focus(); el.innerText = ""; return "byPlaceholder"; }
    const nonProse = all.find(e =>
      e.getAttribute("contenteditable") !== null &&
      !e.classList.contains("ProseMirror") && e.offsetHeight > 0
    );
    if (nonProse) { nonProse.focus(); nonProse.innerText = ""; return "byNonProse"; }
    return null;
  });
  if (!found) await page.mouse.click(640, 180);
  await sleep(200);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(100);
  await page.keyboard.type(title, { delay: 15 });
  console.log(`  ✅ タイトル入力完了 [${found || "coord"}]`);
}

// ─── 本文入力 ─────────────────────────────────────────────────
async function fillBody(page, bodyText) {
  const pm = page.locator(".ProseMirror").first();
  if (!(await pm.isVisible({ timeout: 6000 }).catch(() => false))) {
    console.log("  ⚠️ ProseMirror未検出");
    return;
  }
  await pm.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(300);
  await page.evaluate(text => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    document.activeElement.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
    );
  }, bodyText);
  await sleep(2000);
  console.log("  ✅ 本文入力完了");
}

// ─── カバー画像アップロード ───────────────────────────────────
async function uploadCoverImage(page, imgPath) {
  if (!existsSync(imgPath)) { console.log("  ⚠️ カバー画像ファイルなし"); return false; }

  // note.com エディタのカバー画像エリアを探す
  // 通常はエディタ上部に「カバー画像を設定」のボタンがある
  const coverBtnSels = [
    'button[aria-label*="カバー"]',
    'button:has-text("カバー画像")',
    '[data-testid*="cover"]',
    '.p-noteEditor__addCover, .o-noteEditContainer__addCoverImage',
  ];
  for (const sel of coverBtnSels) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click();
      await sleep(800);
      const fi = page.locator('input[type="file"]').first();
      if (await fi.count() > 0) {
        await fi.setInputFiles(imgPath);
        await sleep(3000);
        console.log("  ✅ カバー画像アップロード完了");
        return true;
      }
    }
  }

  // エディタツールバーの画像ボタン経由
  const imgBtnSels = [
    'button[aria-label*="画像"], button[aria-label*="image"]',
    '[data-testid="image-upload-button"]',
  ];
  for (const sel of imgBtnSels) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click();
      await sleep(800);
      const fi = page.locator('input[type="file"]').first();
      if (await fi.count() > 0) {
        await fi.setInputFiles(imgPath);
        await sleep(3000);
        console.log("  ✅ 画像挿入完了 (ツールバー)");
        return true;
      }
    }
  }

  console.log("  ⚠️ カバー画像UIが見つかりません → スキップ");
  return false;
}

// ─── 記事公開 ────────────────────────────────────────────────
async function publishArticle(page, label) {
  try {
    const c = page.locator('button:has-text("閉じる")').first();
    if (await c.isVisible({ timeout: 500 })) await c.click();
  } catch {}

  const goBtn = page.locator('button:has-text("公開に進む")').first();
  if (!(await goBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    await page.screenshot({ path: join(ssDir, `${label}_nopub.png`) });
    console.log("  ❌ 「公開に進む」ボタンなし");
    return null;
  }
  await goBtn.click();
  console.log("  ✅ 「公開に進む」クリック");
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, `${label}_modal.png`) });

  if (await page.locator(':text("タイトル、本文を入力してください")').isVisible({ timeout: 500 }).catch(() => false)) {
    console.log("  ⚠️ タイトルエラー → リトライ");
    return null;
  }

  const confirmBtn = page.locator('button:has-text("公開する"), button:has-text("投稿する")').first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click();
    console.log("  ✅ 「公開する」クリック");
  }

  try {
    await page.waitForURL(/note\.com\/.+\/n\/n[a-z0-9]+/, { timeout: 30000 });
    const url = page.url();
    console.log(`  🎉 公開完了: ${url}`);
    await page.screenshot({ path: join(ssDir, `${label}_done.png`) });
    return url;
  } catch {
    await page.screenshot({ path: join(ssDir, `${label}_timeout.png`) });
    console.log(`  ⚠️ URL未変化: ${page.url()}`);
    return null;
  }
}

// ─── プロフィール設定 ─────────────────────────────────────────
async function setupProfile(page) {
  console.log("\n⚙️  プロフィール設定中...");
  await page.goto("https://note.com/settings/profile", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "profile_01.png") });

  // 表示名
  for (const sel of ['input[name="nickname"]','input[name="name"]','input[placeholder*="ニックネーム"]','input[placeholder*="表示名"]','input[placeholder*="アカウント名"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.displayName);
      console.log("  ✅ 表示名:", PROFILE.displayName); break;
    }
  }
  // 自己紹介
  for (const sel of ['textarea[name="description"]','textarea[name="bio"]','textarea[placeholder*="自己紹介"]','textarea[placeholder*="プロフィール"]','textarea[placeholder*="あなたのこと"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.bio);
      console.log("  ✅ 自己紹介設定完了"); break;
    }
  }
  // URL
  for (const sel of ['input[name="website_url"]','input[name="url"]','input[placeholder*="URL"]','input[type="url"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.websiteUrl);
      console.log("  ✅ WebサイトURL:", PROFILE.websiteUrl); break;
    }
  }
  await sleep(500);
  await page.screenshot({ path: join(ssDir, "profile_02.png") });
  // 保存
  for (const sel of ['button:has-text("保存")','button[type="submit"]']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click(); console.log("  ✅ 保存クリック"); await sleep(3000); break;
    }
  }
  await page.screenshot({ path: join(ssDir, "profile_03.png") });
  console.log("  ✅ プロフィール設定完了");
}

// ─── メイン ──────────────────────────────────────────────────
async function main() {
  console.log("====================================");
  console.log("  note.com 完全自動投稿 (Chrome実行バイナリ版)");
  console.log("====================================\n");

  // 1. Chrome停止 + ロック解除
  await killChrome();

  // 2. カバー画像撮影 (認証不要)
  console.log("\n📸 カバー画像を撮影中...");
  const coverBrowser = await chromium.launch({ headless: true });
  const coverPage = await coverBrowser.newPage();
  await coverPage.setViewportSize({ width: 1200, height: 630 });
  for (const art of ARTICLES) {
    const imgPath = join(imgDir, art.imgFile);
    try {
      await coverPage.goto(art.screenshotUrl, { waitUntil: "networkidle", timeout: 30000 });
      await sleep(2000);
      await coverPage.screenshot({ path: imgPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      console.log(`  ✅ ${art.imgFile} 保存完了`);
    } catch (e) {
      console.log(`  ⚠️ ${art.imgFile} 失敗: ${e.message.slice(0, 60)}`);
    }
  }
  await coverBrowser.close();

  // 3. プロファイルを一時ディレクトリにコピー (Chrome停止中なのでロックなし)
  const tmpProfile = join(process.env.TEMP, "chrome_note_automation");
  const tmpDefault = join(tmpProfile, "Default");
  console.log("\n📋 Chromeプロファイルを一時ディレクトリにコピー中...");
  mkdirSync(tmpDefault, { recursive: true });
  // 必要なファイルのみコピー
  const profileSrc = join(CHROME_USER_DATA, "Default");
  const filesToCopy = ["Cookies", "Local State"];
  const localStateSrc = join(CHROME_USER_DATA, "Local State");
  try {
    for (const f of ["Cookies", "Preferences", "Login Data", "Web Data"]) {
      const s = join(profileSrc, f);
      if (existsSync(s)) { execSync(`copy /Y "${s}" "${tmpDefault}\\${f}"`, { stdio: "pipe", shell: true }); }
    }
    // Local StateはDefault外にある
    const localStateDst = join(tmpProfile, "Local State");
    if (existsSync(localStateSrc) && !existsSync(localStateDst)) {
      execSync(`copy /Y "${localStateSrc}" "${localStateDst}"`, { stdio: "pipe", shell: true });
    }
    console.log("✅ プロファイルコピー完了");
  } catch (e) {
    console.log("⚠️ 一部コピー失敗:", e.message.slice(0, 80));
  }

  // 4. Chrome実行バイナリでPlaywright起動 (一時プロファイル使用)
  console.log(`\n🚀 実Chromeで起動中... (一時プロファイル: ${tmpProfile})`);
  let context;
  try {
    context = await chromium.launchPersistentContext(tmpProfile, {
      executablePath: CHROME_EXE,
      headless: false,
      slowMo: 60,
      args: [
        "--profile-directory=Default",
        "--no-restore-session-state",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    console.log("✅ Chrome起動成功 (note.comセッション引き継ぎ済み)");
  } catch (e) {
    console.error("❌ Chrome起動失敗:", e.message.slice(0, 200));
    restartChromeNormal();
    process.exit(1);
  }

  const page = context.pages()[0] || await context.newPage();

  // 4. note.com ログイン確認
  await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "00_top.png") });

  const isLoggedOut =
    (await page.locator('a:has-text("ログイン")').count()) > 0 &&
    (await page.locator('[class*="avatar"], [class*="user-icon"], [data-testid*="user"]').count()) === 0;

  if (isLoggedOut) {
    console.log("⚠️ note.comへのログインが確認できません。");
    console.log(`   スクリーンショット: ${join(ssDir, "00_top.png")}`);
    await context.close();
    restartChromeNormal();
    process.exit(1);
  }
  console.log("✅ note.comログイン確認OK");

  // 5. 記事投稿 (3本)
  const results = [];
  for (const [idx, art] of ARTICLES.entries()) {
    const label = `art${idx + 1}`;
    console.log(`\n📝 [${idx + 1}/3] ${art.title.slice(0, 42)}...`);
    const body = mdToPlain(join(articlesDir, art.file));
    const imgPath = join(imgDir, art.imgFile);

    await page.goto("https://note.com/notes/new", { waitUntil: "domcontentloaded" });
    await sleep(5000);
    await page.screenshot({ path: join(ssDir, `${label}_01_editor.png`) });

    if (page.url().includes("/login")) {
      console.log("  ❌ ログインページへリダイレクト → スキップ");
      continue;
    }

    // タイトル
    await fillTitle(page, art.title);
    await sleep(400);

    // 本文
    await fillBody(page, body);
    await sleep(400);
    await page.screenshot({ path: join(ssDir, `${label}_02_filled.png`) });

    // カバー画像
    await uploadCoverImage(page, imgPath);
    await page.screenshot({ path: join(ssDir, `${label}_03_img.png`) });

    // 公開
    let url = await publishArticle(page, label);
    if (!url) {
      console.log("  🔄 タイトル再入力して再試行...");
      await sleep(1000);
      await fillTitle(page, art.title);
      await sleep(400);
      url = await publishArticle(page, `${label}_r2`);
    }
    if (url) results.push({ n: idx + 1, title: art.title, url });
    if (idx < ARTICLES.length - 1) await sleep(3000);
  }

  // 6. プロフィール設定
  await setupProfile(page);

  // 7. 完了
  console.log("\n====== 完了 ======");
  console.log(`📰 公開記事 (${results.length}/3):`);
  results.forEach(r => console.log(`  [${r.n}] ${r.url}\n      ${r.title.slice(0, 50)}`));
  console.log(`📸 スクリーンショット: ${ssDir}`);

  await sleep(5000);
  await context.close();
  restartChromeNormal();
}

main().catch(e => {
  console.error("❌ 致命的エラー:", e.message);
  restartChromeNormal();
  process.exit(1);
});
