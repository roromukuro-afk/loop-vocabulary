import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "英単語学習ガイド | Loop Vocabulary",
  description: "大学受験・英検・TOEICの英単語を効率よく覚えるためのガイド記事を掲載しています。スマホアプリで忘却曲線を活かした学習を。",
};

const GUIDES = [
  {
    slug: "daigaku-juken-tango",
    title: "大学受験英単語の効率的な覚え方【2024年版】",
    description: "忘却曲線・SRS・スキマ時間活用など、大学受験に合格する英単語学習法を徹底解説。",
    tag: "大学受験",
    readTime: "5分",
  },
  {
    slug: "eiken-2kyu-tango",
    title: "英検2級 単語帳の使い方と合格への最短ルート",
    description: "英検2級合格に必要な語彙レベル・学習順・おすすめアプリ活用法を紹介。",
    tag: "英検",
    readTime: "4分",
  },
  {
    slug: "chugaku-eigo-tango",
    title: "中学英語の単語を完璧に覚える方法【基礎固め完全版】",
    description: "高校受験・英検3級の基礎となる中学英単語1,200語の効率的な覚え方を解説。",
    tag: "中学英語",
    readTime: "4分",
  },
  {
    slug: "eiken-jun1-tango",
    title: "英検準1級 単語の攻略法と学習ロードマップ",
    description: "準1級合格に必要な語彙数・頻出テーマ・学習スケジュールを徹底解説。2級合格後の次のステップ。",
    tag: "英検準1級",
    readTime: "5分",
  },
  {
    slug: "eiken-1kyu-tango",
    title: "英検1級 単語対策【15,000語レベルへの学習戦略】",
    description: "英検1級合格に必要な語彙数・カテゴリ別頻出語・12ヶ月攻略戦略を完全解説。準1級からのステップアップ。",
    tag: "英検1級",
    readTime: "6分",
  },
  {
    slug: "toeic-tango",
    title: "TOEICスコアアップの英単語学習法【600→800点】",
    description: "TOEIC頻出単語の特徴と、スコア帯別の学習戦略。アプリで継続するコツも解説。",
    tag: "TOEIC",
    readTime: "6分",
  },
  {
    slug: "eiken-conversation",
    title: "英会話に効く英単語の覚え方【使える語彙を増やす】",
    description: "日常英会話・旅行英語で実際に使える単語とフレーズの覚え方とアウトプット練習法を解説。",
    tag: "英会話",
    readTime: "4分",
  },
  {
    slug: "ielts-tango",
    title: "IELTSの英単語学習法【アカデミック語彙を効率的に覚える】",
    description: "IELTS頻出語彙・AWL攻略法とスコア帯別の学習戦略。留学・就労ビザ取得を目指す方向け。",
    tag: "IELTS",
    readTime: "5分",
  },
  {
    slug: "business-english-tango",
    title: "ビジネス英語の必須単語300選と実践的な覚え方",
    description: "会議・メール・プレゼンで使えるビジネス英語の頻出単語と表現を厳選。実践活用法も解説。",
    tag: "ビジネス英語",
    readTime: "5分",
  },
  {
    slug: "eitango-oboeru-houhou",
    title: "英単語の覚え方・効率的な記憶術【科学的アプローチ】",
    description: "SRS・語源・例文記憶・ニーモニックなど、認知科学に基づく英単語の覚え方を徹底解説。忘却曲線を攻略しよう。",
    tag: "学習法",
    readTime: "7分",
  },
  {
    slug: "eiken-3kyu-tango",
    title: "英検3級 単語・語彙対策【頻出800語カテゴリ別解説】",
    description: "英検3級合格に必要な必須単語800語をカテゴリ別に解説。10週間合格プランと語彙問題攻略ポイントも掲載。",
    tag: "英検3級",
    readTime: "5分",
  },
  {
    slug: "eiken-jun2-tango",
    title: "英検準2級 単語対策【頻出1,000語テーマ別】",
    description: "英検準2級合格に必要な単語1,000語を環境・医療・テクノロジーなどテーマ別に解説。6週間合格プランと語彙問題攻略法も掲載。",
    tag: "英検準2級",
    readTime: "6分",
  },
  {
    slug: "eigo-hatsuon-renshu",
    title: "英語の発音練習方法【フォニックス・シャドーイング完全ガイド】",
    description: "英語の発音を独学で改善する方法を徹底解説。フォニックス・シャドーイング・IPA活用法から日本人が苦手な音の攻略法まで。",
    tag: "発音練習",
    readTime: "5分",
  },
  {
    slug: "koukou-eigo-tango",
    title: "高校英語の単語を完全に覚える方法【大学受験対応・2,000語攻略】",
    description: "共通テスト・難関私大・国立大に対応した高校英語の単語学習法。レベル別ロードマップとSRS活用法で2,000〜5,000語を最短習得。",
    tag: "高校英語",
    readTime: "5分",
  },
  {
    slug: "toeic-900ten",
    title: "TOEIC 900点の勉強法【スコアアップ戦略と学習スケジュール】",
    description: "TOEIC 900点突破のための現在スコア別ロードマップ・パート別攻略法・必須語彙強化法を実践的に解説。",
    tag: "TOEIC 900点",
    readTime: "6分",
  },
  {
    slug: "eigo-listening-renshu",
    title: "英語リスニング練習方法【初心者〜上級者別 完全ガイド】",
    description: "シャドーイング・ディクテーション・多聴の効果的な使い方からレベル別おすすめ教材まで。TOEICリスニング対策にも対応。",
    tag: "リスニング",
    readTime: "5分",
  },
  {
    slug: "eibunpo-kiso",
    title: "英文法 基礎の覚え方【中学〜高校・大学受験 完全ガイド】",
    description: "英文法のつまずきポイント5選と3ステップ攻略法。時制・仮定法・関係代名詞を理解ベースで攻略。英検・TOEIC文法対策にも対応。",
    tag: "英文法",
    readTime: "5分",
  },
  {
    slug: "eigo-dokkai-houhou",
    title: "英語長文読解の勉強法【大学受験・英検・TOEIC対応】",
    description: "英語長文を速く正確に解く4つのスキルと試験別攻略法。語彙力・精読・速読・パラグラフ読みを段階的に強化。",
    tag: "長文読解",
    readTime: "5分",
  },
];

const LIST_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "英単語学習ガイド",
  "description": "受験・英検・TOEICの英単語を効率よく覚えるためのガイド記事一覧",
  "url": "https://loop-vocabulary.app/guide",
  "itemListElement": GUIDES.map((g, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "url": `https://loop-vocabulary.app/guide/${g.slug}`,
    "name": g.title,
  })),
};

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LIST_JSON_LD) }} />
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-2xl font-black leading-tight">英単語学習ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">受験・資格・TOEIC の単語学習を科学する</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guide/${g.slug}`} className="block">
            <div className="bg-white rounded-2xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">{g.tag}</span>
                <span className="text-[11px] text-navy-400">読了 {g.readTime}</span>
              </div>
              <h2 className="font-bold text-navy-800 leading-snug">{g.title}</h2>
              <p className="text-sm text-navy-500 mt-1 leading-relaxed">{g.description}</p>
              <div className="mt-3 text-sm text-sky-600 font-semibold">続きを読む →</div>
            </div>
          </Link>
        ))}

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center mt-6">
          <div className="font-black text-lg mb-1">今すぐ無料で始める</div>
          <p className="text-sm text-navy-300 mb-4">単語帳作成・忘却曲線復習・AI解説が全部無料</p>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
          >
            無料登録 →
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
