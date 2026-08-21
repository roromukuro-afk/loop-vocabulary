import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PhraseTtsButton } from "./PhraseTtsButton";

export const metadata: Metadata = {
  title: "英語フレーズ集【英検・TOEIC・大学受験】| Loop Vocabulary",
  description: "英検2級・準1級・TOEIC・大学受験で頻出する英語フレーズ・イディオムを一覧で確認できます。ログイン不要で閲覧可能。スマホで学習するならLoop Vocabularyへ。",
  alternates: { canonical: "https://loop-vocabulary.app/phrases" },
};

type Phrase = { phrase: string; meaning: string; example: string; level: string };

const PHRASES: Phrase[] = [
  // 英検2級・大学受験レベル
  { phrase: "as a result", meaning: "その結果として", example: "As a result, many people lost their jobs.", level: "大学受験" },
  { phrase: "in addition to", meaning: "〜に加えて", example: "In addition to English, she speaks French.", level: "大学受験" },
  { phrase: "on the other hand", meaning: "一方では", example: "On the other hand, prices have risen sharply.", level: "大学受験" },
  { phrase: "take advantage of", meaning: "〜を利用する・活用する", example: "We should take advantage of this opportunity.", level: "大学受験" },
  { phrase: "be responsible for", meaning: "〜に責任がある", example: "She is responsible for managing the project.", level: "大学受験" },
  { phrase: "contribute to", meaning: "〜に貢献する", example: "Exercise can contribute to better mental health.", level: "大学受験" },
  { phrase: "be aware of", meaning: "〜を認識している", example: "Are you aware of the risks involved?", level: "大学受験" },
  { phrase: "play a role in", meaning: "〜において役割を果たす", example: "Diet plays a key role in disease prevention.", level: "大学受験" },
  // 英検準1級レベル
  { phrase: "in terms of", meaning: "〜の点では・〜に関して", example: "In terms of cost, this option is better.", level: "英検準1級" },
  { phrase: "regardless of", meaning: "〜に関わらず", example: "The rule applies regardless of age.", level: "英検準1級" },
  { phrase: "come up with", meaning: "〜を思いつく・考え出す", example: "Can you come up with a better solution?", level: "英検準1級" },
  { phrase: "give rise to", meaning: "〜を引き起こす", example: "Pollution gives rise to many health problems.", level: "英検準1級" },
  { phrase: "be attributed to", meaning: "〜に起因する", example: "His success is attributed to hard work.", level: "英検準1級" },
  { phrase: "pose a threat to", meaning: "〜に脅威をもたらす", example: "Climate change poses a threat to biodiversity.", level: "英検準1級" },
  { phrase: "lead to", meaning: "〜につながる・引き起こす", example: "Stress can lead to serious health issues.", level: "英検準1級" },
  { phrase: "call for", meaning: "〜を要求する・必要とする", example: "The situation calls for immediate action.", level: "英検準1級" },
  // TOEICレベル
  { phrase: "get back to", meaning: "〜に折り返す・戻る", example: "I'll get back to you by end of day.", level: "TOEIC" },
  { phrase: "look into", meaning: "〜を調査する", example: "We'll look into the matter right away.", level: "TOEIC" },
  { phrase: "be in charge of", meaning: "〜を担当している", example: "Who is in charge of this project?", level: "TOEIC" },
  { phrase: "ahead of schedule", meaning: "予定より早く", example: "The project was completed ahead of schedule.", level: "TOEIC" },
  { phrase: "reach out to", meaning: "〜に連絡を取る", example: "Please reach out to our support team.", level: "TOEIC" },
  { phrase: "follow up on", meaning: "〜をフォローアップする", example: "I'll follow up on that email tomorrow.", level: "TOEIC" },
  { phrase: "be subject to", meaning: "〜に従わなければならない", example: "All prices are subject to change.", level: "TOEIC" },
  { phrase: "in line with", meaning: "〜に沿って・一致して", example: "This decision is in line with our policy.", level: "TOEIC" },
];

const LEVEL_COLORS: Record<string, string> = {
  "大学受験": "bg-indigo-50 text-indigo-700",
  "英検準1級": "bg-amber-50 text-amber-700",
  "TOEIC": "bg-emerald-50 text-emerald-700",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "英語フレーズ集【英検・TOEIC・大学受験】",
  "url": "https://loop-vocabulary.app/phrases",
  "numberOfItems": PHRASES.length,
};

export default function PhrasesPage() {
  const levels = [...new Set(PHRASES.map((p) => p.level))];

  return (
    <div className="min-h-dvh bg-[#f7f9fc]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-2xl font-black leading-tight">英語フレーズ集</h1>
        <p className="mt-2 text-sm text-navy-300">英検・TOEIC・大学受験の頻出フレーズ {PHRASES.length}選</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* レベル別目次 */}
        <div className="flex gap-2 flex-wrap mb-6">
          {levels.map((lv) => (
            <a key={lv} href={`#${lv}`}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold ${LEVEL_COLORS[lv] ?? "bg-navy-50 text-navy-700"}`}>
              {lv}
            </a>
          ))}
        </div>

        {/* フレーズリスト（レベル別） */}
        {levels.map((lv) => (
          <section key={lv} id={lv} className="mb-8">
            <h2 className="font-black text-lg text-navy-800 mb-4 flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${LEVEL_COLORS[lv] ?? ""}`}>{lv}</span>
              フレーズ
            </h2>
            <div className="space-y-3">
              {PHRASES.filter((p) => p.level === lv).map((p) => (
                <div key={p.phrase} className="bg-white rounded-2xl border border-navy-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-black text-navy-900 text-base flex-1">{p.phrase}</div>
                    <PhraseTtsButton phrase={p.phrase} />
                  </div>
                  <div className="text-sm font-semibold text-sky-700 mt-1">{p.meaning}</div>
                  <div className="mt-2 bg-navy-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-navy-600 italic">"{p.example}"</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center mt-4">
          <div className="font-black text-base mb-1">フレーズを自分の単語帳で覚える</div>
          <p className="text-sm text-navy-300 mb-4">Loop Vocabulary はフレーズ・熟語も登録して忘却曲線で覚えられます</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック</Link>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-navy-400 space-y-2">
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/guide" className="underline">学習ガイド</Link>
            <Link href="/vocab-check" className="underline">語彙力チェック</Link>
            <Link href="/vocab-check/toeic" className="underline">TOEIC語彙チェック</Link>
            <Link href="/vocab-check/eiken" className="underline">英検語彙チェック</Link>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <PublicFooter />
      </div>
    </div>
  );
}
