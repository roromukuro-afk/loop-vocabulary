# PROJECT_CONTEXT — Loop Vocabulary

> このファイルはセッション間引き継ぎ用の「不変に近い前提知識」をまとめたもの。
> 変化する作業状況は `WORK_HISTORY.md` / `HANDOFF.md` を参照。
> 最終更新: 2026-07-01

## 1. アプリ概要

**Loop Vocabulary** = 忘却曲線（SRS / 間隔反復）で英単語を「本当に覚える」ための英単語学習アプリ。

- コンセプト: 「調べた英語を本当に覚える」。辞書検索・単語帳・忘却曲線復習・小テストで学習を回す。
- ターゲット: 中学〜大学受験、英検、TOEIC など日本語話者の英語学習者。
- 収益モデル: 無料（広告表示 = Google AdSense）＋ 有料プラン（広告非表示）＋ Amazon アフィリエイト（書籍紹介）。

## 2. 技術スタック

- フレームワーク: Next.js（App Router）/ TypeScript
- DB / 認証: Supabase（Postgres + Auth）
- 配信: Vercel（本番ドメイン想定 `https://loop-vocabulary.app`、`NEXT_PUBLIC_SITE_URL` で切替）
- PWA: manifest / offline cache / push 対応済み
- モバイル: Capacitor（android / ios / mobile-shell あり。ストア公開準備中）
- 計測: Google Analytics（`NEXT_PUBLIC_GA_ID`）/ Microsoft Clarity（`NEXT_PUBLIC_CLARITY_ID`）/ AdSense（`NEXT_PUBLIC_ADSENSE_CLIENT`）
- AI: Anthropic Claude API（AI解説・コアイメージ・単語帳自動生成スクリプト）

- リポジトリ: `github.com/roromukuro-afk/loop-vocabulary`（branch: `main`）
- ローカル: `C:\Users\rorom\loop_vocabulary`
- package: `loop-vocabulary` v0.1.0

## 3. 主要ディレクトリ / ルート

| ルート | 役割 | 認証 |
|---|---|---|
| `/` (`src/app/page.tsx`) | ランディング（JSON-LD, FAQ 構造化データ） | 不要 |
| `/dictionary` | 辞書検索（許諾済み公開教材＋自分の登録単語） | **現状ログイン必須** |
| `/materials`, `/materials/[id]` | 教材・単語帳一覧／詳細 | **閲覧は不要化済み**（インポートは要ログイン） |
| `/road` | 学習ロード（6レベル・17教材） | 要ログイン |
| `/dashboard` | ダッシュボード（進捗・ミッション・カレンダー） | 要ログイン |
| `/guide`, `/guide/[slug]` | SEO 記事群（学習法・単語帳比較・英検 等） | 不要 |
| `/grammar`, `/grammar/[slug]` | 英文法レッスン（新機能） | 不要 |
| `/faq`, `/premium`, `/contact`, `/test`… | 補助ページ | 一部不要 |

- 教材ID体系: `00000000-0000-0000-0000-0000000000XX` 形式の固定UUIDを多用（road / GoalProgress / guide CTA が同じIDを参照）。一部は実UUID（例: 英検2級必須単語 `f2661c18-...`）。
- `materials.is_public = true` の教材のみ sitemap / 未ログイン閲覧の対象。

## 4. Supabase 主要テーブル（コードから確認できる範囲）

- `materials` — 公開教材（`id, title, level, exam_type, description, is_public, created_at`）
- `material_words` 相当（`get_material_word_counts` RPC で語数集計）
- `words` — ユーザーの学習単語（`user_id, material_id, mastery, is_weak`）
- `word_books` — ユーザーの単語帳（`user_id, source_material_id, id`）
- `profiles` — ユーザープロフィール（`id, exam_goal` ほか）
- クライアント: `@/lib/supabase/server`（RLS準拠）/ `@/lib/supabase/admin`（service role・sitemap や metadata 用）/ `@/lib/supabase/requireUser`（要ログインページ用ラッパ）

## 5. パーソナライズの鍵: `exam_goal`

`profiles.exam_goal` は2系統の値が混在しうるため、正規化ロジックを各所に持つ:

- Onboarding 短縮コード: `university` / `eiken` / `toeic` / `daily` / `review` / `other`
- ExamCountdown が保存する日本語文字列: 例「英検準2級」「TOEIC」「大学受験」など

→ `road/page.tsx` と `components/dashboard/GoalProgress.tsx` に、短縮コードと日本語文字列の両対応 `resolveCategory` 相当ロジックがある（重複実装。将来共通化候補）。

## 6. SEO / 信頼性の基本方針

- 公開して価値のあるページ（教材・記事・文法）は**ログイン不要でインデックスさせる**。
- 構造化データ（JSON-LD）で Organization / WebSite / FAQ / 記事を明示。
- `sitemap.ts` は動的生成（公開教材ID・guideスラッグ・文法レッスンを網羅）。
- 収益は広告 + Amazon アフィリエイト（`@/components/affiliate/AmazonBook`、ASIN指定）。

## 7. 運用スクリプト

- `scripts/generate-materials.mjs` — Claude API で単語リスト生成 → Supabase 直接投入（新規教材追加用）。
- `scripts/fill-empty-materials.mjs` — 0語・低語数教材の語彙補完用。
- どちらも `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` を使用。**ビルドには非関与のローカル運用ツール**。
