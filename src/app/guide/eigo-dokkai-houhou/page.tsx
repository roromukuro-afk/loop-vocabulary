import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英語長文読解の勉強法【大学受験・英検・TOEIC対応】| Loop Vocabulary",
  description: "英語長文読解を速く正確に解く方法を解説。パラグラフリーディング・精読と速読の使い分け・語彙力強化まで。大学受験・英検2級〜1級・TOEICのPart7対策にも対応。",
};

const SKILLS = [
  {
    title: "語彙力（最重要）",
    icon: "📚",
    weight: "40%",
    color: "bg-red-500",
    desc: "知らない単語が文中に3〜4語以上あると、読解スピードと正確性が急落します。目標レベルの語彙を事前に習得することが最も効果的な長文対策です。",
    action: "毎日20語をLoop VocabularyでSRS学習。読んでいて知らない単語はその場で登録。",
  },
  {
    title: "文構造把握（精読力）",
    icon: "🔍",
    weight: "25%",
    color: "bg-amber-500",
    desc: "長い一文を正確に読む力。主語・動詞・目的語の骨格を見抜き、修飾語句（関係詞・分詞・副詞節）を正確に解釈する。",
    action: "1日1文の精読を習慣に。難しい文は構造分析してノートに書く。",
  },
  {
    title: "論理構造把握（パラグラフ読み）",
    icon: "🗺️",
    weight: "25%",
    color: "bg-emerald-500",
    desc: "各パラグラフのトピックセンテンス（最初の1文）を拾いながら全体の流れを把握する「マクロ読み」。長文全体の論点が見えると設問に素早く対応できる。",
    action: "本文を読む前に設問を確認→パラグラフごとにメモを書く練習。",
  },
  {
    title: "速読力（処理速度）",
    icon: "⚡",
    weight: "10%",
    color: "bg-sky-500",
    desc: "精読力と語彙が定着した後で伸ばすもの。語彙・文法が弱いまま速読練習しても意味がない。1分間に200語→300語と段階的に上げる。",
    action: "タイマーで計測しながら読む練習。理解率80%以上を維持しながら速度を上げる。",
  },
];

const EXAM_GUIDE = [
  {
    exam: "大学受験（共通テスト）",
    badge: "bg-sky-100 text-sky-700",
    wordTarget: "4,000語",
    strategy: "設問を先読みして「何を探すか」を決めてから本文へ。グラフ・表と本文の照合問題に注意。時間管理が最重要（目安1問2分）。",
    weakness: "最後のパッセージで時間切れになる受験生が多い。前から順番に解かず、解きやすい問題から着手する。",
  },
  {
    exam: "英検2級〜準1級",
    badge: "bg-emerald-100 text-emerald-700",
    wordTarget: "5,000〜7,000語",
    strategy: "内容一致問題（4択）は本文の言い換えを見抜くのが鍵。synonyms（同義語）を知っていると格段に速く解ける。",
    weakness: "文章が長く難しいと感じる人は語彙不足が原因。語彙を補充するだけで読解力が上がることが多い。",
  },
  {
    exam: "TOEIC Part 7",
    badge: "bg-amber-100 text-amber-700",
    wordTarget: "7,000語",
    strategy: "54問を54分で解く必要がある。設問に書かれたキーワードを本文で探すスキャニングが必須。ダブル・トリプルパッセージは複数文書の情報照合に注意。",
    weakness: "時間切れが最大の敵。前半を速く解いて後半（難しい）に時間を残す配分を練習する。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英語長文読解の勉強法【大学受験・英検・TOEIC対応】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eigo-dokkai-houhou",
};

export default function EigoDokkaipHouhouPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eigo-dokkai-houhou" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">読解ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英語長文読解<br />完全攻略ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">大学受験・英検・TOEIC Part7 対応</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">大学受験</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">英検2級〜1級</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">TOEIC Part7</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">長文が読めない本当の原因</h2>
          <p className="text-sm text-navy-600 leading-relaxed mb-3">
            「長文が苦手」と感じる原因のほとんどは<strong>語彙不足（60〜70%）</strong>です。知らない単語が多いと文の意味が取れず、どんな読み方のテクニックも機能しません。まず語彙を固め、それから読解テクニックを学ぶ順序が重要です。
          </p>
          <div className="bg-navy-50 rounded-xl p-4">
            <div className="text-xs font-bold text-navy-700 mb-2">長文読解力の構成要素</div>
            {SKILLS.map((s) => (
              <div key={s.title} className="flex items-center gap-2 mb-1.5">
                <div className={`${s.color} rounded-full h-2`} style={{ width: s.weight === "40%" ? "40%" : s.weight === "25%" ? "25%" : s.weight === "10%" ? "10%" : "25%" }} />
                <span className="text-xs text-navy-600 whitespace-nowrap">{s.title} {s.weight}</span>
              </div>
            ))}
          </div>
        </div>

        <h2 className="font-black text-navy-800 text-lg px-1">読解力を構成する4つのスキル</h2>
        {SKILLS.map((s) => (
          <div key={s.title} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="font-black text-navy-800 text-sm">{s.title}</div>
                <div className="text-xs text-navy-500">読解力への貢献：{s.weight}</div>
              </div>
            </div>
            <p className="text-sm text-navy-600 leading-relaxed mb-2">{s.desc}</p>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-xs text-sky-700 font-semibold">→ 実践法：{s.action}</p>
            </div>
          </div>
        ))}

        <h2 className="font-black text-navy-800 text-lg px-1">試験別 長文読解攻略法</h2>
        {EXAM_GUIDE.map((e) => (
          <div key={e.exam} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${e.badge}`}>{e.exam}</span>
              <span className="text-xs text-navy-500">目標語彙：{e.wordTarget}</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-1">攻略ポイント</div>
                <p className="text-xs text-navy-600 leading-relaxed">{e.strategy}</p>
              </div>
              <div className="border-t border-navy-50 pt-3">
                <div className="text-[11px] font-bold text-red-600 mb-1">よくある失敗</div>
                <p className="text-xs text-navy-600 leading-relaxed">{e.weakness}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl border border-sky-100 p-5">
          <h2 className="font-black text-navy-800 mb-2">語彙強化が長文読解の最短ルート</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            長文で知らない単語に出会ったらその場でLoop Vocabularyに登録。忘却曲線で自動復習されるので、同じ単語を長文で見かけたときに即座に意味が浮かぶようになります。読解練習と語彙強化を並行することで、どちらの力も加速度的に伸びます。
          </p>
        </div>

        <AmazonBookSection
          heading="📚 英語長文読解おすすめ教材（Amazon）"
          books={[
            { title: "英語長文ハイパートレーニング レベル2", author: "安河内哲也", asin: "4342764865", price: "¥990", label: "センター〜共通テストレベル" },
            { title: "やっておきたい英語長文500", author: "富田一彦", asin: "4777208516", price: "¥990", label: "大学受験標準〜難関" },
            { title: "英語長文読解の王道", author: "薬袋善郎", asin: "4342766892", price: "¥1,650", label: "精読・構文解析の教科書" },
            { title: "TOEICテスト リーディング 特急", author: "神崎正哉", asin: "4023314137", price: "¥990", label: "TOEIC Part 7 速読訓練" },
          ]}
        />

        <GuideEmailCapture slug="eigo-dokkai-houhou" />

        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">長文で出た単語をその場で登録</div>
          <p className="text-sm text-navy-300 mb-4">読解しながら語彙を強化。忘却曲線で自動復習。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/koukou-eigo-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎓</div>
            <div className="font-bold text-navy-800 text-sm">高校英語 単語対策</div>
          </Link>
          <Link href="/guide/toeic-900ten" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎯</div>
            <div className="font-bold text-navy-800 text-sm">TOEIC 900点攻略</div>
          </Link>
          <Link href="/guide/eibunpo-kiso" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📐</div>
            <div className="font-bold text-navy-800 text-sm">英文法 基礎ガイド</div>
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
