import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "IELTSの英単語学習法【AWL・アカデミック語彙を効率的に覚える】| Loop Vocabulary",
  description: "IELTS Academic/General の頻出語彙・AWL（アカデミック語彙リスト570語）の攻略法とスコア帯別の学習戦略を解説。留学・就労ビザ取得を目指す方向け完全ガイド。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/ielts-tango" },
  openGraph: {
    title: "IELTSの英単語学習法【AWL攻略・スコア帯別戦略】",
    description: "IELTS頻出語彙・AWL570語の覚え方とBand別学習戦略を完全解説。",
    url: "https://loop-vocabulary.app/guide/ielts-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "IELTS必須英単語3500", author: "旺文社", asin: "4010946032", price: "¥1,980", label: "IELTS語彙の定番" },
  { title: "Complete IELTS Bands 4-5 Student's Book with Answers", author: "Cambridge", asin: "0521179289", price: "¥3,800", label: "Band 5〜6目標" },
  { title: "The Official Cambridge Guide to IELTS", author: "Cambridge", asin: "1107620694", price: "¥4,200", label: "公式ガイドブック" },
];

const BANDS = [
  { band: "Band 5〜5.5", vocab: "4,000〜5,000語", color: "bg-sky-50 border-sky-100 text-sky-700", badge: "bg-sky-100", target: "観光ビザ・短期留学" },
  { band: "Band 6〜6.5", vocab: "6,000〜7,000語", color: "bg-indigo-50 border-indigo-100 text-indigo-700", badge: "bg-indigo-100", target: "大学入学・一般就労ビザ" },
  { band: "Band 7〜7.5", vocab: "9,000〜10,000語", color: "bg-violet-50 border-violet-100 text-violet-700", badge: "bg-violet-100", target: "大学院・専門職ビザ" },
  { band: "Band 8以上", vocab: "12,000語以上", color: "bg-purple-50 border-purple-100 text-purple-700", badge: "bg-purple-100", target: "医師・弁護士など" },
];

const CATEGORIES = [
  {
    icon: "📊",
    title: "分析・論述動詞",
    bg: "bg-indigo-50 border-indigo-100",
    words: [
      { en: "analyze / evaluate", jp: "分析する / 評価する" },
      { en: "demonstrate", jp: "示す・証明する" },
      { en: "indicate", jp: "示す・指し示す" },
      { en: "argue / suggest", jp: "主張する / 示唆する" },
    ],
  },
  {
    icon: "📈",
    title: "変化・程度の形容詞",
    bg: "bg-sky-50 border-sky-100",
    words: [
      { en: "significant", jp: "重要な・かなりの" },
      { en: "considerable", jp: "かなりの" },
      { en: "dramatic", jp: "劇的な" },
      { en: "gradual", jp: "徐々の" },
    ],
  },
  {
    icon: "🔗",
    title: "比較・因果の接続語",
    bg: "bg-teal-50 border-teal-100",
    words: [
      { en: "whereas", jp: "〜である一方" },
      { en: "nevertheless", jp: "それにもかかわらず" },
      { en: "consequently", jp: "結果として" },
      { en: "conversely", jp: "逆に" },
    ],
  },
  {
    icon: "🧠",
    title: "抽象概念名詞（AWL）",
    bg: "bg-violet-50 border-violet-100",
    words: [
      { en: "concept / framework", jp: "概念 / 枠組み" },
      { en: "perspective", jp: "視点・観点" },
      { en: "hypothesis", jp: "仮説" },
      { en: "empirical", jp: "経験に基づいた・実証的" },
    ],
  },
];

const PARAPHRASE = [
  { basic: "show", advanced: "demonstrate / indicate / reveal" },
  { basic: "big", advanced: "substantial / considerable / significant" },
  { basic: "problem", advanced: "challenge / issue / concern" },
  { basic: "use", advanced: "utilize / leverage / employ" },
  { basic: "help", advanced: "facilitate / assist / contribute to" },
  { basic: "end", advanced: "conclude / terminate / cease" },
];

const SCHEDULE = [
  { band: "Band 5 → Band 6", period: "3〜4ヶ月", daily: "1時間のAWL学習 + 週2回過去問" },
  { band: "Band 6 → Band 7", period: "6〜9ヶ月", daily: "1.5時間の語彙 + 週3回Reading/Writing練習" },
  { band: "Band 7 → Band 7.5", period: "6ヶ月〜1年", daily: "コロケーション特訓 + ネイティブテキスト精読" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "IELTSの英単語学習法【AWL・アカデミック語彙を効率的に覚える】",
  "description": "IELTS Academic/Generalの頻出語彙・AWL攻略法とスコア帯別の学習戦略を解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2025-01-05",
  "url": "https://loop-vocabulary.app/guide/ielts-tango",
};

export default function IeltsTangoPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "IELTSの英単語学習法【AWL・アカデミック語彙を効率的に覚える】" }]} />
      </div>

      <GuideTracker slug="ielts-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"IELTSの英単語学習法【AWL・アカデミック語彙を効率的に覚える】","item":"https://loop-vocabulary.app/guide/ielts-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-indigo-700 to-violet-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-indigo-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 font-semibold mb-3">
            IELTS
          </div>
          <h1 className="text-2xl font-black leading-tight">IELTSの英単語学習法<br />【AWL攻略・Band別戦略】</h1>
          <p className="mt-2 text-sm text-indigo-200 max-w-sm mx-auto">留学・就労ビザ取得に必要なアカデミック語彙を最短で習得するための完全ガイド</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* IELTSの特徴 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">IELTSに必要な語彙の特徴</h2>
          <p className="text-sm text-navy-700 leading-relaxed mb-4">
            IELTSはTOEICや英検と大きく異なり、<strong>学術論文・レポートで使うアカデミック語彙</strong>が中心です。4技能（Reading / Listening / Writing / Speaking）すべてで語彙力が問われます。日本の英語教育では出てこない「論文語」を意識的に学ぶ必要があります。
          </p>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="font-bold text-indigo-800 text-sm mb-2">AWL（Academic Word List）とは</div>
            <p className="text-xs text-navy-700 leading-relaxed">
              学術文書に頻出する<strong>570語のリスト</strong>（Coxhead 2000年作成）。IELTSのReadingに占める割合は約10%。AWLを完全習得するだけで Reading スコアが大きく改善します。語根ベースの派生語が多いのも特徴です（analyze → analysis → analytical）。
            </p>
          </div>
        </div>

        {/* Band別語彙数 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">Band スコア別 必要語彙数</h2>
          <div className="space-y-3">
            {BANDS.map((b) => (
              <div key={b.band} className={`rounded-xl border p-3 ${b.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className={`font-black text-sm ${b.color.split(" ")[2]}`}>{b.band}</div>
                    <div className="text-xs text-navy-500 mt-0.5">{b.target}</div>
                  </div>
                  <div className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${b.badge} ${b.color.split(" ")[2]}`}>
                    {b.vocab}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 頻出語彙カテゴリ */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">IELTSで頻出するアカデミック単語</h2>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className={`rounded-xl border p-4 ${cat.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="font-bold text-navy-800 text-sm">{cat.title}</div>
                </div>
                <div className="space-y-1.5">
                  {cat.words.map((w) => (
                    <div key={w.en} className="flex items-start gap-2 text-xs">
                      <span className="font-mono font-bold text-navy-800 flex-1">{w.en}</span>
                      <span className="text-navy-500 shrink-0">{w.jp}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ライティング言い換え表 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">Writing で差がつく言い換え表現</h2>
          <p className="text-xs text-navy-500 mb-4">同じ単語の繰り返しを避け、アカデミックな語彙に格上げすることが高得点のカギ。</p>
          <div className="space-y-2">
            {PARAPHRASE.map((p) => (
              <div key={p.basic} className="flex items-start gap-3 bg-navy-50 rounded-xl p-3 text-xs">
                <div className="font-mono font-bold text-navy-500 w-16 shrink-0">{p.basic}</div>
                <div className="text-navy-300 font-bold shrink-0">→</div>
                <div className="font-semibold text-indigo-700">{p.advanced}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 学習スケジュール */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-4">IELTSスコアアップ 学習スケジュール</h2>
          <div className="space-y-3">
            {SCHEDULE.map((s) => (
              <div key={s.band} className="bg-white rounded-xl border border-indigo-100 p-3">
                <div className="font-bold text-indigo-700 text-sm">{s.band}</div>
                <div className="text-[11px] text-navy-500 mt-0.5">目安期間: {s.period}</div>
                <div className="text-xs text-navy-700 mt-1 font-medium">{s.daily}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-indigo-700 mt-3 font-medium">
            毎日のAWL単語帳学習（Loop Vocabulary SRS）+ 過去問演習が最短ルートです。
          </p>
        </div>

        {/* Loop Vocabulary での使い方 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">Loop VocabularyでのIELTS対策法</h2>
          <div className="space-y-3">
            {[
              { icon: "📚", title: "AWL単語帳を作る", desc: "AWLの570語をSublist 1〜10に分けて単語帳を作成。SRSで繰り返し復習し、最短で全語を習得できます。" },
              { icon: "📥", title: "CSVインポートで一括登録", desc: "AWLリストをCSV形式でインポートすれば570語を一括登録できます（プレミアム機能）。手入力の手間ゼロ。" },
              { icon: "🤖", title: "AI解説でコロケーションを確認", desc: '「conduct research」は正しいが「make research」は誤り。AI解説でこうした使い方の違いを例文付きで確認できます。' },
              { icon: "✍️", title: "Writing頻出語を別管理", desc: "Reading用・Writing用・Speaking用に単語帳を分けて管理すると、試験直前に必要な語彙だけを集中復習できます。" },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 IELTS対策におすすめの参考書（Amazon）" />

        {/* メールキャプチャ */}
        <GuideEmailCapture slug="ielts-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-indigo-700 to-violet-800 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary でAWL単語帳を作る</div>
          <p className="text-sm text-indigo-200 mb-4">570語のAWLをSRS管理。AIコロケーション解説付きで Band Up を実現。</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-800 font-bold text-sm hover:bg-indigo-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/vocab-check"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              語彙力を診断する
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eiken-1kyu-tango", tag: "英検1級", title: "英検1級 単語対策【15,000語レベルへの学習戦略】" },
              { href: "/guide/toeic-tango", tag: "TOEIC", title: "TOEICスコアアップの英単語学習法【600→800点】" },
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
