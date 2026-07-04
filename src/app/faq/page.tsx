import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "よくある質問（FAQ）| Loop Vocabulary",
  description: "Loop Vocabulary の使い方・料金・プレミアムプラン・データ削除・英検/TOEIC対応などよくある質問にお答えします。",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "Loop Vocabulary は無料で使えますか？",
    a: "はい、基本機能（単語帳作成・忘却曲線復習・AI解説5回/日）は完全無料です。プレミアムプランでは広告ゼロ・AI解説無制限・CSV一括インポートなどが使えます。",
  },
  {
    q: "プレミアムプランの料金はいくらですか？",
    a: "月額プランは ¥480/月、年額プランは ¥3,800/年（月あたり約 ¥317）です。いつでもキャンセルでき、解約後も有効期限まで利用できます。",
  },
  {
    q: "英検・TOEIC・大学受験に使えますか？",
    a: "はい、あらゆる試験に対応しています。ご自身で単語帳を作って登録するだけで、忘却曲線（SRS）アルゴリズムが最適なタイミングで復習を出題します。CSV インポートを使えば既存のリストを一括登録できます。",
  },
  {
    q: "忘却曲線（SRS）とはどういう仕組みですか？",
    a: "エビングハウスの忘却曲線に基づき、「忘れそうになるタイミング」で自動的に単語を出題する学習法です。正解すると次回の出題間隔が伸び、長期記憶に定着します。Loop Vocabulary では正答率・連続学習日数をもとに間隔を自動調整します。",
  },
  {
    q: "AI解説機能とは何ですか？",
    a: "Claude（Anthropic社）を使い、単語の語源・ニュアンス・例文・覚え方を AI が解説します。無料プランは1日5回まで、プレミアムは無制限です。",
  },
  {
    q: "スマートフォンで使えますか？アプリはありますか？",
    a: "はい、スマートフォンブラウザに最適化されています。また PWA（プログレッシブウェブアプリ）に対応しており、「ホーム画面に追加」するとアプリのように使えます。プッシュ通知による復習リマインダーも届きます。",
  },
  {
    q: "複数の端末で使えますか？データは同期されますか？",
    a: "はい、アカウント登録するとどの端末からでも同じデータにアクセスできます。学習データはリアルタイムで同期されます。",
  },
  {
    q: "単語をCSVで一括インポートできますか？",
    a: "はい、プレミアムプランで CSV インポート機能が使えます。「英語, 意味」形式のCSVファイルをアップロードするだけで一括登録できます。Anki や他のアプリからの乗り換えにも便利です。",
  },
  {
    q: "単語帳を友達と共有できますか？",
    a: "はい、共有コードを発行して単語帳を公開できます。友達はコードを入力するだけでその単語帳を自分のアカウントにコピーして学習を始められます。",
  },
  {
    q: "アカウントを削除したいのですがどうすればいいですか？",
    a: "設定 → アカウント削除から即時削除できます。削除するとすべての学習データが完全に消去されます。プレミアムご利用中の場合は事前にサブスクリプションをキャンセルしてください。",
  },
  {
    q: "個人情報はどのように扱われますか？",
    a: "プライバシーポリシーをご確認ください。学習データは暗号化して保存し、第三者に販売・提供することはありません。",
  },
  {
    q: "塾や学校での利用は可能ですか？",
    a: "はい、法人・教育機関でのご利用も歓迎します。クラス管理機能などのご要望はお問い合わせフォームからご相談ください。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a },
  })),
};

export default function FaqPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <Link href="/" className="text-xs text-navy-400 hover:text-white transition-colors">← トップへ</Link>
        <h1 className="text-2xl font-black leading-tight mt-3">よくある質問</h1>
        <p className="mt-2 text-sm text-navy-300">Loop Vocabulary についてよくいただくご質問</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-3">
        {FAQS.map(({ q, a }, i) => (
          <details
            key={i}
            className="bg-white rounded-2xl border border-navy-100 shadow-sm group"
          >
            <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none select-none">
              <span className="font-semibold text-navy-800 text-sm leading-snug">{q}</span>
              <span className="shrink-0 w-6 h-6 rounded-full bg-navy-50 text-navy-500 flex items-center justify-center text-sm font-bold group-open:rotate-45 transition-transform">＋</span>
            </summary>
            <div className="px-5 pb-4 text-sm text-navy-600 leading-relaxed border-t border-navy-50 pt-3">
              {a}
            </div>
          </details>
        ))}

        <div className="mt-4 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">解決しない場合は</div>
          <p className="text-sm text-navy-300 mb-3">お問い合わせフォームからご連絡ください</p>
          <Link
            href="/contact"
            className="inline-block px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
          >
            お問い合わせ →
          </Link>
        </div>

        <div className="flex justify-center gap-4 text-sm flex-wrap pt-2">
          <Link href="/materials" className="text-navy-500 underline">教材一覧</Link>
          <Link href="/dictionary" className="text-navy-500 underline">辞書検索</Link>
          <Link href="/" className="text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
