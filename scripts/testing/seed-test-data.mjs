/**
 * Loop Vocabulary — 自動検証用テストデータの投入（冪等・テストユーザーのみ対象）
 *
 * CLI: node scripts/testing/seed-test-data.mjs
 * ライブラリとしても利用（E2Eスクリプトから import して直前にリセットするため）。
 *
 * 対象は TEST_ACCOUNTS の3ユーザーIDのみ。実ユーザーのデータには一切触れない。
 * 再実行しても安全（既存のTEST_プレフィックス単語帳/クラスをリセットしてから作り直す）。
 */
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import {
  TEST_ACCOUNTS,
  TEST_CLASS_NAME,
  TEST_CLASS_INVITE_CODE,
  TEST_WORDBOOK_TITLE,
} from "./lib/testAccounts.mjs";

const DAY = 24 * 60 * 60 * 1000;

export async function resolveUserId(admin, email) {
  const { data, error } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Test user not found for ${email}. Run setup-test-users.mjs first.`);
  return data.id;
}

// SRSテストユーザー: 単語帳0件からリセットし、復習対象になる単語8語を投入
export async function seedSrsUser(admin, userId) {
  const { data: existingBooks } = await admin
    .from("word_books")
    .select("id")
    .eq("user_id", userId)
    .eq("title", TEST_WORDBOOK_TITLE);
  for (const b of existingBooks ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: TEST_WORDBOOK_TITLE, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr) throw bookErr;

  const now = Date.now();
  const words = [
    { word: "persist",  meaning: "[TEST] 固執する、やり遂げる", streak: 1, is_weak: false },
    { word: "acquire",  meaning: "[TEST] 獲得する",             streak: 0, is_weak: true  },
    { word: "reduce",   meaning: "[TEST] 減らす",               streak: 2, is_weak: false },
    { word: "expand",   meaning: "[TEST] 拡大する",             streak: 0, is_weak: false },
    { word: "resolve",  meaning: "[TEST] 解決する、決意する",   streak: 1, is_weak: false },
    { word: "consider", meaning: "[TEST] 考慮する",             streak: 0, is_weak: true  },
    { word: "achieve",  meaning: "[TEST] 達成する",             streak: 3, is_weak: false },
    { word: "maintain", meaning: "[TEST] 維持する",             streak: 0, is_weak: false },
  ].map((w, i) => ({
    user_id: userId,
    word_book_id: book.id,
    word: w.word,
    meaning: w.meaning,
    streak: w.streak,
    is_weak: w.is_weak,
    mastery: 40,
    correct_count: w.streak,
    wrong_count: 0,
    ease_factor: 2.5,
    interval_days: 0,
    next_review_at: new Date(now - (i + 1) * DAY).toISOString(),
    last_studied_at: new Date(now - (i + 2) * DAY).toISOString(),
  }));

  const { error: wErr } = await admin.from("words").insert(words);
  if (wErr) throw wErr;

  return { bookId: book.id, wordCount: words.length };
}

// オンボーディングテストユーザー: 単語帳0件・単語0件の状態にリセット（毎回の空状態検証用）
export async function resetOnboardingUser(admin, userId) {
  const { data: books } = await admin.from("word_books").select("id").eq("user_id", userId);
  for (const b of books ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }
  await admin.from("words").delete().eq("user_id", userId);
  return { reset: true };
}

// 先生テストシナリオ: TEST_検証クラス を用意し、SRSテストユーザーを同意済みで参加させる
export async function seedTeacherClass(admin, teacherId, studentId) {
  const { data: existing } = await admin
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("name", TEST_CLASS_NAME)
    .maybeSingle();

  let classId = existing?.id;
  if (!classId) {
    const { data: created, error } = await admin
      .from("classes")
      .insert({ teacher_id: teacherId, name: TEST_CLASS_NAME, invite_code: TEST_CLASS_INVITE_CODE })
      .select("id")
      .single();
    if (error) throw error;
    classId = created.id;
  }

  const { error: memErr } = await admin
    .from("class_members")
    .upsert(
      { class_id: classId, student_id: studentId, consent: true, status: "active" },
      { onConflict: "class_id,student_id" },
    );
  if (memErr) throw memErr;

  return { classId, inviteCode: TEST_CLASS_INVITE_CODE };
}

export async function seedAll(admin) {
  const onboardingId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
  const teacherId = await resolveUserId(admin, TEST_ACCOUNTS.teacher.email);

  const onboarding = await resetOnboardingUser(admin, onboardingId);
  const srs = await seedSrsUser(admin, srsId);
  const teacher = await seedTeacherClass(admin, teacherId, srsId);

  return { onboardingId, srsId, teacherId, onboarding, srs, teacher };
}

async function main() {
  const admin = getAdminClient();
  const r = await seedAll(admin);
  console.log("onboarding user reset to 0 words/wordbooks:", r.onboarding.reset);
  console.log(`srs user seeded: wordbook=${r.srs.bookId} words=${r.srs.wordCount} (all due for review)`);
  console.log(`teacher class ready: classId=${r.teacher.classId} inviteCode=${r.teacher.inviteCode} (srs user is consenting member)`);
  console.log("\nDone.");
}

// CLI実行時のみ main を走らせる（import時は実行しない）
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("seed-test-data.mjs")) {
  main().catch((e) => {
    console.error("seed-test-data failed:", e.message);
    process.exit(1);
  });
}
