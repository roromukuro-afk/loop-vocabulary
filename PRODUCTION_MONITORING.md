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

- [ ] `npm run test:e2e`（フルE2E一式）を実行し、5フロー（onboarding/dictionary・SRS V2・teacher・admin・教材インポート）が全PASSか
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

- **審査状況**: AdSense承認前か後かで対応が変わる。承認後は広告表示の有無・収益発生を確認
- **広告表示エラー**: ブラウザコンソールでAdSense関連エラーが出ていないか
- **ads.txt / app-ads.txt**: 正しく公開され、AdSense/AdMobが要求する内容と一致しているか
- **表示ポリシー遵守**: テスト中・復習中・入力テスト中に広告が出ていないか（README §7参照、実装済みのはずだが定期確認）
- **収益指標**: 表示回数・クリック率（CTR）・eCPMの異常値（極端な低下・停止）
- **Premium/広告非表示ユーザーへの誤配信がないか**: `is_premium=true`のユーザーに広告が出ていたら不具合

---

## 自動検証コマンドの運用

| コマンド | 実行タイミング | 目的 |
|---|---|---|
| `npm run test:dates` | 日付/streak/カレンダーに関わるコードを変更した時（`test:smoke`内でも自動実行） | JST日付ユーティリティの単体テスト（サーバ不要・数秒） |
| `npm run test:smoke` | **コード変更のコミット前**（ローカル） | build成功＋日付ユーティリティ＋主要ページのHTTP健全性を素早く確認 |
| `npm run test:e2e` | **本番デプロイ前**（大きめの変更時）／**週1定期** | onboarding・SRS V2・teacher・admin・教材インポートの5フローを実ブラウザで通しで検証 |
| `npm run test:onboarding` | オンボーディング/辞書/ダッシュボード導線を変更した時 | 該当フローだけ素早く再検証 |
| `npm run test:srs` | SRSロジック・復習UIを変更した時 | 4段階評価とDB反映（ease/interval/streak/is_weak/correct/wrong）を検証 |
| `npm run test:teacher` | 先生機能・RLS・RPCを変更した時 | ロスター集計のみ表示・同意撤回/再同意・招待コードの再発行/無効化/期限管理を検証 |
| `npm run test:admin` | `/admin`配下のページを変更した時 | admin権限での表示・非admin/未ログイン時のリダイレクト・個別データ非開示・書き込み無しを検証（`test+admin@loop-vocabulary.app`使用） |
| `npm run validate:materials` | プリセット教材パック（`src/data/presets/*`）を追加・変更した時 | word/meaning空でない・教材内重複なし・pos/難易度が範囲内・タグが想定内かをDB不要で高速チェック。既存教材の監査レポートも非ブロッキングで再生成 |
| `npm run test:materials` | プリセット教材パックをDBに反映する前 | 静的検証→DB投入(冪等)→語数一致確認→インポート後SRS/PDF互換性確認→既存教材の非破壊確認までを一括実行 |
| `npm run test:materials:e2e` | 教材インポート導線（`/materials/[id]`・`ImportMaterialButton`・`/pdf`）を変更した時 | 未ログイン時CTA・インポート→単語帳作成→SRS既定値→PDF選択肢反映→再インポート時の重複防止を実ブラウザで検証 |
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
