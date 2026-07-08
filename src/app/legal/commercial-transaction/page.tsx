import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/support";

// ============================================================
// /legal/commercial-transaction — 特定商取引法に基づく表記
// ------------------------------------------------------------
// 2026-07-06に雛形を作成、2026-07-07にオーナーから運営者情報の提供を受けて
// 内容を更新し、同日オーナー承認のもと正式公開した。販売事業者名・
// 運営責任者名はオーナーから提供された実名を記載。所在地・電話番号は、
// オーナーの方針により直接掲載せず、「請求があった場合、法令に基づき
// 遅滞なく開示する」旨を明記する形にしている（個人情報を推測・捏造して
// 埋めたものではない）。
//
// この開示方式（個人事業主が住所・電話番号を常時公開せず、請求時開示とする
// 扱い）が特定商取引法上どこまで認められるかについて、本ファイルは法的な
// 断定を行わない。必要であれば専門家（行政書士・弁護士等）への確認を推奨する
// （詳細: PRODUCTION_MONITORING.md §12-4、LAUNCH_READINESS_CHECKLIST.md §4）。
//
// 公開方針（2026-07-07正式公開）: footer（トップページ）・/premium・/contact・
// /terms からリンクしている。sitemap.xmlにも追加し、noindex/robots.txtの
// クロールブロックも解除済み（通常のページと同じくインデックス対象）。
// ============================================================

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Loop Vocabulary",
  description: "Loop Vocabulary（英単語学習アプリ）の特定商取引法に基づく表記。運営者情報・価格・支払方法・解約方法について。",
  alternates: { canonical: "https://loop-vocabulary.app/legal/commercial-transaction" },
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

      <h1 className="text-2xl font-bold text-navy-800 mt-4">特定商取引法に基づく表記</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-07-07</p>

      <table className="w-full mt-4 not-prose">
        <tbody>
          <Row label="販売事業者名" value="佐藤 慶音" />
          <Row label="運営責任者" value="佐藤 慶音" />
          <Row
            label="所在地"
            value={
              <>
                所在地および電話番号については、請求があった場合、法令に基づき
                遅滞なく開示します。開示を希望される場合は、
                <Link href="/contact" className="underline">お問い合わせフォーム</Link>
                よりご連絡ください。
              </>
            }
          />
          <Row
            label="電話番号"
            value={
              <>
                所在地および電話番号については、請求があった場合、法令に基づき
                遅滞なく開示します。開示を希望される場合は、
                <Link href="/contact" className="underline">お問い合わせフォーム</Link>
                よりご連絡ください。
              </>
            }
          />
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

      <div className="flex justify-center gap-4 text-xs flex-wrap mt-6 not-prose">
        <Link href="/faq" className="text-navy-500 underline">よくある質問</Link>
        <Link href="/about" className="text-navy-500 underline">運営者について</Link>
        <Link href="/contact" className="text-navy-500 underline">お問い合わせ</Link>
      </div>
    </div>
  );
}
