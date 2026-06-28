// Sync missing env vars from .env.local to Vercel production
// Values are piped to vercel CLI without being printed
import { readFileSync } from "fs";
import { execSync } from "child_process";

const localEnv = {};
const content = readFileSync(".env.local", "utf-8");
for (const line of content.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
  localEnv[key] = val;
}

// Keys already in Vercel (skip)
const alreadyInVercel = new Set([
  "CRON_SECRET", "MIGRATE_SECRET",
  "NEXT_PUBLIC_ADMOB_ANDROID_BANNER", "NEXT_PUBLIC_ADMOB_ANDROID_INTERSTITIAL",
  "NEXT_PUBLIC_ADMOB_ANDROID_REWARDED", "NEXT_PUBLIC_ADMOB_IOS_BANNER",
  "NEXT_PUBLIC_ADMOB_IOS_INTERSTITIAL", "NEXT_PUBLIC_ADMOB_IOS_REWARDED",
  "NEXT_PUBLIC_ADMOB_USE_TEST_IDS", "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "RESEND_API_KEY", "STRIPE_PRICE_ID_MONTHLY", "STRIPE_PRICE_ID_YEARLY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
]);

// Skip keys that are not relevant to Vercel
const skipKeys = new Set(["NEXT_PUBLIC_ADS_ENABLED"]);

let added = 0;
for (const [key, val] of Object.entries(localEnv)) {
  if (alreadyInVercel.has(key) || skipKeys.has(key)) continue;
  if (!val) continue;

  try {
    // Use stdin to avoid key appearing in process list
    execSync(`npx vercel env add ${key} production --yes`, {
      input: val,
      stdio: ["pipe", "inherit", "pipe"],
    });
    console.log(`✅ Added ${key}`);
    added++;
  } catch (e) {
    const msg = e.stderr?.toString() ?? e.message;
    if (msg.includes("already exists")) {
      console.log(`⏭ ${key} already exists`);
    } else {
      console.error(`❌ Failed ${key}: ${msg.slice(0, 80)}`);
    }
  }
}

if (added === 0) {
  console.log("All env vars already synced.");
} else {
  console.log(`\nDone. Added ${added} env vars to Vercel production.`);
}
