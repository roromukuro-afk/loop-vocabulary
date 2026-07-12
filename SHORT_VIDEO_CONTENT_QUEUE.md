# SHORT_VIDEO_CONTENT_QUEUE — 初回30本 投稿台本キュー

作成日: 2026-07-13
ステータス: 台本のみ。**自動投稿・自動生成は行わない**（`SHORT_VIDEO_GROWTH_PLAN.md`参照）。
完全なデータは `src/data/shortVideos.ts`（30件、型付き）を参照。このドキュメントは
人間が撮影・投稿の優先順位を判断するための一覧。

## 内訳（30本）

| 型 | 本数 | ID |
|---|---|---|
| 英単語クイズ型 | 10 | sv-01〜sv-10 |
| 似た単語比較型 | 5 | sv-11〜sv-15 |
| 英検対策型 | 4 | sv-16〜sv-19 |
| TOEIC対策型 | 4 | sv-20〜sv-23 |
| 受験生あるある型 | 3 | sv-24〜sv-26 |
| 塾講師向け小テスト型 | 2 | sv-27〜sv-28 |
| 語源解説型 | 2 | sv-29〜sv-30 |

単語系の動画(クイズ・比較・語源)はすべて`src/lib/dictionaryWords/pilotWords.ts`の
実データ（意味・例文・ニュアンス・語源）をそのまま引用しており、事実と異なる説明や
架空の実績は含まない。

## 一覧

| ID | 型 | タイトル | 推奨尺 | 投稿先 |
|---|---|---|---|---|
| sv-01 | クイズ | "significant"の意味、パッと分かる？ | 15-20秒 | TikTok / Shorts / Reels |
| sv-02 | クイズ | "alleviate"の意味、パッと分かる？（英検準1級レベル） | 15-20秒 | TikTok / Shorts |
| sv-03 | クイズ | TOEICで見かける"subsidiary"の意味は？ | 15-20秒 | TikTok / Shorts / Reels |
| sv-04 | クイズ | "ubiquitous"の意味、パッと分かる？（TOEIC900点レベル） | 15-20秒 | TikTok / Shorts |
| sv-05 | クイズ | "ambiguous"の意味、パッと分かる？（大学受験難関） | 15-20秒 | TikTok / Shorts / Reels |
| sv-06 | クイズ | "phenomenon"の複数形、言える？ | 15秒 | TikTok / Shorts |
| sv-07 | クイズ | "decline"には2つの意味がある？ | 15-20秒 | TikTok / Shorts / Reels |
| sv-08 | クイズ | "artificial"の意味、パッと分かる？ | 15秒 | TikTok / Shorts |
| sv-09 | クイズ | "consider"の後は不定詞？動名詞？ | 15秒 | TikTok / Shorts / Reels |
| sv-10 | クイズ | "require"、needと何が違う？ | 15-20秒 | TikTok / Shorts |
| sv-11 | 比較 | "improve" vs "enhance" vs "upgrade"の使い分け | 20-25秒 | TikTok / Shorts / Reels |
| sv-12 | 比較 | "affect" vs "effect"の使い分け | 15-20秒 | TikTok / Shorts / Reels |
| sv-13 | 比較 | "issue" vs "problem" vs "concern"の使い分け | 20-25秒 | TikTok / Shorts |
| sv-14 | 比較 | "assess" vs "evaluate"の使い分け | 15-20秒 | TikTok / Shorts |
| sv-15 | 比較 | "adapt" vs "adopt"、スペル似てて危険 | 15秒 | TikTok / Shorts / Reels |
| sv-16 | 英検 | 英検2級 頻出単語「authority」の意味は？ | 15-20秒 | TikTok / Shorts |
| sv-17 | 英検 | 英検準1級 頻出単語「comprehensive」の意味は？ | 15-20秒 | TikTok / Shorts |
| sv-18 | 英検 | 英検の長文でよく出る「consequence」の意味は？ | 15-20秒 | TikTok / Shorts / Reels |
| sv-19 | 英検 | 英検ライティングで使える「advocate」の使い方 | 20秒 | TikTok / Shorts |
| sv-20 | TOEIC | TOEIC Part5頻出「confirm」の使い方 | 15-20秒 | TikTok / Shorts |
| sv-21 | TOEIC | TOEICのビジネス文書頻出「allocate」の意味は？ | 15-20秒 | TikTok / Shorts / Reels |
| sv-22 | TOEIC | TOEICグラフ問題で使う「decline」の意味は？ | 15秒 | TikTok / Shorts |
| sv-23 | TOEIC | TOEIC経済ニュースで頻出「inflation」の意味は？ | 15-20秒 | TikTok / Shorts |
| sv-24 | あるある | 単語帳1周したのに、模試で忘れてる、あるある | 20-25秒 | TikTok / Shorts / Reels |
| sv-25 | あるある | 4択はできるのに英作文で単語が出てこない、あるある | 20秒 | TikTok / Shorts / Reels |
| sv-26 | あるある | 英単語は覚えたのに長文で意味が取れない、あるある | 20秒 | TikTok / Shorts |
| sv-27 | 塾講師 | 小テストのプリント作り、まだ手作業？ | 20-25秒 | TikTok / Shorts |
| sv-28 | 塾講師 | 苦手単語だけ絞って小テストを作る方法 | 20秒 | TikTok / Shorts / Reels |
| sv-29 | 語源 | "analyze"の語源、知ってる？ | 15-20秒 | TikTok / Shorts |
| sv-30 | 語源 | "convince"の語源、victoryと関係あるって知ってた？ | 15-20秒 | TikTok / Shorts / Reels |

## 各動画に含まれるフィールド（`src/data/shortVideos.ts`）

- `title` / `hook`（冒頭フック）/ `body`（本文）
- `targetWords`（出題単語・意味・例文。単語系動画のみ）
- `cta` / `postTo`（投稿先）/ `durationSec`（推奨尺）
- `screenLayout`（画面構成）/ `voiceoverScript`（音声読み上げ用テキスト）
- `hashtags`（ハッシュタグ案）

## 運用ルール（`SHORT_VIDEO_GROWTH_PLAN.md`と共通）

- 週2〜3本を目安に投稿。この30本で約10〜15週分のキューになる
- 撮影前に必ず`voiceoverScript`の内容が現在のサービス仕様と一致しているか確認する
  （単語の意味・例文は`pilotWords.ts`から引用しているため、単語データが更新された場合は
  台本側も見直すこと）
- スクリーン録画を使う動画（sv-27・sv-28）は、実ユーザーのデータではなくテスト用
  架空データで撮影する
- 自動投稿は行わない。下書き準備は可、公開前に必ず人間が確認する
