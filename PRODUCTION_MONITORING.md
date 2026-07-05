# PRODUCTION_MONITORING — Loop Vocabulary 本番監視ガイド

> 「安定運用フェーズ」における日次/週次の確認項目と、異常時に見るべきポイントをまとめる。
> 実行コマンドの詳細は本書末尾「自動検証コマンドの運用」も参照。

---

## 1. 毎日確認する項目（5分程度）

- [ ] `npm run verify:prod` — 公開ページ200・認証ページ307・API 405 の回帰がないか
- [ ] Vercel Dashboard → 直近デプロイが `READY`（`ERROR`/`BUILDING`で止まっていないか）
- [ ] Vercel → Functions/Logs で直近の 5xx エラーが急増していないか（`get_runtime_errors` / `get_logs` 相当）
- [ ] Supabase Dashboard → Database の稼働状況（一時停止・容量警告が出ていないか）
- [ ] 前日の新規登録数・学習アクティビティが極端にゼロになっていないか（`daily_stats`を軽く確認）

## 2. 週1で確認する項目（15〜20分）

- [ ] `npm run test:e2e`（フルE2E一式）を実行し、17フロー（onboarding/dictionary・SRS V2・teacher・admin・教材インポート・4択出題ロジック・他学習モード出題ロジック・Premium判定回帰・学習モード入口/対象範囲ラベル・単語帳削除・復習リカバリーモード・内部リンク・カテゴリLP・ダッシュボード習得率/苦手単語カード）が全PASSか
- [ ] `npm run verify:srs-global` — SRS V2のグローバル有効化が維持されているか
- [ ] [`/admin/srs`](https://loop-vocabulary.app/admin/srs) — 異常値検知セクションに⚠が出ていないか目視確認（詳細は§3。ページ自体が正しく表示されること・認可が効いていることは`test:e2e`/`test:admin`で自動検証済みなので、ここでは「値」の異常有無だけ見ればよい）
- [ ] Supabase → Database → 使用量（行数・DBサイズ・API呼び出し数）が想定内か
- [ ] Vercel → Usage（Function実行時間・帯域）が想定内か
- [ ] Google Search Console → インデックス状況・検索パフォーマンスの週次トレンド（詳細は [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) §3）
- [ ] AdSense（承認後）→ 表示回数・クリック率・収益の異常値有無
- [ ] `git status` / working tree がクリーンか（保留中の変更が放置されていないか）
- [ ] `PHASE2_DESIGN.md` / `PHASE2B_TEACHER_DESIGN.md` 等、未着手項目の棚卸し

## 3. SRS V2で見るべき異常

SRS V2は全ユーザーに展開済み（`NEXT_PUBLIC_SRS_V2=1`）。以下は「動的復習が正しく機能しているか」の異常検知観点。

**通常はこのSQLを直接叩く必要はない。`/admin`にログイン後 [`/admin/srs`](https://loop-vocabulary.app/admin/srs) で
同じ観点を読み取り専用ダッシュボードとして確認できる**（総単語数・復習対象/今日/明日/7日以内予定・
`is_weak`比率・`ease_factor`/`interval_days`の平均/最小/最大・正誤合計と正答率・下記の異常値5種を集計表示）。
DBを直接見たい場合や、ダッシュボードでは出ない個別行を確認したい場合のみ以下のSQLを使う。

- **`words.ease_factor` が異常値**: 想定レンジは `1.3`〜`2.8`。範囲外の値がある場合はロジックのクランプ処理に不具合がある可能性
  ```sql
  select count(*) from words where ease_factor < 1.3 or ease_factor > 2.8;
  ```
- **`words.interval_days` が異常に大きい**: 想定上限は180日。超過があれば要調査
  ```sql
  select count(*) from words where interval_days > 180;
  ```
- **`next_review_at` が過去日付のまま大量に滞留**: 復習が全く実行されていない兆候（アプリ側の保存処理が失敗している可能性）
  ```sql
  select count(*) from words where next_review_at < now() - interval '7 days';
  ```
- **`next_review_at` が未設定の既学習単語**: `last_studied_at`はあるのに`next_review_at`がnull。保存処理の不具合を疑う
  ```sql
  select count(*) from words where last_studied_at is not null and next_review_at is null;
  ```
- **`is_weak=true` の比率が高すぎる**: 全単語の50%を超える場合は評価ロジックや復習頻度に問題がある可能性
  ```sql
  select count(*) filter (where is_weak) * 100.0 / nullif(count(*), 0) as weak_pct from words;
  ```
- **`profiles.srs_v2`（個人opt-in）の分布**: グローバルON後は意味を持たなくなるが、将来ロールバック判断の参考に
  ```sql
  select srs_v2, count(*) from profiles group by srs_v2;
  ```
- **設定画面の「動的復習アルゴリズム」トグル操作後にエラーが出ていないか**: `/api/settings/srs` のエラーレート（Vercel Functionsログ）

## 4. teacher機能で見るべき異常

- **ロスターに生データが表示されていないか**: `get_class_progress` RPCの戻り値は集計列のみのはず。もし単語そのものが露出していたら重大インシデント → 直ちに `/teacher` ルートを無効化し調査
- **同意していない生徒がロスターに出ていないか**
  ```sql
  -- 同意済み・在籍中の生徒だけが対象になっているか確認
  select cm.class_id, cm.student_id, cm.consent, cm.status
  from class_members cm
  where cm.consent = false and cm.status = 'active';
  -- ↑ このクエリで出てくる生徒がロスターに出ていたらNG
  ```
- **他人のクラスが見えていないか**: `classes`のRLS（`teacher_id = auth.uid()`）が効いているか
- **招待コードの重複・使い回し**: `classes.invite_code`はUNIQUE制約済みだが、想定外のクラスに誤参加していないか
  ```sql
  select invite_code, count(*) from classes group by invite_code having count(*) > 1;
  ```
- **`profiles.role='teacher'`への昇格が野良で増えていないか**（想定外のユーザーが先生ロールを取得していないか）
  ```sql
  select id, email, role, created_at from profiles where role = 'teacher' order by created_at desc;
  ```
- **招待コードの期限切れが放置されていないか**（2026-07-02以降: 新規クラス・再発行は既定90日で失効。
  期限切れのまま先生が気づいていないと、生徒が参加できず問い合わせにつながる可能性がある）
  ```sql
  select id, name, teacher_id, invite_code_expires_at
  from classes
  where invite_code_revoked_at is null
    and invite_code_expires_at is not null
    and invite_code_expires_at <= now() + interval '7 days';
  -- ↑ 7日以内に期限切れ/既に期限切れのクラス一覧（先生に再発行を促す運用の参考）
  ```

## 5. Supabaseで見るべきテーブル

| テーブル | 見る理由 |
|---|---|
| `profiles` | ユーザー数推移・`is_premium`/`role`/`srs_v2`/`is_test_account`の分布 |
| `words` | 学習データ量、SRS異常値（上記4参照） |
| `word_books` | 単語帳作成数（オンボーディング効果測定） |
| `daily_stats` | 日次アクティブ度・学習量トレンド |
| `study_results` | テスト実施ログの増加率 |
| `materials` / `material_words` | 公開教材数・語数（`is_public`/`license_status`の整合性） |
| `classes` / `class_members` | 先生機能の利用状況・同意状態 |
| `pdf_exports` | PDF出力の利用状況・無料枠上限の妥当性 |
| `account_deletion_requests` | 削除リクエストの滞留がないか |
| Auth → Users | テストアカウント（`test+*@loop-vocabulary.app`）以外の異常な大量作成がないか |

**テストデータの混入チェック**（月次で十分）:
```sql
select count(*) from profiles where is_test_account = true; -- 3件のはず（増減があれば要確認）
```

## 6. 教材データの品質で見るべき異常

新規プリセット教材パック（`src/data/presets/*`）は、DB投入前に `npm run validate:materials`
（wordが空でない/重複がない/posが不正でない/難易度が範囲外でない等の静的チェック）、
DB投入後に `npm run test:materials`（インポート後にSRS/PDFテストで使える状態かの検証、
+既存教材が減っていないかの回帰ガード）を通す運用にしている。
新しい教材パックを追加・変更したときは必ずこの2つを実行する。

既存の大規模教材（seed-vocabで投入した31件・約32,000語）を含む**DB上の全教材**は、
`npm run audit:materials`（読み取り専用、[MATERIALS_AUDIT.md](MATERIALS_AUDIT.md) /
[reports/materials-audit.json](reports/materials-audit.json)を生成）で監査できる。
`npm run validate:materials`実行時にも非ブロッキングで自動再生成される。

- **完全重複行**（同一教材内でword/meaning/pos/example/example_ja/importance/frequency/levelが
  全て一致する余剰コピー。**2026-07-02にユーザー承認の上、245件を削除済み**（14教材、
  `material_words`32,587件→32,342件）。2026-07-02時点で0件。削除時の記録・バックアップ・
  ロールバックSQLは[reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md)参照）
- **意味違いの重複行**（同じ見出し語だが内容が異なる。別義の可能性があるため
  自動修正しない方針。2026-07-02時点（削除後）で1,952件・削除対象外のまま保持）
- **品詞(pos)が未設定**（**2026-07-03にユーザー承認の上、自動補完候補3,267件を補完済み**
  （9,997件→6,730件）。慎重に扱う6,730件（追加提案ルール・複数品詞の可能性・熟語句動詞・
  meaning短すぎ・判断材料なし）は今回対象外のまま保持。分類の詳細は
  [MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md) / [reports/materials-pos-fill-plan.md](reports/materials-pos-fill-plan.md)参照）
- **word/meaningが空**（2026-07-02時点で0件）
- **タグ/カテゴリ不整合**（level/exam_typeが空、または表示色分け対象外の未知のlevel値。
  2026-07-02時点で1件・影響は表示上の色分けのみ）

異常値の急増（特に完全重複・word/meaning空欄）を見つけたら、原因（新規教材投入スクリプトの
不具合等）を確認してから対応する。**既存教材データの削除・上書きは、対象・件数・リスク・
ロールバック方法を事前報告してから実施する**（今後同様の作業を行う場合も同じ方針を継続する）。
完全重複行の削除は `npm run materials:dedupe:dry-run`（既定・DB変更なし）で計画を再生成でき、
実削除の `npm run materials:dedupe:apply` は環境変数`CONFIRM_MATERIALS_DEDUPE=yes`の明示指定と
ユーザーの事前承認がなければ実行してはいけない。品詞補完も同様に、`npm run materials:pos:dry-run`
（既定・DB変更なし）で計画を確認でき、`npm run materials:pos:apply`（要`CONFIRM_MATERIALS_POS_FILL=yes`）
はユーザーの事前承認がなければ実行してはいけない。

## 7. Vercelで見るべき項目

- **Deployments**: 直近デプロイの状態（READY/ERROR）、ビルド時間の異常な増加
- **Functions**: 実行時間・エラー率・タイムアウトの有無（特に `/api/wordbook/ensure-default`、`/api/teacher/*`、`/api/settings/srs`）
- **Environment Variables**: `NEXT_PUBLIC_SRS_V2` が Production に存在し続けているか（誤って削除されていないか）
  ```bash
  vercel env ls production | grep SRS
  ```
- **Usage/Billing**: Function実行時間・帯域が想定プラン内か
- **Domains**: `loop-vocabulary.app` のエイリアスが正しく最新デプロイを指しているか

## 8. Google Search Consoleで見るべき項目

登録手順・初回チェック項目・週次の見方は [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) に詳細をまとめた。ここでは巡回時の要点のみ:

- **インデックス状況**: `/sitemap.xml` 経由で送信したページが正しくインデックスされているか（エラー・除外の急増がないか）
- **検索パフォーマンス**: クリック数・表示回数・平均掲載順位の週次トレンド
- **カバレッジの警告**: 404・リダイレクトループ・モバイルユーザビリティの問題
- **手動対策・セキュリティの問題**: 通知が来ていないか
- **sitemap/robots.txtの整合性**: 認証必須ページが誤って混入していないか（2026-07-01に発見・修正済みの不整合パターン。今後ルート追加時は同様のチェックを行う）

> 登録前チェック（sitemap健全性・robots.txt整合性）は2026-07-01に実施・修正済み。GSCへの登録・sitemap送信はオーナー側の作業。詳細は [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) 参照。

## 9. AdSense/広告まわりで見るべき項目

> 2026-07-04: 広告ユニット「Loop Vocabulary Display Banner」（`data-ad-slot="5952840845"`）を
> 本番投入済み。`NEXT_PUBLIC_ADSENSE_SLOT_BANNER`をVercel Productionに設定し、表示箇所は
> `/dashboard`の1ページのみに限定（AdSenseが`Getting ready`のため最小限からスタート）。
> 詳細・拡大方針は [ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4 参照。

- **審査状況**: AdSense管理画面「サイト」でのステータス（2026-07-04時点: `Getting ready`。
  準備完了/レビュー中/要確認/不承認）を定期確認。承認後は広告表示の有無・収益発生を確認
  （確認手順は[ADSENSE_SETUP.md](ADSENSE_SETUP.md)§2）
- **`/dashboard`の広告表示**: レイアウト崩れがないか、配信の有無（AdSense管理画面「広告」→
  「サマリー」の表示回数・クリック率で確認可能になり次第）
- **広告表示エラー**: ブラウザコンソールでAdSense関連エラーが出ていないか
- **ads.txt / app-ads.txt**: 正しく公開され、AdSense/AdMobが要求する内容と一致しているか
  （2026-07-04確認: Web版`pub-5148247638505100`、App版`pub-7135124532952935`、いずれも
  `layout.tsx`/AdMob設定と一致）
- **プライバシーポリシーの広告記載**: Web版AdSense・Cookie利用・オプトアウト手段
  （2026-07-04追記済み）とアプリ版AdMobの両方が記載されているか
- **表示ポリシー遵守**: テスト中・復習中・入力テスト中に広告が出ていないか（README §7参照、実装済みのはずだが定期確認）
- **収益指標**: 表示回数・クリック率（CTR）・eCPMの異常値（極端な低下・停止）
- **Premium/広告非表示ユーザーへの誤配信がないか**: `is_premium=true`のユーザーに広告が出ていたら不具合

## 10. 収益化・成長 監査（2026-07-04実施）の運用への反映

事業・収益・継続率・SEO流入の観点での全体監査を実施し、結果を
[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)「💰 収益化・成長 監査」に記録した。
運用上、以下を継続的にウォッチする:

- **単語帳削除機能**（本監査で発見・修正したバグ）: `test:wordbook-delete`が週次`test:e2e`に
  含まれているため、退行があれば自動検知される
- **TOEIC/ビジネス教材**: 2026-07-04に4パック(計400語)を追加済み（優先度A項目21）。
  2026-07-05にさらに3パック（TOEIC頻出名詞100・経済/企業ニュース英単語100、計300語）を
  追加済み（優先度A項目27）。TOEIC教材は5件、ビジネス英語専用教材は4件（計15パック・
  1,450語）。`test:materials`/`test:materials:e2e`/`test:category-lps`に組み込み済みの
  ため退行があれば自動検知される
- **専門分野・ニュース語彙の拡充**: 経済・企業ニュースは2026-07-05に対応済み（優先度A項目27）。
  テクノロジー/IT・バイオ・医療の専門語彙デッキは引き続き未着手（優先度C項目15）。
  教材追加時は既存の`validate:materials`/`test:materials`基盤を使う
- **復習リカバリーモード**: 2026-07-04実装済み（優先度A項目22）。`/review`のdue件数20語以上で
  「まず10語だけ」「20語だけ進める」ボタンを表示。`test:recovery-mode`が週次`test:e2e`に
  含まれているため、退行があれば自動検知される。「リセット」「スケジュール再調整」は
  別タスクとして未着手のまま
- **ダッシュボードの習得率・苦手単語カード追加**: 2026-07-05実装済み（優先度A項目26）。
  習得率カード（習得済み/学習中/苦手の内訳・全体習得率・`/wordbooks`/`/review`導線）と
  苦手単語カード（上位5件・`/weak`導線・控えめなPremium導線）を追加。`test:dashboard-insights`が
  週次`test:e2e`に含まれているため、退行があれば自動検知される。あわせて`/weak/page.tsx`の
  既存バグ（苦手単語がある状態で開くと必ずサーバーレンダリングがクラッシュしていた）も
  今回発見・修正した
- **教材・辞書ページの内部リンク強化**: 2026-07-04実装済み（優先度A項目23）。関連教材
  セクション・教材⇄辞書の相互CTA・カテゴリクイックジャンプ等を追加。`test:internal-links`が
  週次`test:e2e`に含まれているため、新規教材追加時も関連教材表示の退行があれば自動検知される
- **カテゴリ別公開LP（TOEIC・ビジネス英語・ニュース英語）**: 2026-07-04に`/materials/toeic`・
  `/materials/business`の2LPを新設（優先度A項目24）、2026-07-05に3本目の`/materials/news`
  （経済/企業ニュース英単語100が主役）を新設（優先度A項目28）。`test:category-lps`が週次
  `test:e2e`に含まれているため、教材追加時・ルーティング変更時の退行があれば自動検知される。
  他カテゴリ（大学受験・英検・中学高校基礎・日常会話）のLPは未着手（効果を見てから検討）
- **カテゴリLPのSEO導線（sitemap/robots/canonical/構造化データ）**: 2026-07-04確認・修正済み
  （優先度A項目25）、2026-07-05に`/materials/news`分も同様に対応済み（優先度A項目28）。
  3LPすべてをsitemap.xmlに追加、canonicalを明示、`verify:seo-lp-audit`で週次・デプロイ後に
  自動検証。Search Consoleでのインデックス登録状況は
  [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md)§0-1でオーナー確認待ち

---

## 自動検証コマンドの運用

| コマンド | 実行タイミング | 目的 |
|---|---|---|
| `npm run test:dates` | 日付/streak/カレンダーに関わるコードを変更した時（`test:smoke`内でも自動実行） | JST日付ユーティリティの単体テスト（サーバ不要・数秒） |
| `npm run test:smoke` | **コード変更のコミット前**（ローカル） | build成功＋日付ユーティリティ＋主要ページのHTTP健全性を素早く確認 |
| `npm run test:e2e` | **本番デプロイ前**（大きめの変更時）／**週1定期** | onboarding・SRS V2・teacher・admin・教材インポート・4択出題ロジック・他学習モード出題ロジック・Premium判定回帰・学習モード入口/対象範囲ラベル・単語帳削除・復習リカバリーモード・内部リンク・カテゴリLP・ダッシュボード習得率/苦手単語カードの17フローを実ブラウザで通しで検証 |
| `npm run test:entry-points:e2e` | `/wordbooks/[id]`の導線・各モードのスコープラベル(`quiz-scope-label`)・PDFの`?book=`プリセレクトを変更した時 | 単語帳詳細ページの7導線(`choice`/`input`/`typing`/`listening`/`attack`/`pdf`/`review`)が`?book=`付きで存在すること・各モードのスコープラベル表示・PDFの対象語数・reviewのbook引き継ぎ・Premium有無の分岐を検証（33項目） |
| `npm run test:wordbook-delete` | 単語帳削除機能(`/api/wordbook/[id]` DELETE・`DeleteWordbookButton`)を変更した時 | 削除ボタン表示→削除実行→DB上でword_books・words両方が削除される→一覧/dashboard/reviewに残骸が出ない→削除済みIDへの直接アクセスが404、を実ブラウザで検証 |
| `npm run test:recovery-mode` | `/review`の復習リカバリーモード・FlipCardRunnerを変更した時 | 35語due時のバナー表示→10語モードでちょうど10語出題・DB更新→残り25語でバナー継続→20語モードで20語出題→残り5語でバナー消滅→通常復習は残り全件を出題、をbook指定スコープ隔離も含めて実ブラウザで検証 |
| `npm run test:internal-links` | 教材詳細の関連教材・辞書⇄教材の相互導線・`/materials`カテゴリクイックジャンプを変更した時 | カテゴリクイックジャンプ表示・関連教材表示（新規教材追加時の自動反映含む）・関連教材リンクの遷移・教材⇄辞書の相互導線・既存インポート導線の非破壊・モバイル幅での横スクロール無し、を実ブラウザで検証 |
| `npm run test:category-lps` | `/materials/toeic`・`/materials/business`・`/materials/news`・`/materials`のLP導線を変更した時 | 3LPの200表示・教材カード件数と内容（`/materials/news`は主役2件+関連教材3件を区別して検証）・教材詳細への遷移・辞書導線・LP間相互リンク（TOEIC⇄ビジネス英語⇄ニュース英語）・`/materials`からの導線・モバイル幅での崩れなし・既存`/materials/[id]`への非影響、を実ブラウザで検証 |
| `npm run test:dashboard-insights` | `/dashboard`の習得率カード・苦手単語カードを変更した時 | 0語ユーザーでのカード非表示・表示崩れ無し、通常ユーザーでの習得率内訳・苦手単語表示・`/wordbooks`/`/review`/`/weak`各リンク導線・非Premium向けPremium導線・重複タイル非存在、due単語20件以上での既存リカバリーヒントとの共存、モバイル幅(375px)での横スクロール無し、を実ブラウザで検証 |
| `npm run verify:seo-lp-audit` | sitemap.ts・robots.txt・カテゴリLPのmetadataを変更した時／**本番デプロイ後** | 本番の`/sitemap.xml`に主要ページ・3LPが含まれるか・`/robots.txt`が対象パスをブロックしていないか・3LPのcanonicalが自分自身を指すか・JSON-LD(BreadcrumbList/ItemList)が妥当なJSONか・既存`/materials/[id]`への非影響を、HTTPのみ（ブラウザ不要）で検証。`verify:prod`同様デフォルトで本番URLを対象とする |
| `npm run test:onboarding` | オンボーディング/辞書/ダッシュボード導線を変更した時 | 該当フローだけ素早く再検証 |
| `npm run test:srs` | SRSロジック・復習UIを変更した時 | 4段階評価とDB反映（ease/interval/streak/is_weak/correct/wrong）を検証 |
| `npm run test:teacher` | 先生機能・RLS・RPCを変更した時 | ロスター集計のみ表示・同意撤回/再同意・招待コードの再発行/無効化/期限管理を検証 |
| `npm run test:admin` | `/admin`配下のページを変更した時 | admin権限での表示・非admin/未ログイン時のリダイレクト・個別データ非開示・書き込み無しを検証（`test+admin@loop-vocabulary.app`使用） |
| `npm run test:quiz` (`npm run test:learning-selection`と同一) | `src/lib/learning/wordSelection.ts`を変更した時（DB不要・数秒） | 出題選定(未学習優先/due・weak重み付け/直近除外/出題キュー化)・選択肢生成(重複なし/空欄なし/正解1つ)の単体テスト。4択・input・typing・listening・attack全モード共通ロジックのため、ここでの検証が全モードの正しさを保証する |
| `npm run test:quiz:e2e` | 4択テスト(`/test/choice`)の出題ロジックを変更した時 | 未学習単語の優先出題・選択肢の健全性・正解後のSRS(correct_count)更新・`/review`/`/pdf`への回帰なしを実ブラウザで検証 |
| `npm run test:learning-modes:e2e` | input/typing/listening/attackのいずれかを変更した時 | 各モードで未学習単語が1問目に出ること・正解後にSRSフィールドが更新されること・attackの`?book=`単語帳スコープ（指定時は対象単語帳のみ・未指定時は全単語帳横断・対象範囲ラベル表示）・`/test/choice`/`/review`/`/pdf`/`/materials`への回帰なしを実ブラウザで検証（25項目） |
| `npm run test:premium-gating` | Premium判定（`profiles.is_premium`）を参照する箇所を変更した時 | `/wordbooks/[id]`・`/plan`・`/extract`・`/weak`の表示分岐と`/api/ai/weakness-analysis`・`/api/ai/extract-words`・`/api/wordbook/[id]/ai-suggest{,/add}`の403/非403分岐を非Premium/Premium両状態で検証、5学習モードへの回帰なしも確認（21項目） |
| `npm run validate:materials` | プリセット教材パック（`src/data/presets/*`）を追加・変更した時 | word/meaning空でない・教材内重複なし・pos/難易度が範囲内・タグが想定内かをDB不要で高速チェック。既存教材の監査レポートも非ブロッキングで再生成 |
| `npm run test:materials` | プリセット教材パックをDBに反映する前 | 静的検証→DB投入(冪等)→語数一致確認→インポート後SRS/PDF互換性確認→既存教材の非破壊確認までを一括実行 |
| `npm run test:materials:e2e` | 教材インポート導線（`/materials/[id]`・`ImportMaterialButton`・`/pdf`）を変更した時 | 未ログイン時CTA・インポート→単語帳作成→SRS既定値→PDF選択肢反映→再インポート時の重複防止、インポート後（新規・再訪問済み双方）のメインCTA(`/wordbooks/<id>`)・サブCTA(`/test/choice?book=`・`/pdf?book=`)遷移、および1000語超の既存教材(1,500語・2,000語)で総語数がSupabase既定の1000件で頭打ちにならず正しく表示されることを実ブラウザで検証（25項目） |
| `npm run validate:materials` / `npm run test:materials` | `src/lib/materials/existingMaterialMeta.ts`（既存31教材のgrade/purpose/tags等）や`presetMeta.ts`を変更した時 | 15スターターパック（2026-07-02の4パック+2026-07-04の8パック+2026-07-05の3パック）の静的品質チェック・既存教材の非破壊回帰ガード（31件以上維持・総語数0の教材なし）を確認。表示メタデータ自体の内容は`/materials`・`/materials/[id]`を目視確認する |
| `npm run audit:materials` | 既存教材データの品質状況を確認したい時（いつでも・読み取り専用） | DB上の全教材（既存31+新規パック）を監査し`MATERIALS_AUDIT.md`を再生成 |
| `npm run materials:dedupe:dry-run` | 完全重複行の削除計画を確認・更新したい時（いつでも・読み取り専用、DB変更なし） | 削除対象行・教材別内訳・バックアップ・ロールバックSQLを`reports/materials-duplicate-*`に生成 |
| `npm run materials:dedupe:apply` | **完全重複行を実際に削除する時（要ユーザーの事前承認 + `CONFIRM_MATERIALS_DEDUPE=yes`）** | dry-runと同じ計画に基づき`material_words`から完全重複行のみ削除。承認なしに実行しないこと |
| `npm run audit:materials-pos` | 品詞(pos)未設定の状況を確認したい時（いつでも・読み取り専用） | 未設定件数・教材別内訳・自動補完可否の分類を`MATERIALS_POS_AUDIT.md`に生成 |
| `npm run materials:pos:dry-run` | 品詞補完計画を確認・更新したい時（いつでも・読み取り専用、DB変更なし） | 補完候補・教材別内訳・ロールバックSQLを`reports/materials-pos-fill-*`に生成 |
| `npm run materials:pos:apply` | **品詞を実際に補完する時（要ユーザーの事前承認 + `CONFIRM_MATERIALS_POS_FILL=yes`）** | dry-runと同じ計画に基づき高信頼度ルール該当行のみposを補完。承認なしに実行しないこと |
| `npm run verify:prod` | **本番デプロイ直後 毎回**／毎日の軽い巡回 | 本番URLに対するHTTPのみの回帰確認（ブラウザ不要・数秒で完了） |
| `npm run verify:srs-global` | SRS V2のenvフラグを変更した時／週1定期 | グローバルフラグが実際に本番で効いているかを実ログインで確認 |

### 推奨フロー

- **通常の小さな修正**: `tsc --noEmit` → `npm run build` → `npm run test:smoke` → コミット → push → `npm run verify:prod`
- **SRS/teacher/onboarding に関わる変更**: 上記に加えて該当する `test:*` を実行してからコミット
- **大きめのリリース後**: `npm run test:e2e` をフルで一度回す
- **日次巡回**: `npm run verify:prod` だけで十分（軽量・高速）
- **週次巡回**: `npm run test:e2e` + `npm run verify:srs-global` + 上記チェックリスト

いずれのコマンドも `scripts/testing/` 配下に実装があり、テスト専用アカウント（`test+onboarding` / `test+srs` / `test+teacher`）とテストデータのみを使用する。実ユーザーのデータには一切触れない。
