# PRODUCTION_MONITORING — Loop Vocabulary 本番監視ガイド

> 「安定運用フェーズ」における日次/週次の確認項目と、異常時に見るべきポイントをまとめる。
> 実行コマンドの詳細は本書末尾「自動検証コマンドの運用」も参照。

---

## 1. 毎日確認する項目（5分程度）

- [ ] `npm run verify:prod` — 公開ページ200・認証ページ307・API 405の回帰、および
  Stripe/Premium関連（`profiles.stripe_customer_id`/`premium_expires_at`列の存在・
  checkout/webhookルートの存在・ダッシュボード広告のisPremiumガード）の回帰がないか
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
- **ゲーミフィケーション×リワードチケット連携「今日の達成チケット」**: 2026-07-05実装済み
  （優先度A項目29）。今日の学習達成・復習10語達成・苦手単語を復習・7日連続達成の4種を
  チケット風に表示。判定ロジックは`src/lib/gamification/rewardTickets.ts`に純粋関数として
  切り出し、`test:gamification-rewards`（週次`test:smoke`にも自動組み込み）で閾値・境界値を
  検証。`test:dashboard-insights`（週次`test:e2e`）で実データとの整合性・既存カードとの
  共存も検証。同日中に、安全性を調査した上で`reward_tickets`への実付与（1日1枚まで、
  `POST /api/gamification/claim-daily-ticket`、既存の広告視聴チケットとは別kind
  `daily_achievement`）まで実装した（優先度A項目30）。`test:reward-ticket-claim`
  （週次`test:e2e`）で未達成時の拒否・達成後1枚のみ受取・同日2回目拒否・リロード後も
  増えないこと・既存チケットとの非干渉を検証。2026-07-05にはさらに、`reward_tickets`に
  `kind='daily_achievement'`のみを対象にした部分ユニークインデックス
  （`migrations/014_daily_achievement_ticket_unique.sql`、キーは
  `user_id` + JST日付）を追加し、DB側でも1日1枚を完全に保証する形に強化した（優先度A
  項目31）。同時多重リクエストでも1枚しか作成されないことを`test:reward-ticket-claim`に
  追加した8件同時POSTのシナリオで検証済み。さらに2026-07-05、`reward_tickets`の
  kind別の付与元・消費先を全種類調査した結果、実際に機能している消費先は`ai_generation`
  （AI利用上限バイパス）のみで、`extra_review`は付与のみ・消費コード無し、`daily_achievement`
  も同様に消費先が無いことが判明。無料付与を既存のAI利用上限バイパスに接続すると
  Premium価値を薄める懸念があるため、`daily_achievement`は「交換可能なチケット」では
  なく「達成の記録（スタンプ）」としてUI文言を整理する方針を採用した（優先度A項目32）。
  `TodayRewardTickets.tsx`/`ClaimDailyTicketButton.tsx`の文言を「チケットを受け取る」→
  「達成を記録する」に変更し、ダッシュボードに累計「通算◯日分を記録済み」表示を追加。
  DBスキーマ・kind値・付与/二重防止ロジック・API応答フィールド名は無変更。さらに
  同日、`extra_review`（`FlipCardRunner.tsx`「もう一周チャレンジ」/`ChoiceTestRunner.tsx`
  「もう10問チャレンジ」）が広告視聴で付与されるものの消費コードが一切無く、
  `used_amount`が永久に0のまま溜まり続けていた問題に対応（優先度A項目33）。
  `restart()`/`onRewardedExtra()`が広告視聴直後に結果をその場で使い切る設計のため
  「後で使うために貯める」余地が無く、加えて同じ内容を無料で提供する「もう一度」
  ボタンが既に並存していたため、真に消費するチケット化（案A）は不自然と判断し、
  `reward_tickets`への永続化自体をやめる方針（案B）を採用した
  （`src/lib/native/rewards.ts`の`INSTANT_USE_REWARD_KINDS`）。`ai_generation`等
  ほかのkindの付与・消費ロジック、既存の`extra_review`データ（本番9件）は無変更。
  `test:extra-review-ticket`（週次`test:e2e`）で広告視聴後に復習/4択テストが実際に
  再開されること・DBに新規行が作られないこと・ほかのkindへの非干渉を検証。
  さらに同日、広告なしの「もう一度」ボタンが広告ゲート版とほぼ同じ内容を無料提供して
  おり広告視聴の価値が実質的に無かった問題を解消（優先度A項目34）。
  `FlipCardRunner.tsx`は無料=「間違えた◯語だけもう一度」（誤答時のみ表示、
  `wrongPool`に絞り込んだ`sessionPool`を再出題）・広告=「広告を見てもう一周
  チャレンジ」（元の全語を再出題、無変更）に役割分担。`ChoiceTestRunner.tsx`は
  無料=「同じ問題をもう一度」（`qs`を再構築せず全く同じ問題を再演習）・
  広告=「広告を見て別の10問に挑戦」（新しい問題セットを選び直す、関数は無変更）
  に役割分担。Premium判定は追加していない（無料/広告の役割分担であり
  Premium/無料の差別化ではない）。`extra_review`のreward_tickets非永続化は維持。
  `test:extra-review-ticket`を拡張（15項目）し、無料ボタンのラベル・実際の
  出題件数の絞り込み・広告ボタンでの全語/新問題再開・DB非干渉を検証。
- **AI弱点分析のMVP整理・強化**: 2026-07-05実装済み（優先度A項目35）。`/weak`と
  Premium向けAI分析（`/api/ai/weakness-analysis`）はすでに実装済みだったことが
  調査で判明。無料ユーザーでも品詞別・単語帳別・習熟度別の傾向が分かる決定論的な
  「傾向を確認」セクション（AI不要、`data-testid="weak-trend-summary"`）を新設し、
  各単語行にも品詞バッジ・単語帳名・習熟度%を追加表示。「今すぐ復習する」
  「まず10語だけ復習する」の復習導線も新設（既存の`/review`リカバリーモードを再利用、
  SRS V2中核ロジックは無変更）。Premium向けAI分析が失敗した場合は、常時表示の
  「傾向を確認」セクションへ誘導する一文をエラーメッセージに追加し、ページが
  手詰まりに見えないようにした。AIに送るデータ・`ai_generation`チケットの消費仕様は
  無変更。`test:weak-analysis`（週次`test:e2e`）で一覧・傾向集計・復習導線・
  非Premium案内・Premium実行結果・ダッシュボード連携を検証。
- **Premium導線とプランページの棚卸し・改善**: 2026-07-05実装済み（優先度A項目36）。
  Premium導線を監査した結果、`/dashboard`の広告(`BannerAdPlaceholder`)が
  `isPremium`ガード無しで表示されており、「広告完全なし」という/premium・
  /settings・/dashboardの訴求と矛盾していた不具合を修正（`{!isPremium && ...}`で
  ラップ）。あわせて`/weak`・`/extract`・`/plan`・`/settings`のPremium誘導CTAを
  「月額 ¥480〜 プレミアムを見る →」に統一。**重大発見**: `profiles.
  stripe_customer_id`/`premium_expires_at`列が本番に存在せず（migrations/
  003_stripe_premium.sqlが本番未適用）、`/premium`ページ・Stripe
  checkout/webhookが正しく動作していなかった。オーナー承認の上、追加専用の
  安全なマイグレーション（列追加2件＋インデックス1件）を本番へ適用。適用後、
  Stripeの実データ（読み取り専用）を確認し、本番のサブスクリプションは0件
  （実ユーザー4件・Premium 0件）で実害は無かったことを確認済み。あわせて
  `POST /api/stripe/checkout`に「既にPremiumなら409 already_premium」の
  防御的ガードを追加（二重課金防止）。`test:premium-conversion`（週次
  `test:e2e`）でPremium表示切り替え・チェックアウトボタン制御・CTA統一・
  ペイウォール表示・広告ガードのソース確認を検証。既存`test:premium-gating`は
  CTA文言変更に伴いアサーションを更新（動作自体は無変更）。
  **残課題**: `/premium`の利用者数・評価・体験談はプレースホルダーの可能性が
  高く（本番実ユーザー4件・Premium 0件と乖離）、マーケティング判断のため
  オーナー確認待ち（詳細はNEXT_IMPROVEMENTS.md参照）。
  → **2026-07-05、オーナー承認を得て下記項目で対応済み。**
- **実データと乖離した社会的証明・マーケティング文言の棚卸しと修正**
  （2026-07-05、NEXT_IMPROVEMENTS.md優先度A項目37）: 上記残課題への対応。
  `/premium`の「3,200+登録ユーザー」「4.8★ユーザー評価」「42万語学習済み単語」の
  統計カードと3件の架空testimonials（「ユーザーの声」セクション）を削除し、
  機能ベースの価値訴求（広告非表示・AI利用無制限・PDF出力無制限）に置換。
  トップページ(`/`)は`getPublicStats()`の虚偽の下駄履き表示（実データ不足時に
  「3,200人」等の固定値を出す実装）を撤去して実教材冊数のみを返すよう簡素化し、
  ヒーローバッジ・「数字で訴求」セクション・見出し「こんな人に選ばれています」を
  機能ベースの文言に置換、6件の架空testimonialsと「英語が変わった人たちの声」
  セクションを削除、schema.orgのJSON-LDの未実証`aggregateRating`を削除した。
  実ユーザー数（4件）は非公開のまま。教材冊数のような「コンテンツ量」の実データは
  「ユーザー数」ではないため維持。`test:premium-conversion`（週次`test:e2e`）に
  誇張文言の残存チェックを2ステップ追加。
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

## 11. Stripe決済・Premium反映で見るべき異常（2026-07-06整備）

2026-07-05に発覚した「`profiles.stripe_customer_id`/`premium_expires_at`列が
本番に存在せずStripe連携が壊れていた」重大不具合の再発を早期検知するため、
checkout作成→webhook受信→Premium反映までの一連のフローを検証・監視できるように
した。以下は異常が疑われる場合の確認手順。

### 11-1. 「Stripeで支払い済みなのにPremiumにならない」

1. Stripe Dashboard → 該当顧客の Payments/Subscriptions で決済が実際に成功しているか確認
2. Stripe Dashboard → Developers → Webhooks → 対象endpoint → 直近のイベント配信ログで
   `checkout.session.completed` が届いているか、ステータスが 200 か確認
3. 200でない場合は §11-2「Webhookが失敗している」へ
4. 200なのにPremiumにならない場合は、Vercel Runtime Logs（`get_runtime_errors` /
   `get_runtime_logs`、`routes=/api/stripe/webhook`）でエラーが出ていないか確認
5. `npm run verify:prod` の「Stripe/Premium schema columns」セクションで
   `profiles.stripe_customer_id`/`premium_expires_at`列が存在するかを再確認
   （2026-07-05と同じ不具合の再発がないか）

### 11-2. 「Webhookが失敗している」

1. Stripe Dashboard → Developers → Webhooks → 対象endpointの配信ログで、
   400（署名検証エラー）が続いていないか確認
2. 400が続く場合、**そのendpointのsigning secretとVercel Productionの
   `STRIPE_WEBHOOK_SECRET`が一致していない可能性が高い**（2026-07-06に発覚した
   重複endpoint問題と同種の原因。詳細は §11-5）
3. `npm run verify:prod` の「Stripe routes exist」セクションで
   `/api/stripe/webhook`が404になっていないか（ルート自体が消えていないか）確認
4. `npm run test:stripe-premium-webhook` を実行し、署名付きテストイベントが
   正常に処理されるか（ローカル/プレビュー環境で）確認

### 11-3. 「is_premiumが更新されない」「premium_expires_atが入らない」

1. `npm run test:stripe-premium-webhook` を実行し、
   checkout.session.completed / customer.subscription.updated /
   customer.subscription.deleted の3イベントそれぞれで
   `is_premium`/`premium_expires_at`が正しく更新されるかを確認
   （テストアカウントのみ操作、実顧客データには触れない）
2. 失敗する場合は `src/app/api/stripe/webhook/route.ts` の該当`case`分岐と
   本番Vercel Runtime Logsの`[stripe webhook]`ログ・例外を突き合わせる

### 11-4. 「Premiumユーザーなのにcheckoutに進めてしまう」「Premiumユーザーなのに広告が出る」

1. `npm run test:premium-gating`・`npm run test:premium-conversion`
   （二重checkout防止の409ガード・ダッシュボード広告のisPremiumガードを検証）を実行
2. `npm run verify:prod` の「Premium ad-hide guard (source check)」セクションで
   `dashboard/page.tsx`の`BannerAdPlaceholder`が`isPremium`ガードでラップされたままか確認

### 11-5. Webhook endpointの重複問題（2026-07-06発見）

調査の結果、Stripe本番アカウントに `https://loop-vocabulary.app/api/stripe/webhook`
（Vercelのデフォルトドメイン経由を含む）へ向くWebhook endpointが**2本**登録されており、
`checkout.session.completed`・`customer.subscription.deleted`が重複配信される設定に
なっていたことが判明した（片方は`customer.subscription.updated`を購読しておらず、
Vercel Productionの`STRIPE_WEBHOOK_SECRET`と一致しない方のendpointからのイベントは
署名検証エラー(400)で静かに失敗している可能性があった）。発覚時点で実サブスクリプション
は0件のため実害はなかった。

対応（2026-07-06完了）: `customer.subscription.updated`を含む正しいイベント構成の
endpoint（`we_1TiSuwIEd2EBa26eUb2n0pTB`）を残し、オーナーがStripe Dashboard上で
そのsigning secretをroll（再発行。Stripeの公開APIにはroll操作が無くDashboard操作
でのみ可能なためオーナーが実施）し、新しいsecretをVercel Production
`STRIPE_WEBHOOK_SECRET`に反映・redeployした（`verify:prod`/`verify:srs-global`で
回帰なしを確認）。もう片方のendpoint（`we_1Tm4GYIEd2EBa26eIJSWfLUa`、
`customer.subscription.updated`不足）は、誤って必要な方を消すリスクを避けるため
**削除ではなくまず無効化**した（`status: "disabled"`。DBスキーマ・Stripe価格・
既存ユーザーのis_premiumへの変更は無し）。secret値自体はログ・ドキュメントの
いずれにも記録していない。

無効化後、Vercel Runtime Logsで`/api/stripe/webhook`への直近7日間のアクセスを
確認したところ、記録されている400（署名検証エラー）は2件のみで、いずれも
このラウンドの`verify:prod`の意図的なテスト（不正signatureで400を期待する
チェック）自体によるものと時刻が一致しており、実際のStripeからの配信失敗による
ものではないことを確認した。実サブスクリプションは0件のため実害はない。

**保留した項目**: 本番live endpointへの疑似テストイベント送信（Stripe Dashboardの
「Send test webhook」）は、安全に本番へ影響を与えない実施手段が確認できなかったため
今回は見送った。本番小額決済・本番checkout sessionの作成も行っていない。
初回の実課金が発生した際に、Stripe Dashboardの配信ログと本番`profiles`の
`is_premium`/`stripe_customer_id`/`premium_expires_at`が正しく反映されているかを
実データで確認することを残課題とする。

**今後の注意**: Webhook endpointを新規に追加する際は、既存のendpoint一覧
（Stripe Dashboard → Developers → Webhooks）を必ず確認し、同一URLへの重複登録を
避けること。

---

## 自動検証コマンドの運用

| コマンド | 実行タイミング | 目的 |
|---|---|---|
| `npm run test:dates` | 日付/streak/カレンダーに関わるコードを変更した時（`test:smoke`内でも自動実行） | JST日付ユーティリティの単体テスト（サーバ不要・数秒） |
| `npm run test:gamification-rewards` | `src/lib/gamification/rewardTickets.ts`（今日の達成チケット判定ロジック）を変更した時（`test:smoke`内でも自動実行） | 4種チケットの閾値・境界値・次の達成ヒント選択・全達成時の判定を単体テスト（サーバ不要・数秒、19項目） |
| `npm run test:smoke` | **コード変更のコミット前**（ローカル） | build成功＋日付ユーティリティ＋主要ページのHTTP健全性を素早く確認 |
| `npm run test:e2e` | **本番デプロイ前**（大きめの変更時）／**週1定期** | onboarding・SRS V2・teacher・admin・教材インポート・4択出題ロジック・他学習モード出題ロジック・Premium判定回帰・学習モード入口/対象範囲ラベル・単語帳削除・復習リカバリーモード・内部リンク・カテゴリLP・ダッシュボード習得率/苦手単語カード・今日の達成チケット実付与の18フローを実ブラウザで通しで検証 |
| `npm run test:entry-points:e2e` | `/wordbooks/[id]`の導線・各モードのスコープラベル(`quiz-scope-label`)・PDFの`?book=`プリセレクトを変更した時 | 単語帳詳細ページの7導線(`choice`/`input`/`typing`/`listening`/`attack`/`pdf`/`review`)が`?book=`付きで存在すること・各モードのスコープラベル表示・PDFの対象語数・reviewのbook引き継ぎ・Premium有無の分岐を検証（33項目） |
| `npm run test:wordbook-delete` | 単語帳削除機能(`/api/wordbook/[id]` DELETE・`DeleteWordbookButton`)を変更した時 | 削除ボタン表示→削除実行→DB上でword_books・words両方が削除される→一覧/dashboard/reviewに残骸が出ない→削除済みIDへの直接アクセスが404、を実ブラウザで検証 |
| `npm run test:recovery-mode` | `/review`の復習リカバリーモード・FlipCardRunnerを変更した時 | 35語due時のバナー表示→10語モードでちょうど10語出題・DB更新→残り25語でバナー継続→20語モードで20語出題→残り5語でバナー消滅→通常復習は残り全件を出題、をbook指定スコープ隔離も含めて実ブラウザで検証 |
| `npm run test:internal-links` | 教材詳細の関連教材・辞書⇄教材の相互導線・`/materials`カテゴリクイックジャンプを変更した時 | カテゴリクイックジャンプ表示・関連教材表示（新規教材追加時の自動反映含む）・関連教材リンクの遷移・教材⇄辞書の相互導線・既存インポート導線の非破壊・モバイル幅での横スクロール無し、を実ブラウザで検証 |
| `npm run test:category-lps` | `/materials/toeic`・`/materials/business`・`/materials/news`・`/materials`のLP導線を変更した時 | 3LPの200表示・教材カード件数と内容（`/materials/news`は主役2件+関連教材3件を区別して検証）・教材詳細への遷移・辞書導線・LP間相互リンク（TOEIC⇄ビジネス英語⇄ニュース英語）・`/materials`からの導線・モバイル幅での崩れなし・既存`/materials/[id]`への非影響、を実ブラウザで検証 |
| `npm run test:dashboard-insights` | `/dashboard`の習得率カード・苦手単語カード・今日の達成チケットを変更した時 | 0語ユーザーでのカード非表示（習得率/苦手単語）・「今日の達成チケット」の0語表示崩れ無し、通常ユーザーでの習得率内訳・苦手単語表示・「今日の達成チケット」が実際の`daily_stats`と整合していること・`/wordbooks`/`/review`/`/weak`各リンク導線・非Premium向けPremium導線・重複タイル非存在、due単語20件以上での既存リカバリーヒントとの共存（習得率/苦手単語/今日の達成チケットいずれも）、モバイル幅(375px)での横スクロール無し、を実ブラウザで検証 |
| `npm run test:reward-ticket-claim` | `/api/gamification/claim-daily-ticket`・`ClaimDailyTicketButton`・`TodayRewardTickets`・`reward_tickets`のDB制約を変更した時 | 未達成時はボタンが押せずAPI直接呼び出しも400 not_eligibleで拒否・達成後はボタンから1枚だけ記録できる・同日2回目は409 already_claimedで拒否され行数が増えない・リロード後も「記録済み」表示と累計「通算◯日分」表示が維持され行数が増えない・0語ユーザーで崩れない・既存の広告視聴チケット(kind=ai_generation等)と混ざらない・モバイル幅での崩れなし・8件同時POSTでもDBの部分ユニークインデックスにより1枚しか作成されない、を実ブラウザ+DB直接確認で検証（23項目） |
| `npm run test:extra-review-ticket` | `src/lib/native/rewards.ts`(`watchRewardedAndGrant`)・`FlipCardRunner.tsx`・`ChoiceTestRunner.tsx`の広告視聴導線・無料/広告再挑戦の役割分担を変更した時 | FlipCardRunnerで誤答時のみ無料「間違えた◯語だけもう一度」が表示されクリックで実際にその語だけに絞り込まれる・全問正答時は広告ボタンのみ残る・広告ボタンでは元の全語が再出題される、ChoiceTestRunnerで無料「同じ問題をもう一度」が全く同じ問題(`data-word-id`順)を再演習する・広告「別の10問に挑戦」で新しい問題セットが始まる、いずれも`reward_tickets(kind=extra_review)`に新規行が作られない・`ai_generation`/`daily_achievement`等ほかのkindの行数が変化しない・0語ユーザーで`/review`が崩れない、を実ブラウザ+DB直接確認で検証（15項目） |
| `npm run test:weak-analysis` | `src/app/weak/page.tsx`・`WeaknessAnalysis.tsx`・`api/ai/weakness-analysis/route.ts`を変更した時 | 苦手単語ありユーザーで一覧・品詞/単語帳/習熟度バッジ・「傾向を確認」の集計(品詞別/単語帳別/習熟度低い順)が正しい・「今すぐ復習する」「まず10語だけ復習する」から実際に`/review`へ遷移する・苦手単語なしユーザーで崩れない・非Premiumで控えめな案内・PremiumでAI分析実行結果(成功/失敗いずれもページが壊れない)・`reward_tickets(kind=ai_generation)`に影響なし・ダッシュボードの苦手単語カードからの遷移、を実ブラウザ+DB直接確認で検証（20項目） |
| `npm run test:premium-conversion` | `/premium`・トップページ(`/`)・`PremiumCheckout.tsx`・Stripe checkout/webhookルート・各Premium gatingページのCTA文言・`dashboard/page.tsx`の広告表示・マーケティング文言を変更した時 | 非Premiumで料金比較表・チェックアウトボタンが表示される・Premiumで「現在プレミアム会員です」表示に切り替わりチェックアウトボタンが消える・`POST /api/stripe/checkout`がPremium時に409 already_premiumを返す（二重課金防止）・`/weak`/`/extract`/`/plan`のPremium誘導CTAが統一文言になっている・`/test/typing`/`/test/listening`のペイウォール表示・`/premium`のモバイル崩れなし・ダッシュボード広告のisPremiumガードをソースコードで確認・`/premium`とトップページ(`/`)に実データと乖離した誇張・社会的証明の文言（「3,200+登録ユーザー」「ユーザーの声」等）が残っていないこと・トップページのJSON-LDに未実証`aggregateRating`が含まれていないこと、を実ブラウザ+API直接確認で検証（2026-07-05に2ステップ追加） |
| `npm run test:stripe-premium-webhook` | `src/app/api/stripe/checkout/route.ts`・`src/app/api/stripe/webhook/route.ts`・Premium反映フローを変更した時 | 署名付きテストイベント（`Stripe.webhooks.generateTestHeaderString`、実Stripe通信なし・実課金なし）で、不正signatureの400拒否・未知イベントタイプでの非クラッシュ・存在しない顧客ID/ユーザーIDでの非クラッシュ・`checkout.session.completed`でのis_premium/premium_expires_at反映・webhookで付与したis_premiumが実際に`/premium`のPremium機能解放に反映されること・二重checkout防止(409)・未ログインcheckout(401)・`customer.subscription.updated`(active/canceled期限反映)・`customer.subscription.deleted`(即時失効)を検証（2026-07-06新規、`run-e2e.mjs`ステップ22として追加、20項目）。テスト用アカウントのみ操作し、実Stripe顧客・実メール送信は一切発生しない設計 |
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
| `npm run verify:prod` | **本番デプロイ直後 毎回**／毎日の軽い巡回 | 本番URLに対するHTTPのみの回帰確認（ブラウザ不要・数秒で完了）。2026-07-06からStripe/Premium関連の読み取り専用チェックも含む: `profiles.stripe_customer_id`/`premium_expires_at`列の存在確認（Supabase service roleでの1行select、DB変更なし）・`/api/stripe/checkout`/`/api/stripe/webhook`が404になっていないか（想定される401/400が返るか）・`dashboard/page.tsx`のBannerAdPlaceholderが`isPremium`ガードされたままか（ソース確認） |
| `npm run verify:srs-global` | SRS V2のenvフラグを変更した時／週1定期 | グローバルフラグが実際に本番で効いているかを実ログインで確認 |

### 推奨フロー

- **通常の小さな修正**: `tsc --noEmit` → `npm run build` → `npm run test:smoke` → コミット → push → `npm run verify:prod`
- **SRS/teacher/onboarding に関わる変更**: 上記に加えて該当する `test:*` を実行してからコミット
- **大きめのリリース後**: `npm run test:e2e` をフルで一度回す
- **日次巡回**: `npm run verify:prod` だけで十分（軽量・高速）
- **週次巡回**: `npm run test:e2e` + `npm run verify:srs-global` + 上記チェックリスト

いずれのコマンドも `scripts/testing/` 配下に実装があり、テスト専用アカウント（`test+onboarding` / `test+srs` / `test+teacher`）とテストデータのみを使用する。実ユーザーのデータには一切触れない。
