/**
 * Growth OS Phase 5: retention計算の正データソース修正を、本番Supabaseの実データで検証する。
 *
 * 背景(2026-07-14 発見・修正): 旧実装は cohort_week(登録週の月曜日)を起点にD{offset}を
 * 計算しており、週の途中に登録したユーザーは実際の経過日数とズレたラベルで判定されて
 * いた(例: 日曜登録者の「本当のD1」が月曜起点だと登録前の日付を指してしまい常に0になる)。
 * 修正後は各ユーザー本人の登録日(profiles.created_at)を起点にD{offset}を判定する。
 *
 * このテストは /api/cron/growth-rollup を実行して analytics_retention_cohorts を
 * 再計算させたうえで、daily_stats(学習実績)から独立に計算した「正解」の継続状況と
 * 一致することを確認する(daily_statsは今回の修正対象ではなく、既に別の場所で
 * source of truthとして使われている既存テーブル)。
 *
 * 使い方: node scripts/testing/e2e/retention-source-of-truth.mjs
 */
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function toJstDateString(d) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function jstDatePlusDays(dateStr, offset) {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return toJstDateString(d);
}
function jstMondayOfWeek(dateStr) {
  // dateStr(JST日付文字列)のJST正午をUTCで表現した Date の getUTCDay() は、
  // そのままJST基準の曜日(0=日,1=月,...,6=土)と一致する。
  const weekdayIdx = new Date(`${dateStr}T12:00:00+09:00`).getUTCDay();
  const daysSinceMonday = (weekdayIdx + 6) % 7; // 月=0, 火=1, ..., 日=6
  return jstDatePlusDays(dateStr, -daysSinceMonday);
}

async function main() {
  loadEnv();
  requireEnv(["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();

  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    console.log("\n--- growth-rollup cronを実行してretention_cohortsを再計算させる ---");
    const res = await fetch(`${baseUrl}/api/cron/growth-rollup`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body = await res.json().catch(() => null);
    if (res.status === 200 && body?.ok === true) ok("growth-rollup cronが正常完了した");
    else bad(`growth-rollup cronが失敗: status=${res.status} body=${JSON.stringify(body)}`);

    console.log("\n--- 独立にdaily_statsから「正解」を計算する ---");
    const [{ data: profiles, error: profErr }, { data: dsRows, error: dsErr }] = await Promise.all([
      admin.from("profiles").select("id, created_at, is_test_account"),
      admin.from("daily_stats").select("user_id, day, studied_count").gt("studied_count", 0),
    ]);
    if (profErr) throw new Error(profErr.message);
    if (dsErr) throw new Error(dsErr.message);

    const activeUserDay = new Set((dsRows ?? []).map((r) => `${r.user_id}|${r.day}`));
    const today = toJstDateString(new Date());

    // 各非テストユーザーについて、到達済みのD1/D7を「本人の登録日起点」で正解計算する
    const expected = new Map(); // "cohortWeek|offset" -> {size, retained}
    for (const p of (profiles ?? []).filter((p) => !p.is_test_account)) {
      const signupDate = toJstDateString(new Date(p.created_at));
      const cohortWeek = jstMondayOfWeek(signupDate);
      for (const offset of [1, 7]) {
        const targetDate = jstDatePlusDays(signupDate, offset);
        if (targetDate > today) continue; // 未到達は分母に入れない
        const key = `${cohortWeek}|${offset}`;
        const e = expected.get(key) ?? { size: 0, retained: 0 };
        e.size += 1;
        if (activeUserDay.has(`${p.id}|${targetDate}`)) e.retained += 1;
        expected.set(key, e);
      }
    }

    console.log("\n--- analytics_retention_cohorts(実際に保存された値)と突合 ---");
    const { data: cohortRows, error: cohortErr } = await admin
      .from("analytics_retention_cohorts")
      .select("cohort_week, day_offset, cohort_size, retained_count")
      .in("day_offset", [1, 7]);
    if (cohortErr) throw new Error(cohortErr.message);

    if ((cohortRows ?? []).length === 0 && expected.size === 0) {
      console.log("ℹ️  比較対象データが無い(登録から1日/7日経過したユーザーがまだいない)。ロジックの単体挙動は他のD14/D30セルで別途確認可能。");
    } else {
      let matched = 0;
      let checked = 0;
      for (const [key, exp] of expected) {
        const [cohortWeek, offsetStr] = key.split("|");
        const offset = Number(offsetStr);
        checked++;
        const row = (cohortRows ?? []).find((r) => r.cohort_week === cohortWeek && r.day_offset === offset);
        if (!row) { bad(`analytics_retention_cohortsに ${key} の行が無い`); continue; }
        if (row.cohort_size === exp.size && row.retained_count === exp.retained) {
          matched++;
        } else {
          bad(`${key}: 期待値 size=${exp.size},retained=${exp.retained} / 実際 size=${row.cohort_size},retained=${row.retained_count}`);
        }
      }
      if (checked > 0 && matched === checked) ok(`daily_statsから独立に計算した${checked}件のコホート×offsetすべてが analytics_retention_cohorts と一致する`);
      else if (checked === 0) console.log("ℹ️  比較可能なコホートが無かった");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:retention-source-of-truth: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:retention-source-of-truth RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("retention-source-of-truth crashed:", e);
  process.exit(1);
});
