# RELEASE_NOTES — Loop Vocabulary

> 2026-06-30〜2026-07-01 にかけて行った大規模改善のまとめ。
> 対象コミット: `f692e53`（SEO改善）〜 `45374ab`（SRS V2全ユーザーON）。
> 詳細な時系列・調査経緯は [WORK_HISTORY.md](WORK_HISTORY.md) を参照。

---

## 1. SEO・信頼性改善

- Organization / WebSite / FAQPage / Article / BreadcrumbList の JSON-LD 構造化データを整備
- `sitemap.ts` を動的化（公開教材ID・guide記事・grammarレッスンを自動収録）
- フッターに公式URL・問い合わせ・運営情報を明記、2カラム化
- 無料/Premiumの表現を実態に合わせて統一（「全機能無料」→「基本機能は無料・広告非表示等はPremium」）
- 教材カテゴリ表記のゆれを表示層で統合（大学入試→大学受験 等。DBは不変）
- `/signup`（登録ページ）にメタデータ追加、`/login`はnoindex
- SEO記事10本・英文法レッスン機能を追加

**不整合の解消**: WebSite JSON-LDの`SearchAction`が「ログイン必須かつ`q`未対応」の`/dictionary`を指していた問題 → 登録不要辞書化とあわせて解消（後述）。

## 2. 登録不要の辞書検索

- `/dictionary` をログイン不要で使えるように変更（公開教材データはRLSで anon 読み取り可）
- 未ログイン時は「登録して単語帳に追加」を促すCTA、ログイン時は追加ボタンをそのまま表示
- 単語追加後に「復習で覚える／テスト」への導線を追加

## 3. 教材ページの公開化

- `/materials`（一覧）・`/materials/[id]`（詳細）を未ログインでも閲覧可能に
- 詳細ページに教材別メタデータ・OGP・BreadcrumbList JSON-LDを追加
- 未ログイン向け「無料登録」CTA、既存の教材語数表記の統一

## 4. PDFカスタマイズ強化

- 段組み（1列/2列）オプション
- 解答用紙の完全分離（改ページで問題用紙と解答用紙を分けて印刷可能）
- 印刷レイアウト改善（氏名/日付/得点欄、余白調整）

## 5. SRS V2（動的復習アルゴリズム）— 全ユーザーON

- 固定間隔（1→3→7→14→30日）の従来方式（V1）に加え、SM-2簡易版の動的方式（V2）を実装
- 評価「もう一度／難しい／普通／簡単」の4段階で、`ease_factor`・`interval_days`を単語ごとに動的計算
- 段階導入: グローバルenvフラグ → per-user opt-in（設定画面トグル）→ 全ユーザーON の順で展開
- **現在の状態**: `NEXT_PUBLIC_SRS_V2=1`（Vercel Production）で**全ユーザーに有効**
- V1ロジック（`applySrs`）は削除せず保持。個人opt-in（`profiles.srs_v2`）も独立して機能
- 関連migration: `009_srs_dynamic.sql`（`words.ease_factor`/`interval_days`追加）、`010_srs_v2_optin.sql`（`profiles.srs_v2`追加）。いずれも非破壊・適用済み

## 6. 先生向け進捗管理MVP

- 先生ロール・クラス作成・招待コード・生徒の同意制参加
- ロスターは**集計値のみ表示**（学習日数・学習語数・正答率・苦手数・復習状況）。生の単語データは非開示
- 同意撤回で即座にロスターから除外、再同意で復帰
- 関連migration: `011_teacher.sql`（`profiles.role`・`classes`・`class_members`追加、新規テーブルにのみRLS、SECURITY DEFINER RPC 3種）
- 認可はDBレベルで厳格化（RPC内で「教師本人所有 かつ 同意済み」を必須検証）

## 7. オンボーディング改善

- ダッシュボードに「はじめの3ステップ」ガイド（新規/未学習ユーザーのみ表示）
- 単語帳0件ユーザーへのデフォルト単語帳自動作成（ダッシュボード経由・`/dictionary`直行の両方に対応）
- ダッシュボードの先頭CTAを状態に応じて動的化（0件→辞書/教材優先、復習ありなら復習優先）
- 復習0件・教材未インポート時の空状態にCTAを追加

## 8. 自律E2E検証体制

- テスト専用アカウント3件（`test+onboarding` / `test+srs` / `test+teacher`、`profiles.is_test_account`でマーク）
- Playwright実ブラウザE2E 3本（onboarding/dictionary・SRS V2・teacher）を`next build && next start`（本番相当ビルド）に対して実行
- HTTPのみのsmoke/verify-prodスクリプトで公開ページ・認証ページ・APIの健全性を自動チェック
- 関連migration: `012_test_account_flag.sql`（`profiles.is_test_account`追加、非破壊）
- 詳細は本ドキュメント末尾「自動検証コマンドの運用」および [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) を参照

## 9. 副次的に発見・修正した既存バグ2件

1. **ReferralCardのハイドレーションミスマッチ**: `typeof window !== "undefined"`分岐でサーバー/クライアントが異なるURLを描画していた → `NEXT_PUBLIC_SITE_URL`に統一し、`useEffect`で実オリジンとの差分のみ後から補完
2. **設定トグルの`router.refresh()`欠如**: PATCH後にRSCキャッシュが更新されず、ページ再訪問時に古い表示のままだった → `SrsModeToggle`・`NotificationToggles`に`router.refresh()`を追加

---

## 本番確認済み項目（2026-07-01時点）

| 項目 | 状態 |
|---|---|
| 主要公開ページ（`/` `/dictionary` `/materials` `/guide` `/grammar` `/faq` `/privacy` `/terms` `/sitemap.xml` `/signup`） | 全て200 |
| 認証必須ページ（`/dashboard` `/review` `/settings` `/teacher` `/pdf`）未ログイン時 | 全て307→`/login` |
| POST専用APIをGETで叩いた場合 | 全て405 |
| SRS V2 | グローバルenvで全ユーザー有効。個人フラグ無効のテストアカウントでも4段階評価UIが表示されることを確認済み |
| 先生機能 | ロスターは集計のみ・生データ非開示・同意撤回で即除外・再同意で復帰、をE2Eで確認済み |
| ハイドレーション警告 | 0件（修正前は1〜2件） |
| working tree | クリーン |

## ロールバック方法

| 対象 | 手順 |
|---|---|
| **SRS V2 全体OFF** | `vercel env rm NEXT_PUBLIC_SRS_V2 production` → `vercel --prod --yes`（または git push で再デプロイ）。個人opt-inは影響を受けない |
| **アプリコードの変更全般** | 該当コミットを `git revert`。migrationは追加カラム/テーブルのみで無害なため、コード側のロールバックだけで通常は十分 |
| **先生機能を隠す** | UIルート（`/teacher`系）を一時的に無効化、またはfeature flagを追加すれば良い（現状flag無し・必要なら追加提案可） |
| **DBスキーマ（最終手段）** | 追加カラム・テーブルのみなので、必要な場合のみ `drop column` / `drop table`（データ削除を伴うため実行前に必ず確認） |

## 関連ドキュメント

- [WORK_HISTORY.md](WORK_HISTORY.md) — 時系列の詳細な作業ログ
- [HANDOFF.md](HANDOFF.md) — 次セッションへの申し送り・現在ステータス
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — プロジェクト全体の前提知識
- [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) — 本番監視・定期検証の運用ガイド
