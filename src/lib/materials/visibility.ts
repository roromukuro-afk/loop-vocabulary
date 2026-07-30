/**
 * `/materials/[id]` の実際の公開可否は `is_public` 単独ではなく、
 * `is_public=true かつ license_status IN ('approved','original')` の両方で決まる
 * (public/RLSポリシー"materials public read"・ページ側の実クエリ双方がこの条件でフィルタする)。
 * IndexNowへ即時通知すべきかどうかの判定も、この実際の公開可否の遷移を基準にする必要がある
 * (is_publicだけを見ると、license_statusがpendingのまま`is_public=true`にしても実際には
 * 誰にも見えないページを「公開された」と誤って通知してしまう)。
 */
export type MaterialVisibilityFields = {
  is_public: boolean;
  license_status: string;
};

const VISIBLE_LICENSE_STATUSES = new Set(["approved", "original"]);

export function isEffectivelyPublicMaterial(fields: MaterialVisibilityFields): boolean {
  return fields.is_public === true && VISIBLE_LICENSE_STATUSES.has(fields.license_status);
}
