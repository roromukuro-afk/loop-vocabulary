import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "教材データ・著作権について | Loop Vocabulary",
  description: "Loop Vocabulary が収録・紹介する教材データの扱い、市販教材の著作権・商標への配慮、CSVインポート時の注意点について説明します。",
  alternates: { canonical: "https://loop-vocabulary.app/legal/content-policy" },
};

export default function ContentPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500 no-underline">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-4">教材データ・著作権について</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-07-09</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">1. アプリに収録している教材データについて</h2>
      <p>
        Loop Vocabulary の「教材一覧」から一括インポートできる単語帳データは、権利関係を確認できたもの、
        または独自に作成したもののみを収録しています。権利者から許諾を得られていない、あるいは
        許諾の確認が取れない教材データは収録していません。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">2. 市販の単語帳を紹介する記事について</h2>
      <p>
        「学習ガイド」内には、「システム英単語」「英単語ターゲット1900」「LEAP」「鉄壁」など、
        市販の単語帳・教材を紹介・比較する記事があります。これらの記事について、以下の点にご注意ください。
      </p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>
          紹介している市販教材の名称・シリーズ名は、各出版社・著作権者の商標または著作物です。
          Loop Vocabulary はこれらの出版社・権利者と<b>公式に提携・協力しているものではありません</b>。
        </li>
        <li>
          記事の内容は、教材の一般的な特徴・使い方についての独自の解説・比較であり、出版社の公式見解や
          公式サポート内容を示すものではありません。
        </li>
        <li>
          記事内に表示されるAmazonの商品リンクは、Amazonアソシエイト・プログラムを通じた広告リンクです
          （各記事内に明記しています）。
        </li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">3. CSVインポート機能をご利用の際の注意</h2>
      <p>
        Loop Vocabulary では、プレミアムプランでCSVファイルから単語・意味を一括インポートできます。
        この機能は、<b>ご自身で作成したデータ、または権利者の許諾がある（もしくは私的利用の範囲内である）
        データ</b>をご自身の学習用として登録いただくためのものです。市販の単語帳・教材の内容を
        無断で複製・データ化して第三者と共有する目的でのご利用はお控えください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">4. 引用・参考にした情報について</h2>
      <p>
        学習ガイドの記事は、一般的に公開されている教材の構成・特徴（対象レベル・収録語数・配列方式など）を
        参考に、独自の切り口でまとめたものです。教材の本文・例文をそのまま転載することはしていません。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5. 権利者の方へ</h2>
      <p>
        記載内容に事実誤認がある場合や、著作権・商標権上の懸念がある場合は、
        <Link href="/contact">お問い合わせフォーム</Link>（種別「著作権に関するお問い合わせ」）または
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>までご連絡ください。
        確認のうえ、該当箇所の修正・削除など速やかに対応いたします。
      </p>

      <p className="text-xs text-navy-400 mt-6">
        本ページは一般的な取り扱い方針を説明するものであり、個別の法的判断を確定するものではありません。
        判断に迷う事案については、専門家（弁護士等）への確認を推奨します。本ページの記載内容は
        <Link href="/terms">利用規約</Link>・<Link href="/privacy">プライバシーポリシー</Link>と
        矛盾しないよう整備しています。内容に相違がある場合は利用規約・プライバシーポリシーの記載が優先されます。
      </p>

      <div className="flex justify-center gap-4 text-xs flex-wrap mt-6 not-prose">
        <Link href="/faq" className="text-navy-500 underline">よくある質問</Link>
        <Link href="/about" className="text-navy-500 underline">運営者について</Link>
        <Link href="/contact" className="text-navy-500 underline">お問い合わせ</Link>
        <Link href="/legal/commercial-transaction" className="text-navy-500 underline">特定商取引法に基づく表記</Link>
      </div>
    </div>
  );
}
