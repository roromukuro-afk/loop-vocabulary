# PHASE2_DESIGN — Loop Vocabulary 大型機能 設計書（実装前レビュー用）

> Phase 1（SEO・信頼性・登録不要辞書）は 2026-07-01 に本番反映済み（commit `f692e53`）。
> 本書は Phase 2 の3大機能の設計。**オーナー確認後に実装**する。現時点で実装コードは書かない。
> 最終更新: 2026-07-01

推奨実装順：**C（PDF強化）→ A（動的復習）→ B（先生向け管理）**
（DB影響と実装リスクが小さい順。C は新スキーマ不要、B は新スキーマ＋プライバシー設計で最重量）

---

## A. 復習アルゴリズムの動的化

### 現状
- `src/lib/srs/index.ts`：streak ベースの**固定間隔** `[1, 3, 7, 14, 30]` 日。
- 入力は `is_correct`（正誤2値）と `is_weak` のみ。単語ごとの「難しさ」を反映できない。
- `words` テーブルに `mastery(0-100) / streak / correct_count / wrong_count / next_review_at / last_studied_at / is_weak` を保持。

### 目的
自己評価（もう一度／難しい／普通／簡単）と正答率に応じて、単語ごとに復習間隔が動的に伸縮するようにする（SM-2 簡易版）。

### DB 設計（`words` への**追加のみ**・後方互換）
```sql
-- 009_srs_dynamic.sql
alter table public.words
  add column if not exists ease_factor real not null default 2.5,   -- 難易度係数 1.3〜2.8
  add column if not exists interval_days real not null default 0;    -- 直近の間隔（日）
-- streak / mastery は既存を継続利用。既存行は default で埋まり、初回レビューから新ロジックに乗る。
```

### ロジック設計（`applySrs` を拡張）
- 入力に `rating: "again" | "hard" | "good" | "easy"` を追加（`is_correct` は後方互換で `again=false, その他=true` に写像）。
- SM-2 簡易版：
  - `again`：interval=翌日、ease -= 0.20、streak=0、is_weak=true、mastery -8
  - `hard` ：interval = max(1, prev*1.2)、ease -= 0.15、mastery +4
  - `good` ：interval = max(1, prev*ease)、streak+1、mastery +12
  - `easy` ：interval = max(2, prev*ease*1.3)、ease += 0.15、mastery +16
  - ease は 1.3〜2.8 でクランプ。interval 上限（例 180日）を設ける。
- 既存の固定間隔関数 `nextInterval` は残し、**フィーチャーフラグ**（`profiles.srs_mode` or env）で新旧切替可能に。

### 画面設計
- **フラッシュカード復習（/review 系）**：裏面表示後に4ボタン（もう一度／難しい／普通／簡単）。各ボタンに次回間隔プレビュー（「+3日」等）。
- **4択・入力テスト**：正誤を自動で `good`/`again` に写像（UI変更は最小）。任意で「簡単」ショートカットを追加検討。

### 実装手順
1. マイグレーション `009_srs_dynamic.sql` 追加・適用。
2. `src/lib/srs/index.ts` に `applySrsV2(rating, ease, interval, streak, is_weak)` を追加（既存 `applySrs` は保持）。
3. `src/lib/srs/saveResult.ts` を rating 対応に拡張（呼び出し側から rating を受ける）。
4. 復習UI（フラッシュカード）に評価ボタン＋間隔プレビューを追加。
5. フラグで段階ロールアウト → 問題なければ既定化。

### リスク
- **既存ユーザーのスケジュール変化**：切替時に全単語の間隔が変わる。→ 既存 `next_review_at` は保持し、次回レビュー時から新ロジック適用（一括再計算しない）。
- 評価が主観的で乱れやすい → 4択/入力は自動写像で担保、手動評価はフラッシュカードのみ。
- 工数感：中（1〜2日）。DBは追加のみで低リスク。

---

## B. 先生向け進捗管理（塾・家庭教師）

### 現状
- ユーザーは個人単位のみ。教師-生徒の関係・クラスの概念が無い。
- 生徒データは `words` / `daily_stats` に個人保持、RLS は本人のみ。

### 目的
先生が担当生徒の **学習日数／学習語数／正答率／苦手単語／復習実施状況** を一覧で把握できる管理画面。

### DB 設計（新規テーブル＋RLS）
```sql
-- 010_teacher.sql
alter table public.profiles
  add column if not exists role text not null default 'student';  -- 'student' | 'teacher'

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  invite_code text not null unique,          -- 生徒参加用（短いランダム）
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  consent boolean not null default false,    -- 生徒が学習状況の共有に同意
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
```
- **RLS 方針（プライバシー最優先）**：
  - 先生は「自分の class に属し `consent=true` の生徒」の集計のみ閲覧可。
  - 生徒データ本体（`words` 等）は直接開示せず、**集計ビュー/RPC 経由**で必要指標だけ返す（生の単語リストは苦手単語トップNのみ等に限定）。
  - 生徒はいつでも参加解除・同意撤回可能。

### 画面設計
- `/teacher`：クラス一覧＋作成、招待コード表示。
- `/teacher/[classId]`：生徒ロスター表（学習日数・累計語数・平均正答率・苦手数・最終学習日・今週の復習実施回数）。行クリックで生徒詳細（苦手単語トップ20、学習カレンダー）。
- `/join/[code]`：生徒がコードで参加＋共有同意のオンボーディング。
- 先生機能は **有料（塾向けプラン）** を想定（課金設計は別途）。

### 実装手順
1. マイグレーション `010_teacher.sql`＋RLS ポリシー＋集計RPC（`get_class_progress(class_id)`）。
2. ロール判定・`/teacher` ルートのガード。
3. クラス作成／招待コード発行／参加フロー（`/join/[code]`＋同意）。
4. ロスター集計RPC → 一覧UI。
5. 生徒詳細（苦手トップN・カレンダー）。
6. 課金ゲート（塾プラン）連携。

### リスク
- **個人情報・同意**：未成年含む生徒データ。明示同意・撤回・最小開示を徹底（要利用規約/プライバシー改訂）。
- RLS 設計ミスは情報漏えい直結 → 集計RPC＋厳格ポリシー＋テスト必須。
- 集計クエリのスケール（多人数クラス）→ 事前集計 or インデックス設計。
- 工数感：大（1〜2週間＋法務確認）。**MVPを小さく**（招待コード制・読み取り専用ロスター・基本5指標）から。

---

## C. PDFテストのカスタマイズ（最優先・低リスク）

### 現状（`src/app/pdf/PdfTestBuilder.tsx`・HTML印刷方式）
**既に実装済み**：出題方向（英→日/日→英）、出題形式（記述/選択）、フィルタ（全て/苦手のみ/新規）、問題数指定、シャッフル（`sample()`）、解答つき生成、Free回数制限。

### 目的（不足分のみ追加）
ユーザー要望のうち未実装は主に2点：
1. **段組変更**（1列/2列レイアウト）
2. **解答用紙の分離**（問題と解答を別ページ/別シートに完全分割）
（＋任意：出題設定のプリセット保存、フォントサイズ、ヘッダー（学校名/日付/氏名欄））

### DB 設計
- 原則不要（クライアント生成）。プリセット保存を入れる場合のみ `pdf_presets(user_id, name, config jsonb)` を追加。

### 画面/実装設計
- `PdfTestBuilder` に state 追加：`columns: 1 | 2`、`answerSheet: "inline" | "separate"`、`fontSize`、`headerFields`（氏名/日付/点数欄）。
- HTML 印刷テンプレートを CSS `column-count` で段組対応、`page-break-before` で解答ページ分離。
- 解答分離時：本体は問題のみ→改ページ→「解答」セクション。

### 実装手順
1. `PdfTestBuilder` に段組・解答分離・ヘッダー欄のUIオプション追加。
2. 印刷テンプレート（HTML/CSS）を段組＆改ページ対応に改修。
3. （任意）プリセット保存（`pdf_presets`）。
4. 印刷プレビューで各組合せを実機確認。

### リスク
- 段組×改ページの印刷崩れ（ブラウザ差）→ 主要ブラウザで検証。
- jsPDF ではなく HTML 印刷方式のため日本語フォントは安全（現行踏襲）。
- 工数感：小〜中（0.5〜1日）。新スキーマ不要（プリセット除く）。**Phase 2 の着手はここから推奨。**

---

## 全体の推奨ロードマップ
1. **C（PDF段組＋解答分離）** — 低リスク・教育現場価値が高く即効性あり。
2. **A（動的復習）** — コア学習体験の改善。DBは追加のみ。フラグで安全にロールアウト。
3. **B（先生向け管理）** — 最重量。法務・RLS・課金設計を伴うため MVP を小さく切って段階実装。

各機能の着手前に、この設計でOKか／MVP範囲・課金方針・プライバシー方針をオーナーと確定してから実装する。
