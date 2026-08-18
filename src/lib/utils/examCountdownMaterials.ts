/**
 * /exam-countdown-planner の「教材から単語数を入力」選択ロジック。
 *
 * UIコンポーネント(ExamCountdownPlanner.tsx)から純粋関数として切り出し、
 * ユニットテスト可能にする。DBアクセス・Reactの状態は一切持たない。
 */

export type ExamCountdownMaterialOption = {
  id: string;
  title: string;
  examType: string | null;
  level: string | null;
  wordCount: number;
};

/**
 * 教材一覧を試験区分(exam_type)ごとにグループ化する(<optgroup>表示用)。
 * exam_type が null の教材は「その他」グループにまとめる。
 * 元の配列の並び順を維持したまま、初出のexam_type順にグループが並ぶ。
 */
export function groupMaterialsByExamType(
  materials: ExamCountdownMaterialOption[],
): [string, ExamCountdownMaterialOption[]][] {
  const groups = new Map<string, ExamCountdownMaterialOption[]>();
  for (const m of materials) {
    const key = m.examType ?? "その他";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

/**
 * 選択された教材IDから、「覚えたい単語数」欄に自動入力すべき語数を解決する。
 * 該当教材が見つからない場合はnullを返す(呼び出し側は入力欄を変更しない)。
 */
export function resolveWordCountFromMaterial(
  materials: ExamCountdownMaterialOption[],
  materialId: string,
): number | null {
  const material = materials.find((m) => m.id === materialId);
  return material ? material.wordCount : null;
}
