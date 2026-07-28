import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { ExamInfoDisclaimer } from "@/components/guide/ExamInfoDisclaimer";

export const metadata: Metadata = {
  title: "英検1級 単語対策【合格に必要な15,000語レベルの学習戦略】| Loop Vocabulary",
  description: "英検1級合格に必要な語彙数・頻出カテゴリ・学習戦略を徹底解説。準1級との差と15,000語レベルへの到達ルートを紹介します。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-1kyu-tango" },
  openGraph: {
    title: "英検1級 単語対策【15,000語レベルへの学習戦略】",
    description: "英検1級合格に必要な語彙数・頻出カテゴリ・学習戦略を徹底解説。",
    url: "https://loop-vocabulary.app/guide/eiken-1kyu-tango",
    type: "article",
  },
};

const BOOKS = [
  { title: "英検1級 でる順パス単 5訂版", author: "旺文社", asin: "4010947519", price: "¥1,210", label: "1級語彙対策の必携書" },
  { title: "英検1級 過去6回全問題集", author: "旺文社", asin: "4010947586", price: "¥1,650", label: "本番形式で仕上げ" },
  { title: "英検1級 二次試験・面接 完全予想問題", author: "旺文社", asin: "4010947713", price: "¥1,650", label: "二次試験スピーキング対策" },
  { title: "英単語の語源図鑑", author: "清水建二・すずきひろし", asin: "4046021969", price: "¥1,650", label: "語根で一気に語彙爆増" },
];

const CATEGORIES = [
  {
    icon: "🧬",
    title: "科学・テクノロジー",
    bg: "bg-sky-50 border-sky-100",
    badge: "bg-sky-100 text-sky-700",
    words: ["nanotechnology", "photosynthesis", "genome", "neuroplasticity", "cryonics"],
    tip: "ライティングエッセイでも頻出。Scientific American などでアカデミック語彙を実地で確認。",
  },
  {
    icon: "⚖️",
    title: "法律・倫理",
    bg: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    words: ["jurisprudence", "jurisdiction", "culpable", "statute", "punitive"],
    tip: "1級の長文では国際法・倫理問題が頻出。語根「jur/jus=law」「pun=punish」を押さえると効果的。",
  },
  {
    icon: "🏛️",
    title: "政治・国際関係",
    bg: "bg-violet-50 border-violet-100",
    badge: "bg-violet-100 text-violet-700",
    words: ["hegemony", "geopolitics", "multilateralism", "sovereignty", "realpolitik"],
    tip: "二次試験のスピーチトピックに直結。論説文での使い方（「exercise hegemony」等）をセットで覚えよう。",
  },
  {
    icon: "💰",
    title: "経済・社会",
    bg: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    words: ["oligopoly", "remittance", "austerity", "divestiture", "plutocracy"],
    tip: "The Economist の記事を週1本読むとこのレベルの語彙に自然と触れられる。",
  },
  {
    icon: "🧠",
    title: "哲学・心理学",
    bg: "bg-rose-50 border-rose-100",
    badge: "bg-rose-100 text-rose-700",
    words: ["epistemology", "empiricism", "cognition", "phenomenology", "hubris"],
    tip: "語源理解（「epi=upon」「logos=study」）が特に効くカテゴリ。ラテン語・ギリシャ語語根を意識する。",
  },
];

const STRATEGY = [
  { phase: "Phase 1（1〜3ヶ月）", title: "語根・語源を体系的に学ぶ", desc: "でる順パス単1級を通読しながら、語根図鑑と組み合わせて学習。ラテン語・ギリシャ語語根60個を押さえると語彙推測力が一気に上がる。" },
  { phase: "Phase 2（4〜6ヶ月）", title: "英字媒体でインプット量を増やす", desc: "The Guardian, BBC World Service, Scientific American を週3本読む/聴く。知らない単語はその場でLoop VocabularyへAI自動抽出（プレミアム）。" },
  { phase: "Phase 3（7〜9ヶ月）", title: "ライティング・スピーキングで定着", desc: "語彙を受容語彙から産出語彙へ昇格させる。エッセイ200語を週3本書き、知らない表現を1級らしい語彙に置き換える練習をする。" },
  { phase: "Phase 4（10〜12ヶ月）", title: "過去問で弱点を刈り込む", desc: "過去6回問題集の語彙問題を時間計測で演習。間違えた語をSRS登録して最終仕上げ。AI弱点分析（プレミアム）でカテゴリごとの習熟度を可視化。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英検1級 単語対策【合格に必要な15,000語レベルの学習戦略】",
  "description": "英検1級合格に必要な語彙数・頻出カテゴリ・学習戦略を徹底解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-11-15",
  "url": "https://loop-vocabulary.app/guide/eiken-1kyu-tango",
};

export default function Eiken1KyuPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英検1級 単語対策【合格に必要な15,000語レベルの学習戦略】" }]} />
      </div>

      <GuideTracker slug="eiken-1kyu-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英検1級 単語対策【合格に必要な15,000語レベルの学習戦略】","item":"https://loop-vocabulary.app/guide/eiken-1kyu-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-rose-700 to-rose-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-rose-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/30 text-rose-200 font-semibold mb-3">
            英検対策ガイド
          </div>
          <h1 className="text-2xl font-black leading-tight">英検1級 単語対策</h1>
          <p className="mt-2 text-sm text-rose-300 max-w-sm mx-auto">15,000語レベルへの到達ルート・カテゴリ別頻出語・12ヶ月攻略戦略を完全解説</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">英検1級の語彙レベルとは</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            英検1級は「大学上級〜ネイティブ近接レベル」（CEFR C1〜C2）を問う試験で、合格には <strong>10,000〜15,000語</strong> 以上の語彙が必要です。語彙問題（大問1・25問）では学術的・高度な語彙が問われ、「一般的な辞書を引けば出てくるがほとんどの日本人が知らない語」が多数出題されます。準1級（7,000〜8,000語）からの差は大きく、通常1〜2年の集中学習が必要です。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "必要語彙数", value: "10,000〜15,000語" },
              { label: "語彙問題", value: "25問（大問1）" },
              { label: "標準学習期間", value: "1〜2年" },
            ].map((s) => (
              <div key={s.label} className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <div className="text-xs font-black text-rose-800">{s.value}</div>
                <div className="text-[10px] text-rose-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <ExamInfoDisclaimer kind="eiken" />
          </div>
        </div>

        {/* 準1級との差 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">準1級との語彙レベルの差</h2>
          <div className="space-y-3">
            {[
              { level: "英検2級", words: "〜5,000語", bar: 30, color: "bg-emerald-400" },
              { level: "英検準1級", words: "〜8,000語", bar: 55, color: "bg-amber-400" },
              { level: "英検1級", words: "〜15,000語", bar: 100, color: "bg-rose-400" },
            ].map((r) => (
              <div key={r.level} className="flex items-center gap-3">
                <div className="text-xs text-navy-600 w-20 shrink-0">{r.level}</div>
                <div className="flex-1 h-3 bg-navy-100 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.bar}%` }} />
                </div>
                <div className="text-xs font-bold text-navy-700 w-20 text-right shrink-0">{r.words}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-navy-500 leading-relaxed">準1級から1級では必要語彙数がほぼ2倍に。単語帳での丸暗記だけでは対応が難しく、英字媒体との大量インプットが不可欠です。</p>
        </div>

        {/* カテゴリ別語彙 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">カテゴリ別 頻出語彙リスト</h2>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className={`rounded-xl border p-4 ${cat.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="font-bold text-navy-800 text-sm">{cat.title}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cat.words.map((w) => (
                    <span key={w} className="text-[11px] bg-white border border-navy-100 rounded-lg px-2 py-0.5 font-mono text-navy-700">{w}</span>
                  ))}
                </div>
                <p className={`text-[11px] leading-relaxed px-2 py-1.5 rounded-lg ${cat.badge} font-medium`}>{cat.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 12ヶ月学習戦略 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-1">12ヶ月 英検1級攻略戦略</h2>
          <p className="text-xs text-navy-500 mb-4">準1級合格後からのスケジュール例（1日1〜2時間想定）</p>
          <div className="space-y-4">
            {STRATEGY.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center">{i + 1}</div>
                <div>
                  <div className="text-[11px] font-bold text-rose-600 mb-0.5">{s.phase}</div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loop Vocabulary活用 */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabulary で1級語彙を制する</h2>
          <ul className="space-y-2.5">
            {[
              { icon: "✨", text: "英字記事・論文を貼ってAI自動抽出（プレミアム）。The Economist から直接1級語彙を単語帳に追加。" },
              { icon: "🌱", text: "AI語源解説で「語根から推測する力」を強化。1つの語根を理解すると関連語が一気に定着。" },
              { icon: "🔬", text: "AI弱点分析（プレミアム）で「科学系は強いが法律系が弱い」などを可視化し、集中特訓の計画を立てられる。" },
              { icon: "📝", text: "1級エッセイライティングに使った表現を単語帳に追加して産出語彙として定着させる。" },
            ].map((item) => (
              <li key={item.icon} className="flex gap-2.5 text-sm text-navy-700">
                <span className="shrink-0">{item.icon}</span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 英検1級合格者が使った参考書（Amazon）" />

        <GuideEmailCapture slug="eiken-1kyu-tango" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で1級語彙に挑戦</div>
          <p className="text-sm text-navy-300 mb-4">英字記事からの自動抽出×SRS×AI語源解説。効率的に15,000語レベルへ。</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/premium"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              AI抽出を使う
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/eiken-jun1-tango", tag: "英検準1級", title: "英検準1級 単語対策【合格に必要な語彙数と学習戦略】" },
              { href: "/guide/toeic-tango", tag: "TOEIC", title: "TOEIC頻出単語・語彙対策【スコア別必須リスト】" },
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="英検1級レベルの単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000032", title: "英検1級 必須単語" },
            { id: "00000000-0000-0000-0000-000000000023", title: "英検準1級 重要単語" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
