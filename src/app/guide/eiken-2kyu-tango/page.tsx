import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { ExamInfoDisclaimer } from "@/components/guide/ExamInfoDisclaimer";
import { GuideShareCta } from "./GuideShareCta";

const PAGE_TITLE = "英検2級 単語対策｜頻出テーマ別の覚え方と無料単語一覧";

export const metadata: Metadata = {
  title: `${PAGE_TITLE} | Loop Vocabulary`,
  description: "英検2級の単語対策を、頻出テーマ別の覚え方・無料の単語一覧・自分の単語でテストが作れるツールまでまとめて解説。最新の出題形式(大問1は17問)にもとづいて解説しています。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-2kyu-tango" },
};

const CATEGORIES = [
  {
    icon: "🌍",
    title: "環境・自然",
    bg: "bg-emerald-50 border-emerald-100",
    color: "text-emerald-700",
    examples: ["environment（環境）", "pollution（汚染）", "renewable（再生可能な）", "endangered（絶滅危惧の）", "sustainable（持続可能な）", "ecosystem（生態系）"],
    tip: "英検2級ではリーフレットや記事でよく出るテーマの一つ。「prevent/reduce/protect」などの動詞もセットで覚えておくと文脈がつかみやすくなります。",
  },
  {
    icon: "🏥",
    title: "医療・健康",
    bg: "bg-red-50 border-red-100",
    color: "text-red-700",
    examples: ["symptom（症状）", "treatment（治療）", "diagnosis（診断）", "infectious（感染性の）", "prevention（予防）", "nutrition（栄養）"],
    tip: "医療系の英文はライティングの意見論述でも使いやすいテーマです。「suffer from / recover from / consult a doctor」のようなコロケーションもあわせて押さえましょう。",
  },
  {
    icon: "💼",
    title: "社会・ビジネス",
    bg: "bg-blue-50 border-blue-100",
    color: "text-blue-700",
    examples: ["economy（経済）", "legislation（法律）", "poverty（貧困）", "discrimination（差別）", "global（世界的な）", "statistics（統計）"],
    tip: "時事的な話題に関連した語彙が多いテーマです。英字ニュースの見出しに日常的に触れておくと、単語だけでなく背景知識も一緒に身につきやすくなります。",
  },
  {
    icon: "🔬",
    title: "科学・テクノロジー",
    bg: "bg-purple-50 border-purple-100",
    color: "text-purple-700",
    examples: ["artificial（人工の）", "innovation（革新）", "experiment（実験）", "efficient（効率的な）", "automated（自動化された）", "algorithm（アルゴリズム）"],
    tip: "環境技術やAI関連など、科学技術系のテーマが扱われることがあります。接頭辞「auto-（自動）」「bio-（生命）」「cyber-（サイバー）」を意識すると語彙を広げやすくなります。",
  },
  {
    icon: "🎓",
    title: "教育・社会問題",
    bg: "bg-amber-50 border-amber-100",
    color: "text-amber-700",
    examples: ["curriculum（カリキュラム）", "scholarship（奨学金）", "diversity（多様性）", "inequality（不平等）", "compulsory（義務的な）", "literacy（識字能力）"],
    tip: "英検ライティングの意見論述でも使う機会が多い語彙群です。自分の意見を英語で述べる練習と合わせて覚えると記憶に残りやすくなります。",
  },
];

const STUDY_PLAN = [
  { week: "1〜2週目", goal: "基礎語彙の総点検", content: "中学〜高1レベルの語彙を復習。アプリで苦手単語をマーク" },
  { week: "3〜4週目", goal: "テーマ別語彙を習得", content: "環境・医療・社会などの頻出テーマ語彙をSRSで学習。1日30語ペースが一例" },
  { week: "5〜6週目", goal: "語彙問題の演習", content: "過去問の語彙問題（大問1・短文の語句空所補充）を毎日解く。わからない語は即アプリ登録" },
  { week: "7週目", goal: "ライティング語彙の強化", content: "英文要約(45〜55語程度)と意見論述(80〜100語程度)、それぞれで使える語彙・表現を集中的に確認" },
  { week: "8週目", goal: "総仕上げ", content: "弱点単語の最終確認。本番形式の過去問で時間配分を練習" },
];

const TACTICS = [
  { icon: "🎯", title: "大問1（語彙問題）は文脈から推測する", desc: "短文の語句空所補充は、選択肢を見る前に空欄前後の文脈を読むと絞り込みやすくなることがあります。文法的に不自然な選択肢から除外していくのも有効な進め方の一つです。" },
  { icon: "✍️", title: "ライティングでは知っている語を使う", desc: "難しい単語を無理に使おうとしてスペルミスをするより、確実に使える単語で書く方が減点が少なくなる傾向があります。" },
  { icon: "📖", title: "長文（大問2・3）で語彙を文脈推測する練習をする", desc: "2級の長文問題で知らない単語が出ても、前後の文脈から意味を推測できることがあります。この力は本番前に意識して練習しておくと安心です。" },
  { icon: "🔄", title: "派生語をまとめて覚える", desc: "「innovate（動詞）→ innovation（名詞）→ innovative（形容詞）→ innovatively（副詞）」のように品詞変化をセットで覚えると、1つの単語から使える語彙を効率よく広げられます。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": PAGE_TITLE,
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eiken-2kyu-tango",
};

const FAQ_ITEMS = [
  {
    q: "英検2級の単語は何語くらい覚えれば合格できますか？",
    a: "英検は「合格に必要な語彙数」を公式には発表していません。市販の単語帳（でる順パス単など）では出題範囲の目安として約5,000語という数字が使われることもありますが、教材によって算出方法が異なり数字には幅があります。具体的な語数を追うよりも、過去問で実際に知らない単語がどれくらいあるかを確認し、頻出テーマから優先して覚えていく方が効率的です。",
  },
  {
    q: "準2級プラスを受けてから2級に進むべきですか？",
    a: "英検には準2級プラスという級があり、英検公式でも2級は「準2級プラスまでしっかりつけてきた力を実生活の様々な分野で応用できる力を身につけている級」と説明されています。準2級プラスの受験は必須ではありませんが、準2級と2級の間の力試しとして活用する選択肢もあります。",
  },
  {
    q: "2級の単語対策で、社会・環境・医療などのテーマ別語彙はどう覚えればいいですか？",
    a: "テーマごとにまとめて覚えると、関連する単語同士のつながりで記憶に残りやすくなります。1つのテーマを浅く広く触れるより、忘れかけたタイミングでそのテーマの単語群をまとめて復習する方が定着しやすい傾向があります。",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Eiken2KyuPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: PAGE_TITLE }]} />
      </div>

      <GuideTracker slug="eiken-2kyu-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":PAGE_TITLE,"item":"https://loop-vocabulary.app/guide/eiken-2kyu-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">英検対策ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英検2級 単語対策</h1>
        <p className="mt-2 text-sm text-navy-300">頻出テーマ別に効率よく身につけて合格へ</p>
        <div className="mt-4 inline-block bg-white/10 rounded-xl px-4 py-2 text-sm">
          難易度の目安：高校卒業程度（英検公式）
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 英検2級のリーディングは大問1〜3で計31問（うち語彙問題にあたる「短文の語句空所補充」が17問）。配点比率が高いため、社会・環境・医療・テクノロジー等のテーマ別に頻出語彙を学習するのが効率的です。
          </p>
        </div>

        {/* 学習の流れ */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <div className="text-sm font-bold text-navy-700 mb-3">このページの使い方</div>
          <div className="flex items-center gap-1.5 text-xs text-navy-600 flex-wrap">
            <span className="px-2 py-1 bg-navy-50 rounded-lg border border-navy-100">① 単語一覧を確認する</span>
            <span>→</span>
            <span className="px-2 py-1 bg-navy-50 rounded-lg border border-navy-100">② 自分でテストする</span>
            <span>→</span>
            <span className="px-2 py-1 bg-navy-50 rounded-lg border border-navy-100">③ Loopで忘れた語を復習する</span>
          </div>
        </div>

        {/* 単語一覧CTA（ファーストビュー付近） */}
        <GuideMaterialCTA
          heading="英検2級の単語一覧を見る"
          materials={[
            { id: "00000000-0000-0000-0000-000000000022", title: "英検2級 重要単語" },
          ]}
        />

        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">英検2級の出題形式と語彙レベル</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英検2級は高校卒業程度が目安。一次試験のリーディングは大問1「短文の語句空所補充」17問・大問2「長文の語句空所補充」6問・大問3「長文の内容一致選択」8問の計31問、ライティングは「英文要約」と「意見論述」の2題、リスニングはPart1・Part2で計30問という構成です。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">17問</div>
              <div className="text-[10px] text-navy-500">短文の語句空所補充（大問1）</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">31問</div>
              <div className="text-[10px] text-navy-500">リーディング計（大問1〜3）</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">約7分</div>
              <div className="text-[10px] text-navy-500">二次試験（面接）</div>
            </div>
          </div>
          <p className="text-sm text-navy-600 leading-relaxed mt-4">
            単語対策が必要になる場面は一つではありません。大問1の語彙問題そのもので失点する場合もあれば、大問2・3の長文が語彙不足でそもそも読みにくい、ライティングで使える語彙が少なく減点される、というケースもあります。テーマ別に語彙を増やすことは、このどの場面にも効果があります。
          </p>
          <div className="mt-4">
            <ExamInfoDisclaimer kind="eiken" lastVerified="2026-08-15" />
          </div>
        </div>

        {/* カテゴリ別 */}
        <h2 className="font-black text-navy-800 text-lg px-1">テーマ別 頻出単語</h2>
        {CATEGORIES.map((c) => (
          <div key={c.title} className={`bg-white rounded-2xl border overflow-hidden ${c.bg}`}>
            <div className={`flex items-center gap-2 px-5 py-3 border-b ${c.bg}`}>
              <span className="text-xl">{c.icon}</span>
              <span className={`font-black text-base ${c.color}`}>{c.title}</span>
            </div>
            <div className="p-5 bg-white">
              <div className="flex flex-wrap gap-2 mb-3">
                {c.examples.map((ex) => (
                  <span key={ex} className="text-xs bg-navy-50 text-navy-700 px-3 py-1 rounded-full">{ex}</span>
                ))}
              </div>
              <p className="text-xs text-navy-500 border-t border-navy-50 pt-2">💡 {c.tip}</p>
            </div>
          </div>
        ))}

        {/* テストメーカー導線 */}
        <div className="bg-white rounded-2xl border border-sky-200 p-5">
          <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1">Loop Vocabulary ツール</div>
          <div className="text-sm font-bold text-navy-800 mb-2">自分の単語リストでテストを作る</div>
          <p className="text-xs text-navy-600 leading-relaxed mb-3">
            学校の教材や単語帳で覚えている英単語を貼り付けるだけで、無料の4択・記述式テストをPDFで作成できます。登録不要ですぐ使えます（英検2級の単語一覧データを自動で読み込むものではないため、単語はご自身で貼り付けてください）。
          </p>
          <Link
            href="/tools/vocab-test-maker"
            data-tool="vocab_test_maker"
            data-placement="mid_article_test_maker_card"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            自分の単語でテストを作る →
          </Link>
        </div>

        {/* 8週間プラン */}
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-5 py-4 text-white">
            <h2 className="font-black">8週間の学習プラン例</h2>
            <p className="text-xs text-navy-300 mt-0.5">1日20〜30分の学習を目安にした一例です</p>
          </div>
          <div className="divide-y divide-navy-50">
            {STUDY_PLAN.map((p) => (
              <div key={p.week} className="px-5 py-3 flex gap-4">
                <div className="text-xs font-bold text-navy-600 shrink-0 w-16">{p.week}</div>
                <div>
                  <div className="text-sm font-bold text-navy-800">{p.goal}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{p.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 学習計画ツール導線(8週間プランを自分の試験日に合わせて調整する) */}
        <div className="bg-white rounded-2xl border border-sky-200 p-5">
          <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1">Loop Vocabulary ツール</div>
          <div className="text-sm font-bold text-navy-800 mb-2">自分の試験日から逆算して学習ペースを計算する</div>
          <p className="text-xs text-navy-600 leading-relaxed mb-3">
            上の8週間プランはあくまで一例です。試験日と覚えたい単語数を入力すると、今日から試験日までの1日あたりの学習語数を無料で自動計算できます。
          </p>
          <Link
            href="/exam-countdown-planner"
            data-tool="exam_countdown_planner"
            data-placement="mid_article_exam_countdown_card"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            学習計画を立てる →
          </Link>
        </div>

        {/* 語彙攻略のコツ */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">語彙問題を攻略する4つのコツ</h2>
          <div className="space-y-4">
            {TACTICS.map((t) => (
              <div key={t.title} className="flex gap-3">
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SRS復習 + 役割の整理 */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">③ 忘れた語をLoopのSRSで継続復習</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線に沿って自動的に復習タイミングを計算。弱点単語を集中的に学習できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">今の語彙力を診断する</Link>
          </div>
          <p className="text-[11px] text-navy-400 mt-3">
            「今の語彙力を診断する」は現在の語彙レベルの目安を見る診断テスト、「自分の単語でテストを作る」は自分が覚えている範囲からテストを作るツールです。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="text-sm font-bold text-navy-800 mb-2">よくある質問</div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <GuideShareCta />

        {/* アフィリエイト */}
        <AmazonBookSection
          heading="📚 英検2級おすすめ参考書（Amazon）"
          books={[
            { title: "英検2級 でる順パス単 5訂版", author: "旺文社", asin: "4010947268", price: "¥990", label: "2級単語帳の定番" },
            { title: "英検2級 過去6回全問題集", author: "旺文社", asin: "4010947284", price: "¥1,430", label: "本番形式で仕上げ" },
            { title: "英検2級 ライティング問題", author: "旺文社", asin: "4010947764", price: "¥880", label: "ライティング強化" },
            { title: "システム英単語 改訂新版", author: "霜康司・刀祢雅彦", asin: "4796111727", price: "¥1,210", label: "語彙の底上げに" },
          ]}
        />

        <GuideEmailCapture slug="eiken-2kyu-tango" />

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eiken-jun2-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">⬇️</div>
            <div className="font-bold text-navy-800 text-sm">英検準2級 単語対策</div>
          </Link>
          <Link href="/guide/eiken-jun1-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">⬆️</div>
            <div className="font-bold text-navy-800 text-sm">英検準1級 単語対策</div>
          </Link>
          <Link href="/guide/eiken-vocabulary-study" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🔁</div>
            <div className="font-bold text-navy-800 text-sm">英検単語の復習方法（全級共通）</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/vocab-check/eiken" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">英検語彙チェック（無料）</div>
          </Link>
          <Link href="/exam-countdown-planner" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🗓️</div>
            <div className="font-bold text-navy-800 text-sm">試験日から逆算する学習計画メーカー</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
