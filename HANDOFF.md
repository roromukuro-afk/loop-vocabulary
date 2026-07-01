# HANDOFF — Loop Vocabulary

> 次に作業する人（次セッションの自分）への申し送り。
> 「今どういう状態か」「何を触ってよくて、何を触ってはいけないか」「次に何をするか」。
> 最終更新: 2026-07-01

---

## 0. 最重要ルール（このセッションのオーナー方針）

1. **勝手に削除・巻き戻し・commit・デプロイをしない。** 変更前に必ず確認する。
2. **B系統・scripts・launch.json は今回のSEO改善コミットに混ぜない**（後述）。
3. まずは現状把握と合意 → その後に実装、の順で進める。

---

## 1. 現在のスコープ = SEO・信頼性改善

今回のコミット/デプロイ対象は **A系統（SEO・信頼性改善）のみ**。

対象ファイル（A系統）:
- `src/app/layout.tsx`（JSON-LD: Organization / WebSite）
- `src/app/page.tsx`（FAQPage JSON-LD）
- `src/app/sitemap.ts`（動的化）
- `src/app/materials/page.tsx`, `src/app/materials/[id]/page.tsx`（未ログイン閲覧化・metadata/OGP・CTA）
- `src/app/guide/page.tsx`, `src/app/guide/[slug]/page.tsx`, `src/app/guide/*/page.tsx`（記事追加・内部CTA・Amazon）
- 新規 `src/components/guide/GuideMaterialCTA.tsx`
- 新規 `src/app/grammar/**`, `src/components/grammar/**`, `src/lib/grammar/**`（英文法レッスン）

---

## 2. 分離・保留する変更（今回のSEO改善には含めない）

以下は **別軸の変更**。**削除も巻き戻しもしない**が、今回のSEO改善コミット・デプロイには
**混ぜず、別コミット（または保留）として扱う**とオーナーが決定（2026-07-01）。

### B系統：目標パーソナライズ機能（保留）
- `src/app/road/page.tsx` — 目標関連教材のハイライト（追加のみ・破壊的変更なし）
- `src/app/dashboard/page.tsx` — `GoalProgress` の import + 設置（4行）
- `src/components/dashboard/GoalProgress.tsx`（新規）— 目標別進捗カード

> 品質・安全性に問題は見当たらないが、SEO・信頼性というスコープ外の機能追加のため分離。
> コミットするなら「feat: 目標別パーソナライズ」等として独立させる。

### C系統：運用ツール・ローカル設定（保留）
- `scripts/generate-materials.mjs`（新規）— Claude API 単語帳生成
- `scripts/fill-empty-materials.mjs`（新規）— 低語数教材の補完
- `.claude/launch.json` — dev ポート 3000 → 3001 変更＋1行圧縮

> scripts はコンテンツ拡充の運用ツールで有用だが、アプリ本体のSEO改善とは無関係。
> `.claude/launch.json` のポート変更は意図が不明。**コミット前にオーナーへ要確認**
> （3000→3001 が意図的か、他プロジェクトとの競合回避か等）。

### 分離の実務メモ
- A系統だけをコミットする場合、`git add` は**ファイル単位で明示指定**する
  （`git add -A` は使わない）。B/C系統を巻き込まないこと。
- guide 個別ファイルは 18 件あるため add 漏れ・巻き込みに注意。

---

## 0.4 自律E2E検証基盤（2026-07-01・本番デプロイ済 `8af9a79`）

今後は `npm run test:e2e`（全体）/ `test:srs` / `test:onboarding` / `test:teacher` / `test:smoke` /
`verify:prod` でログイン後UIまで含めた検証を自律実行できる。テスト専用アカウント3件・データは
`scripts/testing/setup-test-users.mjs` / `seed-test-data.mjs` で冪等に用意される（実ユーザー非関与）。
E2Eは `next build && next start`（本番相当ビルド）に対して実行する設計（理由は下記の既知課題）。

**既知の課題（未修正・spawn_task済み）**:
- `ReferralCard.tsx` のハイドレーションミスマッチ（`window.location.origin`分岐）。
- 設定系トグルがPATCH後に`router.refresh()`を呼ばず、同一プロセス内で該当ページを再訪問すると
  SSR結果が古いまま表示される（DB自体は正しく更新される）。他のsettings系フォームへの波及可能性あり。

## 0.3 保留分の整理結果（2026-07-01）
- 目標パーソナライズ（road/dashboard/GoalProgress）→ `94ff6fc` で別コミット・本番化。**保留解除済**。
- content生成スクリプト（scripts/*.mjs）→ `d5b5ec2` で追跡。**保留解除済**。
- `.claude/launch.json` → 唯一の残 held。巻き戻し候補（dev専用・本番非関与・意図不明の局所変更）。破棄未実施（要判断なら origin版へ戻す）。

## 0.2 現在ステータス（2026-07-01 時点・本番反映済み）

| 項目 | 状態 |
|---|---|
| Phase 1 SEO/信頼性/登録不要辞書 | 本番済 `f692e53` |
| Phase 2-C PDFカスタマイズ | 本番済 `ba81db9` |
| Phase 2-A 動的SRS基盤(flag OFF) | 本番済 `a8501ed` |
| Phase 2-A SRS V2 per-user opt-in | 本番済 `c60f4b4`。migration 009/010 適用済。**V2グローバルOFF・opted-in 0**。オーナーが設定トグルで自分だけ検証可 |
| Phase 2-B 先生管理 DB基盤 | migration 011 **本番適用済**・認可テストPASS（`329cb50`）|
| Phase 2-B 先生UI | 本番済 `35d2c17`。/teacher・/teacher/[classId]・/join/[code]・設定の同意管理・API・規約/プライバシー追記。DBライフサイクル検証(join→roster→revoke→leave)PASS。生データ非開示・集計のみ |

**次にやること（Phase 2-B UI）**: `/teacher`（クラス作成・招待コード・teacher昇格）、`/teacher/[classId]`（`get_class_progress`でロスター）、`/join/[code]`（`lookup_class_by_code`＋同意→`class_members`挿入）、設定に参加クラス管理/同意撤回（`get_my_memberships`）、利用規約/プライバシー追記。UIは role or feature flag で露出制御。

**SRS V2 全ユーザーON条件（すべて充足済、実UI検証のみ残）**: 非破壊migration✓ / RLS変更なし✓ / V1へ戻すflag✓ / build✓ / 本番回帰✓ / ロールバック明確✓。→ オーナーがトグルで4ボタンUIを一度確認できれば env `NEXT_PUBLIC_SRS_V2=1` で全体ON可能。

## 2.5. Phase 1 実装状況（2026-07-01 実施・未コミット）

信頼性・表記・SEO・CTA・登録不要の「現段階の改善策」を working tree に実装済み（**未コミット・未デプロイ**）。
型チェック `npx tsc --noEmit` パス。dev サーバ(port 3001)で挙動確認済み。

- [x] `layout.tsx` — WebSite JSON-LD の `SearchAction` を削除（下記3参照）
- [x] 辞書を**登録不要**に：`dictionary/page.tsx` を `requireUser`→`createClient`＋任意user化。
      未ログインは検索のみ可＋無料登録CTA。`DictionarySearch` に `loggedIn` prop 追加、
      未ログイン時は追加ボタンを `/signup?next=/dictionary` リンクに切替。
      → RLS `material_words public read` は anon 可のため検索は動作する（確認済み）。
      → 検証: 匿名で `/dictionary` が HTTP 200（従来はloginへリダイレクト）。
- [x] 無料/Premium 表現の整合：landing の FAQ回答・FAQ_LD・機能セクション見出し／ヒーロー文言を
      「基本機能は無料（広告あり）／広告非表示・AI無制限・PDF無制限はPremium」に統一。
- [x] フッター刷新：公式URL明記（https://loop-vocabulary.app）・問い合わせ導線・
      サービス/運営情報の2カラム化・著作年 2025→2025–2026。
- [x] 教材詳細 `materials/[id]` に BreadcrumbList JSON-LD 追加
      （guide/[slug]・grammar/[slug]・faq は既に構造化データ完備だったため変更なし）。

### Phase 1 の未決事項（オーナー確認待ち）
- **運営者名／特定商取引法表記**：フッターに公式URLと問い合わせ窓口は載せたが、
  法的な運営者名・連絡先は捏造できないため未記載（コード内に `TODO(運営者)` を明記）。
  → 実際の運営者情報を提供してもらい次第、フッターに追記する。
- **Google Search Console 登録**：外部作業のため未実施。sitemap は `/sitemap.xml` で自動生成済み。
  GSC にプロパティ登録し `https://loop-vocabulary.app/sitemap.xml` を送信する手順はオーナー作業。

## 3. 要修正: WebSite JSON-LD の SearchAction 不整合

**場所:** `src/app/layout.tsx` の `WEBSITE_LD.potentialAction`
```
target.urlTemplate = `${APP_URL}/dictionary?q={search_term_string}`
```

**問題:**
1. `/dictionary`（`src/app/dictionary/page.tsx`）は `requireUser()` で**ログイン必須** →
   Google のサイトリンク検索ボックス対象として不適切（クローラ/未ログインで機能しない）。
2. `/dictionary` は **`q` パラメータを受け取らない**（`DictionarySearch` はクライアント内 state のみ）→
   ディープリンクしても検索欄に反映されない。
   → 構造化データとして実質無効・むしろ信頼性上のマイナス。

**オーナー決定の対応方針（2026-07-01）:**
1. **まず `SearchAction`（`potentialAction` ブロック）を削除する。** → ✅ 実施済み。
   WebSite JSON-LD 自体は残している。
2. 辞書を**登録不要で使えるように**する → ✅ `/dictionary` を未ログイン閲覧可にした。
3. 残タスク: **`q` パラメータ対応**（`/dictionary?q=...` で検索欄を初期化）まで実装できたら、
   改めて `SearchAction` を戻す。← **未実装**。

> SearchAction 削除・辞書の登録不要化は完了。`q` 対応と SearchAction 復活のみ残っている。

---

## 4. その他の気づき（次で検討）

- **文法レッスンが実体 2 本のみ**（`kanshi-a-an-the` / `meishi-kasan-fukasan`）なのに、
  `/guide` トップと sitemap では「レッスン群」として大きく露出している。
  → 中身拡充 or 露出トーンの調整を検討（薄いコンテンツの過剰露出は SEO/信頼性の観点で逆効果になりうる）。
- `exam_goal` の正規化ロジックが `road/page.tsx` と `GoalProgress.tsx` に重複。将来共通化候補。
- A系統は auth 変更（`requireUser` → `createClient`）と `sitemap` の非同期DB fetch化を含むため、
  デプロイ前に **`next build` で型/ビルドエラーが無いか**確認すること。
- `/contact`（Organization LD の contactPoint 参照先）は実在を確認済み（`src/app/contact/page.tsx`）。

---

## 5. 次にやること（順番）

> ここから先はコード変更を伴う。着手前に必ずオーナーの合意を取る。

1. **SearchAction 削除**（`layout.tsx` の `WEBSITE_LD.potentialAction` を除去）。
2. **A系統のビルド確認**（`next build`）。auth 変更・sitemap 非同期化のエラー有無を見る。
3. 文法レッスンの露出トーン調整 or レッスン追加（薄い状態での過剰宣伝を回避）。
4. **A系統のみをファイル指定でコミット** → デプロイ。B/C系統は含めない。
5. （別途）B系統を独立コミット化するかをオーナーと相談。
6. （別途）`.claude/launch.json` のポート変更の扱いをオーナーへ確認。
7. （将来）辞書の登録不要化 + `q` 対応 → SearchAction 復活。

---

## 6. やってはいけないこと（明示）

- B系統 / scripts / `.claude/launch.json` の**削除・巻き戻し**。
- `git add -A` や `git commit -a` での**一括コミット**（B/C系統を巻き込むため）。
- 合意前の**デプロイ**。
- SearchAction を「戻す」作業を、辞書の未ログイン化・`q`対応が済む前に行うこと。
