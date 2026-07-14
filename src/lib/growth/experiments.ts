/**
 * Growth OS Phase 7: A/Bテスト基盤 — 割当(assignment) / 露出(exposure) / コンバージョン記録。
 *
 * 安全上の大原則（AUTONOMOUS_IMPROVEMENT_POLICY.md 参照）:
 *  - `getVariantForExperiment` は experiments.status === 'running' の実験にしか
 *    バリアントを割り当てない。draft/approved/paused/completed の実験は常に null を返す。
 *    つまりこのファイルのどの関数も experiments.status を書き換えることはない
 *    （draft→approved→running の遷移は管理画面から人間が行う別の操作）。
 *  - すべての関数はプロダクション用途では「呼び出し元を絶対に壊さない」ことを最優先し、
 *    内部で例外を握りつぶして console.error に記録し null/no-op を返す。ただし
 *    テストから失敗を検知できるよう、`{ throwOnError: true }` を渡すと握りつぶさずに
 *    例外を再送出する。
 *
 * 決定論的バケット割当:
 *  - `experimentKey + ':' + subjectKey` をハッシュして [0,1) の値に写像し、
 *    バリアントを traffic_weight で重み付けした累積区間のどこに落ちるかで選ぶ。
 *    バリアントは key の辞書順で並べてから累積するため、DBの行順に依存しない。
 *  - これにより「DB行がまだ無くても同じsubjectは常に同じバリアントを計算できる」
 *    （冪等性）。実際の割当はDBへの upsert で確定させ、レース時は
 *    onConflict: 'experiment_id,subject_key', ignoreDuplicates: true により
 *    片方だけが実際にINSERTされる。呼び出し側にはローカル計算結果ではなく、
 *    upsert後に読み直した「実際にDBに保存されている行」を返す（レース時の正しさを担保）。
 */
import { createClient } from "@supabase/supabase-js";

/**
 * src/lib/supabase/admin.ts の createAdminClient と同一実装をここに複製している。
 * 理由: このファイルは Next.js からの利用に加えて scripts/testing/*.mjs から
 * Node 24 のネイティブ.ts型ストリップで直接importされる想定（テストスクリプトが
 * getVariantForExperiment等を直接呼んで検証するため）。
 * "@/*" (tsconfig paths alias) はNext.jsのバンドラー解決専用でNodeのESM解決では
 * 使えず、かといって拡張子付き相対import(`../supabase/admin.ts`)は
 * tsconfig.json の moduleResolution:"bundler" では allowImportingTsExtensions が
 * 無いと型エラーになる（プロジェクト共通のtsconfigは変更したくない）。
 * createAdminClient自体は数行の薄いラッパーなので、重複を許容してここに複製する。
 */
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type SubjectId = {
  anonymousSessionId?: string;
  userId?: string;
};

export type VariantAssignment = {
  variantKey: string;
  variantId: string;
};

export type ExperimentFnOptions = {
  /**
   * true の場合、内部エラーを握りつぶさずに再送出する。
   * テストスクリプトが失敗パスをassertできるようにするためのオプション。
   * 本番コードからは基本的に渡さない（デフォルト false = 常に安全側に倒す）。
   */
  throwOnError?: boolean;
};

type VariantRow = {
  id: string;
  key: string;
  traffic_weight: number;
};

function subjectKeyOf(subject: SubjectId): string | null {
  if (subject.userId) return subject.userId;
  if (subject.anonymousSessionId) return subject.anonymousSessionId;
  return null;
}

/**
 * FNV-1a (32bit) で文字列をハッシュし、[0, 1) の範囲の値に写像する。
 * 暗号学的な強度は不要（ランダムなバケット割当ができれば十分）で、依存追加なしで
 * どの環境でも同じ結果になる決定論的ハッシュとして採用。
 */
export function hashToUnitInterval(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 4294967296;
}

/**
 * traffic_weight で重み付けした累積区間に bucketValue([0,1)) を当てはめてバリアントを選ぶ。
 * バリアントは key の辞書順に並べてから累積するため、fetch順（DBの行順）に依存しない。
 */
export function pickVariantDeterministic<T extends { key: string; traffic_weight: number }>(
  variants: T[],
  bucketValue: number,
): T {
  if (variants.length === 0) {
    throw new Error("pickVariantDeterministic: variants is empty");
  }
  const sorted = [...variants].sort((a, b) => a.key.localeCompare(b.key));
  const totalWeight = sorted.reduce((sum, v) => sum + Number(v.traffic_weight), 0) || 1;
  let cumulative = 0;
  for (const variant of sorted) {
    cumulative += Number(variant.traffic_weight) / totalWeight;
    if (bucketValue < cumulative) return variant;
  }
  // 浮動小数点誤差で累積が1をわずかに下回るケースへのフォールバック
  return sorted[sorted.length - 1];
}

/**
 * 指定した実験について、subjectId のバリアント割当を取得する（無ければ作成する）。
 *
 * - 実験が status === 'running' でなければ必ず null を返す（draft/approved/paused/completed
 *   では絶対にトラフィックを割り当てない）。
 * - 同じsubjectは常に同じバリアントになる（ハッシュ計算のidempotency + DB unique制約）。
 * - レース対策: upsertはローカル計算した割当を「提案」するだけで、最終的に返す値は
 *   upsert後にDBから読み直した実際の行から取る。
 */
export async function getVariantForExperiment(
  experimentKey: string,
  subjectId: SubjectId,
  options: ExperimentFnOptions = {},
): Promise<VariantAssignment | null> {
  const { throwOnError = false } = options;
  try {
    const subjectKey = subjectKeyOf(subjectId);
    if (!subjectKey) return null; // 匿名IDもuserIdも無ければ割当不可能

    const admin = createAdminClient();

    const { data: experiment, error: expError } = await admin
      .from("experiments")
      .select("id, status")
      .eq("key", experimentKey)
      .maybeSingle();
    if (expError) throw expError;
    // draft / approved / paused / completed のいずれでも割当は行わない。running のみ許可。
    if (!experiment || experiment.status !== "running") return null;

    const { data: variants, error: varError } = await admin
      .from("experiment_variants")
      .select("id, key, traffic_weight")
      .eq("experiment_id", experiment.id);
    if (varError) throw varError;
    if (!variants || variants.length === 0) return null;

    const bucketValue = hashToUnitInterval(`${experimentKey}:${subjectKey}`);
    const localPick = pickVariantDeterministic(variants as VariantRow[], bucketValue);

    const insertRow: Record<string, unknown> = {
      experiment_id: experiment.id,
      variant_id: localPick.id,
    };
    if (subjectId.userId) insertRow.user_id = subjectId.userId;
    else insertRow.anonymous_session_id = subjectId.anonymousSessionId;

    const { error: upsertError } = await admin
      .from("experiment_assignments")
      .upsert(insertRow, { onConflict: "experiment_id,subject_key", ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    // upsertの結果（ローカル計算値）を信用せず、実際にDBに保存されている行を読み直す。
    // これにより2つのリクエストがほぼ同時に来ても、両方が同じ（先にINSERTされた方の）
    // バリアントを返す。
    let storedQuery = admin
      .from("experiment_assignments")
      .select("variant_id")
      .eq("experiment_id", experiment.id);
    storedQuery = subjectId.userId
      ? storedQuery.eq("user_id", subjectId.userId)
      : storedQuery.eq("anonymous_session_id", subjectId.anonymousSessionId as string);
    const { data: stored, error: readError } = await storedQuery.maybeSingle();
    if (readError) throw readError;
    if (!stored) return null;

    const storedVariant = (variants as VariantRow[]).find((v) => v.id === stored.variant_id);
    if (!storedVariant) return null;

    return { variantKey: storedVariant.key, variantId: storedVariant.id };
  } catch (err) {
    console.error("[growth/experiments] getVariantForExperiment failed", err);
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * 露出(exposure)を一度だけ記録する。同じsubjectに対して何度呼ばれても、
 * DBには unique(experiment_id, subject_key) により1行しか残らない（ignoreDuplicatesで
 * 2回目以降は静かにno-op）。
 *
 * variantKeyは呼び出し側（getVariantForExperimentが返した値）が渡す想定。
 * 該当する実験/バリアントがDBに見当たらない場合は何もしない。
 */
export async function recordExposure(
  experimentKey: string,
  variantKey: string,
  subjectId: SubjectId,
  options: ExperimentFnOptions = {},
): Promise<void> {
  const { throwOnError = false } = options;
  try {
    const subjectKey = subjectKeyOf(subjectId);
    if (!subjectKey) return;

    const admin = createAdminClient();

    const { data: experiment, error: expError } = await admin
      .from("experiments")
      .select("id")
      .eq("key", experimentKey)
      .maybeSingle();
    if (expError) throw expError;
    if (!experiment) return;

    const { data: variant, error: varError } = await admin
      .from("experiment_variants")
      .select("id")
      .eq("experiment_id", experiment.id)
      .eq("key", variantKey)
      .maybeSingle();
    if (varError) throw varError;
    if (!variant) return;

    const insertRow: Record<string, unknown> = {
      experiment_id: experiment.id,
      variant_id: variant.id,
    };
    if (subjectId.userId) insertRow.user_id = subjectId.userId;
    else insertRow.anonymous_session_id = subjectId.anonymousSessionId;

    const { error } = await admin
      .from("experiment_exposures")
      .upsert(insertRow, { onConflict: "experiment_id,subject_key", ignoreDuplicates: true });
    if (error) throw error;
  } catch (err) {
    console.error("[growth/experiments] recordExposure failed", err);
    if (throwOnError) throw err;
  }
}

/**
 * コンバージョンを記録する。experiment_conversions にはユニーク制約が無いため
 * （同じsubjectが同じmetricで複数回コンバージョンすることは仕様上あり得る。
 * 例: 複数回購入。metricごとに重複を除外すべきかはmetricの意味次第で、ここでは
 * 一律の重複排除はしない — 呼び出し側/metric設計側で必要なら判断する）、
 * 呼ぶたびに1行追加される。
 *
 * ただし「このsubjectがどのバリアントか分からない」状態でのコンバージョン記録は
 * 集計を汚すため行わない。事前に getVariantForExperiment / recordExposure 等で
 * 割当が作られていることが前提で、割当が無ければ警告を出して何もしない。
 */
export async function recordConversion(
  experimentKey: string,
  metricName: string,
  value: number,
  subjectId: SubjectId,
  options: ExperimentFnOptions = {},
): Promise<void> {
  const { throwOnError = false } = options;
  try {
    const subjectKey = subjectKeyOf(subjectId);
    if (!subjectKey) return;

    const admin = createAdminClient();

    const { data: experiment, error: expError } = await admin
      .from("experiments")
      .select("id")
      .eq("key", experimentKey)
      .maybeSingle();
    if (expError) throw expError;
    if (!experiment) return;

    let assignmentQuery = admin
      .from("experiment_assignments")
      .select("variant_id")
      .eq("experiment_id", experiment.id);
    assignmentQuery = subjectId.userId
      ? assignmentQuery.eq("user_id", subjectId.userId)
      : assignmentQuery.eq("anonymous_session_id", subjectId.anonymousSessionId as string);
    const { data: assignment, error: assignError } = await assignmentQuery.maybeSingle();
    if (assignError) throw assignError;

    if (!assignment) {
      // このsubjectのバリアントが分からないと、どちらの群のコンバージョンか記録できない。
      console.warn(
        `[growth/experiments] recordConversion: no assignment found for experiment="${experimentKey}" subject, skipping (metric="${metricName}")`,
      );
      return;
    }

    const insertRow: Record<string, unknown> = {
      experiment_id: experiment.id,
      variant_id: assignment.variant_id,
      metric_name: metricName,
      value,
    };
    if (subjectId.userId) insertRow.user_id = subjectId.userId;
    else insertRow.anonymous_session_id = subjectId.anonymousSessionId;

    const { error } = await admin.from("experiment_conversions").insert(insertRow);
    if (error) throw error;
  } catch (err) {
    console.error("[growth/experiments] recordConversion failed", err);
    if (throwOnError) throw err;
  }
}
