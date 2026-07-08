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

    console.log("\n=== 5b. SRS モード別間隔重み付け E2E ===");
    results.srsModeWeighting = runNode("scripts/testing/e2e/srs-mode-weighting.mjs");

    console.log("\n=== 6. teacher E2E ===");
    results.teacher = runNode("scripts/testing/e2e/teacher.mjs");

    console.log("\n=== 7. admin E2E ===");
    results.admin = runNode("scripts/testing/e2e/admin.mjs");

    console.log("\n=== 8. materials import E2E ===");
    results.materials = runNode("scripts/testing/e2e/materials.mjs");

    console.log("\n=== 9. quiz selection E2E ===");
    results.quiz = runNode("scripts/testing/e2e/quiz.mjs");

    console.log("\n=== 10. learning modes (input/typing/listening/attack) E2E ===");
    results.learningModes = runNode("scripts/testing/e2e/learning-modes.mjs");

    console.log("\n=== 11. premium gating regression (profiles.plan → is_premium) ===");
    results.premiumGating = runNode("scripts/testing/verify-premium-gating.mjs");

    console.log("\n=== 12. learning-mode entry points & scope labels E2E ===");
    results.entryPoints = runNode("scripts/testing/e2e/entry-points.mjs");

    console.log("\n=== 13. wordbook deletion E2E ===");
    results.wordbookDelete = runNode("scripts/testing/e2e/wordbook-delete.mjs");

    console.log("\n=== 14. review recovery mode E2E ===");
    results.recoveryMode = runNode("scripts/testing/e2e/recovery-mode.mjs");

    console.log("\n=== 15. internal links (materials/dictionary) E2E ===");
    results.internalLinks = runNode("scripts/testing/e2e/internal-links.mjs");

    console.log("\n=== 16. category landing pages (TOEIC/business) E2E ===");
    results.categoryLps = runNode("scripts/testing/e2e/category-lps.mjs");

    console.log("\n=== 17. dashboard insights (mastery/weak-words cards) E2E ===");
    results.dashboardInsights = runNode("scripts/testing/e2e/dashboard-insights.mjs");

    console.log("\n=== 18. reward ticket claim (今日の達成チケット実付与) E2E ===");
    results.rewardTicketClaim = runNode("scripts/testing/e2e/reward-ticket-claim.mjs");

    console.log("\n=== 19. extra_review ticket (広告視聴→追加復習) E2E ===");
    results.extraReviewTicket = runNode("scripts/testing/e2e/extra-review-ticket.mjs");

    console.log("\n=== 20. /weak 弱点分析(傾向を確認・AI分析) E2E ===");
    results.weakAnalysis = runNode("scripts/testing/e2e/weak-analysis.mjs");

    console.log("\n=== 21. Premium導線・プランページ棚卸し E2E ===");
    results.premiumConversion = runNode("scripts/testing/e2e/premium-conversion.mjs");

    console.log("\n=== 22. Stripe webhook → Premium反映フロー E2E ===");
    results.stripePremiumWebhook = runNode("scripts/testing/e2e/stripe-premium-webhook.mjs");

    console.log("\n=== 23. 信頼ページ・規約・決済説明 E2E ===");
    results.legalTrustPages = runNode("scripts/testing/e2e/legal-trust-pages.mjs");

    console.log("\n=== 24. AI利用コスト・濫用対策 E2E ===");
    results.aiUsageGuards = runNode("scripts/testing/e2e/ai-usage-guards.mjs");

    console.log("\n=== 25. 管理画面 AI利用状況モニタリング E2E ===");
    results.adminAiUsage = runNode("scripts/testing/e2e/admin-ai-usage.mjs");

    console.log("\n=== 26. AI route別利用ログ(ai_usage_events) E2E ===");
    results.aiUsageEvents = runNode("scripts/testing/e2e/ai-usage-events.mjs");

    console.log("\n=== 27. ai_usage_events 保持期間・削除運用 E2E ===");
    results.aiUsageRetention = runNode("scripts/testing/e2e/ai-usage-retention.mjs");

    console.log("\n=== 28. ai_usage_events 自動削除cron E2E ===");
    results.aiUsageCleanupCron = runNode("scripts/testing/e2e/ai-usage-cleanup-cron.mjs");

    console.log("\n=== 29. フラッシュカードforgot直後のAI解説導線 E2E ===");
    results.flashcardAiHint = runNode("scripts/testing/e2e/flashcard-ai-hint.mjs");

    console.log("\n=== 30. 音声ファーストUI（自動再生トグル）E2E ===");
    results.audioFirstLearning = runNode("scripts/testing/e2e/audio-first-learning.mjs");

    console.log("\n=== 31. AdSense再審査対応（広告表示ルート制限）E2E ===");
    results.adsenseReadiness = runNode("scripts/testing/e2e/adsense-readiness.mjs");

    console.log("\n=== 32. 新規学習ガイド8記事 E2E ===");
    results.guidesContent = runNode("scripts/testing/e2e/guides-content.mjs");

    console.log("\n=== 33. 語彙力チェックSNSシェア導線 E2E ===");
    results.diagnosticShare = runNode("scripts/testing/e2e/diagnostic-share.mjs");

    console.log("\n=== 34. 教員向けPDF小テストガイド E2E ===");
    results.teacherPdfGuide = runNode("scripts/testing/e2e/teacher-pdf-guide.mjs");
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
