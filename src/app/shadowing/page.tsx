import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "英語シャドーイング練習【単語・フレーズ】| Loop Vocabulary",
  description: "英語の音声を聞いてそのまま発音するシャドーイング練習。スマートフォンのWebブラウザで手軽に英語発音トレーニング。英検・TOEIC・大学受験対応。",
};

const SHADOWING_TIPS = [
  {
    icon: "👂",
    title: "ステップ1: まず聞く",
    desc: "音声を聞いて、英語のリズム・強弱・イントネーションを感じます。意味は後で考えてOK。",
  },
  {
    icon: "🔁",
    title: "ステップ2: 繰り返す",
    desc: "聞いた音声を0.5〜1秒遅れでそのままマネして発音します。口が動かなくてもOK、まず真似ることが大事。",
  },
  {
    icon: "🎯",
    title: "ステップ3: 意味と合わせる",
    desc: "発音に慣れてきたら意味も意識しながらシャドーイング。脳と口を同時に使うことで語彙が定着します。",
  },
  {
    icon: "📈",
    title: "ステップ4: 反復練習",
    desc: "同じフレーズを最低5回は繰り返します。できれば毎日10〜15分のシャドーイング習慣を作りましょう。",
  },
];

const SAMPLE_PHRASES = [
  { phrase: "Take your time.", meaning: "ゆっくりどうぞ。" },
  { phrase: "That makes sense.", meaning: "なるほど。それは理にかなっています。" },
  { phrase: "Could you say that again?", meaning: "もう一度言っていただけますか？" },
  { phrase: "I'll keep that in mind.", meaning: "それを心に留めておきます。" },
  { phrase: "Let me think about it.", meaning: "少し考えさせてください。" },
  { phrase: "I appreciate your help.", meaning: "ご協力に感謝します。" },
];

export default function ShadowingPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-2xl font-black leading-tight">英語シャドーイング練習</h1>
        <p className="mt-2 text-sm text-navy-300">音声を聞いてそのまま発音する、リスニング×スピーキング同時強化法</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* シャドーイングとは */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">シャドーイングとは？</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            シャドーイング（Shadowing）とは、英語の音声を聞きながら、影（Shadow）のようにほぼ同時に発音を繰り返す学習法です。
            プロの通訳者の訓練法として始まり、現在では英語学習の最も効果的なトレーニング法の一つとして広く知られています。
          </p>
          <div className="mt-3 bg-sky-50 rounded-xl p-3">
            <p className="text-xs text-sky-700 font-semibold">📊 研究で証明された効果</p>
            <ul className="mt-1.5 text-xs text-sky-700 space-y-1">
              <li>✓ リスニング力の向上</li>
              <li>✓ 英語の発音・イントネーションの習得</li>
              <li>✓ 単語・フレーズの定着率アップ</li>
              <li>✓ 英語のリズム感の獲得</li>
            </ul>
          </div>
        </div>

        {/* 4ステップ */}
        <div>
          <h2 className="font-black text-navy-800 mb-4">シャドーイングの4ステップ</h2>
          <div className="grid grid-cols-1 gap-3">
            {SHADOWING_TIPS.map((t) => (
              <div key={t.title} className="bg-white rounded-2xl border border-navy-100 p-4 flex gap-4">
                <div className="text-2xl shrink-0">{t.icon}</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-600 mt-1">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 練習フレーズ */}
        <div>
          <h2 className="font-black text-navy-800 mb-4">今すぐ練習できるフレーズ</h2>
          <p className="text-xs text-navy-500 mb-3">下のフレーズを声に出して、ネイティブのようなリズムで練習しましょう。</p>
          <div className="space-y-3">
            {SAMPLE_PHRASES.map((p) => (
              <div key={p.phrase} className="bg-white rounded-2xl border border-navy-100 p-4">
                <div className="font-black text-navy-900 text-base">{p.phrase}</div>
                <div className="text-xs text-navy-500 mt-1">{p.meaning}</div>
              </div>
            ))}
          </div>
        </div>

        {/* アプリCTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">音声付きでシャドーイング練習</div>
          <p className="text-sm text-navy-300 mb-2">
            Loop Vocabulary では登録した単語の音声読み上げ（Web Speech API）でシャドーイング練習ができます。
            英語フレーズを単語帳に登録して、スキマ時間に練習しましょう。
          </p>
          <ul className="text-xs text-navy-300 mb-4 space-y-1 text-left mx-auto max-w-xs">
            <li>✓ 自分で追加したフレーズで練習</li>
            <li>✓ フラッシュカードでシャドーイング＋意味確認</li>
            <li>✓ 忘却曲線で定着度チェック</li>
          </ul>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/phrases" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">フレーズ集を見る</Link>
          </div>
        </div>

        {/* 関連リンク */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eiken-conversation" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">💬</div>
            <div className="font-bold text-navy-800 text-sm">英会話フレーズ学習法</div>
          </Link>
          <Link href="/guide/toeic-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📊</div>
            <div className="font-bold text-navy-800 text-sm">TOEIC単語学習法</div>
          </Link>
          <Link href="/vocab-check" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">語彙力チェック</div>
          </Link>
          <Link href="/faq" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">❓</div>
            <div className="font-bold text-navy-800 text-sm">よくある質問</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
