# WORK_HISTORY — Loop Vocabulary

> 作業の時系列ログ。新しいものを上に追記する。
> 最終更新: 2026-07-01

---

## 2026-07-01 Phase 1: 信頼性・表記・SEO・登録不要の改善を実装（未コミット）

オーナー指示の「現段階の改善策」を working tree に実装。**commit / デプロイ / 巻き戻しは未実施。**
`npx tsc --noEmit` パス。dev サーバ(3001)で挙動確認済み。

- `src/app/layout.tsx` — WebSite JSON-LD の `SearchAction`(potentialAction) を削除（不整合解消）。
- `src/app/dictionary/page.tsx` — `requireUser`→`createClient`＋任意user。**登録不要で検索可**に。
  未ログイン時は無料登録CTAを表示。metadata/OGP 追加。
- `src/app/dictionary/DictionarySearch.tsx` — `loggedIn` prop 追加。未ログインは追加先セレクタ/
  追加ボタンを隠し、`/signup?next=/dictionary` への登録リンクに切替。
- `src/app/page.tsx` — 無料/Premium 表現の整合（FAQ回答・FAQ_LD・機能見出し・ヒーロー文言）。
  フッターを刷新（公式URL明記・問い合わせ導線・2カラム化・著作年 2025→2025–2026）。
- `src/app/materials/[id]/page.tsx` — BreadcrumbList JSON-LD 追加。

**検証:** 匿名で `/dictionary` が HTTP 200（従来はloginリダイレクト）。RLS `material_words public read`
は anon 可のため公開検索が成立。landing に公式URL・新コピー反映、HTML から SearchAction が消滅。

**未決:** 運営者名/特商法表記（捏造不可・要オーナー提供、コードに TODO(運営者) 明記）、
GSC 登録（外部作業）、辞書 `q` パラメータ対応→SearchAction 復活。

### Phase 2（分離・未着手）＝オーナー整理の「そのうえで」領域
- 復習アルゴリズムの動的化（自己評価「簡単/普通/難しい」・正答率で間隔可変）
- 先生向け進捗管理画面（生徒の学習日数/語数/正答率/苦手/復習状況）… 新DB設計・ロール必要
- PDFテストのカスタマイズ（シャッフル/解答分離/段組/問題数/日英⇔英日/苦手のみ）
→ いずれも新スキーマ・大改修を伴うため、別途設計してから着手する。

---

## 2026-07-01 セッション引き継ぎ（現状把握）

前セッションの引き継ぎ資料（`PROJECT_CONTEXT.md` / `WORK_HISTORY.md` / `HANDOFF.md`）は
**ファイル保存されておらず Markdown 本文として出力されただけ**だったため、本セッションで
git 差分をもとに 3 ファイルを新規作成した（このファイルもその一つ）。

### この時点の git 状態

- branch: `main`（origin と同期、未コミットの作業ツリー変更あり）
- 直近コミット:
  - `69f1f09 fix: license_status フィルターを approved+original に拡張`
  - `e1930b8 feat: UX強化 - 例文表示・スワイプ・直接開始・AI補完`
  - `f7d34a0 feat: PWA offline cache, offline page, push send API, health endpoint`

### 未コミットの変更（作業ツリー）

**変更 28 ファイル / 新規（未追跡）多数。** 目的別に3系統へ分類した。

#### A系統：今回の主目的 = SEO・信頼性改善（コミット対象）
- `src/app/layout.tsx` — Organization / WebSite の JSON-LD 追加
  - ※ WebSite の `SearchAction` が `/dictionary?q=...` を指すが、`/dictionary` は
    ログイン必須かつ `q` 未対応 → **不整合（要修正）**。詳細は HANDOFF 参照。
- `src/app/page.tsx` — FAQPage JSON-LD 追加（4問）
- `src/app/sitemap.ts` — 非同期・動的化。公開教材ID / 追加 guide スラッグ 10 件 /
  文法レッスン（`/grammar/[slug]`）/ `/materials`・`/grammar` を収録。
- `src/app/materials/page.tsx` — `requireUser` → `createClient` 化で**未ログイン閲覧可**、
  metadata / OGP 追加、未ログイン向け無料登録 CTA。
- `src/app/materials/[id]/page.tsx` — 同上の未ログイン開放、`generateMetadata`（教材別 title/description/OGP）、
  未ログイン時はインポートボタンを「無料登録して単語帳にインポート」リンクに切替。
- `src/app/guide/page.tsx` — 記事カード 10 本追加、`/grammar` への誘導バナー追加。
- `src/app/guide/[slug]/page.tsx`（+約1020行）— 追加記事の本文・Amazon書籍セクション
  （`@/components/affiliate/AmazonBook`, ASIN指定）・教材内部 CTA（`GuideMaterialCTA`）。
- `src/app/guide/*/page.tsx`（個別 18 ファイル, 各 +1〜11 行）— 教材 CTA / 導線の小追加。
- 新規 `src/components/guide/GuideMaterialCTA.tsx` — 記事から教材ページへの内部リンクCTA。
- 新規 `src/app/grammar/`, `src/components/grammar/`, `src/lib/grammar/` — 英文法レッスン機能。
  - `lessons.ts`(423行) だが**レッスン実体は現状 2 本のみ**（`kanshi-a-an-the` / `meishi-kasan-fukasan`）。

#### B系統：目標パーソナライズ機能（今回のSEO改善とは分離・保留）
- `src/app/road/page.tsx` — `profiles.exam_goal` 取得 → 目標関連教材ハイライト表示。追加のみ・破壊的変更なし。
- `src/app/dashboard/page.tsx` — `GoalProgress` を import + 設置（4行）。
- 新規 `src/components/dashboard/GoalProgress.tsx` — 目標別進捗カード（Server Component）。

#### C系統：運用ツール・ローカル設定（今回のSEO改善とは分離・保留）
- 新規 `scripts/generate-materials.mjs` — Claude API 単語帳生成スクリプト。
- 新規 `scripts/fill-empty-materials.mjs` — 低語数教材の補完スクリプト。
- `.claude/launch.json` — dev 構成名変更＋**ポート 3000 → 3001**、JSON を1行に圧縮。

### 本セッションで行ったこと
- 現状把握（各ファイルの diff 確認）。**コード変更・commit・デプロイ・巻き戻しは未実施。**
- `PROJECT_CONTEXT.md` / `WORK_HISTORY.md` / `HANDOFF.md` を新規作成。

### 未着手（次セッションへ）
→ `HANDOFF.md` の「次にやること」を参照。
