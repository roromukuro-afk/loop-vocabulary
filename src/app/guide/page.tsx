import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/components/analytics/TrackedLink";

export const metadata: Metadata = {
  title: "英単語学習ガイド | Loop Vocabulary",
  description: "大学受験・英検・TOEICの英単語を効率よく覚えるためのガイド記事を掲載しています。スマホアプリで忘却曲線を活かした学習を。",
  alternates: { canonical: "https://loop-vocabulary.app/guide" },
};

const GUIDES = [
  {
    slug: "vocabulary-quiz-pdf-for-teachers",
    title: "塾・学校の英単語小テストをPDFで作る方法【教員・家庭教師向け】",
    description: "定期テスト前・英検前・授業後の確認・宿題プリントに使える、小テストPDF作成の使い方。",
    tag: "教員・塾講師向け",
    readTime: "4分",
  },
  {
    slug: "english-vocabulary-quiz-maker",
    title: "英単語小テスト作成ツールの使い方【無料・登録不要で試せる】",
    description: "単語帳の準備から出題形式の選び方、PDF出力までの流れを紹介。Word/Excel手作業との違いも比較。",
    tag: "教員・塾講師向け",
    readTime: "4分",
  },
  {
    slug: "printable-english-vocabulary-test",
    title: "印刷できる英単語テストPDFを作る方法【A4・段組み対応】",
    description: "A4用紙にきれいに印刷できるPDFの作り方と、段組み・解答欄配置・印刷設定のポイントを解説。",
    tag: "教員・塾講師向け",
    readTime: "4分",
  },
  {
    slug: "juku-vocabulary-test",
    title: "塾・家庭教師向け英単語小テストの作り方【個別対応】",
    description: "生徒一人ひとりに合わせた小テストの作り方。個別指導・少人数クラスでの使い方を紹介。",
    tag: "教員・塾講師向け",
    readTime: "4分",
  },
  {
    slug: "high-school-english-vocabulary-test",
    title: "高校英語の単語テストを効率よく作る方法【定期テスト・英検対応】",
    description: "教科書範囲・定期テスト・英検対策に合わせた単語テストの作り方を解説。",
    tag: "教員・塾講師向け",
    readTime: "4分",
  },
  {
    slug: "spaced-repetition-english-vocabulary",
    title: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】",
    description: "SRS（間隔反復システム）が「いつ・何を」復習させているのか、毎日何をすればいいか迷わない組み立て方。",
    tag: "学習法",
    readTime: "5分",
  },
  {
    slug: "flashcards-vs-multiple-choice",
    title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】",
    description: "2つの出題形式の得意・不得意を整理し、自力で思い出せる状態にするための正しい使い分け方。",
    tag: "学習法",
    readTime: "5分",
  },
  {
    slug: "eiken-vocabulary-study",
    title: "英検単語の復習方法【全級共通・音声とAIを使った学習法】",
    description: "級を問わず使える復習の組み立て方、音声での「聞いて分かる」対策、AI弱点分析の活用法。",
    tag: "英検",
    readTime: "5分",
  },
  {
    slug: "university-exam-vocabulary",
    title: "大学受験 直前期の英単語復習法【模試・AI弱点分析の活用】",
    description: "直前期に復習範囲を絞り込む方法。模試・過去問で出た単語の扱い方とAI弱点分析の使い方。",
    tag: "大学受験",
    readTime: "5分",
  },
  {
    slug: "school-test-vocabulary",
    title: "定期テスト前の英単語復習法【教科書・プリントの単語整理】",
    description: "教科書やプリントの単語をどう整理して復習すればいいか。短期間でも自己想起を使った確認方法。",
    tag: "定期テスト",
    readTime: "4分",
  },
  {
    slug: "listening-and-pronunciation-vocabulary",
    title: "単語を音で覚える【音声ファースト学習法】",
    description: "「読めるのに聞き取れない」を防ぐ、単語レベルでの音声学習の取り入れ方。",
    tag: "リスニング",
    readTime: "4分",
  },
  {
    slug: "ai-vocabulary-learning",
    title: "AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】",
    description: "AI弱点分析・学習プラン作成・長文からの単語抽出・単語解説の使い方と、頼りすぎないための注意点。",
    tag: "AI活用",
    readTime: "5分",
  },
  {
    slug: "daigaku-juken-tango",
    title: "大学受験英単語の効率的な覚え方【共通テスト〜難関大対応】",
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
    title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】",
    description: "自己想起（アクティブリコール）・忘却曲線に沿った復習を軸に、語源・例文記憶・ニーモニックなど7つのアプローチを徹底解説。",
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
  {
    slug: "eitango-oboerarenai",
    title: "英単語が覚えられない原因と解決法【記憶科学で攻略】",
    description: "「覚えられない」のは才能ではなく方法の問題。忘却曲線・想起練習・分散学習で、覚えられない5つの原因と具体的な解決法を解説。",
    tag: "学習法",
    readTime: "6分",
  },
  {
    slug: "eitango-ichinichi-nanko",
    title: "英単語は1日何個が最適？続く適正量の決め方",
    description: "多すぎると逆効果になる理由と、目的・期間から逆算する適正量の決め方。挫折しない継続のコツも紹介。",
    tag: "学習法",
    readTime: "5分",
  },
  {
    slug: "genzaikanryo-kakokei-chigai",
    title: "現在完了と過去形の違い【「今との繋がり」で完全理解】",
    description: "日本語にない『今との繋がり』という1つの軸で、完了・経験・継続・結果の4用法を例文で完全理解。よくある間違いも解説。",
    tag: "英文法",
    readTime: "5分",
  },
  {
    slug: "eiken-2kyu-tango-nanko",
    title: "英検2級は単語何個で受かる？必要語彙数の真実",
    description: "合格に必要な語彙は約5,000語。級別の必要語彙数一覧と、なぜ語彙が合否を分けるのか、最短で覚える方法を解説。",
    tag: "英検",
    readTime: "5分",
  },
  {
    slug: "tangocho-erabikata",
    title: "英単語帳の選び方と正しい使い方【失敗しない1冊の選定と回し方】",
    description: "単語帳はレベル・形式・音声・目的で選び、回数より頻度で何周もするのが正解。1冊を完璧にする回し方とSRS活用法を解説。",
    tag: "単語帳",
    readTime: "6分",
  },
  {
    slug: "system-eitango",
    title: "システム英単語の使い方・レベル・特徴を徹底解説",
    description: "シス単の特徴・対象レベル・効果的な使い方。ミニマルフレーズで覚える仕組みと、ターゲット1900との違いまで。",
    tag: "単語帳",
    readTime: "5分",
  },
  {
    slug: "target-1900",
    title: "英単語ターゲット1900 完全攻略【使い方・レベル・周回法】",
    description: "1単語1義・でる順の定番単語帳の使い方を解説。100語セクション周回・赤シート活用・シス単との違いまで。",
    tag: "単語帳",
    readTime: "5分",
  },
  {
    slug: "systan-vs-target-1900",
    title: "システム英単語とターゲット1900を実際に比較【どっちを選ぶ】",
    description: "収録単語を実際に比較。最頻出語はほぼ共通、違いは覚え方と難関帯の単語の性格。タイプ・志望校別にどっちを選ぶべきか解説。",
    tag: "単語帳",
    readTime: "6分",
  },
  {
    slug: "leap-eitango",
    title: "英単語LEAP（リープ）の使い方・レベル・特徴を徹底解説",
    description: "2,300語をテーマ別＋発信/受信で分ける独自設計、CEFR表示。実際の収録語を踏まえ、ターゲット・シス単との違いまで解説。",
    tag: "単語帳",
    readTime: "6分",
  },
  {
    slug: "eitango-cho-hikaku",
    title: "大学受験の英単語帳おすすめ比較【LEAP・シス単・ターゲット・鉄壁】",
    description: "定番4冊を配列・語数・レベル・覚え方で徹底比較。志望校とタイプ別に、どれを選ぶべきか一目でわかる早見表つき。",
    tag: "単語帳",
    readTime: "6分",
  },
];

// タグ→カテゴリのマッピング。記事のURL・タグ自体は変更せず、一覧の見せ方のみ整理する。
const TAG_TO_CATEGORY: Record<string, string> = {
  "英検": "英検対策",
  "英検2級": "英検対策",
  "英検準1級": "英検対策",
  "英検1級": "英検対策",
  "英検3級": "英検対策",
  "英検準2級": "英検対策",
  "TOEIC": "TOEIC対策",
  "TOEIC 900点": "TOEIC対策",
  "大学受験": "大学受験英単語",
  "定期テスト": "定期テスト・高校英語",
  "高校英語": "定期テスト・高校英語",
  "中学英語": "定期テスト・高校英語",
  "学習法": "記憶法・忘却曲線（SRS）",
  "リスニング": "リスニング・発音",
  "発音練習": "リスニング・発音",
  "英文法": "英文法",
  "長文読解": "長文読解",
  "AI活用": "AIを使った英単語学習",
  "教員・塾講師向け": "PDF小テスト・教育者向け",
  "単語帳": "英単語帳レビュー・比較",
  "英会話": "英会話・資格・ビジネス英語",
  "IELTS": "英会話・資格・ビジネス英語",
  "ビジネス英語": "英会話・資格・ビジネス英語",
};

const CATEGORY_ORDER = [
  "記憶法・忘却曲線（SRS）",
  "英検対策",
  "TOEIC対策",
  "大学受験英単語",
  "定期テスト・高校英語",
  "リスニング・発音",
  "英文法",
  "長文読解",
  "AIを使った英単語学習",
  "PDF小テスト・教育者向け",
  "英単語帳レビュー・比較",
  "英会話・資格・ビジネス英語",
];

// 初めての方向けに、まず読むとよい3記事をおすすめとして固定表示する。
const FEATURED_SLUGS = [
  "eitango-oboeru-houhou",
  "spaced-repetition-english-vocabulary",
  "tangocho-erabikata",
];

const CATEGORIZED_GUIDES = CATEGORY_ORDER.map((category) => ({
  category,
  guides: GUIDES.filter((g) => TAG_TO_CATEGORY[g.tag] === category),
}));

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
        <Link href="/grammar" className="block">
          <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-5 text-white hover:shadow-md transition-shadow">
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-200 mb-1">新着・英文法レッスン</div>
            <div className="font-black text-lg leading-snug">英文法を「理由」で理解する無料レッスン</div>
            <p className="text-sm text-teal-100 mt-1">冠詞・名詞などを例文＋確認問題で。中学〜大学受験対応 →</p>
          </div>
        </Link>

        <div data-testid="guide-featured-section" className="bg-white rounded-2xl border border-navy-100 p-5">
          <div className="text-xs font-bold text-navy-800 mb-1">はじめての方へ</div>
          <p className="text-xs text-navy-500 mb-3">まずはこの3記事から読むのがおすすめです。</p>
          <div className="space-y-2">
            {FEATURED_SLUGS.map((slug) => {
              const g = GUIDES.find((x) => x.slug === slug);
              if (!g) return null;
              return (
                <Link key={slug} href={`/guide/${slug}`} className="flex items-center justify-between gap-2 text-sm font-semibold text-sky-700 hover:underline">
                  <span>{g.title}</span>
                  <span className="shrink-0 text-navy-300">→</span>
                </Link>
              );
            })}
          </div>
        </div>

        <nav aria-label="カテゴリ一覧" className="bg-white rounded-2xl border border-navy-100 p-4 flex flex-wrap gap-2">
          {CATEGORIZED_GUIDES.map(({ category, guides }) => (
            <a
              key={category}
              href={`#category-${category}`}
              className="text-[11px] px-2.5 py-1 rounded-full bg-navy-50 text-navy-600 font-semibold hover:bg-navy-100 transition-colors"
            >
              {category}（{guides.length}）
            </a>
          ))}
        </nav>

        {CATEGORIZED_GUIDES.map(({ category, guides }) => (
          <section key={category} id={`category-${category}`} data-testid="guide-category-section" className="scroll-mt-4">
            <h2 className="text-base font-black text-navy-800 px-1 mb-2">{category}</h2>
            <div className="space-y-3">
              {guides.map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}`} className="block">
                  <div className="bg-white rounded-2xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">{g.tag}</span>
                      <span className="text-[11px] text-navy-400">読了 {g.readTime}</span>
                    </div>
                    <h3 className="font-bold text-navy-800 leading-snug">{g.title}</h3>
                    <p className="text-sm text-navy-500 mt-1 leading-relaxed">{g.description}</p>
                    <div className="mt-3 text-sm text-sky-600 font-semibold">続きを読む →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center mt-6">
          <div className="font-black text-lg mb-1">今すぐ無料で始める</div>
          <p className="text-sm text-navy-300 mb-4">単語帳作成・忘却曲線復習・AI解説が全部無料</p>
          <TrackedLink
            href="/signup"
            growthEvent="signup_cta_click"
            growthProperties={{ cta_location: "guide" }}
            className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
          >
            無料登録 →
          </TrackedLink>
        </div>

        <div className="flex justify-center gap-4 text-sm flex-wrap pt-2">
          <Link href="/materials" className="text-navy-500 underline">教材一覧</Link>
          <Link href="/dictionary" className="text-navy-500 underline">辞書検索</Link>
          <Link href="/" className="text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
