/**
 * Growth OS Phase 7: 3件のA/Bテストを status='draft' で登録する（冪等・一回限りのシード）。
 *
 * 安全ルール: このスクリプトが作る experiments 行は必ず status='draft'。
 * draft→approved→running への遷移はここでは一切行わない（管理画面から人間が行う操作）。
 *
 * 冪等性: 同じkeyの実験が既に存在すればスキップする（再実行してもduplicateしない）。
 *
 * primary_metric / guardrail_metric の選定について（既存のsrc/lib/analytics/eventSchema.tsに
 * 完全一致するイベントが無いものは、暫定のmetric_name文字列を使い、ここにコメントとして
 * 前提を明記する。将来 analytics_events / experiment_conversions への実記録を実装する際は
 * このコメントを参照すること）:
 *
 *  a) vocab_check_result_cta:
 *     primary_metric = 'vocab_check_signup_clicked'
 *       → eventSchema.ts に既存のイベント。CTA文言変更の直接的な効果を測るには、
 *         その先の signup_completed（登録完了）より、CTAクリックの方が1ホップ近く
 *         ノイズが少ないため主指標に採用。signup_completedは将来的な二次指標候補。
 *     guardrail_metric = 'vocab_check_result_abandoned'
 *       → 「結果画面離脱率」に対応する既存イベントは無い（暫定のmetric_name。
 *         実際にexperiment_conversionsへ記録するには、結果画面を開いてから
 *         一定時間内に何もクリックせず離脱したことを検知する新規イベントの追加が
 *         別途必要。このスクリプトではdraft実験の設定値としてのみ登録する）。
 *
 *  b) onboarding_word_target:
 *     primary_metric = 'd7_retention'
 *       → 「D7継続率」はraw event 1つでは表現できない集計指標（signup日から7日後に
 *         学習行動があったか）。既存のanalytics_events集計ロジック
 *         （日次/週次rollup）側で計算される想定の暫定metric_name。
 *     guardrail_metric = 'signup_immediate_dropoff'
 *       → 「signup直後離脱率」に対応する既存イベントも無い（暫定metric_name。
 *         signup_completedの直後に一定時間内へのonboarding_started/first_word_added等が
 *         無いことを検知する集計ロジックが別途必要）。
 *
 *  c) premium_value_explanation:
 *     primary_metric = 'checkout_started'
 *       → eventSchema.ts に既存のイベントをそのまま使用。
 *     guardrail_metric = 'premium_page_abandoned'
 *       → premium_page_viewed（既存イベント）はあるが「離脱」を示す既存イベントは無い
 *         （暫定metric_name。premium_page_viewedからcheckout_started等の後続アクションが
 *         一定時間内に無いことを検知する集計ロジックが別途必要）。
 *
 * 使い方: node scripts/growth/seed-draft-experiments.mjs
 */
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv } from "../testing/lib/env.mjs";

const EXPERIMENTS = [
  {
    key: "vocab_check_result_cta",
    name: "語彙力チェック結果画面のCTA文言",
    hypothesis:
      "結果画面のCTA文言を「結果を保存して復習を始める」に変えることで、診断完了後の登録率(vocab_check_signup_clicked)が改善する",
    primary_metric: "vocab_check_signup_clicked",
    guardrail_metric: "vocab_check_result_abandoned",
    variants: [
      { key: "control", name: "現在のCTA", is_control: true, traffic_weight: 0.5 },
      { key: "treatment", name: "「結果を保存して復習を始める」", is_control: false, traffic_weight: 0.5 },
    ],
  },
  {
    key: "onboarding_word_target",
    name: "オンボーディング単語数の案内",
    hypothesis: "登録直後に5語追加を案内することでD7継続率(d7_retention)が改善する",
    primary_metric: "d7_retention",
    guardrail_metric: "signup_immediate_dropoff",
    variants: [
      { key: "control", name: "自由に開始", is_control: true, traffic_weight: 0.5 },
      { key: "treatment", name: "最初に5語追加を案内", is_control: false, traffic_weight: 0.5 },
    ],
  },
  {
    key: "premium_value_explanation",
    name: "Premium価値説明の実験",
    hypothesis:
      "AI・PDF・広告非表示の利用例を見せることでcheckout開始率(checkout_started)が改善する",
    primary_metric: "checkout_started",
    guardrail_metric: "premium_page_abandoned",
    variants: [
      { key: "control", name: "現在の説明", is_control: true, traffic_weight: 0.5 },
      { key: "treatment", name: "利用例を表示", is_control: false, traffic_weight: 0.5 },
    ],
  },
];

export async function seedDraftExperiments(admin) {
  const results = [];
  for (const exp of EXPERIMENTS) {
    const { data: existing, error: findErr } = await admin
      .from("experiments")
      .select("id, key, status")
      .eq("key", exp.key)
      .maybeSingle();
    if (findErr) throw findErr;

    if (existing) {
      results.push({ key: exp.key, status: "skipped_existing", id: existing.id });
      continue;
    }

    const { data: inserted, error: insertErr } = await admin
      .from("experiments")
      .insert({
        key: exp.key,
        name: exp.name,
        hypothesis: exp.hypothesis,
        primary_metric: exp.primary_metric,
        guardrail_metric: exp.guardrail_metric,
        status: "draft", // 絶対にdraft以外を書かない
      })
      .select("id, key, status")
      .single();
    if (insertErr) throw insertErr;

    const variantRows = exp.variants.map((v) => ({
      experiment_id: inserted.id,
      key: v.key,
      name: v.name,
      is_control: v.is_control,
      traffic_weight: v.traffic_weight,
    }));
    const { data: insertedVariants, error: variantErr } = await admin
      .from("experiment_variants")
      .insert(variantRows)
      .select("id, key, name, is_control, traffic_weight");
    if (variantErr) throw variantErr;

    results.push({
      key: exp.key,
      status: "created",
      id: inserted.id,
      variants: insertedVariants,
    });
  }
  return results;
}

async function main() {
  loadEnv();
  const admin = getAdminClient();
  const results = await seedDraftExperiments(admin);

  for (const r of results) {
    if (r.status === "skipped_existing") {
      console.log(`- skip (already exists): ${r.key} (id=${r.id})`);
    } else {
      console.log(`+ created: ${r.key} (id=${r.id})`);
      for (const v of r.variants) {
        console.log(`    variant ${v.key} (id=${v.id}) is_control=${v.is_control} weight=${v.traffic_weight}`);
      }
    }
  }
  console.log("\n=== seed-draft-experiments: done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
