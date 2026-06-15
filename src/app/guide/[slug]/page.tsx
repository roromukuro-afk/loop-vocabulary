import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Article = {
  title: string;
  description: string;
  tag: string;
  published: string;
  content: string;
};

const ARTICLES: Record<string, Article> = {
  "daigaku-juken-tango": {
    title: "大学受験英単語の効率的な覚え方【2024年版】",
    description: "忘却曲線・SRS・スキマ時間活用など、大学受験に合格するための英単語学習法を徹底解説します。",
    tag: "大学受験",
    published: "2024-09-01",
    content: `
## 大学受験に必要な英単語数は？

大学受験（共通テスト・私大・国公立二次）に合格するためには、一般的に **3,000〜5,000語** 程度の英単語が必要とされています。共通テストでは約3,000語レベルが目安ですが、難関国公立・早慶上智を目指す場合は5,000語以上が求められることもあります。

やみくもに単語帳を眺めるだけでは定着しません。科学的な学習法を取り入れることで、同じ時間でも覚える量が大きく変わります。

---

## 忘却曲線とSRS（間隔反復学習）

ドイツの心理学者エビングハウスが発見した「忘却曲線」によると、人は学んだことを：

- 1時間後に **約56%** 忘れる
- 1日後に **約74%** 忘れる
- 1週間後に **約77%** 忘れる

この忘却に対抗するのが **SRS（Spaced Repetition System）＝間隔反復学習** です。覚えた単語は「忘れそうになるタイミング」で再確認することで、長期記憶に移行させます。

Loop Vocabulary では SRS アルゴリズムを内蔵しており、「復習待ち」の単語を自動でピックアップして出題します。

---

## スキマ時間を最大化する学習法

通学・移動・休憩のスキマ時間は英単語学習の宝庫です。1日 **10〜15分** のスキマ学習を積み重ねることで、月に 300〜500語 の習得が可能です。

- **電車の中**：フラッシュカードで単語を確認（音声読み上げ付き）
- **朝のルーティン**：今日の復習 20 問をこなしてから登校
- **寝る前**：AI解説で1単語の語源・ニュアンスを深掘り

---

## 単語帳の選び方

市販の単語帳（システム英単語・Duo 3.0・ターゲット1900など）と、自分の過去問からの抽出を組み合わせるのが最も効果的です。

- **システム英単語**：頻出度順で効率的。共通テストから早慶まで対応
- **ターゲット1900**：シンプルで使いやすく、私大受験生に人気
- **DUO 3.0**：例文で単語のセットを覚える独自アプローチ

Loop Vocabulary の **CSV インポート機能**（プレミアム）を使えば、市販の単語帳の単語リストや先生が作ったプリントの単語をそのまま取り込んで、SRS 学習を始められます。

---

## AI で語源・ニュアンスを深く理解する

単語を文脈なしに丸暗記しても、入試の長文では使えません。**語源・ニュアンス・例文** を合わせて覚えることで、初見の単語でも意味を推測できる力がつきます。

Loop Vocabulary の **AI 解説機能** では：

- **レベル別例文**：高校生レベルから難関大レベルまで
- **語源解説**：ラテン語・ギリシャ語由来の意味の成り立ち
- **覚え方・語呂合わせ**：AIがユニークな記憶術を提案
- **ニュアンス解説**：試験での出方・注意点を解説

---

## 継続するためのコツ

英単語学習で最も大切なのは **継続すること** です。

1. **毎日の目標を低く設定する**：最初は「1日10語」でOK
2. **ストリーク（連続学習日数）を守る**：途切れると再開が億劫になる
3. **弱点単語に集中する**：間違えた単語を「苦手リスト」で管理
4. **スコアを可視化する**：ダッシュボードで正答率・学習語数を確認

Loop Vocabulary では連続学習日数（ストリーク）バッジ、正答率グラフ、次のバッジまでの進捗を毎日表示します。ゲーミフィケーションで学習を継続しやすくしています。

---

## まとめ

大学受験の英単語学習に必要なのは、「正しい学習法 × 継続」の掛け算です。SRS を活用し、スキマ時間を最大化し、AI で深く理解することで、限られた受験期間でも確実に語彙を増やせます。

まずは無料で Loop Vocabulary を試してみましょう。単語帳を作って最初の10語を登録するだけで、今日からSRS学習が始まります。
    `,
  },

  "eiken-2kyu-tango": {
    title: "英検2級 単語帳の使い方と合格への最短ルート",
    description: "英検2級に合格するために必要な語彙レベル・学習順序・アプリ活用法を解説します。準1級へのステップとしても参考にしてください。",
    tag: "英検",
    published: "2024-09-15",
    content: `
## 英検2級の語彙レベルと合格に必要な単語数

英検2級は「高校卒業程度」の英語力を測る試験です。合格に必要な語彙数は **3,000〜5,000語** とされており、大学受験英語と重なる部分が多いです。

英検2級の単語の特徴：
- **日常的なトピック**（環境・テクノロジー・医療・社会問題）に関連する語が頻出
- **フォーマルな文体**で使われる動詞・形容詞が問われる
- 語彙問題（大問1）で **25問** 出題される

---

## 英検2級の語彙問題の出題パターン

英検2級の語彙問題は、文脈から適切な単語を選ぶ形式です。4択から正解を選ぶため、「なんとなくわかる」ではなく **確実に意味を答えられる** レベルが必要です。

頻出テーマ別の重要単語：

**環境・自然**
- sustainable（持続可能な）/ renewable（再生可能な）/ biodiversity（生物多様性）

**医療・健康**
- vaccine（ワクチン）/ symptom（症状）/ diagnose（診断する）

**テクノロジー**
- artificial intelligence（人工知能）/ innovation（革新）/ algorithm（アルゴリズム）

**社会・経済**
- unemployment（失業）/ infrastructure（インフラ）/ poverty（貧困）

---

## 合格への学習ロードマップ

英検2級合格までのステップを逆算して組み立てると効果的です。

### ステップ 1：基礎語彙を固める（1〜2ヶ月）

まず中学英語の語彙（約1,500語）を完璧にします。「基礎ができていない」まま2級単語に進んでも定着しません。Loop Vocabulary で簡単な単語から始め、正答率 80%以上を維持することを目標にしましょう。

### ステップ 2：2級頻出語を集中学習（2〜3ヶ月）

英検2級用の単語帳（旺文社「英検2級 でる順パス単」など）を使い、頻出上位 1,000語を集中的に学習。**SRS復習**で忘れずに定着させます。

### ステップ 3：弱点単語の集中補強（1ヶ月）

過去問演習と並行して、間違えた単語を Loop Vocabulary の「苦手単語」機能で管理し、繰り返し出題します。

---

## Loop Vocabulary の活用法

### 単語帳を試験別に分ける

- 「英検2級 語彙問題頻出」
- 「英検2級 読解・長文頻出」
- 「英検2級 ライティング表現」

などに分けて管理すると、試験直前に重要単語だけを集中復習できます。

### AI解説で文脈を理解する

英検の語彙問題では、単語の **使われ方（コロケーション）** が問われることがあります。AI解説の「ニュアンス解説・入試での出方」機能を使い、単語の使い方を例文で確認しましょう。

例：「implement」は「実施する・実装する」という意味ですが、英検2級では「政策を実施する（implement a policy）」という文脈で頻出します。

---

## 英検2級 よく出る動詞・形容詞リスト

**よく出る動詞**
| 単語 | 意味 |
|---|---|
| implement | 実施する |
| contribute | 貢献する |
| reduce | 削減する |
| eliminate | 排除する |
| promote | 促進する |

**よく出る形容詞**
| 単語 | 意味 |
|---|---|
| significant | 重要な・大きな |
| potential | 潜在的な |
| adequate | 適切な |
| efficient | 効率的な |
| diverse | 多様な |

---

## まとめ

英検2級合格のカギは、**頻出語彙を文脈で覚え、SRS で定着させること** です。Loop Vocabulary を使えば、苦手単語の管理から AI による語義深掘りまで、スマホ1台で完結します。

無料プランで今すぐ単語帳を作り始めましょう。
    `,
  },

  "toeic-tango": {
    title: "TOEICスコアアップの英単語学習法【600→800点】",
    description: "TOEIC L&R テストの頻出単語の特徴とスコア帯別の学習戦略を解説。アプリを使った継続学習のコツも紹介します。",
    tag: "TOEIC",
    published: "2024-10-01",
    content: `
## TOEICに必要な語彙数とスコアの関係

TOEIC L&R テストは 990点満点で、スコア帯によって求められる語彙数が異なります。

| スコア | 必要語彙数の目安 |
|---|---|
| 〜500点 | 3,000語程度 |
| 500〜700点 | 5,000語程度 |
| 700〜900点 | 7,000〜8,000語 |
| 900〜990点 | 10,000語以上 |

TOEICは「ビジネス英語」に特化した試験のため、日常会話やニュース英語とは異なる頻出単語があります。

---

## TOEICの頻出ビジネス単語トップ30

TOEICのリスニング・リーディング両方でよく出る重要単語を厳選しました。

**会議・コミュニケーション**
- agenda（議題）/ minutes（議事録）/ reschedule（日程変更する）/ confirm（確認する）

**業務・オペレーション**
- deadline（締め切り）/ submit（提出する）/ authorize（承認する）/ implement（実施する）

**人事・採用**
- applicant（応募者）/ qualified（資格のある）/ promote（昇進させる）/ resign（辞任する）

**財務・数字**
- revenue（収益）/ estimate（見積もり）/ invoice（請求書）/ quarterly（四半期の）

**物流・調達**
- shipment（荷物）/ inventory（在庫）/ vendor（取引先）/ quantity（数量）

---

## スコア帯別の学習戦略

### 〜600点：基礎単語の完全習得

まずは中学〜高校英語の基礎語彙（3,000語）を固めることが先決です。TOEICの単語以前に「基礎的な英文が読めない」状態では、リーディングセクションで時間が足りなくなります。

この段階で Loop Vocabulary を使い、1日 30〜50 語を SRS で回していきましょう。フラッシュカード→4択テスト→入力テストの順に難易度を上げると定着しやすくなります。

### 600〜730点：ビジネス英語への移行

このレベルでは、日常英語はほぼ理解できているため、TOEIC特有のビジネス語彙を集中習得します。

- **Part 5（短文穴埋め）**：品詞の理解と前置詞コロケーションが鍵
- **Part 6・7（長文読解）**：ビジネスメール・報告書・広告の定型表現を覚える
- **Part 3・4（リスニング）**：会議・アナウンス・ナレーションに頻出の表現

### 730〜860点：語彙の「深さ」を増す

このレベルになると、単語の意味を知っているだけでは不十分です。**同義語・コロケーション・品詞変化** を含めて覚えることで、Part 5 の正答率が上がります。

Loop Vocabulary の AI 解説「ニュアンス解説」機能で、単語の使われ方の微妙な違いを確認しましょう。

例：「rise」vs「raise」— どちらも「上がる・上げる」ですが、「rise」は自動詞（主語が上がる）、「raise」は他動詞（〜を上げる）という違いがあります。

---

## 継続のためのシステム構築

TOEICスコアアップに必要な学習時間は、目標スコアによって異なりますが、一般的に：

- 600点 → 700点：**100〜150時間**
- 700点 → 800点：**200〜300時間**

これを1日30分に換算すると、半年〜1年以上かかります。**継続するシステム** を作ることが最重要です。

### 継続のための3つの仕組み

1. **毎朝5分のフラッシュカード復習**：起床後にスマホで SRS 単語確認。朝の脳は記憶定着に効果的。

2. **通勤・通学でのリスニング練習**：電車の中で TOEIC 公式問題集の音声を流しながら、Loop Vocabulary で今日の単語を確認。

3. **週次の弱点分析**：週に1回、ダッシュボードの正答率を確認し、苦手単語を集中補強する。

---

## TOEICと他の資格との比較

| 試験 | 求められる語彙の特徴 |
|---|---|
| TOEIC | ビジネス・日常の実用英語。文脈推測力が重要 |
| 英検2級 | 社会問題・環境・医療。フォーマルな表現が多い |
| IELTS | アカデミック英語。論述・学術語彙が重要 |
| 大学受験 | 長文読解・語彙問題。頻出度ランクが明確 |

---

## まとめ

TOEICスコアアップの本質は「ビジネス文脈で使われる単語を素早く認識する力」です。SRS で記憶を定着させ、AI 解説でコロケーションと使い方を深く理解することで、リーディングの速度と正確さが上がります。

Loop Vocabulary で今日から単語帳を作り、毎日の SRS 学習をルーティン化しましょう。
    `,
  },
};

export async function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) return {};
  return {
    title: `${article.title} | Loop Vocabulary`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.published,
    },
  };
}

function renderContent(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  const flushTable = (key: string) => {
    if (tableRows.length < 2) { tableRows = []; return; }
    const [headers, , ...rows]: string[] = tableRows;
    elements.push(
      <div key={key} className="overflow-x-auto my-4">
        <table className="w-full text-sm border border-navy-200 rounded-xl overflow-hidden">
          <thead className="bg-navy-50">
            <tr>
              {headers.split("|").filter(Boolean).map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-navy-700 border-b border-navy-200">{h.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-navy-100 last:border-0">
                {row.split("|").filter(Boolean).map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-navy-600">{cell.trim()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, i) => {
    const key = String(i);
    if (line.startsWith("|")) {
      inTable = true;
      tableRows.push(line);
      return;
    }
    if (inTable) {
      flushTable(key);
      inTable = false;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={key} className="text-xl font-black text-navy-800 mt-8 mb-3 leading-snug">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={key} className="text-base font-bold text-navy-800 mt-5 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={key} className="my-6 border-navy-100" />);
    } else if (line.startsWith("- ")) {
      elements.push(<li key={key} className="text-navy-700 text-sm leading-relaxed ml-4 list-disc">{renderInline(line.slice(2))}</li>);
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="h-2" />);
    } else {
      elements.push(<p key={key} className="text-navy-700 text-sm leading-relaxed">{renderInline(line)}</p>);
    }
  });
  if (inTable) flushTable("end");
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-bold text-navy-900">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} className="bg-navy-50 border border-navy-200 rounded px-1 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    }
    return p;
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) notFound();

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-10 pb-14 text-white">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors">← ガイド一覧</Link>
          <div className="mt-3 inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold">
            {article.tag}
          </div>
          <h1 className="text-2xl font-black leading-tight mt-2">{article.title}</h1>
          <p className="mt-2 text-sm text-navy-300">{article.description}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4">
        {/* 本文カード */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-6">
          {renderContent(article.content)}
        </div>

        {/* CTA */}
        <div className="mt-6 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary で学習を始める</div>
          <p className="text-sm text-navy-300 mb-4">忘却曲線・SRS・AI解説を組み合わせた英単語学習アプリ</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* 関連記事 */}
        <div className="mt-6">
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {Object.entries(ARTICLES)
              .filter(([s]) => s !== slug)
              .map(([s, a]) => (
                <Link key={s} href={`/guide/${s}`} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                  <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{a.tag}</div>
                  <div className="text-sm font-semibold text-navy-800">{a.title}</div>
                </Link>
              ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
