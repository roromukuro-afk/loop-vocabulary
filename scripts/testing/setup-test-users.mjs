/**
 * Loop Vocabulary — 自動検証用テストユーザーの作成（冪等）
 *
 * 使い方: node scripts/testing/setup-test-users.mjs
 *
 * - 実ユーザーには一切触れない（対象は TEST_ACCOUNTS 定義のメールのみ）
 * - 既に存在する場合は再利用し、重複作成しない
 * - パスワードは .env.local にのみ保存し、標準出力には出さない
 * - profiles.is_test_account = true でマークする
 */
import { randomBytes } from "crypto";
import { appendFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { REPO_ROOT, loadEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { TEST_ACCOUNTS } from "./lib/testAccounts.mjs";

loadEnv();

function genPassword() {
  return `Tv2!${randomBytes(18).toString("base64url")}`;
}

function ensurePasswordInEnvLocal(key) {
  if (process.env[key]) return process.env[key];
  const envPath = resolve(REPO_ROOT, ".env.local");
  const pwd = genPassword();
  const line = `\n${key}=${pwd}\n`;
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    if (!content.includes(`${key}=`)) appendFileSync(envPath, line);
  } else {
    appendFileSync(envPath, line);
  }
  process.env[key] = pwd;
  return pwd;
}

async function findUserByEmail(admin, email) {
  // supabase-js admin.listUsers はメールフィルタを持たないため全件走査（テスト環境は少数なので許容）
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page++;
  }
}

async function ensureUser(admin, key, cfg) {
  const password = ensurePasswordInEnvLocal(cfg.passwordEnvKey);
  let user = await findUserByEmail(admin, cfg.email);
  let created = false;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: cfg.email,
      password,
      email_confirm: true,
      user_metadata: { is_test_account: true, purpose: cfg.purpose },
    });
    if (error) throw error;
    user = data.user;
    created = true;
  } else {
    // 既存テストユーザーのパスワードを最新の .env.local の値に同期しておく（ローカル紛失時の復旧用）
    await admin.auth.admin.updateUserById(user.id, { password }).catch(() => {});
  }

  // handle_new_user トリガーで作られた profiles 行を、テスト用属性で更新（存在しなければ作成）
  const { error: upErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: cfg.email,
      is_test_account: true,
      display_name: cfg.displayName,
      role: cfg.role,
    },
    { onConflict: "id" },
  );
  if (upErr) throw upErr;

  return { key, id: user.id, email: cfg.email, created };
}

async function main() {
  const admin = getAdminClient();
  const results = [];
  for (const [key, cfg] of Object.entries(TEST_ACCOUNTS)) {
    const r = await ensureUser(admin, key, cfg);
    results.push(r);
    console.log(`${r.created ? "created" : "reused "} ${key.padEnd(10)} id=${r.id} email=${r.email}`);
  }
  console.log("\nDone. Passwords are stored in .env.local (not printed, not committed).");
  return results;
}

main().catch((e) => {
  console.error("setup-test-users failed:", e.message);
  process.exit(1);
});
