/**
 * 試験情報（出題形式・問題数・試験時間・合格ライン等）を扱うガイド記事に表示する注記コンポーネント。
 *
 * 目的（AdSense事前審査対応・試験情報の正確性監査 フェーズ2）:
 *  - 出題形式・問題数・試験時間・配点は年度や回によって変更されうるため、断定を避ける
 *  - 英検はCSE（英検独自の技能別スコア）で合否判定される試験であり、単純な「正答率◯%」が
 *    公式の合格基準ではないことを明示する（showCseNote=true のページのみ）
 *  - 「最終確認日」を明示し、情報の鮮度をユーザーに伝える
 *
 * 詳細な運用方針は /EXAM_INFO_SOURCE_POLICY.md を参照。
 */

export type ExamKind = "eiken" | "toeic" | "university" | "school" | "general";

const OFFICIAL_LABEL: Record<ExamKind, string> = {
  eiken: "英検公式サイト（日本英語検定協会）",
  toeic: "ETS公式TOEIC情報・IIBC公式サイト",
  university: "各大学・各試験実施団体の公式サイト",
  school: "学校・教育委員会が配布する公式の試験要項",
  general: "各試験実施団体の公式サイト",
};

// 最終確認日は Phase 2 監査実施日で固定。以後、本ページの試験情報を見直した際はこの値を更新すること。
export const EXAM_INFO_LAST_VERIFIED = "2026-07-12";

export function ExamInfoDisclaimer({
  kind,
  showCseNote = false,
  lastVerified = EXAM_INFO_LAST_VERIFIED,
}: {
  kind: ExamKind;
  /** 英検の合否ラインを「正答率◯%」のように単純化して言及しているページで true にする */
  showCseNote?: boolean;
  lastVerified?: string;
}) {
  return (
    <div
      data-testid="exam-info-disclaimer"
      className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed space-y-1.5"
    >
      <p>
        ※ 試験の出題形式・問題数・試験時間・配点は年度や回によって変更される場合があります。本ページに記載の数値は目安・過去の傾向であり、最新情報は{OFFICIAL_LABEL[kind]}でご確認ください。
      </p>
      {showCseNote && (
        <p>
          ※ 英検は「英検CSEスコア」という技能別のスコア制度で合否を判定しており、単純な正答率（%）だけで合格ラインが決まるわけではありません。本ページの「◯%」表記は過去の出題傾向をもとにした参考値であり、合格を保証するものではありません。
        </p>
      )}
      <p className="text-amber-700 font-semibold" data-testid="exam-info-last-verified">
        最終確認日: {lastVerified}
      </p>
    </div>
  );
}
