import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

export const metadata: Metadata = {
  title: "高校英語の単語を完全に覚える方法【大学受験対応・2,000語攻略】| Loop Vocabulary",
  description: "高校英語で必要な単語2,000〜4,000語の効率的な覚え方を解説。センター試験・共通テスト・大学別対策まで、科学的な記憶術（SRS・忘却曲線）で最短合格を目指す方法。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/koukou-eigo-tango" },
};

const LEVELS = [
  {
    title: "高1〜高2 基礎固め",
    range: "1,500〜2,000語",
    color: "from-sky-500 to-sky-600",
    badge: "bg-sky-100 text-sky-700",
    target: "共通テスト60〜70点台・英検2級",
    words: ["achieve（達成する）", "influence（影響する）", "maintain（維持する）", "recognize（認識する）", "solution（解決策）"],
    strategy: "教科書の単語を完璧に → 英単語ターゲット1400 → 共通テスト過去問で頻度確認",
  },
  {
    title: "高3 難関私大・GMARCH",
    range: "3,000〜4,000語",
    color: "from-emerald-500 to-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    target: "共通テスト80点台・英検準1級",
    words: ["ambiguous（曖昧な）", "consecutive（連続した）", "inevitable（避けられない）", "scrutiny（精査）", "prevalent（普及した）"],
    strategy: "ターゲット1900 or 鉄壁 → 長文で語彙の文脈理解 → リスニングで定着確認",
  },
  {
    title: "最難関大（東京大・京都大・慶応義塾大など）",
    range: "5,000語以上",
    color: "from-purple-500 to-purple-600",
    badge: "bg-purple-100 text-purple-700",
    target: "英検1級レベルの語彙力",
    words: ["elusive（捉えにくい）", "pragmatic（実用的な）", "rhetoric（修辞）", "sovereignty（主権）", "juxtapose（並置する）"],
    strategy: "語源学習（接頭辞・接尾辞）→ 多読・英字新聞 → 派生語（名詞・動詞・形容詞）をセット記憶",
  },
];

const METHODS = [
  {
    icon: "📊",
    title: "SRS（間隔反復）で忘却を防ぐ",
    desc: "覚えた単語を忘れる前に復習する「忘却曲線」を活用。1日目・3日目・7日目・14日目・30日目に復習するだけで、長期記憶に定着。Loop Vocabularyで自動管理できる。",
  },
  {
    icon: "📖",
    title: "例文ごと覚える（文脈記憶）",
    desc: "単語単体ではなく例文・コロケーション（よく使われる組み合わせ）とセットで覚えると想起速度が3倍速くなる。「make a significant contribution」のようにかたまりで暗記。",
  },
  {
    icon: "🔤",
    title: "語源（接頭辞・語根）を学ぶ",
    desc: "「re-」（再び）「un-」（否定）「-tion」（名詞化）などを覚えると、知らない単語でも意味が推測できる。1つの語根から10〜20語を芋づる式に覚えられる。",
  },
  {
    icon: "🎧",
    title: "音声付きで聴覚記憶を使う",
    desc: "視覚（スペル）だけでなく聴覚（音声）でも記憶することで、脳の別の部位に情報が保存され忘れにくくなる。リスニング対策にも直結。",
  },
];

const SCHEDULE = [
  { week: "1〜2週目", task: "1日20語 × 毎日復習で400語", focus: "基礎動詞・形容詞を完璧に" },
  { week: "3〜6週目", task: "1日20語追加 + SRS復習", focus: "コロケーション・例文記憶" },
  { week: "7〜10週目", task: "1日15語追加 + 弱点強化", focus: "語源・派生語のまとめ学習" },
  { week: "11〜12週目", task: "単語帳一周仕上げ", focus: "過去問演習 + 確認テスト" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "高校英語の単語を完全に覚える方法【大学受験対応・2,000語攻略】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/koukou-eigo-tango",
};

export default function KoukouEigoTangoPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="koukou-eigo-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"高校英語の単語を完全に覚える方法【大学受験対応・2,000語攻略】","item":"https://loop-vocabulary.app/guide/koukou-eigo-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">高校英語ガイド</div>
        <h1 className="text-2xl font-black leading-tight">高校英語 単語の<br />完全攻略ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">大学受験〜共通テストに必要な2,000〜5,000語の覚え方</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">大学受験</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">共通テスト対応</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">SRS学習法</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">高校英語の語彙はどれだけ必要？</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            共通テストでは約3,500〜4,000語、難関私大では5,000語以上の語彙が求められます。高校の教科書だけでは1,500〜2,000語しかカバーできないため、単語帳による計画的な学習が不可欠です。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "教科書の語彙数", val: "1,500語" },
              { label: "共通テスト必要語彙", val: "4,000語" },
              { label: "難関大必要語彙", val: "5,000語+" },
            ].map((s) => (
              <div key={s.label} className="bg-navy-50 rounded-xl p-3">
                <div className="text-sm font-black text-navy-700">{s.val}</div>
                <div className="text-[10px] text-navy-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* レベル別攻略 */}
        <h2 className="font-black text-navy-800 text-lg px-1">志望校レベル別 単語攻略法</h2>
        {LEVELS.map((l) => (
          <div key={l.title} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${l.color} px-5 py-4 text-white`}>
              <div className="font-black text-base">{l.title}</div>
              <div className="text-sm opacity-80 mt-0.5">目標語彙数：{l.range}</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${l.badge}`}>目標</span>
                <span className="text-xs text-navy-600">{l.target}</span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-1.5">このレベルの頻出単語</div>
                <div className="flex flex-wrap gap-2">
                  {l.words.map((w) => (
                    <span key={w} className={`text-xs px-2 py-1 rounded-full font-medium ${l.badge}`}>{w}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-navy-50 pt-3">
                <div className="text-[11px] font-bold text-navy-700 mb-1">学習戦略</div>
                <p className="text-xs text-navy-600 leading-relaxed">📌 {l.strategy}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 学習法 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">科学的に正しい単語の覚え方</h2>
          <div className="space-y-4">
            {METHODS.map((m) => (
              <div key={m.title} className="flex gap-3">
                <span className="text-2xl shrink-0">{m.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{m.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 12週スケジュール */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">12週間で800語を習得するスケジュール</h2>
          <div className="space-y-3">
            {SCHEDULE.map((s) => (
              <div key={s.week} className="flex gap-3 items-start">
                <div className="bg-navy-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                  {s.week}
                </div>
                <div>
                  <div className="text-sm font-semibold text-navy-700">{s.task}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{s.focus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アフィリエイト */}
        <AmazonBookSection
          heading="📚 高校英語おすすめ単語帳（Amazon）"
          books={[
            { title: "英単語ターゲット1900 6訂版", author: "旺文社", asin: "4010773634", price: "¥1,100", label: "大学受験の定番単語帳" },
            { title: "システム英単語 5訂版", author: "霜康司・刀祢雅彦", asin: "4796120289", price: "¥1,100", label: "チャンク暗記で文脈対応" },
            { title: "鉄壁 改訂版", author: "鉄緑会英語科", asin: "4046055561", price: "¥1,980", label: "東大・難関大向け最強単語帳" },
            { title: "英単語Stock4500", author: "文単プロジェクト", asin: "4890853170", price: "¥1,430", label: "語源・イメージで覚える" },
          ]}
        />

        <GuideEmailCapture slug="koukou-eigo-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">単語帳をスマホアプリで管理</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線が自動で最適化。1日5分から始められる受験英単語学習。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">英検レベル確認</Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/daigaku-juken-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎓</div>
            <div className="font-bold text-navy-800 text-sm">大学受験英単語ガイド</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/guide/eiken-2kyu-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📝</div>
            <div className="font-bold text-navy-800 text-sm">英検2級 単語対策</div>
          </Link>
          <Link href="/guide" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📚</div>
            <div className="font-bold text-navy-800 text-sm">学習ガイド一覧</div>
          </Link>
        </div>

        <GuideMaterialCTA
          heading="高校英語の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000040", title: "高校1年英語 重要単語" },
            { id: "00000000-0000-0000-0000-000000000041", title: "高校2年英語 重要単語" },
            { id: "00000000-0000-0000-0000-000000000047", title: "loop受験英単語③【高校基礎】" },
          ]}
        />
      </div>
    </div>
  );
}
