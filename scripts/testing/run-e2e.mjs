/**
 * Loop Vocabulary — 自律E2E検証の一括実行
 *
 * 1. テストユーザー作成（冪等） 2. テストデータ投入（冪等）
 * 3. 専用ポートで dev サーバを1つ起動（他セッションの dev サーバとは別ポート）
 * 4. onboarding/dictionary, srs, teacher の3本のE2Eを順に実行
 * 5. 起動した dev サーバを停止し、結果サマリを表示
 *
 * 使い方: node scripts/testing/run-e2e.mjs
 */
import { execFileSync } from "child_process";
import { resolve } from "path";
import { REPO_ROOT, loadEnv } from "./lib/env.mjs";
import { ensureDevServer, stopDevServer } from "./lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function runNode(relPath) {
  const full = resolve(REPO_ROOT, relPath);
  try {
    execFileSync(process.execPath, [full], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env, TEST_PORT: String(PORT) },
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  loadEnv();

  console.log("=== 1. setup-test-users ===");
  if (!runNode("scripts/testing/setup-test-users.mjs")) {
    console.error("setup-test-users failed — aborting");
    process.exit(1);
  }

  console.log("\n=== 2. seed-test-data ===");
  if (!runNode("scripts/testing/seed-test-data.mjs")) {
    console.error("seed-test-data failed — aborting");
    process.exit(1);
  }

  console.log(`\n=== 3. ensure dev server on port ${PORT} ===`);
  const dev = await ensureDevServer(PORT);
  console.log(`dev server ready at ${dev.url} (startedByUs=${dev.startedByUs})`);

  const results = {};
  try {
    console.log("\n=== 4. onboarding/dictionary E2E ===");
    results.onboardingDictionary = runNode("scripts/testing/e2e/onboarding-dictionary.mjs");

    console.log("\n=== 5. SRS V2 E2E ===");
    results.srs = runNode("scripts/testing/e2e/srs.mjs");

    console.log("\n=== 6. teacher E2E ===");
    results.teacher = runNode("scripts/testing/e2e/teacher.mjs");

    console.log("\n=== 7. admin E2E ===");
    results.admin = runNode("scripts/testing/e2e/admin.mjs");

    console.log("\n=== 8. materials import E2E ===");
    results.materials = runNode("scripts/testing/e2e/materials.mjs");
  } finally {
    stopDevServer(dev);
  }

  console.log("\n=== SUMMARY ===");
  let allPass = true;
  for (const [name, pass] of Object.entries(results)) {
    console.log(`${pass ? "✅" : "❌"} ${name}`);
    if (!pass) allPass = false;
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("run-e2e crashed:", e);
  process.exit(1);
});
