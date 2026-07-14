/**
 * src/lib/growth/experiments.ts の単体テスト（実DBに対する往復あり）。
 *
 * 確認内容:
 *  (a) status='draft' の実験は絶対にバリアントを割り当てない（getVariantForExperimentがnull）
 *  (b) [growth/experimentStats.tsの担当なのでtest-experiment-statistics.mjs側で確認]
 *  (c) 同じsubjectは常に同じバリアントになる（決定論的ハッシュ割当のコア保証）
 *  (d) recordExposureを同じsubjectに対して2回呼んでも、exposureは1回しか記録されない
 *  (+) 割当が存在しないsubjectに対するrecordConversionは何も書き込まず静かにno-opする
 *
 * (c)について: このプロジェクトのポリシー(AUTONOMOUS_IMPROVEMENT_POLICY.md)上、どのコードからも
 * experiments.status を 'running' にしてはならない。getVariantForExperiment は status='running'
 * の実験にしか実際の割当を行わないため、このテストスクリプト（テストであっても）は実験を
 * running にはしない。代わりに、割当の決定論性を担保しているコア関数
 * （hashToUnitInterval / pickVariantDeterministic、いずれも experiments.ts から export）を
 * 直接呼び出して「同じ入力なら常に同じ出力になる」ことを確認する。
 *
 * テスト用に一時的な実験(status='draft')をDBに作成し、テスト終了後に必ず削除する。
 *
 * 使い方: node scripts/testing/test-experiment-assignment.mjs
 */
import { randomUUID } from "crypto";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { loadEnv } from "./lib/env.mjs";
import {
  getVariantForExperiment,
  recordExposure,
  recordConversion,
  hashToUnitInterval,
  pickVariantDeterministic,
} from "../../src/lib/growth/experiments.ts";

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`✅ ${msg}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${msg}`);
  }
}

async function main() {
  loadEnv();
  const admin = getAdminClient();

  const tempKey = `test_assignment_harness_${randomUUID().slice(0, 8)}`;
  let experimentId = null;

  try {
    // ── セットアップ: 一時実験をstatus='draft'で作成（絶対にrunningにはしない） ──
    const { data: experiment, error: expErr } = await admin
      .from("experiments")
      .insert({
        key: tempKey,
        name: "テストハーネス用実験（自動削除される）",
        primary_metric: "test_metric",
        status: "draft",
      })
      .select("id")
      .single();
    if (expErr) throw expErr;
    experimentId = experiment.id;

    const { data: variants, error: varErr } = await admin
      .from("experiment_variants")
      .insert([
        { experiment_id: experimentId, key: "control", name: "control", is_control: true, traffic_weight: 0.5 },
        { experiment_id: experimentId, key: "treatment", name: "treatment", is_control: false, traffic_weight: 0.5 },
      ])
      .select("id, key");
    if (varErr) throw varErr;

    // ── (a) draft実験はgetVariantForExperimentが必ずnullを返す ──
    const subjectA = { anonymousSessionId: `harness-subject-a-${randomUUID()}` };
    const assignmentDraft = await getVariantForExperiment(tempKey, subjectA, { throwOnError: true });
    assert(assignmentDraft === null, "status='draft'の実験はgetVariantForExperimentがnullを返す（割当を作らない）");

    const { count: assignmentRowCount, error: countErr } = await admin
      .from("experiment_assignments")
      .select("id", { count: "exact", head: true })
      .eq("experiment_id", experimentId);
    if (countErr) throw countErr;
    assert(assignmentRowCount === 0, "draft実験に対してexperiment_assignmentsへの書き込みが一切発生していない");

    // ── (c) 決定論的ハッシュ割当: 同じ入力は常に同じバケット値・同じバリアントになる ──
    const input = `${tempKey}:${subjectA.anonymousSessionId}`;
    const bucket1 = hashToUnitInterval(input);
    const bucket2 = hashToUnitInterval(input);
    assert(bucket1 === bucket2, "hashToUnitIntervalは同じ入力に対して常に同じ値を返す");

    const variantRows = variants.map((v) => ({ key: v.key, traffic_weight: 0.5 }));
    const pick1 = pickVariantDeterministic(variantRows, bucket1);
    const pick2 = pickVariantDeterministic(variantRows, bucket2);
    assert(pick1.key === pick2.key, "同じバケット値なら常に同じバリアントが選ばれる");

    // 複数回呼んでも同じsubjectは常に同じバリアントになることを、実際に3回計算して確認
    const repeatedPicks = new Set();
    for (let i = 0; i < 3; i++) {
      const b = hashToUnitInterval(input);
      repeatedPicks.add(pickVariantDeterministic(variantRows, b).key);
    }
    assert(repeatedPicks.size === 1, "同じsubjectに対して3回計算しても常に同じバリアントになる（冪等性）");

    // 異なるsubjectでは（必ずではないが）異なるバケット値になり得ることの一応の確認
    const otherBucket = hashToUnitInterval(`${tempKey}:harness-subject-different`);
    assert(typeof otherBucket === "number" && otherBucket >= 0 && otherBucket < 1, "hashToUnitIntervalは[0,1)の範囲の値を返す");

    // ── (d) recordExposureは同じsubjectに対して2回呼んでも1回しか記録されない ──
    const subjectD = { anonymousSessionId: `harness-subject-d-${randomUUID()}` };
    await recordExposure(tempKey, "control", subjectD, { throwOnError: true });
    await recordExposure(tempKey, "control", subjectD, { throwOnError: true });

    const { data: exposureRows, error: expoErr } = await admin
      .from("experiment_exposures")
      .select("id")
      .eq("experiment_id", experimentId)
      .eq("anonymous_session_id", subjectD.anonymousSessionId);
    if (expoErr) throw expoErr;
    assert(
      Array.isArray(exposureRows) && exposureRows.length === 1,
      `recordExposureを2回呼んでもexperiment_exposuresの行は1件のまま (got ${exposureRows?.length})`,
    );

    // ── (+) 割当が無いsubjectに対するrecordConversionは静かにno-op（例外もinsertもしない） ──
    const subjectE = { anonymousSessionId: `harness-subject-e-${randomUUID()}` };
    await recordConversion(tempKey, "test_metric", 1, subjectE, { throwOnError: true });
    const { data: conversionRows, error: convErr } = await admin
      .from("experiment_conversions")
      .select("id")
      .eq("experiment_id", experimentId)
      .eq("anonymous_session_id", subjectE.anonymousSessionId);
    if (convErr) throw convErr;
    assert(
      Array.isArray(conversionRows) && conversionRows.length === 0,
      "割当の無いsubjectに対するrecordConversionは何も書き込まない",
    );
  } finally {
    // ── クリーンアップ: テスト用に作った行を必ず削除する ──
    if (experimentId) {
      await admin.from("experiment_exposures").delete().eq("experiment_id", experimentId);
      await admin.from("experiment_conversions").delete().eq("experiment_id", experimentId);
      await admin.from("experiment_assignments").delete().eq("experiment_id", experimentId);
      await admin.from("experiment_variants").delete().eq("experiment_id", experimentId);
      await admin.from("experiments").delete().eq("id", experimentId);
      console.log(`\n(cleanup) removed temporary test experiment ${tempKey}`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\n=== test:experiment-assignment: FAILED ===");
    process.exit(1);
  } else {
    console.log("\n=== test:experiment-assignment RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
