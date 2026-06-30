import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "TOEIC 900点の勉強法【スコアアップ戦略と学習スケジュール】| Loop Vocabulary",
  description: "TOEIC 900点達成のための勉強法を徹底解説。現在のスコア別ロードマップ・パート別攻略・語彙強化・時間管理テクニックまで、実践的な戦略を紹介。",
};

const PARTS = [
  {
    part: "Part 1 写真描写",
    weight: "6問 / 990点",
    color: "from-sky-500 to-sky-600",
    target: "満点",
    strategy: "主語の動作・状態を正確に聞き取る。「A man is…」形式の消去法。900点では落とせないパート。",
    vocab: ["adjacent（隣接する）", "stacked（積み重なった）", "unoccupied（空の）", "pedestrian（歩行者）"],
  },
  {
    part: "Part 2 応答問題",
    weight: "25問 / 990点",
    color: "from-emerald-500 to-emerald-600",
    target: "23/25問",
    strategy: "疑問詞の種類（Who/What/When/Where/Why/How）を瞬時に判断。トリッキーな間接応答に慣れる。",
    vocab: ["regarding（〜について）", "tentative（仮の）", "reschedule（変更する）", "alternatively（あるいは）"],
  },
  {
    part: "Part 3 会話",
    weight: "39問 / 990点",
    color: "from-amber-500 to-amber-600",
    target: "35/39問",
    strategy: "設問を先読みしてから会話を聞く。図表問題は表の数字を事前確認。900点突破の最重要パート。",
    vocab: ["vendor（業者）", "premises（構内）", "merger（合併）", "expedite（早める）"],
  },
  {
    part: "Part 5 短文穴埋め",
    weight: "30問 / 990点",
    color: "from-purple-500 to-purple-600",
    target: "28/30問",
    strategy: "1問20秒ルール。品詞問題（名詞・動詞・形容詞・副詞の4択）は1秒で判断。語彙問題に時間を使う。",
    vocab: ["pursuant（従って）", "stringent（厳格な）", "concise（簡潔な）", "lucrative（儲かる）"],
  },
  {
    part: "Part 7 長文読解",
    weight: "54問 / 990点",
    color: "from-rose-500 to-rose-600",
    target: "48/54問",
    strategy: "設問のキーワードを先に読んでから本文へ。NOT問題は全選択肢を確認。ダブル・トリプルパッセージは情報照合に注意。",
    vocab: ["compensation（報酬）", "subsidiary（子会社）", "liability（責任）", "discrepancy（食い違い）"],
  },
];

const ROADMAP = [
  { from: "〜700点", to: "900点", months: "6〜9ヶ月", daily: "2〜3時間/日", focus: "文法・語彙の基礎固め + 全パート均等強化" },
  { from: "700〜750点", to: "900点", months: "4〜6ヶ月", daily: "1.5〜2時間/日", focus: "Part 3/4/7の精度向上 + 上位語彙7,000語" },
  { from: "750〜830点", to: "900点", months: "2〜4ヶ月", daily: "1〜1.5時間/日", focus: "弱点パートの集中強化 + 速度向上" },
  { from: "830〜870点", to: "900点", months: "1〜2ヶ月", daily: "1時間/日", focus: "ケアレスミス対策 + 時間管理の最適化" },
];

const VOCAB_TIPS = [
  "TOEIC出る単特急「金のフレーズ」を3周する（約600語のコア語彙）",
  "Part 5・6の語彙問題は「同義語」セットで覚える（purchase = buy など）",
  "Loop Vocabularyで毎日20語 × SRS復習で7,000語を8ヶ月で攻略",
  "ビジネスメール・会議・物流・法務の専門用語を優先",
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "TOEIC 900点の勉強法【スコアアップ戦略と学習スケジュール】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/toeic-900ten",
};

export default function Toeic900TenPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="toeic-900ten" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">TOEIC 900点攻略</div>
        <h1 className="text-2xl font-black leading-tight">TOEIC 900点<br />スコアアップ戦略</h1>
        <p className="mt-2 text-sm text-navy-300">パート別攻略・語彙強化・学習ロードマップを完全解説</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">ビジネス英語</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">L&R対応</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">スコア別ロードマップ</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 900点の壁 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">900点突破に必要な3つの条件</h2>
          <div className="space-y-3">
            {[
              { num: "①", title: "語彙力：7,000〜8,000語", desc: "金のフレーズ卒業後も「金のセンテンス」や上位語彙を継続的に強化。" },
              { num: "②", title: "Part 3/4 先読み精度：95%以上", desc: "設問の3問を5秒で先読みし、会話・説明を聞きながら答えを選ぶスキル。" },
              { num: "③", title: "Part 7 速読：1分間300語", desc: "長文を読む速度を上げないと時間切れになる。ビジネス文書の速読訓練が必須。" },
            ].map((c) => (
              <div key={c.num} className="flex gap-3">
                <div className="bg-navy-800 text-white font-black text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  {c.num}
                </div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{c.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 現在スコア別ロードマップ */}
        <h2 className="font-black text-navy-800 text-lg px-1">現在のスコア別 900点ロードマップ</h2>
        {ROADMAP.map((r) => (
          <div key={r.from} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-navy-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl">{r.from}</div>
              <div className="text-navy-400 text-sm">→</div>
              <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">900点</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center mb-3">
              <div className="bg-navy-50 rounded-xl p-2">
                <div className="text-sm font-black text-navy-700">{r.months}</div>
                <div className="text-[10px] text-navy-500">目安期間</div>
              </div>
              <div className="bg-navy-50 rounded-xl p-2">
                <div className="text-sm font-black text-navy-700">{r.daily}</div>
                <div className="text-[10px] text-navy-500">推奨学習時間</div>
              </div>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">💡 {r.focus}</p>
          </div>
        ))}

        {/* パート別攻略 */}
        <h2 className="font-black text-navy-800 text-lg px-1">パート別 900点攻略ポイント</h2>
        {PARTS.map((p) => (
          <div key={p.part} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${p.color} px-5 py-3 text-white`}>
              <div className="flex items-center justify-between">
                <div className="font-black text-sm">{p.part}</div>
                <div className="text-xs opacity-80">{p.weight}</div>
              </div>
              <div className="text-xs mt-0.5 opacity-90">目標スコア：{p.target}</div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-navy-600 leading-relaxed">{p.strategy}</p>
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-1.5">このパートで使う高頻度語彙</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.vocab.map((w) => (
                    <span key={w} className="text-xs bg-navy-50 text-navy-700 px-2 py-1 rounded-full">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 語彙強化 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-3">900点を目指す語彙強化のポイント</h2>
          <ul className="space-y-2">
            {VOCAB_TIPS.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-navy-600">
                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* アフィリエイト */}
        <AmazonBookSection
          heading="📚 TOEIC 900点向け教材（Amazon）"
          books={[
            { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "900点到達の最重要単語帳" },
            { title: "TOEIC L&Rテスト 出る単特急 金のセンテンス", author: "TEX加藤", asin: "4023316075", price: "¥990", label: "例文で900点レベルの語彙を強化" },
            { title: "公式TOEIC Listening & Reading 問題集10", author: "ETS", asin: "4906033989", price: "¥3,300", label: "公式の本番同等模試2セット" },
            { title: "TOEIC L&R TEST 900点 特訓プログラム", author: "ヒロ前田", asin: "4023315931", price: "¥1,980", label: "900点突破者の実践的攻略本" },
          ]}
        />

        <GuideEmailCapture slug="toeic-900ten" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">TOEICスコアアップは語彙力から</div>
          <p className="text-sm text-navy-300 mb-4">Loop Vocabularyで毎日20語。忘却曲線で7,000語を確実に習得。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check/toeic" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">TOEIC語彙チェック</Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/toeic-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎯</div>
            <div className="font-bold text-navy-800 text-sm">TOEIC頻出単語ガイド</div>
          </Link>
          <Link href="/guide/business-english-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">💼</div>
            <div className="font-bold text-navy-800 text-sm">ビジネス英語単語300選</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/guide" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📚</div>
            <div className="font-bold text-navy-800 text-sm">学習ガイド一覧</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
