import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "Loop Vocabularyについて | 運営者・開発の背景",
  description:
    "英単語学習アプリ Loop Vocabulary の開発の背景・運営者情報を紹介します。4択だけで覚えた気になる問題意識から、自己想起×忘却曲線を中心にした学習設計まで。",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "Loop Vocabularyについて",
    description: "英単語学習アプリ Loop Vocabulary の開発の背景・運営者情報。",
    url: `${SITE_URL}/about`,
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Loop Vocabularyについて", item: `${SITE_URL}/about` },
  ],
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />

      <Link href="/" className="text-xs text-navy-500 no-underline">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">Loop Vocabularyについて</h1>

      <h2 className="text-lg font-bold text-navy-800 mt-6">なぜLoop Vocabularyを作ったのか</h2>
      <p>
        英単語学習アプリの多くは4択形式の問題を中心にしています。4択は手軽で続けやすい反面、
        選択肢を見比べて消去法で正解できてしまうため、「見れば分かる」状態と「自力で意味を
        思い出せる」状態の差に気づきにくいという課題を感じていました。実際のテストや読解、
        会話では選択肢は用意されていません。この差を埋めるために、Loop Vocabularyでは
        フラッシュカードによる自己想起（アクティブリコール）を学習の中心に据え、4択・入力・
        リスニングは「覚えた後の仕上げ確認」として位置づけています。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">忘却曲線（SRS）を重視している理由</h2>
      <p>
        単語は覚えた直後から少しずつ忘れていきます。エビングハウスの忘却曲線の考え方をもとに、
        正解・不正解や自己評価に応じて次の復習タイミングを自動で計算するSRS（間隔反復システム）を
        実装し、忘れかけたタイミングで復習することで、詰め込みに頼らない定着を目指しています。
        学習モード（フラッシュカード・4択・入力・リスニング）ごとに記憶への負荷が異なるため、
        復習間隔の計算にもモードごとの重み付けを反映しています。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">AIの位置づけ</h2>
      <p>
        AIは「答えを教えてくれるもの」としてではなく、「自分の力で思い出そうとした後の理解を
        深める補助」として設計しています。フラッシュカードで「思い出せなかった」と自己評価した
        場合に限り、ユーザーが任意でボタンを押したときだけAI解説（語源・ニュアンス）が表示され、
        自動で呼び出されることはありません。AI弱点分析・AI学習プランも、学習そのものを代行する
        のではなく、復習の優先順位づけを補助する位置づけです。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">対象にしている学習者</h2>
      <p>
        高校生・大学受験生・英検受験者・定期テスト対策をしたい中高生を主な対象にしています。
        単語帳のインポート、忘却曲線による自動復習、小テストPDF作成など、学校・塾の学習と
        組み合わせて使える機能を優先して開発しています。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">運営者情報・お問い合わせ</h2>
      <p>
        Loop Vocabularyは個人開発者（佐藤 慶音）が運営しています。販売事業者名・解約方法などの
        詳細は<Link href="/legal/commercial-transaction">特定商取引法に基づく表記</Link>、
        利用条件は<Link href="/terms">利用規約</Link>、個人情報の取り扱いは
        <Link href="/privacy">プライバシーポリシー</Link>をご覧ください。使い方や料金の疑問は
        <Link href="/faq">よくある質問</Link>、ご質問・不具合報告は
        <Link href="/contact">お問い合わせフォーム</Link>からお願いします。
      </p>

      <p className="text-xs text-navy-400 mt-8">
        本ページは開発の背景・考え方を説明するものであり、特定の学習効果・試験結果を
        保証するものではありません。
      </p>
    </div>
  );
}
