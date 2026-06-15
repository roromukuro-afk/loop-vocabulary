import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";

type Article = {
  title: string;
  description: string;
  tag: string;
  published: string;
  content: string;
};

type BookRec = { title: string; author: string; asin: string; price: string; label?: string };
const BOOKS: Record<string, BookRec[]> = {
  "daigaku-juken-tango": [
    { title: "ターゲット1900 6訂版", author: "旺文社", asin: "4010773634", price: "¥1,100", label: "大学受験最定番" },
    { title: "システム英単語 改訂新版", author: "霜康司・刀祢雅彦", asin: "4796111727", price: "¥1,210", label: "共通テスト〜早慶対応" },
    { title: "DUO 3.0", author: "鈴木陽一", asin: "4900790052", price: "¥1,430", label: "例文でセット暗記" },
    { title: "英単語の語源図鑑", author: "清水建二・すずきひろし", asin: "4046021969", price: "¥1,650", label: "語根で語彙爆増" },
  ],
  "chugaku-eigo-tango": [
    { title: "中学英単語1800 ターゲット", author: "旺文社", asin: "4010941847", price: "¥880", label: "中学必須単語の定番" },
    { title: "中学英語をもう一度ひとつひとつわかりやすく。", author: "学研プラス", asin: "4053037042", price: "¥1,320", label: "基礎固めにベスト" },
  ],
  "eiken-jun1-tango": [
    { title: "英検準1級 でる順パス単 5訂版", author: "旺文社", asin: "4010947500", price: "¥1,100", label: "準1級単語帳の王道" },
    { title: "英検準1級 過去6回全問題集", author: "旺文社", asin: "401094757X", price: "¥1,540", label: "本番形式で仕上げ" },
    { title: "英検準1級 二次試験・面接 完全予想問題", author: "旺文社", asin: "4010947705", price: "¥1,540", label: "面接対策も" },
  ],
  "eiken-conversation": [
    { title: "英会話フレーズ大特訓", author: "Phyllis Tanaka", asin: "4010910720", price: "¥1,540", label: "日常英会話の決定版" },
    { title: "DUO 3.0", author: "鈴木陽一", asin: "4900790052", price: "¥1,430", label: "フレーズで覚える" },
  ],
  "ielts-tango": [
    { title: "IELTS必須英単語3500", author: "旺文社", asin: "4010946032", price: "¥1,980", label: "IELTS語彙の定番" },
    { title: "Complete IELTS Bands 4-5 Student's Book with Answers", author: "Cambridge", asin: "0521179289", price: "¥3,800", label: "Band 5〜6目標" },
  ],
  "business-english-tango": [
    { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "ビジネス英語にも直結" },
    { title: "ビジネス英語パーフェクトフレーズ", author: "デイビッド・セイン", asin: "4797361581", price: "¥1,540", label: "メール・会議対応" },
  ],
  "toeic-tango": [
    { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "TOEIC単語帳の決定版" },
    { title: "TOEIC L&Rテスト 出る単特急 金のセンテンス", author: "TEX加藤", asin: "4023316075", price: "¥990", label: "例文で覚えるTOEIC語彙" },
    { title: "TOEIC L&R TEST 出る問 特急 パート5&6", author: "神崎正哉他", asin: "4023315087", price: "¥990", label: "Part5&6特訓" },
  ],
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

  "chugaku-eigo-tango": {
    title: "中学英語の単語を完璧に覚える方法【基礎固め完全版】",
    description: "高校受験・英検3級・日常会話の基礎となる中学英単語1,200語の効率的な覚え方を解説します。",
    tag: "中学英語",
    published: "2024-12-01",
    content: `
## 中学英語の単語を覚えることがなぜ重要か

中学英語の単語（約1,200語）は、高校英語・大学受験・英検・TOEICすべての **土台** となります。ここが曖昧なまま高校・大学の単語に進んでも、定着しません。

「英語が苦手」という人の多くは、中学単語が不完全なケースがほとんどです。

---

## 中学英語の頻出単語カテゴリ

### 基本動詞（最重要）

中学英語で最も大切なのは **基本動詞の使い方** です。

| 動詞 | 意味 | 例文ヒント |
|---|---|---|
| get | 得る・なる | get tired（疲れる） |
| take | 取る・かかる | take a bus（バスに乗る） |
| make | 作る・〜させる | make friends（友達を作る） |
| give | 与える | give up（諦める） |
| put | 置く | put on（着る） |

### 形容詞・副詞

| 単語 | 意味 |
|---|---|
| important | 重要な |
| difficult | 難しい |
| necessary | 必要な |
| suddenly | 突然 |
| carefully | 注意深く |

---

## 中学単語の効率的な覚え方

### 1. 品詞のセットで覚える

単語は単独ではなく、**品詞のセット** で覚えると記憶に残りやすいです。

- beauty（名詞）→ beautiful（形容詞）→ beautifully（副詞）
- health（名詞）→ healthy（形容詞）→ healthily（副詞）

### 2. 例文の中で覚える

丸暗記より例文の中で覚えるほうが長持ちします。Loop Vocabulary の AI解説機能で、中学レベルの例文を自動生成して確認しましょう。

### 3. 小テストで定着確認

単語を「知っている」と「書ける」は別です。Loop Vocabulary の **入力テスト** で、スペルまで書ける状態を目指しましょう。

---

## 高校受験・英検3級との対応

中学英語の語彙は以下の試験に直結します。

| 試験 | 必要な中学単語の割合 |
|---|---|
| 高校受験（公立） | 約80% |
| 英検3級 | 約90% |
| 英検準2級 | 約50% |

高校受験を控えている人は、中学単語を完璧にしてから高校単語に進むのが最も効率的です。

---

## 中学英語単語の学習スケジュール

| 期間 | 目標 | 1日の学習量 |
|---|---|---|
| 1ヶ月目 | 400語 | 15語/日 |
| 2ヶ月目 | 800語 | 15語/日（復習含む） |
| 3ヶ月目 | 1,200語完了 | 10語/日＋復習 |

SRS（忘却曲線復習）を使えば、3ヶ月で中学単語を完全習得できます。

---

## まとめ

中学英語単語の完全習得は「英語の土台作り」です。Loop Vocabulary で単語を登録し、忘却曲線に沿った自動復習で、確実に長期記憶に定着させましょう。

まずは無料で始めて、今日から1日15語の学習を始めてみましょう。
    `,
  },

  "eiken-conversation": {
    title: "英会話に効く英単語の覚え方【使える語彙を増やす】",
    description: "日常英会話・旅行英語・ビジネス会話で実際に使える単語の覚え方と、アウトプット練習法を解説します。",
    tag: "英会話",
    published: "2024-12-15",
    content: `
## 英会話に必要な単語は「教科書英語」と違う

英会話で使う語彙は、試験英語と重なる部分もありますが、**口語表現・フレーズ・感情表現** など特有の語彙があります。

テストで高得点でも英会話が苦手な人が多い理由：
- 知識として単語を知っているが、**瞬時に口から出てこない**
- 自然な口語表現（スラング・コロケーション）を知らない
- フレーズ単位で覚えていない

---

## 英会話頻出フレーズ・表現

### 相づち・返答

| 表現 | 使う場面 |
|---|---|
| That makes sense. | なるほど、理解した |
| Absolutely. | 全くその通り |
| No worries. | 大丈夫、気にしないで |
| Fair enough. | まあ、そうだね |
| I hear you. | おっしゃる通り |

### 気持ちを表す表現

| 単語・表現 | 意味 |
|---|---|
| thrilled | 大興奮している |
| overwhelmed | 圧倒されている |
| relieved | ほっとした |
| frustrated | イライラしている |
| grateful | ありがたく思っている |

### 依頼・提案

| 表現 | 意味 |
|---|---|
| Could you...? | 〜していただけますか？ |
| Would you mind...? | 〜してもいいですか？ |
| How about...? | 〜はどうですか？ |
| Why don't we...? | 〜しませんか？ |

---

## 旅行英語の必須単語

旅行で使う単語は限られていますが、これを覚えるだけで大きく変わります。

**空港・交通**
- departure（出発）/ arrival（到着）/ gate（搭乗口）/ transit（乗り継ぎ）/ fare（運賃）

**ホテル**
- check-in / check-out / reservation（予約）/ vacancy（空室）/ concierge（コンシェルジュ）

**レストラン**
- menu / recommendation（おすすめ）/ allergy（アレルギー）/ bill / takeout

---

## 英会話に効く単語の覚え方

### フレーズ単位で登録する

単語単体ではなく、**よく使うフレーズごと** Loop Vocabulary に登録するのが英会話上達の近道です。

例：
- "make sense" → 「意味をなす・理解できる」
- "keep in touch" → 「連絡を取り合う」
- "look forward to" → 「楽しみにしている」

### AI解説で使い方を確認

Loop Vocabulary の AI解説機能で「どんな場面で使うか」「似た表現との違い」を確認することで、実際の会話で使えるようになります。

### 音声読み上げで発音を確認

英会話では発音が重要です。単語を登録したら必ず **音声読み上げボタン** で発音を確認しましょう。正しい発音を耳に慣らすことで、ネイティブの英語も聞き取りやすくなります。

---

## 英会話力を上げるための学習サイクル

1. **Input**：Loop Vocabulary で新しいフレーズ・単語を登録
2. **Review**：忘却曲線で自動復習→長期記憶へ
3. **Output**：覚えたフレーズを実際の会話・メモ・日記で使う
4. **Feedback**：間違えた表現を苦手リストで管理

---

## まとめ

英会話に効く語彙は、フレーズ単位・感情表現・口語表現など、教科書にない表現が多くあります。Loop Vocabulary に日常で出会った表現をどんどん登録し、SRS で定着させることで、実践的な英語力が身につきます。

まず旅行英語か日常会話フレーズから始めてみましょう。
    `,
  },

  "ielts-tango": {
    title: "IELTSの英単語学習法【アカデミック語彙を効率的に覚える】",
    description: "IELTS Academic/General の頻出語彙・AWL（アカデミック語彙リスト）の攻略法と、スコア帯別の学習戦略を解説します。",
    tag: "IELTS",
    published: "2025-01-05",
    content: `
## IELTSに必要な語彙の特徴

IELTS（International English Language Testing System）は、英国・オーストラリア・カナダ留学や就労ビザに必要な英語力試験です。

TOEICや英検と大きく異なる点：
- **アカデミック語彙**（学術論文・レポートで使う語彙）が中心
- 4技能（Reading / Listening / Writing / Speaking）すべてで語彙力が問われる
- 日本の英語教育では出てこない表現が多い

---

## AWL（Academic Word List）とは

IELTS対策で最重要なのが **AWL（Academic Word List）** です。学術文書で頻出する570語のリストで、IELTSのリーディング・ライティングに頻出します。

AWLの特徴：
- 日常会話ではあまり使わない「論文語」
- 同じ語根を持つ派生語が多い（analyze → analysis → analytical）
- 抽象概念を表す語が多い

---

## IELTSスコア帯別の必要語彙数

| スコア（Band） | 必要語彙数の目安 |
|---|---|
| Band 5〜5.5 | 4,000〜5,000語 |
| Band 6〜6.5 | 6,000〜7,000語 |
| Band 7〜7.5 | 9,000〜10,000語 |
| Band 8以上 | 12,000語以上 |

---

## IELTSで頻出するアカデミック単語

**分析・論述**
- analyze / evaluate / demonstrate / indicate / suggest / argue

**変化・影響**
- significant（重要な）/ considerable（かなりの）/ dramatic（劇的な）/ gradual（徐々の）

**比較・対比**
- whereas（〜である一方）/ nevertheless（それにもかかわらず）/ conversely（逆に）

**因果関係**
- consequently（結果として）/ therefore / thus / hence / as a result

**抽象概念**
- concept / framework / perspective / approach / aspect / factor

---

## IELTSライティングで差がつく語彙

Writingでは同じ単語の繰り返しを避け、言い換え表現を使うことが高得点のカギです。

| 基本語 | 言い換え（上級） |
|---|---|
| show | demonstrate / indicate / reveal |
| big | substantial / considerable / significant |
| problem | challenge / issue / concern |
| use | utilize / employ / implement |
| help | facilitate / assist / contribute to |

---

## Loop VocabularyでのIELTS対策

### AWL単語帳を作る

AWLの570語をカテゴリ別（Sublist 1〜10）に分けて単語帳を作成し、SRS で繰り返し復習します。

### プレミアムのCSVインポートを活用

AWLの単語リストをCSVでまとめて作成し、Loop Vocabulary にインポートすることで、効率よく570語を管理できます。

### AI解説でコロケーションを確認

IELTSでは単語の「組み合わせ（コロケーション）」が重要です。

例：「conduct research」は正しいが「make research」は間違い。AI解説でこうした使い方の違いを確認しましょう。

---

## IELTSに向けた学習スケジュール

| 現在のスコア | 目標 | 推奨学習期間 |
|---|---|---|
| Band 5 | Band 6 | 3〜4ヶ月 |
| Band 6 | Band 7 | 6〜9ヶ月 |
| Band 7 | Band 7.5 | 6ヶ月〜1年 |

毎日1時間の語彙学習（SRS）+ 週3回の過去問演習が最短ルートです。

---

## まとめ

IELTSの語彙学習は、AWLを中心としたアカデミック英語の習得が核心です。Loop Vocabulary でAWL単語帳を作り、SRS で定着させながら、AI解説でコロケーション・使い方を深く理解することで、スコアアップが実現できます。

まず無料プランで始めて、AWL Sublist 1（60語）から学習を開始しましょう。
    `,
  },

  "eiken-jun1-tango": {
    title: "英検準1級 単語の攻略法と学習ロードマップ",
    description: "英検準1級合格に必要な語彙数・頻出テーマ・学習スケジュールを徹底解説。2級合格後の次のステップとして。",
    tag: "英検準1級",
    published: "2024-11-01",
    content: `
## 英検準1級の難易度と必要な語彙数

英検準1級は「大学中級程度」の英語力を測る試験で、合格率は約15〜20%と難関です。必要な語彙数は **7,500〜9,000語** とされており、2級（5,000語）から大きくジャンプします。

語彙問題（大問1）は41問中25問を占め、**ここで高得点を取れるかどうかが合否を分けます**。

---

## 英検準1級の頻出テーマと重要単語

準1級の語彙問題は「抽象度の高い表現」が多く出題されます。日常会話では使わないが、論説文・ニュース記事では必須の単語が中心です。

**政治・社会**
- implement（実施する）/ advocate（提唱する）/ legislation（法律制定）/ sanction（制裁）

**経済・ビジネス**
- revenue（収益）/ fiscal（財政の）/ deficit（赤字）/ incentive（奨励策）

**科学・環境**
- sustainable（持続可能な）/ emit（排出する）/ biodiversity（生物多様性）/ deteriorate（悪化する）

**医療・福祉**
- chronic（慢性的な）/ alleviate（緩和する）/ susceptible（影響を受けやすい）/ resilient（回復力のある）

---

## 2級合格後から準1級までのロードマップ

### フェーズ1：語彙強化（3〜4ヶ月）

準1級の核心は語彙です。まず専用単語帳（「英検準1級でる順パス単」など）を使い、3,000〜4,000語を集中習得します。

Loop Vocabulary での学習法：
- 1日 **50語** を SRS で回す
- 間違えた単語は「苦手フラグ」で管理し、集中的に再出題
- AI解説で語源・類義語・使い方を深掘り

### フェーズ2：過去問演習（2〜3ヶ月）

語彙の土台ができたら過去問に取り組みます。

- 語彙問題：25問中20問以上を目標
- 長文読解：内容一致問題の精度を上げる
- 英作文（ライティング）：250語前後の意見文を書く練習

### フェーズ3：弱点補強・仕上げ（1ヶ月）

Loop Vocabulary の「苦手単語」機能で、繰り返し間違える単語を集中補強します。

---

## 準1級の語彙問題の解き方

準1級の語彙問題は「文脈から意味を推測する力」も求められます。

**解法のポイント：**
1. 選択肢の4語をすべて確認し、知らない語をメモ
2. 文の主語・動詞・目的語の関係から、入る品詞を確認
3. 同じ語根を持つ単語から意味を類推

例：「The policy was designed to **alleviate** poverty.」→「緩和する」が入ると推測

---

## 準1級合格に必要な勉強時間

英検2級合格者が準1級に合格するまでの目安：

| 週の学習時間 | 合格までの期間 |
|---|---|
| 週5時間 | 約12〜18ヶ月 |
| 週10時間 | 約6〜9ヶ月 |
| 週20時間 | 約3〜4ヶ月 |

「毎日コツコツ」が最も効果的です。Loop Vocabulary のストリーク機能で継続を可視化しましょう。

---

## まとめ

英検準1級合格のカギは **語彙力の圧倒的な底上げ** です。1日50語のSRS学習を継続し、AI解説で語の深い理解を積み重ねることで、合格に近づけます。

まずは無料プランで単語帳を作り、準1級頻出語の学習を今日から始めましょう。
    `,
  },

  "business-english-tango": {
    title: "ビジネス英語の必須単語300選と実践的な覚え方",
    description: "会議・メール・プレゼンで使えるビジネス英語の頻出単語と表現を厳選。TOEIC・英検との違いと実践活用法も解説。",
    tag: "ビジネス英語",
    published: "2024-11-15",
    content: `
## ビジネス英語単語が「普通の英語」と違う理由

ビジネス英語には、日常英語やテスト英語とは異なる **特有の語彙・表現・略語** が存在します。会議で"Let's circle back on this."と言われて固まった経験はありませんか？

ビジネス英語の特徴：
- **略語・バズワード**：KPI、ROI、B2B、synergy など
- **婉曲表現**：「却下する」を"decline to proceed"と言う
- **動詞の名詞化**：utilization（利用）、implementation（実施）

---

## シーン別・必須ビジネス英語単語

### 会議・ディスカッション

| 単語・表現 | 意味 |
|---|---|
| agenda | 議題・アジェンダ |
| minutes | 議事録 |
| follow up | フォローアップする |
| circle back | 後で再確認する |
| action item | 決定事項・タスク |
| deliverable | 成果物 |
| bottleneck | ボトルネック・障害 |

### メール・コミュニケーション

| 単語・表現 | 意味 |
|---|---|
| regarding | 〜について（件名に使う） |
| as per | 〜に従って |
| acknowledge | 確認・受領する |
| enclosed | 添付の・同封の |
| revert | 返信する（アジア英語） |
| cc / bcc | CC / BCC |

### プレゼン・提案

| 単語・表現 | 意味 |
|---|---|
| overview | 概要 |
| benchmark | 基準・目標値 |
| projection | 予測・見込み |
| stakeholder | 利害関係者 |
| scalable | スケーラブルな |
| pivot | 方向転換する |

---

## KPI・数値関連の重要単語

ビジネスでは数値を表す英語が頻出します。

- **revenue**（収益）vs **profit**（利益）：revenue は売上全体、profit はコスト差し引き後
- **gross**（総〜）vs **net**（純〜）：gross profit（粗利）、net profit（純利益）
- **forecast**（予測）vs **projection**（見込み）：forecast は過去データ基準、projection は仮定基準
- **YoY**（前年比）/ **QoQ**（前四半期比）/ **MoM**（前月比）

---

## ビジネスメールで差がつく動詞

単純な動詞をビジネス英語に格上げする表現集：

| 日常表現 | ビジネス英語 | ニュアンス |
|---|---|---|
| tell | inform / notify | フォーマル |
| need | require / necessitate | 書き言葉 |
| use | utilize / leverage | 積極的活用 |
| start | initiate / commence | 公式文書向け |
| end | conclude / terminate | 正式終了 |
| help | facilitate / assist | サポート |

---

## ビジネス英語の学習法

### 実務との組み合わせが最速

英単語帳だけでなく、実際のビジネス文書から単語を抽出するのが最も定着が早い方法です。

1. **仕事のメール・資料から単語を抽出** → Loop Vocabulary に登録
2. SRS で繰り返し出題し、スペルと意味を確実に覚える
3. AI解説でビジネス文脈での使い方を確認
4. 実際に自分のメール・資料で使ってみる

### Loop Vocabulary でのビジネス英語管理

- 単語帳を「会議用」「メール用」「財務用」に分けて管理
- CSV インポート（プレミアム）で、用語集・対訳表を一括取り込み
- 週1回「苦手単語」を集中復習して完全定着

---

## まとめ

ビジネス英語の語彙は、テスト英語と重なる部分もありますが、会議・メール・プレゼン特有の表現が多数あります。実務で使う単語を積極的に Loop Vocabulary に登録し、SRS で定着させることで、実践的な英語力が身につきます。

無料プランで今すぐビジネス英語の単語帳を作りましょう。
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

const SITE_URL = "https://loop-vocabulary.app";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "datePublished": article.published,
    "author": { "@type": "Organization", "name": "Loop Vocabulary" },
    "publisher": {
      "@type": "Organization",
      "name": "Loop Vocabulary",
      "url": SITE_URL,
    },
    "url": `${SITE_URL}/guide/${slug}`,
    "mainEntityOfPage": `${SITE_URL}/guide/${slug}`,
    "keywords": article.tag,
  };

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

        {/* Amazon アフィリエイト */}
        {BOOKS[slug] && (
          <AmazonBookSection
            books={BOOKS[slug]}
            heading="📚 あわせて読みたい参考書（Amazon）"
          />
        )}

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
