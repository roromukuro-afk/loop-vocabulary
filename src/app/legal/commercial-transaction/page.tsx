import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/support";

// ============================================================
// /legal/commercial-transaction — 特定商取引法に基づく表記（準備中）
// ------------------------------------------------------------
// 2026-07-06、Premium課金導線の信頼性整備の一環として雛形を作成した。
// 販売事業者名・運営責任者名・所在地・電話番号は、オーナーから実際の情報が
// 提供されるまでプレースホルダーのまま。個人情報を推測・捏造して埋めることは
// 一切していない。
//
// 公開方針（案A、詳細はWORK_HISTORY.md参照）: ページ自体は実装するが、
// footer・/contact・/premium等、どこからもリンクしない（このファイルへの
// 直接URLアクセスでのみ到達可能）。sitemap.xmlにも含めず、
// robots meta (noindex,nofollow) と robots.txt の両方でクロールを防止する。
// オーナーが運営者情報を提供し、内容を確認・承認した後に、
// footerへのリンク追加を別途検討する。
// ============================================================

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記（準備中） | Loop Vocabulary",
  robots: { index: false, follow: false },
};

function Row({ label, value, pending }: { label: string; value: React.ReactNode; pending?: boolean }) {
  return (
    <tr className="border-b border-navy-100 last:border-0">
      <th className="text-left align-top py-3 pr-4 text-sm font-bold text-navy-800 w-40 shrink-0">
        {label}
      </th>
      <td className={`py-3 text-sm ${pending ? "text-amber-700 bg-amber-50 px-2 rounded" : "text-navy-700"}`}>
        {value}
      </td>
    </tr>
  );
}

export default function CommercialTransactionPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500">← トップへ</Link>

      <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 not-prose">
        <p className="text-sm font-bold text-amber-900">
          ⚠️ このページは準備中です（社内確認用ドラフト）
        </p>
        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
          運営者情報（販売事業者名・運営責任者名・所在地・電話番号）は未確定のため、
          プレースホルダーのまま表示しています。このページはサイト内のどこからも
          リンクされておらず、検索エンジンにもインデックスされません
          (robots: noindex, nofollow)。運営者情報の確認・入力が完了するまで、
          本ページを正式な特定商取引法に基づく表記として公開・案内しないでください。
        </p>
      </div>

      <h1 className="text-2xl font-bold text-navy-800 mt-4">特定商取引法に基づく表記</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-07-06（準備中ドラフト）</p>

      <table className="w-full mt-4 not-prose">
        <tbody>
          <Row label="販売事業者名" value="オーナー確認待ち" pending />
          <Row label="運営責任者" value="オーナー確認待ち" pending />
          <Row label="所在地" value="オーナー確認待ち（個人事業主の場合、請求があれば遅滞なく開示する取り扱いも選択可）" pending />
          <Row label="電話番号" value="オーナー確認待ち（個人事業主の場合、請求があれば遅滞なく開示する取り扱いも選択可）" pending />
          <Row
            label="メールアドレス"
            value={<a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>}
          />
          <Row
            label="お問い合わせ"
            value={<Link href="/contact" className="underline">お問い合わせフォーム</Link>}
          />
          <Row
            label="販売価格"
            value={
              <>
                プレミアムプラン<br />
                月額プラン: ¥480（税込・月額）<br />
                年額プラン: ¥3,800（税込・年額、月あたり約¥317相当）
              </>
            }
          />
          <Row
            label="商品代金以外の必要料金"
            value="なし（インターネット接続料金等、お客様のご負担となる通信費は別途発生します）"
          />
          <Row
            label="支払方法"
            value="クレジットカード等（決済代行事業者 Stripe, Inc. を通じたオンライン決済）"
          />
          <Row
            label="支払時期"
            value="プラン登録時に初回課金、以降は月額プランは毎月・年額プランは毎年、登録日を基準とした更新日に自動課金されます"
          />
          <Row
            label="サービス提供時期"
            value="決済完了後、直ちにプレミアム機能（広告非表示・AI解説無制限・CSV一括インポート等）をご利用いただけます"
          />
          <Row
            label="解約・返品特約"
            value={
              <>
                「設定」ページの Stripe カスタマーポータルからいつでも解約できます。
                解約後もその時点の請求期間の終了まで全機能をご利用いただけます。
                日割りでの返金には対応しておりません。
              </>
            }
          />
        </tbody>
      </table>

      <p className="text-xs text-navy-400 mt-6">
        本ページの記載内容は <Link href="/terms" className="underline">利用規約</Link> および{" "}
        <Link href="/privacy" className="underline">プライバシーポリシー</Link> と矛盾しないよう
        整備しています。内容に相違がある場合は利用規約・プライバシーポリシーの記載が優先されます。
      </p>
    </div>
  );
}
