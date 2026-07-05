# Loop Vocabulary

**調べた英語を、覚える英語へ。覚えた英語を、使える英語へ。**

英単語を「調べる → 登録する → 分類する → 忘却曲線復習する → 4 択/入力テストする → AI 解説で理解する → 小テストを PDF 出力する」までを 1 つにまとめた総合英単語学習アプリ。Next.js + Supabase + Tailwind + PWA で構築。

スマホ片手操作・テンポ重視の UI を最優先に、将来的に React Native / Capacitor でスマホアプリ化し AdMob を載せられる構造にしています。

- **GitHub**: <https://github.com/roromukuro-afk/loop-vocabulary>
- **本番 URL**: <https://loop-vocabulary.app>

### 運用ドキュメント

- [RELEASE_NOTES.md](RELEASE_NOTES.md) — 直近リリースのまとめ・本番確認済み項目・ロールバック方法
- [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) — 日次/週次の監視項目、自動検証コマンド（`npm run test:e2e` 等）の運用タイミング
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) — Google Search Console 登録手順・sitemap送信・週次の見方
- [NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md) — 優先順位付きの次の改善候補
- [HANDOFF.md](HANDOFF.md) — 次セッションへの申し送り・現在ステータス
- [WORK_HISTORY.md](WORK_HISTORY.md) — 時系列の作業ログ

---

## 1. 機能

- Supabase Auth (Email + Password) によるユーザー登録/ログイン
- 自作 / 教材インポートの複数単語帳
- 単語ごとの 14 項目入力 (品詞・発音記号・例文・和訳・語源・ニュアンス・似た単語・反意語・派生語・熟語・タグ・重要度…)
- 辞書検索風 UI (公開教材 + 自分の単語) からワンタップで単語帳追加
- 忘却曲線復習 (1→3→7→14→30 日 / 不正解は翌日 / 苦手フラグ翌日)
- 爆速 4 択テスト (英→日 / 日→英)
- 入力テスト (Levenshtein 近似一致で「惜しい」表示)
- 苦手単語ページ (5 つの並び替え)
- 学習記録 + 30 日カレンダー + 連続学習日数
- 教材一覧 / 教材詳細 (レベル別・試験別・参考書別)
- AI 例文・解説 (現状はモック、1 日 5 回、リワード広告で追加可)
- 小テスト作成 → A4 印刷用 HTML → ブラウザの「PDF で保存」で PDF 化
- 広告コンポーネント 4 種 (Banner / Native / Rewarded / Interstitial) を差し替え可能設計で実装
- 管理画面: 教材 CRUD・許諾ステータス管理・公開切替・CSV/JSON インポート
- PWA (manifest / テーマカラー / ホーム画面追加対応)

---

## 2. 技術スタック

| 区分      | 採用                                          |
|----------|----------------------------------------------|
| Framework | Next.js 14 (App Router) / TypeScript        |
| UI        | Tailwind CSS / 自前コンポーネント              |
| 認証 / DB | Supabase Auth / Postgres + RLS               |
| PWA       | manifest.json + メタタグ                      |
| 広告      | Web: Google AdSense 実装済み（審査状況待ち）/ Native: AdMob 実装済み |
| AI        | モック (`/api/ai` を OpenAI/Anthropic に差し替え可) |
| デプロイ   | Vercel 想定                                   |

---

## 3. ローカル起動手順

```bash
# 1) 依存インストール
npm install

# 2) Supabase プロジェクト作成 → URL & anon key を取得
cp .env.local.example .env.local
# .env.local を編集:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=... (管理者作成・サーバ処理用)

# 3) Supabase SQL 実行 (Supabase Studio → SQL Editor で順番に)
#    supabase/schema.sql
#    supabase/rls.sql
#    supabase/seed.sql

# 4) 開発サーバ起動
npm run dev
# → http://localhost:3000
#   ※ 3000 が使用中なら自動で 3001/3002... にフォールバックします
```

### Supabase 未設定時の挙動

`.env.local` を作る前でも起動可能です。

- LP / `/login` / `/signup` / `/privacy` / `/terms` / `/premium` / `/setup` はそのまま表示されます
- 認証が必要なページ (`/dashboard`, `/wordbooks`, `/materials`, `/test/*`, `/review`, `/weak`, `/stats`, `/ai`, `/pdf`, `/settings`, `/admin/*`) は **自動で `/setup` にリダイレクト**され、設定手順が案内されます
- 環境変数を設定すれば、認証必須ページは `/login` にリダイレクトされ、ログイン後はダッシュボードに進めます

---

## 4. Supabase 設定手順 (本番チェックリスト)

### 4-1. プロジェクト作成 & SQL 投入

- [ ] <https://supabase.com> でプロジェクト作成 (リージョンは Tokyo / ap-northeast-1 推奨)
- [ ] Project Settings → API から `Project URL` と `anon public key` を取得
- [ ] (本番のみ) `service_role` key も取得し、Vercel 環境変数に **NEXT_PUBLIC_ なしで** 設定
- [ ] SQL Editor で **必ずこの順番** で実行
  1. `supabase/schema.sql` (テーブル定義 + `on_auth_user_created` トリガ)
  2. `supabase/rls.sql` (Row Level Security)
  3. `supabase/seed.sql` (初期 30 語の公開教材)
- [ ] (任意) `supabase/rls-check.sql` を SQL Editor で実行し、RLS が期待通り動いているかを確認 (各クエリの「期待結果」と一致すれば OK)

### 4-2. Authentication 設定

- [ ] Authentication → Providers → **Email** を有効化
- [ ] Confirm email
  - 開発: OFF (テストが楽)
  - 本番: ON (Production では必ず有効化)
- [ ] Authentication → URL Configuration で
  - `Site URL`: 本番 URL (例: `https://loop-vocab.vercel.app`)
  - `Redirect URLs`:
    - `http://localhost:3000/**`
    - `http://localhost:3001/**` (port フォールバック用)
    - `https://your-domain.vercel.app/**`
    - `https://*.vercel.app/**` (プレビューデプロイ用)

### 4-3. profiles 自動作成の確認

`schema.sql` 実行時に `on_auth_user_created` トリガが作成されます。動作確認:

1. アプリで signup → メール受信 → 認証
2. Supabase Studio → Table Editor → `profiles` を開き、新規行があるか確認
3. ない場合: SQL Editor で `select * from pg_trigger where tgname='on_auth_user_created';` を実行し、トリガが存在するか確認

### 4-4. 管理者化

```sql
update public.profiles set is_admin = true where email = 'admin@example.com';
```

実行後、アプリでログインし直すと `/admin` 配下が解放される。

### 4-5. RLS 確認 (本番投入前に必ず)

匿名ユーザーが他人のデータを読めないことを確認:

```sql
-- 1) anon ロールに切り替えて
set role anon;

-- 2) 他人の words が見えないことを確認 (0 行になるべき)
select count(*) from public.words;

-- 3) 公開教材は見えることを確認 (> 0 行)
select count(*) from public.materials where is_public = true and license_status = 'approved';

-- 4) ロールを戻す
reset role;
```

### 4-6. データバックアップ (本番運用開始後)

- [ ] Supabase → Database → Backups で日次バックアップが ON になっていることを確認 (Pro 以上のプラン推奨)
- [ ] 月 1 で `pg_dump` を手元に取得しておく運用を決める

---

## 5. Vercel デプロイ手順 (本番チェックリスト)

### 5-1. リポジトリ準備

- [ ] `git init` → GitHub にプライベートリポジトリ作成 → push
- [ ] `.env.local` は **絶対にコミットしない** (`.gitignore` に既に登録済み)
- [ ] `.env.local.example` だけリポジトリに含める

### 5-2. Vercel プロジェクト作成

- [ ] Vercel ダッシュボードから "Add New → Project" で GitHub リポジトリを Import
- [ ] Framework Preset: Next.js (自動検出)
- [ ] Build Command: `npm run build` (デフォルト)
- [ ] Install Command: `npm install` (デフォルト)
- [ ] Output Directory: `.next` (デフォルト)
- [ ] Root Directory: 空 (リポジトリ直下)

### 5-3. Environment Variables 設定

Vercel プロジェクトの Settings → Environment Variables で以下を **Production / Preview / Development の全環境** に設定:

| 変数名                              | 値の例                                  |
|------------------------------------|---------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`         | `https://xxx.supabase.co`             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | `eyJhbGciOi...` (anon public key)     |
| `NEXT_PUBLIC_SITE_URL`             | `https://your-domain.vercel.app`      |
| `NEXT_PUBLIC_ADS_ENABLED`          | `true` (オフなら `false`)              |
| `SUPABASE_SERVICE_ROLE_KEY`        | service_role key (サーバ専用、将来用)  |
| `ADMIN_EMAILS`                     | `admin@example.com` (将来用)          |

### 5-4. デプロイ

- [ ] "Deploy" 押下 → ビルドが緑になる
- [ ] 本番 URL を開き、LP → signup → ログイン → ダッシュボードまで通せる
- [ ] Supabase の Site URL / Redirect URLs を本番 URL に更新 (4-2 参照)
- [ ] 設定後、本番でもう一度 signup → メール認証 → ダッシュボードまで通せる

### 5-5. 本番運用後

- [ ] Vercel → Analytics を有効化 (任意)
- [ ] Vercel → Speed Insights を有効化 (任意)
- [ ] Supabase の DB 使用量・行数を週次でチェック
- [ ] Sentry 等エラートラッキングの追加検討

---

## 6. 教材データ CSV / JSON インポート手順

1. 管理者で `/admin/materials` から教材を 1 つ作成 (例: 「ターゲット 1900」)
2. その教材の `license_status` を `approved`、`is_public` を `公開` に
3. `/admin/import` で教材を選択し、CSV または JSON をペースト → 「インポート実行」

### CSV 形式

```csv
word,meaning,pos,example,example_ja,importance,frequency,level,chapter,unit,page,display_order
provide,提供する,動詞,The school provides...,その学校は...,5,4,高校基礎,Ch1,U1,12,1
develop,発達する,動詞,...,...,5,4,高校基礎,Ch1,U1,13,2
```

必須カラム: `word, meaning`。他は任意。

### JSON 形式

```json
[
  { "word": "provide", "meaning": "提供する", "pos": "動詞", "example": "...", "example_ja": "...", "importance": 5 },
  { "word": "develop", "meaning": "発達する" }
]
```

**重要**: 著作権上問題のあるデータを取り込まないこと。許諾済みデータのみ `license_status='approved'` & `is_public=true` で公開すること。

### プリセット教材パック（自社オリジナル・小規模・高品質）の追加手順

上記のCSV/JSON手動インポートとは別に、`license_status='original'`（自社オリジナル作成）の
小規模パックを型安全・品質チェック付きで管理する仕組みがある（2026-07-02追加）。

1. `src/lib/materials/types.ts` の `PresetMaterialPack` 型に沿って `src/data/presets/*.ts` に
   新しいパック（教材ID・タイトル・レベル・学年・目的・推奨期間・1日目安語数・タグ・単語配列）を追加
2. `src/data/presets/index.ts` の `PRESET_PACKS` 配列に追加
3. `npm run validate:materials` で静的品質チェック（重複・空欄・pos/難易度の範囲・タグを検証）
4. `npm run test:materials` でDB投入（冪等）＋インポート後のSRS/PDF互換性を確認
5. `npm run test:materials:e2e` で実ブラウザ（Playwright）によるインポート導線の検証
   （未ログイン時CTA・インポート→単語帳作成→SRS既定値→PDF選択肢反映→再インポート時の重複防止）
6. 対象学年・目的・タグ等の表示メタデータは `src/lib/materials/presetMeta.ts` に自動反映される
   （DBスキーマ変更不要）

既存教材（新規パック含むDB上の全教材）の品質状況は `npm run audit:materials`（読み取り専用）で
[MATERIALS_AUDIT.md](MATERIALS_AUDIT.md) を再生成できる。

**既存31教材への表示メタデータ拡張（2026-07-04）**: 新規パック以外の既存31教材（`words`本体
を持たない）にも同じ`grade`/`purpose`/`recommendedWeeks`/`dailyWordTarget`/`category`/`tags`を
表示したい場合は、`src/lib/materials/existingMaterialMeta.ts`に教材ID(`materials.id`)をキーに
した`PresetMeta`エントリを追加する（`PresetMaterialPack`のような単語データは不要）。
`presetMeta.ts`が新規パック由来のメタデータと自動マージする（DBスキーマ変更不要）。

**注意（3スクリプトの二重管理）**: `scripts/materials/{validate-materials,test-materials,
seed-preset-materials}.mjs`はいずれも対象パックを`import`文と`PRESET_PACKS`配列の
ハードコードで管理している（`src/data/presets/index.ts`の`PRESET_PACKS`を動的に
参照する構造ではない）。新しいパックを追加した際は、上記手順1・2に加えてこの3ファイルにも
同じパターンでimportと配列追加が必要。

詳細な設計判断は [WORK_HISTORY.md](WORK_HISTORY.md) の「2026-07-02 プリセット教材パック基盤の構築」
「2026-07-02 既存教材の品質監査基盤 + 教材インポートE2E追加」
「2026-07-04 既存31教材へのpresetMeta拡張」
「2026-07-04 教材パックの追加拡充 Part2」参照。

---

## 7. 広告実装 (Web: AdSense / Native: AdMob、2026-07-04時点で実装済み)

**2026-07-04追記**: 以下のコンポーネント名には歴史的経緯で "Placeholder" が残っているが、
現在はダミー実装ではなく実際の広告ネットワークに接続済み。詳細は
[ADSENSE_SETUP.md](ADSENSE_SETUP.md) 参照。

広告コンポーネントは [`src/components/ads/AdComponents.tsx`](src/components/ads/AdComponents.tsx)
（`src/components/ads/AppAds.tsx`・[`src/components/ads/AdSense.tsx`](src/components/ads/AdSense.tsx)への
互換レイヤー）に集約されています。

| コンポーネント            | Web (ブラウザ)                          | Native (Capacitorアプリ) |
|--------------------------|------------------------------------------|---------------------------|
| `BannerAdPlaceholder`    | `AdSenseBanner`（実AdSense、要スロットID設定） | AdMob Adaptive Banner（実装済み） |
| `NativeAdCard`           | `AdSenseInFeed`（実AdSense、要スロットID設定） | AdMob Native Advanced（実装済み） |
| `RewardedAdButton`       | プレースホルダのまま（Web版はリワード広告非対応） | AdMob Rewarded — 完了コールバックで `onReward` |
| `useInterstitialAdTrigger` | no-op（Web版はインタースティシャル非対応） | 画面遷移時に AdMob Interstitial |

Web版のAdSense本体（`ca-pub-...`・`adsbygoogle.js`・自動広告）は
`NEXT_PUBLIC_ADSENSE_CLIENT`環境変数が設定済みで本番稼働中。ただし個別の広告ユニット
（`NEXT_PUBLIC_ADSENSE_SLOT_BANNER`/`_RECTANGLE`/`_INFEED`）は未設定のため、
AdSense管理画面で審査完了・広告ユニット発行後にVercelの環境変数へ設定する必要がある
（詳細は[ADSENSE_SETUP.md](ADSENSE_SETUP.md)参照）。

### 表示ポリシー (実装に組み込み済み)

- **テスト中・復習中・入力テスト中は広告を表示しない** (これらの画面で `<Banner...>` 等を一切呼ばない)
- 「広告 / Ad」ラベルを必ず明示 (`AdLabel`)
- 誤タップを誘うレイアウト・配色は禁止 (枠と本文を明確に分離、配色も淡色)
- 広告 ID / 配信先は `NEXT_PUBLIC_ADMOB_*` 環境変数で管理
- `NEXT_PUBLIC_ADS_ENABLED=false` で全広告を OFF 可能 (Premium 判定時に動的 OFF も可能)

### 広告枠の現在位置

- ダッシュボード末尾 (Banner)
- ダッシュボード中央 (Native)
- 単語帳一覧の 3 件目下 (Native)
- 単語帳詳細・苦手単語・復習トップ・設定・教材詳細・統計 (Banner)
- **テスト/復習プレイ中は無し**

### リワード広告の用途

- AI 例文生成回数を +1 (実装済み: `reward_tickets` テーブルに `kind='ai'` で付与)
- (TODO) 復習上限の追加 / 苦手単語テストの追加 / PDF 出力回数の追加

---

## 8. SRS (忘却曲線) ロジック

[`src/lib/srs/index.ts`](src/lib/srs/index.ts) の `applySrs()` で完結しています。後から日数間隔やボーナス計算を調整しやすい構造です。

初期ルール:

| streak | 次回復習 |
|--------|---------|
| 1      | 1 日後  |
| 2      | 3 日後  |
| 3      | 7 日後  |
| 4      | 14 日後 |
| 5+     | 30 日後 |
| 不正解  | 翌日 / streak リセット / 苦手 |
| 苦手↑正解 | 翌日 (3 連続正解で苦手解除) |

---

## 9. ディレクトリ構成

```
loop_vocabulary/
├── public/
│   ├── manifest.json
│   └── icons/                 # PWA アイコン (実画像は別途配置)
├── supabase/
│   ├── schema.sql             # テーブル定義
│   ├── rls.sql                # Row Level Security
│   └── seed.sql               # オリジナル基本英単語 30 語
├── src/
│   ├── app/                   # App Router ページ群 (28 画面)
│   │   ├── page.tsx            # LP
│   │   ├── login/ signup/
│   │   ├── dashboard/
│   │   ├── wordbooks/ [id]/ add/
│   │   ├── dictionary/
│   │   ├── test/choice/  test/input/
│   │   ├── review/  weak/  stats/
│   │   ├── materials/ [id]/
│   │   ├── ai/  pdf/
│   │   ├── premium/  settings/
│   │   ├── privacy/  terms/
│   │   ├── admin/  admin/materials/  admin/import/
│   │   └── api/ai/route.ts
│   ├── components/
│   │   ├── ui/ (Button, Card, Input, Select)
│   │   ├── ads/AdComponents.tsx
│   │   └── layout/(AppShell, BottomNav)
│   ├── lib/
│   │   ├── supabase/(client/server/middleware/requireUser)
│   │   ├── srs/(index, saveResult)
│   │   └── utils/(cn, shuffle)
│   └── types/db.ts
└── README.md
```

---

## 10. 今後の追加機能リスト

### 短期

- [x] 単語編集・削除 UI（`/wordbooks/[id]`のドロワーから実装済み）
- [x] 単語帳の削除 UI（2026-07-04実装。編集(タイトル/説明の変更)UIは引き続き未実装）
- [ ] 4 択テストのテスト前設定画面 (出題数/方向の選択 UI)
- [ ] 教材別の進捗グラフ (現状は教材詳細に未実装)
- [ ] 英検級別・TOEIC レベル別の専用ハブページ
- [ ] パスワードリセット / Magic Link 対応

### 中期

- [ ] AI を OpenAI / Anthropic に実接続 (`AI_PROVIDER` で切替)
- [ ] 辞書検索を外部 API (Wiktionary / 自前辞書 DB) に拡張
- [ ] PDF を `jsPDF + 日本語フォント埋め込み` で直接生成 (現状はブラウザ印刷経由)
- [ ] AdMob Web SDK / AdSense 連携
- [ ] Stripe による Premium 課金
- [ ] バックアップ機能 (CSV エクスポート)

### 長期

- [ ] Capacitor で iOS / Android 化 → AdMob 接続
- [ ] React Native 版 (Expo) の検討
- [ ] 教材マーケット (許諾済みデータの配信)
- [ ] 学校・塾向け管理機能 (クラス・宿題配信)
- [ ] 音声読み上げ (TTS) / 発音判定

---

## 11. セキュリティ評価 / Next.js アップグレード履歴

### 現状

| パッケージ        | バージョン      | 評価 |
|------------------|----------------|------|
| `next`           | `15.5.18`      | 15系最新パッチ。14系の高/重要CVE 14件は解消済み |
| `react` / `react-dom` | `19.x`     | Next 15 推奨。`useActionState` 等利用可 |
| `@supabase/ssr`  | `0.10.3`       | 最新。`CookieOptions` を利用 |
| `@types/react`   | `19.x`         | React 19 対応 |
| `eslint-config-next` | `15.5.18`  | Next と統一 |
| `tailwindcss`    | `3.4.x`        | OK |

### `npm audit` の残存項目 (本番リスク評価込み)

| 内容                                                  | レベル   | 本番リスク |
|------------------------------------------------------|---------|----------|
| `postcss < 8.5.10` (Next 内蔵、`</style>` 関連 XSS)    | moderate | **なし** — postcss はビルド時のみ動作。ユーザー入力が直接 CSS 文字列に混入するルートが存在しないため、本番ランタイムには影響しない |

直接依存の `postcss` は `^8.4.47` を指定済 (8.5.x 系自動取得) で安全。Next が `node_modules/next/node_modules/postcss` として古いバージョンを内包しているのは Next 16 で解消予定。

### アップグレード履歴

| 日付         | 内容 |
|-------------|------|
| 2026-05-22  | `next 14.2.15` → `14.2.35` (14系最新パッチ)、未使用の `jspdf` 削除 |
| 2026-05-23  | **`next 14.2.35` → `15.5.18` (Next 15 メジャー移行)**。React 19 / @supabase/ssr 0.10.3 / @types/react 19。動的ルート `params` を Promise 化、`cookies()` を await 化 |

### Next 15 移行で行った破壊的変更対応

| 影響                              | 対応ファイル                                                                       |
|----------------------------------|-----------------------------------------------------------------------------------|
| `params` が Promise              | `wordbooks/[id]/page.tsx`, `wordbooks/[id]/add/page.tsx`, `materials/[id]/page.tsx` |
| `searchParams` が Promise        | `materials/page.tsx`, `weak/page.tsx`, `review/page.tsx`, `ai/page.tsx`, `test/choice/page.tsx`, `test/input/page.tsx` |
| `cookies()` が async             | `src/lib/supabase/server.ts` (関数自体も async に)、呼び出し元 `requireUser.ts` / `api/ai/route.ts` で await |
| React 19 への移行                | 既存コードは互換性問題なし (`useFormState` 等は未使用) |
| `eslint-config-next` 15 系へ更新  | 動作確認済 (`next lint` は Next 16 で廃止予定の警告は出る) |
| `@supabase/ssr` 0.5 → 0.10       | `CookieOptions` 型インポートはそのまま使える。getAll/setAll API は変更なし |

### Next 16 への更新は当面不要

- Next 15 で audit のCritical/High本体CVEは全て解消済み
- 残った moderate 1 件は本番ランタイム影響なし
- `next lint` が Next 16 で廃止予定だが、ESLint CLI への移行は `npx @next/codemod@canary next-lint-to-eslint-cli .` でいつでも実行可能

### `npm audit fix --force` を実行しなかった理由

`npm audit fix --force` は強制的に **`next@9.3.3` (8 年前)** にダウングレードする提案を出すケースがある (postcss の脆弱性解消パスを `next` のダウングレードで満たそうとするため)。手動で系統的に上げる方が安全。

---

## 12. 実操作テスト

本番公開前に [`TESTING.md`](TESTING.md) の 17 セクション・100+ 項目をチェック。
特に **Supabase 未設定時の `/setup` フォールバック** と **RLS 確認** は必ず実施。

---

## 13. 人間が今から実施する作業 (本番デプロイ前)

GitHub push 完了済み (<https://github.com/roromukuro-afk/loop-vocabulary>)。
ここから先は外部サービス操作で、人間の認証情報が必要なため、以下を順番に実施してください。

### 13-1. Supabase プロジェクト作成 (5 分)

1. <https://supabase.com> にログイン → "New project"
2. Name: `loop-vocabulary`、Region: `Northeast Asia (Tokyo)` 推奨
3. Database Password を控えておく
4. プロジェクト作成完了後、Project Settings → API から:
   - `Project URL` ← `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key ← `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key ← `SUPABASE_SERVICE_ROLE_KEY` (Vercel のみ、サーバ専用)

### 13-2. SQL 投入 (3 分)

SQL Editor で **必ずこの順** に実行:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql`
4. (任意検証) `supabase/rls-check.sql`

### 13-3. Authentication 設定 (3 分)

- Authentication → Providers → **Email** を有効化
- 開発中: Confirm email は OFF (テストが楽)
- Authentication → URL Configuration:
  - `Site URL`: 後ほど Vercel 本番 URL に変更 (まずは `http://localhost:3000`)
  - `Redirect URLs`:
    - `http://localhost:3000/**`
    - `http://localhost:3001/**`, `http://localhost:3002/**` (port フォールバック用)
    - 後で Vercel URL を追加

### 13-4. ローカル動作確認 (10 分)

```bash
cd C:\Users\rorom\loop_vocabulary
cp .env.local.example .env.local
# .env.local に取得した URL と anon key を貼る
npm run dev
```

`TESTING.md` の §0〜§17 を順番に潰す。最低限の確認:
- signup → メール認証 → ダッシュボード遷移
- 単語帳作成 → 単語追加 → 4択テスト → 結果が DB に保存
- `/setup` フォールバックが動く (`.env.local` をリネームして確認)

### 13-5. 管理者化 (1 分)

ローカルで signup したアカウントを管理者に。Supabase SQL Editor で:

```sql
update public.profiles set is_admin = true where email = 'your-email@example.com';
```

→ アプリを再ログインすると `/admin` 配下が解放される。
→ `/admin/materials` から教材追加、`/admin/import` で CSV/JSON インポートをテスト。

### 13-6. Vercel デプロイ (5 分)

1. <https://vercel.com> にログイン → "Add New" → "Project"
2. "Import Git Repository" で `roromukuro-afk/loop-vocabulary` を選択
3. Framework Preset: Next.js (自動検出)、Root Directory: 空、Build Command / Install Command: デフォルト
4. **Environment Variables** に設定 (Production / Preview / Development 全環境):
   - `NEXT_PUBLIC_SUPABASE_URL` = (上で取得した URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (上で取得した anon key)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-vercel-domain>.vercel.app` (Deploy 後に判明する URL)
   - (任意) `SUPABASE_SERVICE_ROLE_KEY` = (将来のサーバ専用処理用)
   - (任意) `NEXT_PUBLIC_ADS_ENABLED` = `true`
5. Deploy → 数分待つ → 本番 URL 確定

### 13-7. Supabase 本番 URL 反映 (2 分)

Vercel 本番 URL が確定したら Supabase に戻って:

- Authentication → URL Configuration:
  - `Site URL` を本番 URL に変更
  - `Redirect URLs` に `https://<your-vercel-domain>.vercel.app/**` と `https://*.vercel.app/**` (プレビューデプロイ用) を追加

その後 Vercel 側で `NEXT_PUBLIC_SITE_URL` も本番 URL に更新 → Vercel ダッシュボードから Redeploy。

### 13-8. 本番 URL テスト (15 分)

本番 URL で `TESTING.md` の §2〜§15 を全部潰す。特に:

- signup でメール認証が来る (Confirm email を本番では ON 推奨)
- ログイン後、`/dashboard` まで遷移
- 単語帳作成 → 単語追加 → 4択テスト → SRS 反映
- 別ブラウザ (別ユーザー) で signup し、他人の単語が見えないことを確認 (RLS の本番動作確認)
- 管理者で `/admin/materials` から教材追加 → 一般ユーザーで見えるか確認
- 一般ユーザーで `/admin` にアクセス → `/dashboard` にリダイレクトされる

### 13-9. (必須) ストア申請前の最終調整

- [ ] **サポートメール置換**: Vercel 環境変数 `NEXT_PUBLIC_SUPPORT_EMAIL` に実メール (例: `support@yourdomain.com`) を設定 → 再デプロイ。`/contact` / `/privacy` / `/terms` / `/account/delete` / 設定画面の削除パネルに自動反映される
- [ ] **削除リクエスト用 SQL を本番に投入**: Supabase SQL Editor で `supabase/migrations/002_account_deletion.sql` を実行
- [ ] **アカウント削除動線テスト**: 設定 → アカウント削除 → リクエスト送信 → Supabase で `account_deletion_requests` に行が入ることを確認

### 13-10. (推奨) 本番運用の最終調整

- [ ] Supabase Auth → Confirm email を **ON** に変更
- [ ] Supabase → Database → Backups を Pro プランで日次バックアップ ON
- [ ] Vercel → Analytics / Speed Insights を有効化
- [ ] Sentry 等のエラートラッキング検討
- [ ] 独自ドメイン設定 (任意)

---

## 14. スマホアプリ化 (Capacitor + AdMob)

Loop Vocabulary は **Capacitor** を介して Android / iOS のネイティブアプリにパッケージ化し、AdMob で広告収益化する設計です。

### 14-1. アーキテクチャ方針: WebView Wrapper + Native Plugins

Loop Vocabulary は Next.js の Server Components / middleware / Supabase SSR を多用しているため **static export では動きません**。そこで Capacitor の `server.url` 機能で本番 Vercel URL を WebView 内に読み込み、AdMob・StatusBar・SplashScreen 等のネイティブ機能だけプラグイン経由で提供する Hybrid 構成を採用。

- メリット: 既存 Web/PWA を一切壊さない、Vercel push で即時 OTA 反映、Server Component が無傷
- デメリット: 完全オフライン動作はしない (Web 版も同条件)
- 設定: [`capacitor.config.ts`](capacitor.config.ts)

### 14-2. AdMob 広告コンポーネント

新規追加: [`src/components/ads/AppAds.tsx`](src/components/ads/AppAds.tsx)

| コンポーネント / フック | 説明 |
|---|---|
| `<AppBannerAd />` | Web: プレースホルダ枠、Native: 画面下部に AdMob Adaptive Banner |
| `<AppNativeAdCard />` | 一覧内のネイティブ広告枠 |
| `<AppRewardedAdButton kind={...} />` | リワード視聴 → `reward_tickets` に 1 枚付与 |
| `useAppInterstitial()` | 結果画面等の自然な切れ目で呼ぶインタースティシャル |
| `useTicketBalance(kind)` | チケット残数表示用フック |

旧 `BannerAdPlaceholder` / `RewardedAdButton` / `NativeAdCard` / `useInterstitialAdTrigger` は互換シムを通して `AppAds.tsx` に転送されるため既存ページは変更不要。

#### 広告表示ルール (実装に組み込み済み)

| 画面 | 広告 |
|---|---|
| `/dashboard`, `/wordbooks`, `/stats`, `/settings`, `/premium`, `/materials/[id]` | Banner / Native |
| テスト結果画面 | Banner + (任意で Interstitial) |
| AI 上限到達時 | Rewarded |
| `/test/choice` 実行中, `/test/input` 実行中, `/review` 実行中, `/wordbooks/[id]/add` 入力中, `/admin/*`, `/login`, `/signup` | **広告なし** |

#### リワード広告のチケット種別

`src/lib/native/rewards.ts` の `RewardKind`:
- `ai_generation` — AI 例文・解説生成（`reward_tickets` へ永続化・`api/ai/route.ts` が消費）
- `pdf_export` — PDF 出力回数（未実装、付与・消費コードとも無し）
- `extra_review` — 復習対象拡張。広告視聴の直後にその場で復習/テストを再開する
  「即時消費」の報酬のため、2026-07-05以降は `reward_tickets` へ永続化しない
  （`INSTANT_USE_REWARD_KINDS` 参照。過去付与分の既存データは残置）
- `weak_word_test` — 苦手単語テスト追加（未実装、付与・消費コードとも無し）
- `analysis_ticket` — 詳細分析ロック解除 (将来用、未実装)

### 14-3. 広告 ID の本番切替

開発中は AdMob 公式テスト広告 ID にフォールバックする実装 (`src/lib/native/admob.ts`)。本番リリース時は以下を設定:

```env
# .env.local (Vercel 環境変数にも反映)
NEXT_PUBLIC_ADMOB_USE_TEST_IDS=false

NEXT_PUBLIC_ADMOB_ANDROID_BANNER=ca-app-pub-<your>/<your>
NEXT_PUBLIC_ADMOB_ANDROID_INTERSTITIAL=ca-app-pub-<your>/<your>
NEXT_PUBLIC_ADMOB_ANDROID_REWARDED=ca-app-pub-<your>/<your>
NEXT_PUBLIC_ADMOB_IOS_BANNER=ca-app-pub-<your>/<your>
NEXT_PUBLIC_ADMOB_IOS_INTERSTITIAL=ca-app-pub-<your>/<your>
NEXT_PUBLIC_ADMOB_IOS_REWARDED=ca-app-pub-<your>/<your>
```

加えて、**App ID** は AndroidManifest / Info.plist にビルド時焼き込み:
- `android/app/src/main/AndroidManifest.xml` の `com.google.android.gms.ads.APPLICATION_ID`
- `ios/App/App/Info.plist` の `GADApplicationIdentifier`

書き換えたら `npx cap sync` で再同期。

### 14-4. app-ads.txt

[`public/app-ads.txt`](public/app-ads.txt) を Vercel 経由で `https://loop-vocabulary.vercel.app/app-ads.txt` として公開。AdMob 申請が承認されたら `pub-XXXXXXXXXXXXXXXX` を本物の Publisher ID に置換 → 再デプロイ。Play Console と App Store Connect の "Developer Website / Marketing URL" を Vercel URL に向けることで、AdMob がクロールしてアプリと販売者の紐づけを認識する。

### 14-5. Android ビルド手順

#### 前提

- [ ] **Android Studio** 最新版インストール (<https://developer.android.com/studio>)
- [ ] **JDK 17** が入っていること (`java -version` で確認、Android Studio に同梱されている)
- [ ] Android SDK Platform 34+ / Build-Tools 最新

#### 初回ビルド

```bash
# 1. Web shell 生成 + Capacitor sync
npm run cap:sync           # = build-mobile-shell.mjs + npx cap sync

# 2. Android Studio で開く
npm run cap:open:android   # = npx cap open android
```

Android Studio が起動 → 初回は Gradle Sync で数分 → 完了後:

- **▶ Run** ボタンでエミュレータ or 接続実機にインストール
- ログ (Logcat) で `[AdMob]` を grep するとテスト広告のロード状況が見える

#### Google Play 内部テスト → クローズドテスト → 本番

詳細は [STORE_RELEASE.md](STORE_RELEASE.md) 「Google Play 公開チェックリスト」参照。

### 14-6. iOS ビルド手順

#### 前提

- [ ] **Mac** (Windows 上では iOS ビルド不可)
- [ ] **Xcode 16+** (Mac App Store)
- [ ] **Apple Developer Program** 登録済 (年 $99)
- [ ] (Capacitor 8 は SPM を使うため CocoaPods は不要)

#### 初回ビルド

```bash
# Mac 上で
npm install
npm run cap:sync           # build-mobile-shell.mjs + npx cap sync
npm run cap:open:ios       # Xcode が起動
```

Xcode が起動したら:

1. プロジェクト → Signing & Capabilities → Team を選択
2. Bundle Identifier が `com.loopvocabulary.app` であることを確認
3. ▶ Run ボタンでシミュレータ or 実機にインストール

#### TestFlight → 本番

詳細は [STORE_RELEASE.md](STORE_RELEASE.md) 「Apple App Store 公開チェックリスト」参照。

### 14-7. 検証用テスト広告 ID

開発中は以下の Google 公式テスト広告 ID が自動利用される (本番に出ても請求されない):

| プラットフォーム | スロット | テスト ID |
|---|---|---|
| Android | App ID | `ca-app-pub-3940256099942544~3347511713` |
| Android | Banner | `ca-app-pub-3940256099942544/6300978111` |
| Android | Interstitial | `ca-app-pub-3940256099942544/1033173712` |
| Android | Rewarded | `ca-app-pub-3940256099942544/5224354917` |
| iOS | App ID | `ca-app-pub-3940256099942544~1458502117` |
| iOS | Banner | `ca-app-pub-3940256099942544/2934735716` |
| iOS | Interstitial | `ca-app-pub-3940256099942544/4411468910` |
| iOS | Rewarded | `ca-app-pub-3940256099942544/1712485313` |

### 14-8. プライバシー / 13 歳未満対応 / ATT

- 主対象は **13 歳以上** (利用規約 `/terms` に明記)
- AdMob 既定で **非パーソナライズ広告** (`npa: true`) を要求する実装
- iOS では `NSUserTrackingUsageDescription` + ATT ダイアログを表示
- ATT 拒否時も非パーソナライズ広告は配信される設計
- ユーザーが入力した個人データ (メール / 単語 / 学習履歴) は Supabase で暗号化保存、第三者提供なし (詳細は `/privacy`)

### 14-9. 将来の課金 (Premium プラン)

現状は `/premium` ページで案内のみ。実装時:
- **Android**: Google Play Billing 必須 (デジタル商品)。Capacitor プラグイン `@capacitor-community/in-app-purchases` 等
- **iOS**: StoreKit 2 / IAP 必須。同上
- Stripe 等の外部決済はデジタル商品では両ストアで禁止

---

## 15. ライセンス / 著作権

- 本アプリのコード: 制作者に帰属
- 教材データ: `materials.license_status='approved'` & `is_public=true` のものだけが公開画面に出ます (RLS で強制)
- 「英辞郎」「mikan」「reminDO」「abceed」「ランク順英単語」等の他社サービスのデータ・UI・ロゴはコピーしていません。機能思想のみ参考にしています。
- 「受かる英語」掲載の参考書データは、許諾済みの前提でアプリ内教材データとして利用可能 (本リポジトリには未同梱。`/admin/import` から CSV/JSON で投入)。
