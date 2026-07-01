import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英文法 基礎の覚え方【中学〜高校・大学受験 完全ガイド】| Loop Vocabulary",
  description: "英文法の基礎を効率的に学ぶ方法を解説。中学英文法から高校英文法・大学受験まで、つまずきやすいポイントと覚え方を徹底解説。英検・TOEIC文法対策にも対応。",
};

const GRAMMAR_POINTS = [
  {
    title: "時制（現在・過去・未来・完了形）",
    level: "中学〜高校",
    badge: "bg-sky-100 text-sky-700",
    key: "現在完了（have + 過去分詞）は「過去のことが今に影響している」状態。「I lost my key（過去）」vs「I have lost my key（今も見つかっていない）」の違いを理解する。",
    tip: "日本語にない概念なので「今との繋がり」を意識することが最重要。",
  },
  {
    title: "仮定法（if節の時制ずらし）",
    level: "高校〜大学受験",
    badge: "bg-emerald-100 text-emerald-700",
    key: "仮定法過去：現在の事実に反することを「if + 過去形、would + 原形」で表す。「If I were you（実際は私だが）、I would study harder」",
    tip: "「were」は主語が何でも使う（be動詞の特殊形）。大学受験・英検準1級で必出。",
  },
  {
    title: "関係代名詞（who/which/that）",
    level: "中学〜高校",
    badge: "bg-amber-100 text-amber-700",
    key: "名詞を後ろから説明するための接着剤。「The man who called me（私に電話した男性）」＝ who 以下が The man を修飾する。",
    tip: "まず「修飾される名詞」と「修飾する文」を分けて考えると理解しやすい。",
  },
  {
    title: "不定詞 vs 動名詞（to vs -ing）",
    level: "中学〜高校",
    badge: "bg-purple-100 text-purple-700",
    key: "動詞によって後ろに来るのが不定詞か動名詞か決まる。want/wish/hope → to不定詞。enjoy/finish/avoid → 動名詞(-ing)。remember/forget → 意味が変わる。",
    tip: "「未来志向の動詞はto、過去・現在志向の動詞は-ing」という大まかな法則がある。",
  },
  {
    title: "受動態（be + 過去分詞）",
    level: "中学",
    badge: "bg-rose-100 text-rose-700",
    key: "「〜される・された」という意味。能動態「Tom built the house」→ 受動態「The house was built by Tom」。by以下は省略できる。",
    tip: "TOEICではby以下がない受動態が多く出る。「be動詞 + 過去分詞」の形を瞬時に見抜く練習を。",
  },
];

const STEPS = [
  {
    step: "STEP 1",
    title: "中学英文法を完璧にする（4〜6週間）",
    color: "from-sky-500 to-sky-600",
    desc: "高校英文法・大学受験文法・英検・TOEICのすべての基盤は中学文法です。be動詞・一般動詞・時制・助動詞・疑問文・否定文・接続詞・関係代名詞を完璧にしてから次へ進む。",
    books: ["中学英語をもう一度ひとつひとつわかりやすく（学研）", "くもんの中学英文法"],
  },
  {
    step: "STEP 2",
    title: "高校英文法の頻出事項を覚える（6〜8週間）",
    color: "from-emerald-500 to-emerald-600",
    desc: "仮定法・分詞構文・完了時制・関係詞の全パターン・語法（動詞の後に来るもの）を集中的に学習。問題集で演習しながら定着させる。",
    books: ["Vintage（いいずな書店）", "Forest / Evergreen（瀬戸達郎）"],
  },
  {
    step: "STEP 3",
    title: "文法と語彙を同時に強化する（継続）",
    color: "from-purple-500 to-purple-600",
    desc: "文法知識は語彙と一体化したときに本当に使えるようになる。Loop Vocabularyで例文ごと単語を覚えることで、文法構造を自然に吸収できる。",
    books: ["英文法・語法ランダム演習（駿台）", "Next Stage（桐原書店）"],
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英文法 基礎の覚え方【中学〜高校・大学受験 完全ガイド】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eibunpo-kiso",
};

export default function EibunpoKisoPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eibunpo-kiso" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英文法 基礎の覚え方【中学〜高校・大学受験 完全ガイド】","item":"https://loop-vocabulary.app/guide/eibunpo-kiso"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">英文法ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英文法 基礎の<br />完全攻略ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">中学〜大学受験・英検・TOEICに対応</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">中学英語</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">大学受験</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">英検・TOEIC</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">英文法は「暗記」ではなく「理解」</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英文法が苦手な人の多くは「ルールを丸暗記しようとしている」という共通点があります。英文法は英語のロジック（考え方）を理解することが重要で、ルールの理由が分かると一気に整理されます。語彙と文法は車の両輪。どちらが欠けても英語力は上がりません。
          </p>
        </div>

        <h2 className="font-black text-navy-800 text-lg px-1">つまずきやすい5大文法ポイント</h2>
        {GRAMMAR_POINTS.map((g) => (
          <div key={g.title} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${g.badge}`}>{g.level}</span>
              <h3 className="font-black text-navy-800 text-sm">{g.title}</h3>
            </div>
            <div className="bg-navy-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-navy-700 leading-relaxed">{g.key}</p>
            </div>
            <p className="text-xs text-navy-500 leading-relaxed">💡 {g.tip}</p>
          </div>
        ))}

        <h2 className="font-black text-navy-800 text-lg px-1">英文法マスター 3ステップ</h2>
        {STEPS.map((s) => (
          <div key={s.step} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${s.color} px-5 py-3 text-white`}>
              <div className="text-xs font-bold opacity-80">{s.step}</div>
              <div className="font-black text-base mt-0.5">{s.title}</div>
            </div>
            <div className="p-5">
              <p className="text-sm text-navy-600 leading-relaxed mb-3">{s.desc}</p>
              <div className="text-[11px] font-bold text-navy-700 mb-1.5">おすすめ参考書</div>
              <ul className="space-y-1">
                {s.books.map((b) => (
                  <li key={b} className="text-xs text-navy-600 flex gap-2">
                    <span className="text-emerald-500 font-bold shrink-0">✓</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl border border-sky-100 p-5">
          <h2 className="font-black text-navy-800 mb-2">文法を「使える英語」に変えるには</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            文法ルールを覚えても、例文で使えないと意味がありません。Loop Vocabularyでは単語を登録するとき例文も保存でき、文法パターンを自然に吸収できます。「覚えた単語を使った例文」を音読することで、文法と語彙が同時に定着します。
          </p>
        </div>

        <AmazonBookSection
          heading="📚 英文法おすすめ参考書（Amazon）"
          books={[
            { title: "中学英語をもう一度ひとつひとつわかりやすく", author: "学研プラス", asin: "4053040361", price: "¥1,430", label: "中学文法を基礎から" },
            { title: "大学入試 全レベル問題集 英文法", author: "桐原書店", asin: "4342766884", price: "¥880", label: "大学受験文法の定番" },
            { title: "TOEIC L&R TEST 文法問題でる1000問", author: "TEX加藤", asin: "4906033628", price: "¥2,530", label: "TOEIC文法対策の決定版" },
            { title: "英文法・語法 Vintage", author: "いいずな書店", asin: "4864600082", price: "¥1,430", label: "高校英文法の総仕上げ" },
          ]}
        />

        <GuideEmailCapture slug="eibunpo-kiso" />

        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">文法と語彙を同時に強化</div>
          <p className="text-sm text-navy-300 mb-4">例文付きで単語を登録・SRSで復習。文法パターンが自然に身につく。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">英検レベル確認</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/chugaku-eigo-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📖</div>
            <div className="font-bold text-navy-800 text-sm">中学英語 単語対策</div>
          </Link>
          <Link href="/guide/koukou-eigo-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎓</div>
            <div className="font-bold text-navy-800 text-sm">高校英語 単語対策</div>
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
      </div>
    </div>
  );
}
