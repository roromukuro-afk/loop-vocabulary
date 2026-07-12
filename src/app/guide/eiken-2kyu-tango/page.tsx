import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { ExamInfoDisclaimer } from "@/components/guide/ExamInfoDisclaimer";

export const metadata: Metadata = {
  title: "英検2級 単語対策【頻出1,500語カテゴリ別解説】| Loop Vocabulary",
  description: "英検2級合格に必要な必須単語1,500語をテーマ別に解説。社会・環境・医療・テクノロジーの頻出語彙と8週間合格プランを掲載。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-2kyu-tango" },
};

const CATEGORIES = [
  {
    icon: "🌍",
    title: "環境・自然",
    count: "約200語",
    bg: "bg-emerald-50 border-emerald-100",
    color: "text-emerald-700",
    examples: ["environment（環境）", "pollution（汚染）", "renewable（再生可能な）", "endangered（絶滅危惧の）", "sustainable（持続可能な）", "ecosystem（生態系）"],
    tip: "英検2級ではリーフレットや記事でよく出るテーマ。「prevent/reduce/protect」などの動詞もセットで。",
  },
  {
    icon: "🏥",
    title: "医療・健康",
    count: "約180語",
    bg: "bg-red-50 border-red-100",
    color: "text-red-700",
    examples: ["symptom（症状）", "treatment（治療）", "diagnosis（診断）", "infectious（感染性の）", "prevention（予防）", "nutrition（栄養）"],
    tip: "医療系の英文はライティングでも頻出。「suffer from / recover from / consult a doctor」のコロケーションを押さえよう。",
  },
  {
    icon: "💼",
    title: "社会・ビジネス",
    count: "約250語",
    bg: "bg-blue-50 border-blue-100",
    color: "text-blue-700",
    examples: ["economy（経済）", "legislation（法律）", "poverty（貧困）", "discrimination（差別）", "global（世界的な）", "statistics（統計）"],
    tip: "時事問題に関連した語彙が多い。英字新聞の見出しを週1〜2本読む習慣をつけると効率的。",
  },
  {
    icon: "🔬",
    title: "科学・テクノロジー",
    count: "約170語",
    bg: "bg-purple-50 border-purple-100",
    color: "text-purple-700",
    examples: ["artificial（人工の）", "innovation（革新）", "experiment（実験）", "efficient（効率的な）", "automated（自動化された）", "algorithm（アルゴリズム）"],
    tip: "AIやロボット・宇宙開発などが頻出テーマ。接頭辞「auto-（自動）」「bio-（生命）」「cyber-（サイバー）」を意識して覚えると語彙が広がる。",
  },
  {
    icon: "🎓",
    title: "教育・社会問題",
    count: "約150語",
    bg: "bg-amber-50 border-amber-100",
    color: "text-amber-700",
    examples: ["curriculum（カリキュラム）", "scholarship（奨学金）", "diversity（多様性）", "inequality（不平等）", "compulsory（義務的な）", "literacy（識字能力）"],
    tip: "英検ライティングの「意見論述問題」でも頻繁に使う語彙群。自分の意見を英語で述べる練習と合わせて覚えると記憶に残りやすい。",
  },
];

const STUDY_PLAN = [
  { week: "1〜2週目", goal: "基礎語彙の総点検", content: "中学〜高1レベルの語彙（約1,000語）を復習。アプリで苦手単語をマーク" },
  { week: "3〜4週目", goal: "テーマ別語彙を習得", content: "環境・医療・社会の頻出語彙300語をSRSで学習。1日30語ペース" },
  { week: "5〜6週目", goal: "語彙問題の演習", content: "過去問の語彙問題（大問1）を毎日10問。わからない語は即アプリ登録" },
  { week: "7週目", goal: "ライティング語彙の強化", content: "意見論述（80〜100字）で使える語彙を20個集中暗記" },
  { week: "8週目", goal: "総仕上げ", content: "弱点単語の最終確認。本番形式の模擬テストで時間配分を練習" },
];

const TACTICS = [
  { icon: "🎯", title: "大問1（語彙）は文脈から推測する", desc: "4択の語彙問題は選択肢を見る前に空欄前後の文脈を読む。文法と文脈から選択肢を2つに絞れることが多い。" },
  { icon: "✍️", title: "ライティングでは知っている語を使う", desc: "難しい単語を無理に使おうとしてスペルミスをするより、確実に使える単語で書く方が減点が少ない。" },
  { icon: "📖", title: "長文（大問3・4）で語彙を文脈推測", desc: "2級の長文で知らない単語が出ても前後の文脈から意味を推測できる。この力を本番前に意識して練習しておく。" },
  { icon: "🔄", title: "派生語をまとめて覚える", desc: "「innovate（動詞）→ innovation（名詞）→ innovative（形容詞）→ innovatively（副詞）」のように品詞変化を一括で覚えると語彙数が4倍に増える。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英検2級 単語対策【頻出1,500語カテゴリ別解説】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eiken-2kyu-tango",
};

const FAQ_ITEMS = [
  {
    q: "英検2級の単語は何語くらい覚えれば合格できますか？",
    a: "必要語彙数の目安は約1,500〜3,600語程度とされます。ただし語彙数だけでなく、長文読解・リスニングで実際に使える語彙になっているかどうかも重要です。",
  },
  {
    q: "準2級の単語を復習してから2級を始めるべきですか？",
    a: "準2級の語彙が曖昧なまま2級の学習を始めると、長文で知らない単語につまずきやすくなります。準2級レベルの単語で自信のないものは、2級対策と並行して復習しておくと土台が安定します。",
  },
  {
    q: "2級の単語対策で、社会・環境・医療などのテーマ別語彙はどう覚えればいいですか？",
    a: "テーマごとにまとめて覚えると、関連する単語同士のつながりで記憶に残りやすくなります。1つのテーマを浅く広く触れるより、忘れかけたタイミングでそのテーマの単語群をまとめて復習する方が定着しやすいです。",
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
      <GuideTracker slug="eiken-2kyu-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英検2級 単語対策【頻出1,500語カテゴリ別解説】","item":"https://loop-vocabulary.app/guide/eiken-2kyu-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">英検対策ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英検2級 単語対策</h1>
        <p className="mt-2 text-sm text-navy-300">頻出1,500語をテーマ別にマスターして合格へ</p>
        <div className="mt-4 inline-block bg-white/10 rounded-xl px-4 py-2 text-sm">
          難易度：高校卒業レベル / 目安語彙数：1,500〜2,500語
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 英検2級の語彙問題（大問1）は25問と配点比率が高く、1,500〜2,500語程度をテーマ別（社会・環境・医療・テクノロジー等）に学習するのが効果的です。
          </p>
        </div>

        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">英検2級の語彙レベル</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">高校卒業レベルの語彙力、目安1,500〜2,500語が必要です。</p>
          <p className="text-sm text-navy-600 leading-relaxed">
            英検2級は高校卒業レベルの英語力が目安。語彙問題（大問1）は25問で、全体スコアへの影響が最も大きいパートです。単語は<strong>1,500〜2,500語</strong>程度が必要で、社会・環境・医療・テクノロジーなどのテーマに沿ったカテゴリ別学習が最も効果的です。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">1,500語</div>
              <div className="text-[10px] text-navy-500">必須語彙数</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-lg font-black text-emerald-700">約65%</div>
              <div className="text-[10px] text-emerald-600">合格ラインの目安（過去傾向）</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="text-lg font-black text-amber-700">4〜6ヶ月</div>
              <div className="text-[10px] text-amber-600">学習期間目安</div>
            </div>
          </div>
          <div className="mt-4">
            <ExamInfoDisclaimer kind="eiken" showCseNote />
          </div>
        </div>

        {/* カテゴリ別 */}
        <h2 className="font-black text-navy-800 text-lg px-1">テーマ別 頻出単語</h2>
        {CATEGORIES.map((c) => (
          <div key={c.title} className={`bg-white rounded-2xl border overflow-hidden ${c.bg}`}>
            <div className={`flex items-center justify-between px-5 py-3 border-b ${c.bg}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.icon}</span>
                <span className={`font-black text-base ${c.color}`}>{c.title}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.color} bg-white/60`}>{c.count}</span>
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

        {/* 8週間プラン */}
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-5 py-4 text-white">
            <h2 className="font-black">8週間合格プラン</h2>
            <p className="text-xs text-navy-300 mt-0.5">1日20〜30分の学習で英検2級合格レベルへ</p>
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

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">英検2級の語彙力をSRSで定着</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線で自動復習。弱点単語を集中学習して合格へ。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">英検語彙チェック</Link>
          </div>
        </div>

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
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/vocab-check/eiken" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">英検語彙チェック（無料）</div>
          </Link>
        </div>

        <GuideMaterialCTA
          heading="英検2級の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000022", title: "英検2級 重要単語" },
          ]}
        />
      </div>
    </div>
  );
}
