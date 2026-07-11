import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英語の発音練習方法【フォニックス・シャドーイング完全ガイド】| Loop Vocabulary",
  description: "英語の発音を独学で改善する方法を徹底解説。フォニックス・シャドーイング・IPA（国際音声記号）の使い方から、おすすめアプリ・教材まで。日本人が苦手な発音を克服しよう。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eigo-hatsuon-renshu" },
};

const PHONICS = [
  { sound: "/æ/", example: "cat / apple / hat", tip: "日本語の「ア」より口を横に大きく開ける。顎を下げて歯を見せるイメージ。", mistake: "「ア」に近づけすぎて区別がなくなる" },
  { sound: "/θ/ /ð/", example: "think / this / three", tip: "舌先を上の歯の裏に当て、息を漏らす。「ス」「ズ」と混同しないよう意識。", mistake: "「ス」「ズ」で代替してしまう" },
  { sound: "/r/ vs /l/", example: "right / light / red / led", tip: "/r/ は舌を巻いて宙に浮かす。/l/ は舌先を上の歯茎に当てる。", mistake: "同じ音に聞こえてしまう" },
  { sound: "/v/ vs /b/", example: "very / berry / vine / bine", tip: "/v/ は上の歯を下唇に当てて摩擦音を出す。/b/ は両唇を閉じて破裂させる。", mistake: "両方「バ行」になってしまう" },
];

const STEPS = [
  {
    step: "STEP 1",
    title: "IPAで音を把握する（1〜2週）",
    icon: "📖",
    color: "from-sky-500 to-sky-600",
    desc: "国際音声記号（IPA）の母音16音・子音24音を覚える。辞書の発音記号が読めるようになると、知らない単語でも正確に発音できる。",
    tips: ["Cambridge辞典（音声付き）で1日10音ずつ確認", "YouTubeの「English Pronunciation」チャンネルを活用", "ノートに音とカタカナの違いをメモ"],
  },
  {
    step: "STEP 2",
    title: "シャドーイングを毎日10分（3〜8週）",
    icon: "🎧",
    color: "from-emerald-500 to-emerald-600",
    desc: "ネイティブ音声を聞きながら0.5〜1秒遅れで追いかけて発音する。リエゾン・弱形・イントネーションが身につく最速の方法。",
    tips: ["ニュース英語（BBC / VOA）で速度70〜80%から始める", "同じ素材を5日間繰り返す（完璧になってから次へ）", "スマホで録音して自分の発音と比較"],
  },
  {
    step: "STEP 3",
    title: "単語をIPAと音声セットで暗記（継続）",
    icon: "🔊",
    color: "from-amber-500 to-amber-600",
    desc: "新しい単語を覚えるとき、スペル→意味だけでなく「音」もセットで記憶する。Loop Vocabularyで音声付き単語帳を作ると効率が上がる。",
    tips: ["単語登録時に必ず音声再生して確認", "発音が難しい単語はメモ欄にIPAを記入", "週1回シャドーイング録音と比較"],
  },
  {
    step: "STEP 4",
    title: "スピーキングで実践（2ヶ月目〜）",
    icon: "🗣️",
    color: "from-purple-500 to-purple-600",
    desc: "発音練習はインプットだけでは定着しない。オンライン英会話・AIスピーキングツールで実際に声に出す機会を毎日作る。",
    tips: ["Camblyや italki で週2〜3回ネイティブと会話", "AI会話ツール（Speak / ELSA）で発音スコアを計測", "同じ文を5回音読してから会話に使う"],
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英語の発音練習方法【フォニックス・シャドーイング完全ガイド】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eigo-hatsuon-renshu",
};

export default function EigoHatsuonRenshuPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eigo-hatsuon-renshu" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英語の発音練習方法【フォニックス・シャドーイング完全ガイド】","item":"https://loop-vocabulary.app/guide/eigo-hatsuon-renshu"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">発音練習ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英語の発音練習<br />完全攻略ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">フォニックス・シャドーイング・IPA活用法</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">独学OK</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">スマホ完結</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">初心者〜上級者</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">なぜ発音練習が大切なのか？</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英語の発音が正確になると、リスニング力も同時に上がります。自分が発音できない音は聞き取れないからです。日本人が苦手な「/r/ vs /l/」「/θ/ /ð/」「/v/ vs /b/」をひとつずつ攻略することで、英語全体の理解度が飛躍的に向上します。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "日本人が苦手な音", val: "8種+" },
              { label: "習得目安期間", val: "2〜3ヶ月" },
              { label: "1日の練習時間", val: "10〜15分" },
            ].map((s) => (
              <div key={s.label} className="bg-navy-50 rounded-xl p-3">
                <div className="text-base font-black text-navy-700">{s.val}</div>
                <div className="text-[10px] text-navy-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 苦手な発音 */}
        <h2 className="font-black text-navy-800 text-lg px-1">日本人が特に苦手な発音</h2>
        {PHONICS.map((p) => (
          <div key={p.sound} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-start gap-3">
              <div className="bg-navy-800 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-xl shrink-0">
                {p.sound}
              </div>
              <div className="flex-1">
                <div className="text-xs text-sky-600 font-semibold mb-1">{p.example}</div>
                <p className="text-sm text-navy-600 leading-relaxed">{p.tip}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-red-500">よくある間違い：</span>
                  <span className="text-xs text-navy-500">{p.mistake}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 4ステップ */}
        <h2 className="font-black text-navy-800 text-lg px-1">発音を改善する4ステップ</h2>
        {STEPS.map((s) => (
          <div key={s.step} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${s.color} px-5 py-4 text-white`}>
              <div className="text-xs font-bold opacity-80">{s.step}</div>
              <div className="font-black text-base mt-0.5">{s.icon} {s.title}</div>
            </div>
            <div className="p-5">
              <p className="text-sm text-navy-600 leading-relaxed mb-3">{s.desc}</p>
              <ul className="space-y-1.5">
                {s.tips.map((t) => (
                  <li key={t} className="text-xs text-navy-600 flex gap-2">
                    <span className="text-emerald-500 font-bold shrink-0">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        {/* シャドーイング × 単語学習の相乗効果 */}
        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl border border-sky-100 p-5">
          <h2 className="font-black text-navy-800 mb-2">シャドーイング × 単語学習の相乗効果</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            発音を正確に覚えると、<strong>単語の記憶定着率も2〜3倍</strong>に上がります。音と意味をセットで脳に刻むことで、リスニングでも即座に意味が浮かぶようになります。Loop Vocabularyでは辞書で調べた単語をそのまま音声付き単語帳に登録でき、シャドーイング素材としても活用できます。
          </p>
        </div>

        {/* アフィリエイト */}
        <AmazonBookSection
          heading="📚 発音練習おすすめ教材（Amazon）"
          books={[
            { title: "英語耳 改訂・新CD版", author: "松澤喜好", asin: "4756919650", price: "¥1,760", label: "発音独学の定番書" },
            { title: "英語の発音が正しくなる本", author: "熊谷恵子", asin: "4413036573", price: "¥1,430", label: "口の動きを写真で解説" },
            { title: "フォニックス英語リーディング", author: "竹村和浩", asin: "4791967305", price: "¥1,760", label: "フォニックス基礎から" },
            { title: "シャドーイング・音読で学ぶ英語", author: "門田修平", asin: "4342765926", price: "¥2,530", label: "シャドーイング理論と実践" },
          ]}
        />

        <GuideEmailCapture slug="eigo-hatsuon-renshu" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">発音と同時に語彙力も強化</div>
          <p className="text-sm text-navy-300 mb-4">音声付き単語帳で「音」と「意味」をセット記憶。忘却曲線で自動復習。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/shadowing" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">シャドーイング機能</Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/guide/eiken-conversation" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">💬</div>
            <div className="font-bold text-navy-800 text-sm">英会話に効く単語術</div>
          </Link>
          <Link href="/guide" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📚</div>
            <div className="font-bold text-navy-800 text-sm">学習ガイド一覧</div>
          </Link>
          <Link href="/vocab-check" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">語彙力チェック（無料）</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
