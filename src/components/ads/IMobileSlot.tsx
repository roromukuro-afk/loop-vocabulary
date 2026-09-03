// i-mobile Ad Network(Issue #136 Stage-4)。まだ「i-mobile Ad Networkパートナー」
// (Affiliateではない)への申請自体が未提出で、管理画面が発行するタグを一度も
// 見ていない。i-mobileのメディア/スポット識別子の項目名・スクリプトの読み込み方式
// (同期/非同期・div+script型かiframe型か等)を推測で実装しない
// (ユーザー指示: 「実際のタグ形式を確認する前にprovider固有処理を決め打ちしない」)。
//
// 承認後、管理画面が発行したタグを取得したら、NinjaAdMaxSlot.tsxと同じ方針
// (発行された値だけを差し替え可能にし、それ以外の構造は一字一句そのまま実装)で
// このファイルを実装する。それまでは常にnullを返すスタブとして扱う。
export function IMobileSlot(): null {
  return null;
}
