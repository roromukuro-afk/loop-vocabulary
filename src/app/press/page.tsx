import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "Loop Vocabulary プレスキット・レビュー向け情報 | Loop Vocabulary",
  description:
    "英単語学習アプリ Loop Vocabulary の概要・機能・レビュー時に確認いただきたいポイントをまとめたページです。教育系ブロガー・メディアの方向けの情報を掲載しています。",
  alternates: { canonical: `${SITE_URL}/press` },
  robots: { index: true, follow: true },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "プレスキット", item: `${SITE_URL}/press` },
  ],
};

export default function PressPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← トップページ</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-semibold mb-3">プレス・レビュー向け</div>
          <h1 className="text-2xl font-black leading-tight">Loop Vocabulary<br />プレスキット</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">教育系ブロガー・メディアの方に向けた、サービス概要とレビュー時のポイントです。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">サービス概要</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyは、英単語の検索・登録・忘却曲線（SRS）による自動復習・フラッシュカードでの
            自己想起・4択/入力/リスニングテスト・小テストPDF出力までを1つのアプリで完結できる、
            英単語学習アプリです。中高生・大学受験生・英検受験者・定期テスト対策をしたい方を主な
            対象にしています。無料登録で主要機能を利用でき、Premiumプラン（月額¥480〜）でAI機能や
            PDF出力回数などがさらに使いやすくなります。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">無料で使える機能</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>辞書検索から単語帳への登録</li>
              <li>フラッシュカードでの自己想起・忘却曲線による自動復習</li>
              <li>4択・入力・リスニングテスト</li>
              <li>小テストPDF作成（1日3回まで）</li>
              <li>3分でできる語彙力チェック（ログイン不要）</li>
              <li>各種教材のインポート</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <div className="text-sm font-bold text-navy-800 mb-2">Premiumで使える機能</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>AI単語解説の利用回数アップ</li>
              <li>AI弱点分析・AI学習プラン作成</li>
              <li>長文からのAI単語抽出</li>
              <li>小テストPDF作成が無制限に</li>
              <li>タイピング・リスニング練習</li>
              <li>広告非表示</li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">対象別の導線</h2>
          <div className="space-y-2">
            {[
              { href: "/materials/highschool", label: "高校生向け教材", desc: "定期テスト・英検・大学受験の基礎固め" },
              { href: "/materials/eiken", label: "英検対策教材", desc: "英検4・5級〜1級までレベル別" },
              { href: "/materials/university-exam", label: "大学受験対策教材", desc: "共通テスト〜難関大対策" },
              { href: "/materials/school-test", label: "定期テスト対策教材", desc: "教科書レベルの基礎語彙" },
            ].map((m) => (
              <Link key={m.href} href={m.href} className="block bg-navy-50 rounded-xl px-4 py-3 hover:bg-navy-100 transition-colors">
                <div className="font-semibold text-navy-800 text-sm">{m.label}</div>
                <div className="text-xs text-navy-500 mt-0.5">{m.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">レビュー時に確認いただきたいポイント</h2>
          <ul className="text-sm text-navy-700 space-y-2 list-disc pl-5">
            <li>4択だけでなく、フラッシュカードによる自己想起を中心に設計している点</li>
            <li>忘却曲線（SRS）が学習モードごとに復習間隔を調整している点</li>
            <li>AIは答えを丸投げするものではなく、「思い出せなかった」場合のみ任意で使える解説補助である点</li>
            <li>塾・学校の現場でも使える小テストPDF出力機能</li>
            <li>ログイン不要で試せる語彙力チェック（無料）</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">関連ページ</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/about" className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors">運営者について</Link>
            <Link href="/premium" className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors">料金プラン</Link>
            <Link href="/faq" className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors">FAQ</Link>
            <Link href="/guide" className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors">学習ガイド一覧</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">お問い合わせについて</div>
          <p className="text-xs text-navy-600 leading-relaxed">
            取材・レビュー・掲載に関するご相談は<Link href="/contact" className="underline">お問い合わせフォーム</Link>から
            ご連絡ください。内容を確認のうえ、個別に対応いたします。現時点でアフィリエイトプログラムや
            自動承認によるPremium無償提供の制度はご用意していません。
          </p>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>

      <div className="mt-12">
        <PublicFooter />
      </div>
    </div>
  );
}
