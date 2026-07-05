# WORK_HISTORY — Loop Vocabulary

> 作業の時系列ログ。新しいものを上に追記する。
> 最終更新: 2026-07-05

---

## 2026-07-05 無料再挑戦と広告再挑戦の役割分担を整理

**目的**: 前回のextra_review調査で見つかった残課題「広告なしの『もう一度』ボタンが、
広告ゲート版とほぼ同じ内容を無料・無制限に提供しており、広告視聴の価値が実質的に
無い」問題に対応する。広告視聴による追加復習の価値を持たせつつ、無料再挑戦の
学習体験も破綻させない形で役割を分担する。

**調査結果**:
- **FlipCardRunner.tsx**（復習フラッシュカード完了画面）: 従来の無料`もう一度`
  ボタンは`restart()`（`setIdx(0)`で最初から元の全語を出題）を呼ぶだけで、
  広告ボタン「広告を見てもう一周チャレンジ」の`onReward={restart}`と**全く同一の
  関数**を呼んでいた。広告を見ても見なくても結果は完全に同じだった。
- **ChoiceTestRunner.tsx**（4択テスト完了画面）: 従来の無料`もう一度`ボタンは
  `buildQuestions(pool, mode, count, recentIdsRef.current)`で新しい問題を選び直す
  実装で、広告ボタン「広告を見てもう10問チャレンジ」の`onRewardedExtra`
  （`buildQuestions(pool, mode, Math.min(10, pool.length), recentIdsRef.current)`）
  とほぼ同じ内容（`count`が10前後の設定なら実質同一）だった。
- **Premium/無料の挙動差**: 無し（前回調査時と同様、両ボタンともプラン判定
  `is_premium`を一切参照していない）。
- **広告未設定・未配信の場合の挙動**: `ADS_ENABLED`（`NEXT_PUBLIC_ADS_ENABLED`）が
  `false`の場合、`AppRewardedAdButton`自体が`null`を返し非表示になる
  （`src/components/ads/AppAds.tsx`）。この場合でも無料ボタンは独立して機能するため、
  広告未配信時に復習・テストの継続手段が完全に失われることはない。
- **`watchRewardedAndGrant()`の現在の使われ方**: 前回（2026-07-05、`extra_review`
  ラウンド）の変更により、`extra_review`は広告視聴（またはWeb版の擬似待機）完了後、
  `reward_tickets`への書き込みを行わず成否のみを返す設計になっている。今回の変更は
  この関数自体には手を加えていない（呼び出し元のボタンの役割分担のみを変更）。
- **参考実装**: `src/app/learn/LearnRunner.tsx`には元々「間違えた単語だけもう一度」
  （誤答のみに絞った無料再挑戦ボタン）が既に存在しており、今回採用した設計方針
  （誤答限定の無料復習）の社内前例として踏襲した。

**判断**: オーナー提案の「案A: 無料再挑戦と広告再挑戦の役割を分ける」を採用した。

**採用した方針・実装内容**:
- **FlipCardRunner.tsx**: 新しく`sessionPool`（現在出題中のキュー）と`wrongPool`
  （このセッションで「まだ」と答えた語のリスト）という2つのstateを追加。
  - 無料ボタン「間違えた{n}語だけもう一度」（`wrongPool.length > 0`のときのみ表示）:
    `sessionPool`を`wrongPool`に絞り込んでリセットする`retryWrongOnly()`を新設。
  - 広告ボタン「広告を見てもう一周チャレンジ」（文言・関数`restart()`とも無変更）:
    `sessionPool`を元の`pool`（プロパティ、全語）にリセットする。
  - 全問正答した場合（`wrongPool.length === 0`）は無料ボタンを非表示にし、広告
    ボタンのみを継続手段として残す。ただし広告ボタン自体が出ない4語未満のプールでは、
    代替手段が無くなってしまわないよう、無料の全語再挑戦（従来の`もう一度`相当）を
    フォールバックとして残した。
  - ヘッダーの進捗表示（`{idx+1}/{sessionPool.length}`、`data-testid="flip-progress"`
    を新規付与）・進捗バー・完了判定はすべて`sessionPool`基準に変更。リカバリー
    モードの残数計算（`recoveryTotalDue ?? pool.length`）は元の`pool`プロパティ基準の
    ままで変更していない。
- **ChoiceTestRunner.tsx**: 無料ボタンの関数を`restart()`から`retrySameQuestions()`
  に変更し、`buildQuestions()`を呼ばず`qs`（直前の問題セット）をそのまま使い回して
  idx/results/pickedのみリセットするようにした（＝全く同じ問題が再出題される）。
  広告ボタンの関数`onRewardedExtra`は無変更（新しい問題セットを選び直す）。
- **修正したUI文言**:
  - FlipCardRunner: 「もう一度」→ 条件付きで「間違えた{n}語だけもう一度」
    （誤答が無い場合、4語以上のプールでは非表示、4語未満では「もう一度」のまま）。
    広告ボタンの文言は無変更。
  - ChoiceTestRunner: 「もう一度」→「同じ問題をもう一度」。
    「広告を見てもう10問チャレンジ」→「広告を見て別の10問に挑戦」。

**Premiumユーザーへの影響**: なし。Premium判定は追加していない（無料/広告の役割
分担であり、Premium/無料の差別化ではない）。

**無料ユーザーへの影響**: 誤答した語だけを無料で再確認する権利は維持・明確化した
（「間違えた語だけ」という的を絞った復習は、全語を漫然と再演習するより学習効率が
高いという判断で、意図的に無料のまま残した）。全問正答時や、同じ問題セットを
もう一度解きたい場合の「まっさらな全語再挑戦」「新しい問題セット」は無料では
得られなくなったが、4語未満のプールでは引き続き無料の全語再挑戦を提供しており、
過度な制限感は出していないと判断した。

**extra_review保存停止の維持**: 変更なし。両ボタンとも`AppRewardedAdButton`経由で
`watchRewardedAndGrant("extra_review")`を呼ぶ構造自体は無変更のため、
`INSTANT_USE_REWARD_KINDS`による`reward_tickets`非永続化（前回ラウンド）はそのまま
維持されている。

**変更ファイル**: `src/components/review/FlipCardRunner.tsx`
（`sessionPool`/`wrongPool`state追加、`retryWrongOnly()`新設、`restart()`修正、
進捗表示のdata-testid追加）、`src/app/test/choice/ChoiceTestRunner.tsx`
（`retrySameQuestions()`に変更、ボタン文言変更）、
`scripts/testing/e2e/extra-review-ticket.mjs`（シナリオ拡張）、
`NEXT_IMPROVEMENTS.md`、`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**追加・更新したテスト**: `scripts/testing/e2e/extra-review-ticket.mjs`を拡張
（12項目→15項目）:
1. FlipCardRunnerで1語だけ誤答した状態から、無料ボタンが「間違えた1語だけもう一度」
   に限定されること・広告ボタンも並行して表示されることを確認。
2. 無料ボタンをクリックすると、実際にセッションが1語だけに絞り込まれること
   （進捗表示`1 / 1`を確認）。
3. その1語も正答すると、無料の「間違えた語だけもう一度」ボタンが消えること。
4. 広告ボタンをクリックすると、元の全4語が再出題されること（進捗表示`1 / 4`を確認）。
5. ChoiceTestRunnerで無料ボタンが「同じ問題をもう一度」に変わっていること・
   クリックすると`data-word-id`の順序が完全一致する同一問題が再出題されること。
6. 広告ボタンが「広告を見て別の10問に挑戦」に変わっており、クリックで実際に
   4択テストが再開されること。
7. いずれの操作でも`reward_tickets(kind=extra_review)`に新規行が作られないこと・
   `ai_generation`/`daily_achievement`等ほかのkindが一切影響を受けないこと。
8. 0語ユーザーでも`/review`が崩れないこと。

**検証結果**: `tsc --noEmit`（エラー無し）/ `build`（成功）/ `test:smoke`（全PASS）/
`test:extra-review-ticket`（15項目、全PASS）/ `test:e2e`（19フロー全PASS、
既存回帰なし）/ `verify:prod`（全PASS）/ `verify:srs-global`（V2グローバルフラグ
本番反映を再確認、全PASS）。

**残課題**: なし。無料・広告それぞれの役割が明確に分かれ、広告視聴に実質的な価値
（新しい問題セット・全語の再周回）が生まれた。将来的にChoiceTestRunnerの「別の10問」
に苦手単語優先などの追加価値を持たせる余地はあるが、現状でも「新しい問題」という
価値は成立しているため優先度は低い（NEXT_IMPROVEMENTS.md参照）。

---

## 2026-07-05 extra_reviewの消費コード未整備を解消

**目的**: 前回のreward_tickets調査で見つかった残課題「`extra_review`は広告視聴で
付与されるが消費先が存在せず、`used_amount`が永久に0のまま溜まり続けている」に対応する。
ユーザー視点では「広告を見た→チケットをもらった→でも何に使われたか分からない→残高だけ
残る」という不自然な状態であり、収益化・広告視聴体験・信頼性に関わるため整理が必要と
判断した。

**調査結果**:
- **付与元**: `src/components/review/FlipCardRunner.tsx`（復習完了画面の
  「広告を見てもう一周チャレンジ」、`pool.length >= 4`のときのみ表示）と
  `src/app/test/choice/ChoiceTestRunner.tsx`（4択テスト完了画面の
  「広告を見てもう10問チャレンジ」、同条件）の2箇所。どちらも
  `AppRewardedAdButton`（`src/components/ads/AppAds.tsx`）経由で
  `watchRewardedAndGrant("extra_review")`を呼び、Web版は実際の広告再生を行わず
  600msの疑似待機のみ、Native版は実際の広告再生後にチケットを`reward_tickets`へ
  1件INSERTする設計だった（`ai_generation`と同じ共通関数を使用）。
- **付与後の挙動**: `AppRewardedAdButton`の`onReward`コールバックは
  `FlipCardRunner`側が`restart()`、`ChoiceTestRunner`側が`onRewardedExtra()`という
  **同期関数**で、どちらも広告視聴完了の直後にその場で復習/テストを再開するだけの
  実装。`watchRewardedAndGrant()`の戻り値（`amount`/`used_amount`）は呼び出し側の
  どこからも参照されていない。
- **`used_amount`が更新されない理由**: `extra_review`を消費するAPI・関数が
  コードベース全体に一つも存在しないため。付与(INSERT)だけがあり、消費
  (`used_amount`のUPDATE)を行うコードパス自体が最初から実装されていなかった。
- **決定的な発見**: 両画面には、広告視聴が必要な「もう一周/もう10問チャレンジ」
  ボタンと**並んで**、広告なし・チケットなしで完全に無料の「もう一度」ボタンが
  既に存在し、`buildQuestions()`をほぼ同じ引数で呼ぶだけの、ほぼ同一の内容を
  無制限に提供していた。つまり広告視聴で得られる「延長」は、無料ボタンで既に
  得られるものとほぼ同じであり、`extra_review`チケットはそもそも何かを実質的に
  ゲート（制限）していなかった。
- **Premium/無料の挙動差**: 無し。両ボタンともPremium判定（`is_premium`）を一切
  参照しておらず、Premium・無料どちらのユーザーにも全く同じ2つのボタンが表示される。
- **広告視聴なしで無料追加ができる箇所**: 上記の「もう一度」ボタンがまさにそれに
  該当することを確認した。ただしこれは今回のスコープ（`extra_review`のDB記録の
  不整合を正す）とは別の設計判断（広告ゲートの強化・差別化）であり、既存の
  収益化方針・体験を変えることになるため、今回は一切変更していない
  （NEXT_IMPROVEMENTS.mdの提案セクションに残課題として記録した）。

**判断**: 案A（真に消費するチケットとして実装する）は不自然と判断し見送った。
- `restart()`/`onRewardedExtra()`が広告視聴の直後に結果を即座に使い切る設計のため、
  「後で消費する」という時間差が最初から存在しない。真の残高管理（ダッシュボードでの
  残高表示・後日の任意タイミングでの消費・二重消費防止のトランザクション設計等）を
  作ると、既存の「広告視聴→その場で完結する」UXを不自然に崩すことになる。
- 加えて、無料の「もう一度」ボタンが同等の体験を既に無制限に提供しているため、
  仮に真の消費ロジックを実装しても、ユーザーは無料ボタンを使えば同じ結果を得られる
  ため実質的な効果に乏しい。
案B（reward_ticketsへの永続化自体をやめる）を採用した。

**実装内容**: `src/lib/native/rewards.ts`の`watchRewardedAndGrant()`に
`INSTANT_USE_REWARD_KINDS`（現状`extra_review`のみを含むSet）を追加。該当kindは
広告視聴（Native）またはWeb版の擬似待機（600ms）が完了した後、`reward_tickets`への
`INSERT`を行わず、広告視聴の成否のみを`{ ok: true, reason: "rewarded" }`として返す
ようにした。`ai_generation`等ほかのkindはこれまで通り`reward_tickets`へ記録される。
呼び出し元（`AppRewardedAdButton`、`FlipCardRunner.tsx`、`ChoiceTestRunner.tsx`）・
UI文言・ボタンの見た目・広告視聴のフロー自体は一切変更していない（ユーザー体験は
完全に同じで、内部のDB書き込みだけを止めた）。

**used_amountの扱い**: `extra_review`は今後`reward_tickets`にINSERTされなくなるため、
`used_amount`という概念自体がこのkindには発生しなくなる。既存の本番データ
（`extra_review`が9件蓄積、2026-07-05時点で確認済み）は削除していない。過去の
広告視聴の記録として残置し、新規の行が増えなくなるだけである。

**既存データへの影響**: なし。`extra_review`の既存9件は削除・変更していない。
`ai_generation`/`daily_achievement`等ほかのkindの付与・消費ロジック、既存データも
一切変更していない。

**変更ファイル**: `src/lib/native/rewards.ts`（`INSTANT_USE_REWARD_KINDS`追加、
`watchRewardedAndGrant()`にkind別の分岐追加）、
`scripts/testing/e2e/extra-review-ticket.mjs`（新規）、`scripts/testing/run-e2e.mjs`
（ステップ19として追加）、`package.json`（`test:extra-review-ticket`スクリプト追加）、
`NEXT_IMPROVEMENTS.md`、`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**追加・更新したテスト**: `scripts/testing/e2e/extra-review-ticket.mjs`（新規、
`npm run test:extra-review-ticket`、12項目）:
1. FlipCardRunner「もう一周チャレンジ」— テスト専用単語帳(4語、復習待ち)を用意して
   復習を完走し、広告視聴後に実際に復習(フラッシュカード)が再開されること・
   `reward_tickets(kind=extra_review)`に新規行が作られないことを検証。
2. ChoiceTestRunner「もう10問チャレンジ」— 同様に4択テストを完走し、広告視聴後に
   新しい問題セットで実際にテストが再開されること・DBに新規行が作られないことを検証。
3. `ai_generation`（ダミーチケットを事前投入）・`daily_achievement`等ほかのkindの
   行数が一連の操作前後で一切変化しないことを検証。
4. 0語ユーザー(test+onboarding)でも`/review`が空状態表示のまま崩れないことを検証。

**検証結果**: `tsc --noEmit`（エラー無し）/ `build`（成功）/ `test:smoke`（全PASS）/
`test:extra-review-ticket`（12項目、全PASS）/ `test:e2e`（19フロー全PASS、
既存回帰なし）/ `verify:prod`（全PASS）/ `verify:srs-global`（V2グローバルフラグ
本番反映を再確認、全PASS）。

**残課題**: 広告視聴なしで完全に無料の「もう一度」ボタンが、広告ゲート版の
「もう一周/もう10問チャレンジ」とほぼ同じ内容を無制限に提供している点は、今回
一切変更していない。広告視聴に実質的な価値（出題数の増量・苦手単語優先など）を
持たせて差別化するかどうかは収益化・広告視聴体験に関わる設計判断のため、対応する
場合はオーナー承認の上で別タスクとして着手する。`pdf_export`/`weak_word_test`/
`analysis_ticket`の3種は引き続き完全に未実装のまま。`daily_achievement`への将来の
交換機能追加も未着手。

---

## 2026-07-05 リワードチケットの使い道・表示・消費導線を整理

**目的**: `daily_achievement`チケットは安全に1日1枚付与・DB側の二重防止まで実装できたが、
「受け取ったものが何に使えるのか」がユーザー視点で曖昧という残課題に対応する。
`reward_tickets`の全kindについて付与元・消費先を調査し、`daily_achievement`の位置づけを
明確にする。

**調査結果**（読み取り専用の全文検索で確認、コード変更前に実施）:
- `reward_tickets.kind`は現在6種類定義されている
  （`src/lib/native/rewards.ts`の`RewardKind`型 + `daily_achievement`）が、実際に
  付与・消費の両方が機能しているのは**`ai_generation`のみ**。
- **`ai_generation`**: 広告視聴（`watchRewardedAndGrant()`、Web版は実際の広告再生を
  行わず600msの疑似待機のみ）またはStripe購入（`src/app/api/stripe/webhook/route.ts`
  の`checkout.session.completed`）で付与。`src/app/api/ai/route.ts`が、非Premium
  ユーザーの1日5回のAI生成上限（`DAILY_LIMIT`）を超えた際に、残高のある最も古いチケット
  から1枚(`used_amount`+1)消費して1回分のAI生成を追加許可する、実際に機能する消費先を
  持つ。
- **`extra_review`**: `FlipCardRunner.tsx`（「もう一周チャレンジ」）・
  `ChoiceTestRunner.tsx`（「もう10問チャレンジ」）から広告視聴で付与されるが、
  **消費コードが存在しない**。ボタンのコールバックは`reward_tickets`の残高を
  一切参照せず直接`restart()`/`onRewardedExtra()`を呼ぶだけの設計で、DBへのINSERTは
  行われるが`used_amount`は常に0のまま。本番で9件蓄積していることを確認（データの
  削除はしていない）。
- **`pdf_export`/`weak_word_test`/`analysis_ticket`**: 付与コード・消費コードとも
  一切存在しない（`RewardKind`型定義のみ）。
- **`daily_achievement`**（2026-07-05実装）: 付与・二重防止は完備しているが、消費先は
  一切存在しない（`used_amount`は常に0のまま溜まる）。
- ダッシュボード・設定画面のどこにも「保有チケット残高」を表示するUIは存在しなかった
  （`src/components/ads/AppAds.tsx`の`useTicketBalance()`フックは定義されているが
  どのコンポーネントからも呼ばれていない）。

**判断**: `daily_achievement`を安全な既存の消費先へ接続する案（オーナー提案の案A）は
見送った。
- 実際に機能している消費先は`ai_generation`（AI利用上限バイパス）のみであり、無料で
  付与される達成スタンプをそこに接続すると「無料でAI利用上限を回避できる経路が増える」
  ことになる。ユーザーの明示的な注意事項「AI利用上限を無料で抜けすぎる形にしない」
  「Premium価値を壊さない」に抵触するリスクがあると判断した。
- `extra_review`は消費コード自体が存在しないため、「既存の消費先に接続する」という
  前提条件が成立しない。新たに消費導線を設計することは、今回の「まず整理する」という
  スコープを超える別タスクと判断した。

**採用した方針（案B）**: `daily_achievement`は「交換可能なチケット」ではなく
「達成の記録（スタンプ）」として扱う方向にUI文言を整理した。
- `reward_tickets`テーブル・`kind='daily_achievement'`という値そのもの、DB制約
  （`migrations/014_daily_achievement_ticket_unique.sql`）、付与・二重防止ロジックは
  一切変更していない。すでに本番で付与済みのデータ（`test+srs`アカウントの1件含む）も
  無変更。
- UI文言を「🎟️ 今日の達成チケットを受け取る」→「📝 今日の達成を記録する」、
  「✅ 本日の達成チケットは受け取り済みです」→「✅ 本日の達成は記録済みです」等に変更
  （`ClaimDailyTicketButton.tsx`）。カード見出しも「🎟️ 今日の達成チケット」→
  「📝 今日の達成スタンプ」に変更（`TodayRewardTickets.tsx`）。API応答の
  `claimed`/`reason`（`already_claimed`等）のフィールド名・値、`data-testid`は
  クライアント/サーバー間の契約と既存テストへの影響を避けるため、既存のまま
  一切変更していない。
- ダッシュボードに「通算◯日分を記録済み」という**累計スタンプ数**を新規表示。
  `reward_tickets`の`kind=daily_achievement`件数を軽量な`COUNT`クエリ
  （`select("*", { count: "exact", head: true })`）で取得し、
  `TodayRewardTickets`に`totalStampCount`propとして渡している。交換可能な残高ではなく
  達成の積み重ねを示す表示として位置づけている（0件のときは非表示）。
- `src/lib/gamification/rewardTickets.ts`のコメントに、消費先を意図的に接続していない
  理由（AI利用上限バイパス・Premium価値希薄化のリスク回避）と、将来交換機能を追加する
  場合はオーナー承認の上で別タスクとして設計する旨を明記した。

**AI利用上限・Premium導線への影響**: なし。`ai_generation`の付与ロジック
（広告視聴・Stripe購入）・消費ロジック（`api/ai/route.ts`のチケット消費処理）は
一切変更していない。

**既存チケットへの影響**: なし。`extra_review`/`ai_generation`等の付与UI・DB・RLSは
無変更。

**変更ファイル**: `src/app/dashboard/page.tsx`（`totalAchievementStampCount`の
COUNTクエリ追加、`TodayRewardTickets`へprop受け渡し）、
`src/components/dashboard/TodayRewardTickets.tsx`（見出し・完了メッセージの文言変更、
累計スタンプ数の表示追加）、`src/components/dashboard/ClaimDailyTicketButton.tsx`
（ボタン・メッセージの文言変更）、`src/lib/gamification/rewardTickets.ts`
（コメント更新のみ、ロジック無変更）、
`src/app/api/gamification/claim-daily-ticket/route.ts`（コメント更新のみ、
ロジック・応答フィールド無変更）、`scripts/testing/e2e/reward-ticket-claim.mjs`
（ログ文言の追従、通算スタンプ数表示のアサーション追加）、
`scripts/testing/e2e/dashboard-insights.mjs`（ログ文言の追従のみ、アサーション内容・
data-testidは無変更）、`NEXT_IMPROVEMENTS.md`、`PRODUCTION_MONITORING.md`、
`WORK_HISTORY.md`。

**追加・更新したテスト**: `reward-ticket-claim.mjs`のシナリオ4（リロード確認）に、
達成スタンプを1件記録した後の「通算1日分を記録済み」という累計表示のアサーションを
追加（22項目→23項目）。既存のロック/記録/重複防止/モバイル/同時POSTの各シナリオは
ログ文言のみ新UI文言に追従させ、判定ロジック・data-testidは変更していない。

**検証結果**: `tsc --noEmit`（エラー無し）/ `build`（成功）/ `test:smoke`（全PASS）/
`test:reward-ticket-claim`（23項目、全PASS）/ `test:e2e`（18フロー全PASS、
既存回帰なし）/ `verify:prod`（全PASS）/ `verify:srs-global`（V2グローバルフラグ
本番反映を再確認、全PASS）。

**残課題**:
- `extra_review`（もう一周/もう10問チャレンジ）は付与のみで消費コードが存在しない
  という、今回の調査で見つかった別の未整理問題。実害は無い（体験上は広告視聴後に
  即座に追加復習が始まる）が、DBに使われない行が溜まり続ける。対応するかはオーナー
  判断で、対応する場合は別タスクとして着手する。
- `pdf_export`/`weak_word_test`/`analysis_ticket`の3種は完全に未実装のまま
  （型定義のみ）。実装するか型定義から削除するかは今後の判断が必要。
- `daily_achievement`への将来の交換機能追加（例: 期間限定特典との交換）は今回
  実装していない。追加する場合はAI利用上限・Premium価値への影響を踏まえ、
  オーナー承認の上で別タスクとして設計する。

---

## 2026-07-05 `daily_achievement`チケットの二重付与防止をDB側で完全化

**目的**: 前回実装した「今日の達成チケット」実付与の残課題として、
`POST /api/gamification/claim-daily-ticket`のcheck-then-insert方式に残る、
同時多重リクエストによる二重付与の理論上の競合ウィンドウをDB側でも完全に塞ぐ。
チケットはAI利用上限バイパス等の収益に関わりうるため、アプリ層だけでなくDB側でも
1日1枚を保証したいというオーナー要望。

**調査結果**（実装前にDBへ直接クエリして確認）:
- `reward_tickets`の列は`id`(uuid)/`user_id`(uuid)/`kind`(text)/`amount`(int, default 1)/
  `used_amount`(int, default 0)/`granted_at`(timestamptz, default now())/
  `expires_at`(timestamptz, nullable)。`expires_at`はアプリケーションコードのどこからも
  参照・enforceされていない未使用列であることを確認。
- 既存インデックスは主キー(`id`)のみ（`pg_indexes`で確認）。他の制約は一切無い、
  完全にクリーンな状態。
- 本番の`reward_tickets`の`kind`別件数は`extra_review`が9件、`daily_achievement`が1件
  （前回ラウンドの検証で実際に付与された`test+srs@loop-vocabulary.app`の1件）のみ。
  `ai_generation`等ほかのkindは現在0件。
- **重複チェック**: `kind='daily_achievement'`を`user_id`とJST日付
  （`(granted_at at time zone 'Asia/Tokyo')::date`）でグルーピングし
  `HAVING COUNT(*) > 1`で検索した結果、**該当0件**。既存本番データに重複は無いため、
  データ削除・移行の判断は不要（オーナー指示の「重複があれば報告してから対応方針を決める」
  というゲートは「重複が存在しない」ことをもって満たされた）。

**採用した二重付与防止方式**: オーナー提案の「案A: `grant_date_jst`列を追加+部分ユニーク
インデックス」に対し、**新しい列を追加しない部分ユニークインデックスのみ**という軽量な
代替案を採用（オーナー提案の意図は維持しつつ、スキーマ変更を最小化）。
`migrations/014_daily_achievement_ticket_unique.sql`:
```sql
create unique index if not exists reward_tickets_daily_achievement_one_per_jst_day
  on public.reward_tickets (user_id, ((granted_at at time zone interval '9:00:00')::date))
  where kind = 'daily_achievement';
```
新しい列・バックフィルが不要な分、既存行への影響が一切ない状態でJST日付の一意性を
`granted_at`から直接算出できる。

**実装中に判明した技術的な注意点**（案Aを設計時から一段強めた理由）:
- 当初 `(granted_at + interval '9 hours')::date` という式で作成を試みたところ、
  Postgresから `42P17: functions in index expression must be marked IMMUTABLE` で
  拒否された。原因は、`interval`を足した結果が依然`timestamptz`型のままであり、
  その後の`::date`キャストがセッションの`TimeZone`設定に依存する**STABLE**な変換に
  なるため（インデックス式は**IMMUTABLE**関数のみ許可される）。
- `granted_at at time zone 'Asia/Tokyo'`のような**named timezone**変換も、
  タイムゾーンDB（うるう秒・DST等のルール変更の可能性）に依存するためSTABLE扱いとなり、
  同様にインデックス式には使えない。
- 最終的に採用した`granted_at at time zone interval '9:00:00'`（**固定interval**での
  タイムゾーン変換）は、`timestamptz`から`timestamp`（タイムゾーン情報なし）へ変換する
  演算で、セッション設定に一切依存しないIMMUTABLEな変換のため、インデックス式として
  使用できた。この固定+9時間オフセットという基準は、アプリ全体で使われている
  `src/lib/utils/date.ts`の`JST_OFFSET_MS`固定オフセット計算と同じ考え方であり、
  DB側の「JSTの日付境界」とアプリ側の「JSTの日付境界」がずれる心配もない。

**既存チケットへの影響**: `WHERE kind = 'daily_achievement'`という部分インデックスの
述語により、`ai_generation`/`pdf_export`/`extra_review`/`weak_word_test`/
`analysis_ticket`等ほかのkindの行はこのインデックスの対象外。それらの付与・消費コードは
一切変更していない。RLSも無変更（既存の`tickets owner all`ポリシーのまま）。

**アプリ層の防御的多重化**: DB制約だけに頼らず、`claim-daily-ticket`ルートのINSERT失敗時、
Postgresの一意制約違反エラーコード`23505`を検知した場合は、既存のcheck-then-insert経路と
同じ`409 { claimed: false, reason: "already_claimed" }`を返すよう変更
（`src/app/api/gamification/claim-daily-ticket/route.ts`）。それ以外のDBエラーは
従来通り`500 db_error`のまま。クライアント側の`ClaimDailyTicketButton.tsx`は元々
`reason === "already_claimed"`を正常系（受け取り済み表示）として扱う実装だったため、
UIコンポーネントは一切変更していない。

**同時リクエスト耐性の確認**: `scripts/testing/e2e/reward-ticket-claim.mjs`に新シナリオ
（7番目）を追加し、達成済み状態のユーザーに対して**8件のPOSTリクエストを`Promise.all`で
同時発火**した結果を検証。8件中`claimed:true`はちょうど1件、残り7件は全て
`409 already_claimed`で穏当に拒否（500エラーやその他の異常応答は0件）、DB側の
`reward_tickets`(kind=daily_achievement)行数も検証後にちょうど1件のままであることを確認した。

**マイグレーション適用前後の状態**:
- 適用前: `reward_tickets`のインデックスは`reward_tickets_pkey`のみ。
- 適用後: `reward_tickets_pkey`に加えて
  `reward_tickets_daily_achievement_one_per_jst_day`（`CREATE UNIQUE INDEX ... ON
  public.reward_tickets USING btree (user_id, (((granted_at AT TIME ZONE
  '09:00:00'::interval))::date)) WHERE (kind = 'daily_achievement'::text)`）が追加された
  ことを`pg_indexes`への再クエリで確認済み。データの削除・変更は一切行っていない
  （インデックス追加のみ、行データは無変更）。

**変更ファイル**: `supabase/migrations/014_daily_achievement_ticket_unique.sql`（新規、
本番へ`apply_migration`で適用済み）、
`src/app/api/gamification/claim-daily-ticket/route.ts`（23505エラーハンドリング追加）、
`scripts/testing/e2e/reward-ticket-claim.mjs`（同時POSTシナリオ追加、18項目→22項目）、
`NEXT_IMPROVEMENTS.md`、`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**検証結果**: `tsc --noEmit`（エラー無し）/ `build`（成功）/ `test:smoke`（全PASS）/
`test:reward-ticket-claim`（22項目、全PASS、新シナリオ含む）/ `test:e2e`
（18フロー全PASS、既存回帰なし）/ `verify:prod`（全PASS）/ `verify:srs-global`
（V2グローバルフラグ本番反映を再確認、全PASS）。

**変更していないもの**: `reward_tickets`の既存列（列追加なし）、RLSポリシー、
`ai_generation`等ほかのkindの付与・消費ロジック、`ClaimDailyTicketButton.tsx`等の
既存UI、SRS V2中核ロジック、teacher機能、教材データ、AdSense広告枠、
学習中/復習中画面。

**残課題**: なし。`daily_achievement`の1日1枚制限はDB側の部分ユニークインデックスで
物理的に保証される設計になったため、アプリ層のバグやリトライ処理の変更があっても
二重付与は起こり得ない。

---

## 2026-07-05 「今日の達成チケット」の実付与（reward_tickets連携）を実装

**目的**: 前回チケット風UI表示のみに留めた「今日の達成チケット」について、安全に実際の
`reward_tickets`へ付与できるかを調査し、可能であれば実装する。

**調査結果**:
- `reward_tickets`のカラムは`id`/`user_id`/`kind`(text)/`amount`/`used_amount`/
  `granted_at`/`expires_at`のみ。`source`/`reason`のような区別カラムは無い。
- RLS（`supabase/rls.sql`）は`for all using (auth.uid() = user_id) with check
  (auth.uid() = user_id)`という行所有者に対するフルアクセス許可のみ。達成条件そのものを
  検証する仕組みはDB側に一切無い。
- 既存の広告視聴チケット付与（`watchRewardedAndGrant()`、`src/lib/native/rewards.ts`）は
  **クライアント側から直接**`supabase.from("reward_tickets").insert(...)`しており、
  RLSの「本人であること」以外のサーバー側検証は無い。さらにWeb版では実際の広告再生すら
  行わず**600msの疑似待機のみ**でチケットが付与される（コメントに明記された既存の意図的な
  緩い設計:「Web では本番でも「広告再生扱い」にせず、UI で1枚もらえる体験のみ提供」）。
- チケットの消費先: `src/app/api/ai/route.ts`が、非Premiumユーザーが1日のAI利用上限
  （`DAILY_LIMIT`）を超えた際に`kind="ai_generation"`のチケットを1枚消費してAI生成を
  1回追加で許可する仕組みを確認した。つまり`ai_generation`チケットは実質的に「AI利用料の
  無料バイパス券」であり、無制限に配布すると収益化（Premium/AI利用制限）を弱める。
  他4種（`pdf_export`/`extra_review`/`weak_word_test`/`analysis_ticket`）も同様に何らかの
  機能制限をバイパスする設計と推測されるが、今回は`ai_generation`の消費コードのみ実装を確認。
- 上記を踏まえた判断: **既存の広告視聴チケット付与は、達成チケットより緩い設計
  （クライアント直接INSERT・Web版は実質フリー）で既に本番稼働している**。今回の達成
  チケットを、既存より厳格な設計（サーバー側で毎回条件を再検証してからINSERT）で実装すれば、
  既存システムより安全な形で追加できると判断した。

**実チケット付与が安全かどうか**: 条件付きで安全と判断。
- 付与条件をSSR描画時ではなく、ユーザー操作起点（ボタン押下）のPOSTリクエストでのみ
  サーバー側から再検証する設計にすれば、クライアントからの偽装input・SSR多重描画による
  二重付与のリスクは回避できる。
- 既存5種のkindとは異なる新しい`kind="daily_achievement"`を採用すれば、AI利用上限
  バイパス等の収益に関わる消費経路とは完全に独立するため、「無料配布しすぎて収益化を
  壊す」リスクも回避できる（何にも消費できないチケットとして完全に隔離）。
- 1日1枚という上限も、既存の広告視聴チケット（Web版は事実上無制限に取得可能）よりも
  厳格であるため、経済的な追加リスクは極めて小さい。

**実装した付与条件**: 4条件（今日の学習目標達成`studied>=20`・復習10語達成`studied>=10`・
苦手単語を復習`weakReviewedToday>=1`・7日連続達成`streak>=7`）のうち**いずれか1つ**を
満たせば、1日1枚まで受け取れる（ユーザー指示通り、4条件それぞれで別々に配らない）。

**1日1回制限の方法**: DBのユニーク制約は追加していない（後述）。
`POST /api/gamification/claim-daily-ticket`（新規Route Handler）内で、まず
`reward_tickets`に`kind="daily_achievement"`かつ本日`granted_at`以降の行が存在するかを
確認し（check）、存在しなければ達成条件を再判定した上でINSERTする（insert）という
check-then-insert方式。クライアント側でもボタンをクリック直後に即座に無効化し連打を防止。
同一ユーザーからの真の同時多重リクエスト（極めて稀）に対する理論上の競合ウィンドウは
残るため、DB側のユニーク制約（生成列+ユニークインデックス）を追加すれば完全に閉じられる
旨を`NEXT_IMPROVEMENTS.md`に提案として記録した（**マイグレーションは実施していない**）。

**既存広告チケットとの区別**: `kind="daily_achievement"`という新しい値を導入（`kind`は
自由入力のtext列のためスキーマ変更は不要）。既存5種の消費コード（`api/ai/route.ts`等）は
特定のkind文字列のみを参照するため、`daily_achievement`は現状どの消費経路からも参照されず、
完全に独立している。

**UI文言**: 実際に付与するため「今日の達成チケット」の名称・「🎟️」の表現はそのまま維持した
（誤解を招く表現ではなくなったため、バッジ/スタンプへの変更は不要と判断）。新たに
「🎟️ 今日の達成チケットを受け取る」ボタン、受け取り後は「✅ 本日の達成チケットは
受け取り済みです」、未達成時は「条件を1つ達成すると「受け取る」ボタンが押せるようになります」
の3状態を表示する`ClaimDailyTicketButton`（新規クライアントコンポーネント）を追加した。

**実装内容**:
- `src/app/api/gamification/claim-daily-ticket/route.ts`（新規）: POST専用。認証チェック→
  `daily_stats`/`study_results`をユーザー自身の権限で再取得→達成条件を再計算→本日付与済みか
  確認→未達成/受け取り済みならエラーレスポンス→条件を満たせば`reward_tickets`に1行INSERT。
- `src/components/dashboard/ClaimDailyTicketButton.tsx`（新規）: 3状態（未達成/受け取り可能/
  受け取り済み）を管理するクライアントコンポーネント。
- `src/lib/gamification/rewardTickets.ts`: `DAILY_ACHIEVEMENT_TICKET_KIND`定数と
  `isEligibleForDailyTicket()`を追加（表示用ロジックと共有）。
- `src/lib/gamification/streak.ts`（新規）: ダッシュボードのstreak計算ロジックを
  `computeStreak()`として切り出し、API routeとダッシュボードSSRの両方から同じ実装を使う
  （ロジックの重複・乖離を防止）。
- `src/app/dashboard/page.tsx`: 本日すでに`daily_achievement`を受け取り済みかの軽量count
  クエリを1件追加し、`TodayRewardTickets`に`alreadyClaimedToday`propとして渡すよう変更。
  streak計算を`computeStreak()`呼び出しに置き換え（動作は完全に同一）。
- `src/components/dashboard/TodayRewardTickets.tsx`: カード内に`ClaimDailyTicketButton`を
  追加（既存の4タイル表示・次の達成ヒントはそのまま維持、下部に区切り線で追加）。

DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
AdSense広告枠追加・学習中/復習中画面への広告追加なし。ガチャ・射幸性の強い表現は使わず、
Premium訴求も追加していない。

**新規テスト**: `scripts/testing/e2e/reward-ticket-claim.mjs`（新規、
`npm run test:reward-ticket-claim`、`run-e2e.mjs`のステップ18として追加、18項目）:
未達成時にボタンが押せない・APIを直接呼んでも400 not_eligibleで拒否される・
reward_ticketsに行が作られない、達成後はボタンから1枚だけ受け取れる・DBに正しく1行
（kind=daily_achievement, amount=1）作成される、同日2回目はボタン/API直接呼び出しとも
409 already_claimedで拒否され行数が増えない、リロードしても「受け取り済み」表示が維持され
行数が増えない、0語ユーザーでも崩れない、既存の広告視聴チケット(kind=ai_generation)と
同じテーブル内でも混ざらない、モバイル幅で崩れない、を実ブラウザ+DB直接確認で検証した。
`test:smoke`/`verify:prod`のPOST専用APIチェックリストにも新ルートを追加。

**変更ファイル**: `src/app/api/gamification/claim-daily-ticket/route.ts`（新規）、
`src/components/dashboard/ClaimDailyTicketButton.tsx`（新規）、
`src/lib/gamification/streak.ts`（新規）、`src/lib/gamification/rewardTickets.ts`、
`src/app/dashboard/page.tsx`、`src/components/dashboard/TodayRewardTickets.tsx`、
`scripts/testing/e2e/reward-ticket-claim.mjs`（新規）、`scripts/testing/run-e2e.mjs`、
`scripts/testing/smoke.mjs`、`scripts/testing/verify-prod.mjs`、`package.json`
（`test:reward-ticket-claim`スクリプト追加）、`NEXT_IMPROVEMENTS.md`、
`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2中核ロジック、
teacher機能、教材データ、AdSense広告枠、既存の広告視聴チケット付与ロジック
（`src/lib/native/rewards.ts`・`src/components/ads/AppAds.tsx`はそのまま）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke`
（POST専用APIチェックに新ルート追加、全PASS） / `npm run test:reward-ticket-claim`
（18項目、全PASS） / `npm run test:e2e`（18フロー全PASS、回帰なし） /
`npm run verify:prod`（デプロイ前は新ルートのみ想定通り404、デプロイ後に再実行して
全PASSを確認） / `npm run verify:srs-global`、全PASS。

**残課題**: DB側のユニーク制約（`granted_date_jst`生成列+ユニークインデックス）を追加すれば、
アプリケーション層のcheck-then-insertに残る理論上の競合ウィンドウを完全に閉じられる。
今回はDBスキーマ変更を避ける方針のため実装せず、`NEXT_IMPROVEMENTS.md`に必要性の報告のみ
記録した。付与条件の段階化（達成数に応じて枚数を増やす等）も今回はスコープ外。

---

## 2026-07-05 ゲーミフィケーション×リワードチケット連携「今日の達成チケット」の追加

**目的**: 教材・LP・ダッシュボード可視化・復習リカバリーモードが整ってきたため、次は継続率
向上のために学習継続と報酬をつなげる（収益化監査#5）。単なるバッジ表示ではなく、今日も
学習したくなる・連続学習を続けたくなる・復習を消化した達成感がある・無料ユーザーにも価値が
ある・Premium転換にも自然につながる仕組みを目指した。

**現状調査（実装前）**:
- **バッジ**: `src/app/dashboard/page.tsx`の`getBadges()`/`getNextBadge()`関数で、streak
  （3/7/30日）とwordCount（100/500/1000語）から都度計算。DB保存なし。
- **XP/レベル**: 同ファイル内で`xp = wordCount×10 + totalCorrect×2 + streak×100`、
  `level = floor(xp/1000)+1`として都度計算。DB保存なし。
- **連続学習記録**: `daily_stats`テーブルの`studied_count>0`の日を`daysAgoJST()`で遡って
  カウント（今日だけは未学習でも許容、それ以前に空白があれば打ち切り）。
- **デイリーミッション**: `src/components/dashboard/DailyMissions.tsx`で4種
  （5語学習・目標達成・連続学習・100語登録）を都度計算、DB保存なし。
- **週間ランキング**: `/ranking`が`daily_stats`を今週分集計するライブクエリ。報酬の概念なし。
- **リワードチケット**: `reward_tickets`テーブルが既に存在（`kind`/`amount`/`used_amount`/
  `granted_at`/`expires_at`）。`src/lib/native/rewards.ts`の`watchRewardedAndGrant()`が
  リワード広告視聴という**ユーザー操作起点**でのみ1件ずつ付与する設計。ゲーミフィケーション
  （バッジ/ストリーク/ミッション達成）との連携は無かった。
- `study_results`テーブルには`mode`等の種別列が無く、「復習モード」と「テストモード」の
  区別はDBレベルでは不可能（このアプリのSRSは全モード共通で`saveStudyResult`経由のため、
  リカバリーモードでの学習も通常の学習と同じ`study_results`/`daily_stats`に記録される）。

**実装した表示・導線**: ダッシュボードに「🎟️ 今日の達成チケット」カードを新設
（デイリーミッションの直後、獲得バッジの直前）。4種のチケットを表示:
1. 🎯 今日の学習達成（`studied >= dailyGoal`）
2. 🔁 復習10語達成（`studied >= 10`。リカバリーモードでの学習も同じ`studied`にカウントされる
   ため、明示的な検出ロジックを組まなくても自然にカバーされる）
3. 💪 苦手単語を復習（今日、is_weak=trueの単語に1問でも解答した場合に達成）
4. 🔥 7日連続達成（`streak >= 7`）

達成済みは🎟️アイコン+amber色、未達成はグレーアウト+各アイコンで表示。未達成のうち表示順で
最初の1件について「あと◯語/◯日で「アイコン ラベル」達成！」の進捗ヒントを表示。全達成時は
「🎉 今日の達成チケットをコンプリート！」のお祝い表示に切り替わる。

デイリーミッション（今日すべきことのチェックリスト）とは役割を分け、こちらは「今日集めた
ごほうびを振り返る」発表カードとして位置づけた（今日の学習達成チケットはミッション#2と
同じ条件を再利用しているが、チェックリストと収集物という異なる文脈で提示している）。

**使用したデータ・算出方法**: 判定ロジックを`src/lib/gamification/rewardTickets.ts`（新規）に
`computeTodayTickets()`/`nextTodayTicket()`という純粋関数として切り出した。ダッシュボードの
既存`Promise.all`データ取得ブロックに、苦手単語の今日の復習件数を取得する軽量クエリを1件
追加した:
```
supabase.from("study_results")
  .select("id, words!inner(is_weak)", { count: "exact", head: true })
  .eq("user_id", user.id).eq("words.is_weak", true).gte("answered_at", todayStartJstISO())
```
`words!inner(is_weak)`のPostgREST埋め込みJOINで、行データを取得せずCOUNTのみをDB側で計算する
（本番Supabaseに対して事前に動作確認済み）。studied/dailyGoal/streakは既存のダッシュボード
計算値をそのまま再利用し、追加クエリなし。

**リワードチケット連携の可否**: `reward_tickets`テーブル自体は既存のため、技術的には
今回の4種の達成を直接INSERTすることも可能だった。しかし、ダッシュボードはSSR（サーバー
コンポーネント）でありページを開くたびに再描画されるため、レンダー中にDB書き込みを行うと
ページを開くたびに再付与されてしまう危険がある（二重付与防止には「その日すでに付与済みか」の
事前チェック+重複防止の仕組みが必要で、レンダーというタイミングでの副作用のある書き込みは
Next.jsのベストプラクティスにも反する）。ユーザー指示の「リワードチケットのDBがまだ無い
場合は、チケット風UI+次の報酬までの進捗表示に留めて、実際の消費型チケット機能は別タスクに
分ける」という方針に沿い、今回は表示のみに留めた。実際に付与する場合の設計案（サーバー
アクション+ユーザー操作起点でのINSERT、`granted_at`列を使った1日1回ガード）は
`NEXT_IMPROVEMENTS.md`「ゲーミフィケーション×リワードチケットの次の一手」に提案として記録
した（DBスキーマ変更は不要な設計）。

**表現面の配慮**: ガチャ・くじ引き風の演出、射幸性を煽る表現は使わず、「達成すればもらえる」
という単純な条件明示に留めた。Premium訴求はこのカード内には追加していない（既存の
Premiumバナーが別途あるため）。

**新規テスト**:
- `scripts/testing/test-gamification-rewards.mjs`（新規、`npm run test:gamification-rewards`、
  `test-date-utils.mjs`と同じ「実装を直接importする純粋関数の単体テスト」パターン、19項目）:
  0語ユーザー相当（すべて0）で4件生成・全未達成・次のヒントが正しいこと、各チケットの閾値・
  境界値（studied=9/10、streak=6/7/30）、全達成時の判定とnextTodayTicketがnullを返すこと、
  を検証。`smoke.mjs`にも自動組み込み（`test-date-utils.mjs`と同じ扱い）。
- `scripts/testing/e2e/dashboard-insights.mjs`を拡張: 0語ユーザーでカードが崩れず0/4と
  表示されること、通常ユーザーで実際の`daily_stats.studied_count`と「今日の学習達成」
  「復習10語達成」チケットのdata-done属性が一致すること（DBの実データと表示の整合性を
  直接クロスチェック）、due単語20件以上のリカバリーヒント表示時・モバイル幅(375px)表示時にも
  カードが共存して壊れないこと、を実ブラウザで検証。

**変更ファイル**: `src/lib/gamification/rewardTickets.ts`（新規）、
`src/components/dashboard/TodayRewardTickets.tsx`（新規）、`src/app/dashboard/page.tsx`、
`scripts/testing/test-gamification-rewards.mjs`（新規）、`scripts/testing/smoke.mjs`、
`scripts/testing/e2e/dashboard-insights.mjs`、`package.json`
（`test:gamification-rewards`スクリプト追加）、`NEXT_IMPROVEMENTS.md`、
`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2中核ロジック、
teacher機能、教材データ、AdSense広告枠（追加なし）、学習中・復習中画面への広告（追加なし）、
既存のバッジ/XP・レベル/デイリーミッション/週間ランキング/リカバリーモードのロジック
（そのまま再利用のみ）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke`
（単体テスト19項目含む、全PASS） / `npm run test:dashboard-insights`（新規チェック含め
全項目PASS） / `npm run test:e2e`（17フロー全PASS、回帰なし） / `npm run verify:prod` /
`npm run verify:srs-global`、全PASS。

**残課題**: `reward_tickets`への実際の付与（消費型チケット機能）は別タスク。
`NEXT_IMPROVEMENTS.md`の提案（サーバーアクション+1日1回ガード）を参照。

---

## 2026-07-05 ニュース英語向け公開LP（`/materials/news`）の新設

**目的**: 前回追加した「経済ニュース英単語100」「企業ニュース英単語100」を活かし、
TOEIC・ビジネス英語LPに続く3本目のカテゴリLPとして、英語ニュースを読みたい社会人・
経済/企業ニュースを英語で読みたい人・投資/ビジネス情報を英語で追いたい人を取り込むための
公開LP `/materials/news` を新設した（収益化監査#1・#3の延長）。

**ルーティング競合の確認**: `/materials/[id]`という既存の動的ルートに対し、
`/materials/news`という新規静的ルートが競合しないかを事前に確認した。`/toeic`・`/business`
新設時と同じ理由（Next.js App Routerは同階層で静的セグメントを動的セグメントより優先して
解決するため）で衝突しないことを`npm run build`のルート一覧と実ブラウザ双方で確認した。

**実装内容**:
- `src/app/materials/news/page.tsx`（新規）: 主役は「経済ニュース英単語100」
  （`10000000-...-114`）「企業ニュース英単語100」（`10000000-...-115`）の2教材（固定ID指定、
  `data-testid="category-lp-materials"`）。関連教材として「ビジネス英語 基礎100」
  （`...-111`）「TOEIC 頻出名詞100」（`...-113`）「TOEIC 頻出動詞100」（`...-110`）の3教材を
  「あわせて学びたい方に」という別セクション（`data-testid="news-related-materials"`）で表示し、
  ニュース英語LPの主役が薄まらないようにした。ItemList JSON-LDには主役2教材のみを含めている
  （関連教材はページの主要リストではないため）。
  H1「ニュース英語の単語教材」、学習の流れは①教材を選ぶ→②単語帳に追加→③SRSで復習→
  ④4択・入力・タイピングで確認→⑤辞書で単語を追加、の5ステップ（既存2LPは4ステップだが、
  ユーザー指定の流れをそのまま反映）。
- `src/app/materials/page.tsx`: 「TOEIC・ビジネス英語」セクションの`landingPages`に
  「ニュース英語ページへ」を追加（既存2件と同じ表示トーン）。
- `src/app/materials/business/page.tsx`: 内部リンク行に「📰 経済・企業ニュースの英単語も学ぶ」
  を追加。`/materials/toeic`は変更していない（ユーザー指定の導線範囲どおり）。
- `src/app/sitemap.ts`: `/materials/news`をpriority 0.85・changeFrequency weeklyで追加
  （既存2LPと同じ設定）。
- SEOメタ情報は既存2LPと同品質: `metadata.title`/`description`/`openGraph`/
  `alternates.canonical`、BreadcrumbList JSON-LD（ホーム→教材・単語帳→ニュース英語）、
  ItemList JSON-LD（name: "ニュース英語の単語教材"）。
- `robots.txt`は元々`/materials`配下をブロックしておらず修正不要だった（確認のみ）。

**新規教材データは追加していない**（既存の経済/企業ニュース英単語100・ビジネス英語基礎100・
TOEIC頻出名詞100・TOEIC頻出動詞100をそのまま活用）。DBスキーマ変更・RLS変更・SRS V2中核
ロジック変更・teacher機能変更・AdSense広告枠追加・Premium課金導線の追加なし。

**テスト**:
- `scripts/testing/e2e/category-lps.mjs`に新規セクション（9. `/materials/news`）を追加:
  200表示・H1・主役教材カード2件・主役2教材タイトル表示・関連教材3件（データ件数+タイトル）・
  `/dictionary`導線・`/materials/business`⇄`/materials/news`・`/materials`⇄`/materials/news`の
  相互導線・モバイル幅(375px)での崩れなし・`/materials/news`追加後も既存`/materials/[id]`が
  正常動作すること（ルーティング非競合の最終確認）、を実ブラウザで検証。
- `scripts/testing/seo-lp-audit.mjs`: sitemap包含・robots非ブロック・canonical・JSON-LDの
  4チェックすべてに`/materials/news`を追加（既存2LP分の項目は無変更）。
- `scripts/testing/verify-prod.mjs`: 公開ページ一覧に`/materials/news`を追加。

**変更ファイル**: `src/app/materials/news/page.tsx`（新規）、`src/app/materials/page.tsx`、
`src/app/materials/business/page.tsx`、`src/app/sitemap.ts`、
`scripts/testing/e2e/category-lps.mjs`、`scripts/testing/seo-lp-audit.mjs`、
`scripts/testing/verify-prod.mjs`、`NEXT_IMPROVEMENTS.md`、`PRODUCTION_MONITORING.md`、
`WORK_HISTORY.md`、`SEARCH_CONSOLE_SETUP.md`。

**変更していないもの**: `/materials/toeic`（内部リンク・構造とも無変更）、既存教材データ
（新規パック追加なし）、DBスキーマ（マイグレーション無し）、RLS、SRS V2中核ロジック、
teacher機能、AdSense広告枠。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:category-lps`
（28項目、全PASS） / `npm run test:internal-links`（回帰なし） / `npm run test:e2e`
（17フロー全PASS、回帰なし） / `npm run test:smoke` / `npm run verify:srs-global`、全PASS。
`npm run verify:seo-lp-audit` / `npm run verify:prod`はデプロイ前は`/materials/news`関連の
3項目のみ想定通り失敗（本番に未デプロイのため）し、デプロイ後に再実行して全PASSを確認した。

**残課題**: 他カテゴリ（大学受験・英検・中学高校基礎・日常会話）向けの公開LPは引き続き
未着手（効果を見てから検討）。テクノロジー/IT・就活/転職・人事/労務向けの追加ニュース語彙
パックを作った場合、`/materials/news`の主役リストへの追加要否は利用状況を見てから判断する。

---

## 2026-07-05 社会人向け教材3パックの追加（TOEIC頻出名詞100・経済/企業ニュース英単語100）

**目的**: TOEIC・ビジネス英語LP、内部リンク、ダッシュボード可視化が整ってきたため、次は
社会人ユーザー向けの教材ラインナップを厚くし、TOEIC・ビジネス英語LPに載せられる教材を
増やして検索流入・継続率・Premium転換につながる入口を強化する（収益化監査#1・#3の延長）。

**追加した教材パック**（すべてオリジナル作成、市販教材・公式問題集・ニュース記事本文からの
転載なし）:
1. `src/data/presets/toeic-frequent-nouns-100.ts` — TOEIC 頻出名詞100（100語）。
   「TOEIC 頻出動詞100」と対になる名詞版。TOEIC 500〜700点を目指す方向け。
2. `src/data/presets/economic-news-vocabulary-100.ts` — 経済ニュース英単語100（100語）。
   インフレ・金利・株式市場など、経済ニュースを読むための基礎語彙。
3. `src/data/presets/corporate-news-vocabulary-100.ts` — 企業ニュース英単語100（100語）。
   決算・買収・経営戦略・人事など、企業ニュースを読むための語彙。

**教材メタ情報**: 「TOEIC 頻出名詞100」は`examType: "TOEIC"`・`level: "TOEIC"`（既存の
「TOEIC 頻出動詞100」と同じ設定に揃えた）。経済/企業ニュース2パックは`examType: "ビジネス英語"`・
`level: "ニュース英語"`（新設）。`category`はいずれも既存の`"toeic"`を再利用（`category`
フィールドはDB非保存・表示専用だがアプリのどこからも参照されていないことを確認済みのため、
新規カテゴリ値は追加しなかった）。`ALLOWED_TAGS`に「経済ニュース」「企業ニュース」
「ニュース英語」「学び直し」の4タグを追加（表示専用、DBスキーマ変更なし）。

**既存パックとの重複回避**: 既存12パック・31教材（計1,032語のプリセット語彙）の単語一覧を
抽出し、新規300語との完全一致（大文字小文字区別なし）を機械的にチェックした。ユーザーが
提示した例語のうち`acquisition`・`merger`・`workforce`・`subsidiary`・`demand`・`supply`・
`interest rate`・`profit`・`revenue`が既存パックと重複していたため、`buyout`/`takeover`・
`headcount`・`parent company`・`consumer demand`・`supply chain`・`interest rate hike/cut`・
`profitability`・`sales revenue`等の意味的に近い別語へ置き換えた。3パック間の相互重複も
チェック済み（重複ゼロ）。

**`/materials/toeic`への反映**: `examType: "TOEIC"`のため、既存の`.eq("exam_type", "TOEIC")`
フィルタにより追加コード無しで自動的に表示対象になった（TOEIC教材カード数 4→5件）。
導入文を「頻出動詞・頻出名詞を中心とした語彙」に軽く調整（大きなSEO文追加なし）。

**`/materials/business`への反映**: 経済/企業ニュース2パックも`examType: "ビジネス英語"`のため、
既存の`.eq("exam_type", "ビジネス英語")`フィルタにより追加コード無しで自動的に表示対象に
なった（ビジネス英語教材カード数 2→4件）。導入文に「経済ニュース・企業ニュースを読むための
語彙パックもあわせて用意」の一文を追加。

**`/materials`一覧・関連教材への反映**: `/materials`の「TOEIC・ビジネス英語」セクションは
`exam_type === "TOEIC" || exam_type === "ビジネス英語"`で判定しているため自動反映。
`/materials/[id]`の関連教材セクションも同じ`EXAM_TYPE_GROUP`マッピングを使うため、
新3パックも相互に「関連する教材」として表示される（内部リンクE2Eで6件表示を確認、範囲内）。
これらはすべて既存コードのロジックそのままで、コード変更は一切行っていない。

**実装内容（コード変更）**:
- `src/data/presets/{toeic-frequent-nouns-100,economic-news-vocabulary-100,corporate-news-vocabulary-100}.ts`（新規3ファイル）
- `src/data/presets/index.ts`: `PRESET_PACKS`に新3パックを追加
- `scripts/materials/{seed-preset-materials,validate-materials,test-materials}.mjs`:
  既存4パック追加時と同じパターンでimport・配列登録
- `src/lib/materials/types.ts`: `ALLOWED_TAGS`に4タグ追加
- `src/app/materials/toeic/page.tsx`・`src/app/materials/business/page.tsx`: 導入文を
  各1〜2文だけ軽く調整

**検証で発見した既存バグ**: 無し（前回ラウンドで発見した`/weak/page.tsx`のバグは今回の
スコープ外で、既に前回修正済み）。

**品質チェック結果**: `npm run validate:materials` — 新3パックはerrors=0・warnings=0
（既存2パックの既知warning2件のみ、新パックとは無関係）。`npm run test:materials` — 40項目
全PASS、DB上の語数一致・SRS初期値・PDFテスト互換性を確認、既存31教材（プリセット以外）は
1件も変更されず、総語数0の教材も発生していないことを確認。

**既存教材への影響**: 無し。既存46件（プリセット15件+レガシー31件）のうち、レガシー31件は
一切触れていない（`test:materials`のステップ5で非破壊確認済み）。DBスキーマ変更・RLS変更・
SRS V2中核ロジック変更・teacher機能変更・AdSense広告枠追加・学習中/復習中画面への広告追加なし。

**変更ファイル**: 上記「実装内容」参照 + `scripts/testing/e2e/category-lps.mjs`
（想定教材カード数をTOEIC 4→5件・ビジネス英語 2→4件に更新、新3パックのタイトル表示
チェックを追加）+ `NEXT_IMPROVEMENTS.md`・`PRODUCTION_MONITORING.md`・`WORK_HISTORY.md`。

**追加・更新したテスト**: `scripts/testing/e2e/category-lps.mjs`を更新（新規テストファイル
追加は無し。既存の`validate:materials`/`test:materials`/`test:materials:e2e`基盤が
新パックにもそのまま適用されるため、専用の新規E2Eは不要と判断した）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run validate:materials`
（15パック・errors=0） / `npm run test:materials`（40項目PASS） /
`npm run test:materials:e2e`（25項目PASS、回帰なし） / `npm run test:category-lps`
（更新後、全18項目PASS） / `npm run verify:seo-lp-audit`（本番、17項目PASS） /
`npm run test:e2e`（17フロー全PASS、回帰なし） / `npm run test:smoke` / `npm run verify:prod` /
`npm run verify:srs-global`、全PASS。

**本番反映状況**: `npm run test:materials`が本番Supabaseに直接`materials`/`material_words`を
投入するため、新3パックのデータは検証時点で既に本番DBに反映済み（`verify:seo-lp-audit`が
本番URLに対して実行され、新パックを含むsitemap/canonical/JSON-LDの健全性を確認できている）。
アプリ側のコード変更（LP導入文の軽微な調整・テストファイル更新）はコミット・デプロイ後に反映。

**次に追加すべき社会人向け教材候補**: テクノロジー・IT業界ニュース英単語100（AI・スタートアップ
関連ニュースを読む語彙）、就活・転職英語100（職務経歴・面接・条件交渉）、人事・労務ニュース
英単語100（採用・評価制度・働き方改革）。英検2級基礎100・大学受験基礎形容詞100・
日常英会話超基礎50 Part2（旅行編）も引き続き候補として保留。詳細は
[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)「次に増やすべき教材候補」参照。

---

## 2026-07-05 ダッシュボードに習得率カード・苦手単語カードを追加

**目的**: Loop Vocabularyを収益化できるWebアプリにするには、ユーザーがログインした瞬間に
「自分がどれくらい進んでいるか」「何が苦手か」「今日何をやればいいか」「続ける価値が
あるか」を直感的に分かる必要がある。教材・復習・リカバリーモードは前回までに整ったため、
ダッシュボードで「学習の成果が見える」状態を強化した（収益化監査#4、優先度B項目11の対応）。

**現状調査**:
- `src/app/dashboard/page.tsx`（455行）: ストリークバッジ・今日の目標進捗バー・
  学習数/正答率/復習待ちの3統計カード・状況に応じた次アクションCTA・デイリーミッション・
  獲得バッジ・週間チャレンジ・XP/レベル・90日カレンダー・最近学習した単語・今日の単語、が
  既に実装済みだった。`words.mastery`（0-100、DB保存済み）と苦手単語は、どちらも
  ダッシュボード上に表示が無かった（苦手単語は`/weak`への遷移リンクのみ）。
- `words.mastery`の利用状況: `src/app/wordbooks/[id]/page.tsx`が既に`mastery>=80`を
  「習得済み」の閾値として使っていたため、同じ基準を再利用した（新規の閾値を発明しない）。
- `/weak/page.tsx`（91行）: 苦手単語の抽出は`.or("is_weak.eq.true,wrong_count.gt.0")`・
  デフォルト`wrong_count desc`。この条件をそのままダッシュボードの新カードにも流用した。
- `src/app/weak/WeaknessAnalysis.tsx`: 既存の非Premiumユーザー向け「AI弱点分析
  （Premium）」の控えめなCTAパターン（「プレミアムで解放する →」）を確認。今回は
  新規AI分析機能は実装せず、この既存パターンに合わせた軽い一文リンクのみを追加する
  方針にした。
- `src/components/layout/BottomNav.tsx`・`AppShell.tsx`: 5タブ（ホーム/単語帳/復習/
  ルート/記録）・ヘッダーいずれにも`/dictionary`への導線が無かったため、ダッシュボードの
  アクショングリッドに追加することにした。
- 単語帳単位の集計や苦手単語の抽出を行うSupabase RPCは存在しない（`grep -rn "rpc("`で
  確認）。新規RPC作成にはDBマイグレーションが必要になり「DBスキーマ変更はしない」制約に
  反するため、既存カラムに対するプレーンなSupabaseクエリのみで実装する方針にした。

**追加した習得率カード**（`data-testid="mastery-card"`）:
習得済み（`mastery>=80`）/学習中（残り）/苦手（`is_weak=true AND mastery<80`）の3区分
（排他的・合計は総語数と一致）と、全体習得率（習得済み÷総語数、%）を表示。「単語帳別に
見る」（`/wordbooks`）・「復習する」（`/review?start=1&mode=flip`）の2導線を配置した。
全体習得率を`mastery`列の全件平均ではなく「習得済み÷総語数」で算出したのは、全件平均を
取るには単語を全件フェッチする必要があり「1回の表示で大量のwordsを取得しない」という
制約に反するため。3区分の集計はいずれも`count:"exact",head:true`のCOUNTのみのクエリで
行がクライアントに転送されないため、単語数が多いユーザーでも軽量。

**追加した苦手単語カード**（`data-testid="weak-words-card"`）:
`/weak`と同じ抽出条件・並び順（`wrong_count desc`）で上位5件のみを表示（大量表示はしない）。
「すべて見る →」で`/weak`へ遷移。「まず10語だけ復習」は既存の`/review?...&mode=recovery&limit=10`
導線が既にダッシュボードの復習待ちセクションに存在するため、重複させずそちらに委ねた
（苦手単語カード自体には新設していない）。

**今日やること導線の変更**:
アクショングリッドに「🎯 苦手単語を復習」（`/weak`）「🔍 単語を調べる」（`/dictionary`）を
追加。下部「教材・その他」グリッドにあった旧「苦手単語」タイル（リンクのみのカード）は、
新しい苦手単語カードと内容が重複するため削除して統合した。既存の「今日の復習」ボタン・
リカバリーヒント（`dashboard-recovery-hint`、due>=20件で表示）は一切変更していない。

**使用したデータ・算出方法**: 既存の`Promise.all`データ取得ブロックに3クエリを追加する
だけで実装（`masteredCount`/`weakCount`はCOUNTのみ、`weakWords`は5件limitの軽量クエリ）。
新規RPC・DBスキーマ変更・マイグレーションは無し。

**Premium導線の有無**: 苦手単語カードに、苦手単語が1件以上ある非Premiumユーザーにのみ
「詳しい弱点分析はPremiumで確認 →」という控えめな一文リンク（`/weak`へ）を追加した。
既存の`/weak`の「AI弱点分析（Premium）」パターンをそのまま踏襲し、新規のAI分析機能は
実装していない。

**検証で発見・修正した既存バグ**（本タスクのスコープ外・`/weak/page.tsx`の既存コード）:
苦手単語カードの「すべて見る →」リンクをE2Eでテストした際、苦手単語が1件以上ある状態で
`/weak`を開くと必ず本番ビルドでサーバーレンダリングがクラッシュすることが判明した。
原因は`/weak/page.tsx`（Server Component、`"use client"`無し）内の「🤖 AI解説」`Link`に
`onClick={(e) => e.stopPropagation()}`というインライン関数がServer Componentから
直接渡されており、Next.jsのRSC制約（Server ComponentからClient Componentへ関数を
propとして渡せない）に違反していたため（"Event handlers cannot be passed to Client
Component props"）。この`onClick`は阻止すべき親要素のクリックハンドラが元々存在せず
無意味なコードだったため、削除して修正した（挙動の変更は無い）。これは本タスクとは
無関係の既存バグで、これまでのE2Eが偶然このパスを踏んでいなかったために見過ごされて
いたと考えられる。

**新規テスト**: `scripts/testing/e2e/dashboard-insights.mjs`（新規、
`npm run test:dashboard-insights`、`run-e2e.mjs`のステップ17として追加）:
- 0語ユーザー（test+onboarding）: 習得率・苦手単語カードが表示されない（`hasWords=false`の
  分岐）、既存の「はじめの3ステップ」ガイドは引き続き表示される、表示崩れ・console error無し
- 通常ユーザー（test+srs、8語・is_weak=true×2・mastery=40）: 習得率カードの内訳
  （習得済み0/学習中6/苦手2/全体習得率0%）が正しい、苦手単語カードに`is_weak=true`の
  単語のみ表示（wrong_count=0かつis_weak=falseの単語は含まれない）、「単語帳別に見る」→
  `/wordbooks`・「復習する」→`/review`・「すべて見る →」→`/weak`の各リンクが機能する、
  非Premiumへの控えめなPremium導線が表示される、`/weak`へのリンクが想定通り3箇所
  （重複タイルの復活が無い）
- due単語20件以上の状態: 既存のリカバリーヒント（`dashboard-recovery-hint`）が新カードと
  共存して正しく表示される（既存機能への回帰なし）
- モバイル幅(375px)で横スクロールが発生しない

**変更ファイル**: `src/app/dashboard/page.tsx`、`src/app/weak/page.tsx`（既存バグ修正）、
`scripts/testing/e2e/dashboard-insights.mjs`（新規）、`scripts/testing/run-e2e.mjs`、
`package.json`（`test:dashboard-insights`スクリプト追加）、`NEXT_IMPROVEMENTS.md`、
`PRODUCTION_MONITORING.md`、`WORK_HISTORY.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2中核ロジック、
teacher機能、教材データ本体、AdSense広告枠（追加なし）、学習中・復習中画面への広告
（追加なし）、既存のリカバリーモード導線、単語帳削除機能。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:dashboard-insights`（新規、全24項目PASS） / `npm run test:e2e`
（17フロー全PASS、既存フローに回帰なし） / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: 「まず10語だけ復習」の専用導線は苦手単語カード自体には追加していない
（既存の復習待ちセクションの`mode=recovery&limit=10`導線と重複するため）。品詞別・
出題形式別の弱点分析（ユーザー提案の発展形、収益化監査#6で言及済み）は今回スコープ外の
まま（優先度Bの別項目として引き続き検討）。

---

## 2026-07-04 カテゴリLPの公開URL・sitemap・canonical・robots・Search Console対応確認

**目的**: 前回新設した`/materials/toeic`・`/materials/business`が検索流入に正しくつながるよう、
公開URL・クロール導線を確認・修正した。

**確認結果（発見・修正した不足点）**:
- **sitemap.xmlに両LPが含まれていなかった**（実質的なバグ）: `src/app/sitemap.ts`は
  既存教材の動的ルート（`materialIds.map(...)`）は網羅していたが、新規に追加した静的LP
  （`/materials/toeic`・`/materials/business`）を追加し忘れていた。`/materials`・
  `/dictionary`・`/guide`・`/grammar`・`/faq`は元から含まれていたことを確認 → 両LPを
  priority 0.85・changeFrequency weeklyで追加した。
- **canonicalが未設定だった**: 両LPのmetadataに`alternates.canonical`が無かった。
  `/materials/[id]`との実質的な競合は無い（Next.js App Routerは静的セグメントを動的
  セグメントより優先して解決するため、`/materials/toeic`が`[id]="toeic"`として誤解釈
  されることは無い）が、明示的にcanonicalを設定することで曖昧さを排除した。
  `openGraph.url`も合わせて設定。
- **robots.txtは修正不要だった**: `/materials/toeic`・`/materials/business`・`/materials`・
  `/dictionary`のいずれも`Disallow`に含まれておらず、既存の許可設定のままで問題無し。
- **JSON-LDは既に正しく実装済みだった**: 両LPともBreadcrumbList・ItemListの2種類が
  それぞれ1個ずつ存在し、いずれも妥当なJSONとしてパースできることを確認。
- **内部リンクは前回までにすべて実装済み**: `/materials`⇄各LP、LP間相互リンク、
  `/dictionary`⇄`/materials`、教材詳細⇄関連教材、guide/grammar/faqからmaterials/dictionary
  への導線、いずれも既存の実装で満たされていることを再確認した（新規追加は無し）。

**実装内容**:
- `src/app/sitemap.ts`: `/materials`エントリの直後に`/materials/toeic`・
  `/materials/business`を追加（priority 0.85、changeFrequency weekly）。
- `src/app/materials/toeic/page.tsx`・`src/app/materials/business/page.tsx`:
  `metadata.alternates.canonical`と`openGraph.url`を追加。

**テスト**: `scripts/testing/seo-lp-audit.mjs`（新規、`npm run verify:seo-lp-audit`）を
新設。既存の`verify-prod.mjs`と同じくHTTPのみ（ブラウザ不要）で、本番の`/sitemap.xml`に
主要ページ・両LPが含まれるか、`/robots.txt`が対象パスをブロックしていないか、両LPの
`<link rel="canonical">`が自分自身のURLを指しているか、JSON-LDが妥当なJSON（2個・
BreadcrumbList/ItemList）か、既存`/materials/[id]`が引き続き200で表示されるか、を検証する。
`verify-prod.mjs`の公開ページ一覧にも`/materials/toeic`・`/materials/business`を追加した。

**ドキュメント**: `SEARCH_CONSOLE_SETUP.md`に、オーナーがSearch ConsoleのURL検査ツールで
個別にインデックス登録をリクエストすべきURL（`/materials/toeic`・`/materials/business`・
`/materials`・`/dictionary`）を新セクション「0-1」として追記した。

**変更ファイル**: `src/app/sitemap.ts`、`src/app/materials/toeic/page.tsx`、
`src/app/materials/business/page.tsx`、`scripts/testing/verify-prod.mjs`、
`scripts/testing/seo-lp-audit.mjs`（新規）、`package.json`（`verify:seo-lp-audit`
スクリプト追加）、`SEARCH_CONSOLE_SETUP.md`、`NEXT_IMPROVEMENTS.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2ロジック、
teacher機能、教材データ本体、AdSense広告枠、新規LP作成（今回は既存2LPのSEO導線確認のみ）、
既存の内部リンク実装（すべて前回までの実装で要件を満たしていたため変更不要）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:internal-links`（回帰なし） / `npm run test:category-lps`（回帰なし） /
`npm run test:e2e`（16フロー全PASS） / `npm run verify:prod` / `npm run verify:srs-global` /
`npm run verify:seo-lp-audit`（新規、本番で全項目PASS）。

**残課題**: Search Console側でのインデックス登録状況（URL検査ツールでのリクエスト結果）は
オーナー確認待ち。他カテゴリ（大学受験・英検・中学高校基礎・日常会話）のLPは引き続き
スコープ外（今回のTOEIC/ビジネス英語LPの効果を見てから検討）。

---

## 2026-07-04 カテゴリ別公開LP（TOEIC・ビジネス英語）の新設

**目的**: 前回の内部リンク強化に続き、SEO流入増加と社会人ユーザー獲得のため、TOEIC学習者・
社会人の学び直し・ビジネス英語学習者・会議/メール英語学習者がログイン前でも「このアプリは
使えそう」と感じられる公開LPを新設した。全カテゴリを一気に作るのではなく、社会人ユーザー
獲得に直結するTOEIC・ビジネス英語の2ページから着手した。

**ルーティング衝突の確認**: `/materials/[id]`という動的ルートが既に存在するため、
`/materials/toeic`・`/materials/business`という新規静的ルートが競合しないかを事前に確認した。
Next.js App Routerでは同じ階層に静的セグメント（`toeic`/`business`）と動的セグメント
（`[id]`）が共存する場合、静的セグメントの完全一致が優先されるため、`/materials/toeic`への
アクセスは新設ページに、それ以外のUUID形式のIDへのアクセスは従来通り`/materials/[id]`に
ルーティングされる。また教材の`id`列はUUID形式で保存されているため、"toeic"や"business"
という文字列と実際に衝突することは構造上あり得ないことも確認した。`npm run build`のルート
一覧で`/materials/toeic`・`/materials/business`・`/materials/[id]`がそれぞれ独立したルートとして
生成されることを確認し、実ブラウザでも両方が正しく動作することを確認した。

**実装内容**:
- `src/app/materials/toeic/page.tsx`（新規）: 「TOEIC対策の英単語教材」。
  `materials.exam_type = 'TOEIC'`の4教材（TOEIC 基礎100・TOEIC 頻出動詞100・
  TOEIC頻出単語800・TOEIC頻出単語600）を表示。学習の流れは「①教材を選ぶ→②単語帳に追加→
  ③復習→④テスト」。CTA「TOEIC教材を見る」（ページ内アンカー）「🔍 単語を調べる」
  （`/dictionary`）「無料で始める」（未ログイン時のみ、`/signup?next=/materials/toeic`）。
  末尾に`/dictionary`・`/materials/business`・`/materials`への相互リンク。
- `src/app/materials/business/page.tsx`（新規）: 「ビジネス英語の単語教材」。
  `materials.exam_type = 'ビジネス英語'`の2教材（ビジネス英語 基礎100・会議・メール英語100）
  を表示。学習の流れは「①調べる→②登録→③復習→④テスト」（TOEIC LPとは順序を変え、
  辞書検索からの入り口を強調）。CTA「ビジネス英語教材を見る」「🔍 辞書で調べる」
  「無料で始める」。末尾に`/dictionary`・`/materials/toeic`・`/materials`への相互リンク。
- 両ページとも、教材の単語数表示には既存の`get_material_word_counts` RPC（`/materials`一覧
  ページで使用しているものと同一）を再利用し、新規の重いクエリを追加していない。
- SEO: `metadata`（title/description/OGP）、BreadcrumbList JSON-LD（ホーム→教材・単語帳→
  各LP）、ItemList JSON-LD（表示教材一覧）を設定。説明文は2〜3文の短いものに留め、
  教材カード・学習導線・辞書導線を主役にした（薄いテキストページにしないため）。
- `src/app/materials/page.tsx`: `CategoryGroup`型に`landingPages`（任意）フィールドを追加し、
  「TOEIC・ビジネス英語」セクションの見出し直下に「TOEIC対策ページへ →」「ビジネス英語
  ページへ →」の小さなリンク行を追加（他のセクションには影響なし、UIの圧迫を避けるため
  ラベル+矢印のみのミニマルな表示）。

**テスト**: `scripts/testing/e2e/category-lps.mjs`（新規、`npm run test:category-lps`）を
新設し、`test:e2e`にも16フロー目として統合。実ブラウザで、(1)両LPが200で表示される、
(2)教材カードが正しい件数・タイトルで表示される（TOEIC4件・ビジネス2件）、(3)教材カードから
`/materials/[id]`への遷移、(4)`/dictionary`への導線、(5)LP間相互リンク、(6)`/materials`から
各LPへの導線、(7)モバイル幅(375px)での横スクロール無し、(8)既存`/materials/[id]`が
ルーティング競合の影響を受けず正常動作すること、をすべて検証した。

**変更ファイル**: `src/app/materials/toeic/page.tsx`（新規）、
`src/app/materials/business/page.tsx`（新規）、`src/app/materials/page.tsx`
（`landingPages`フィールド・リンク行追加）、`scripts/testing/e2e/category-lps.mjs`（新規）、
`package.json`（`test:category-lps`スクリプト追加）、`scripts/testing/run-e2e.mjs`
（16フロー目として統合）、`NEXT_IMPROVEMENTS.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2ロジック、
teacher機能、教材データ本体（`materials`/`material_words`の内容は一切変更していない）、
AdSense広告枠（学習中・復習中画面への追加はしていない）、既存の`/materials/[id]`のロジック・
既存の教材インポート導線。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build`（ルート一覧確認含む） /
`npm run test:smoke` / `npm run test:internal-links`（回帰なし） / `npm run test:category-lps`
（単独実行、全項目PASS） / `npm run test:materials:e2e`（25/25、回帰なし） /
`npm run test:e2e`（16フロー全PASS） / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: 他のカテゴリ（大学受験・英検・中学高校基礎・日常会話）向けの公開LPは今回のスコープ
外。今回のTOEIC/ビジネス英語LPの効果（Search Console経由の流入・回遊状況）を見てから、
他カテゴリへの展開を検討する。

---

## 2026-07-04 教材・辞書ページの内部リンク強化

**目的**: 前回の収益化・成長監査で確認した「教材詳細ページに関連教材リンクが無い」
「辞書⇄教材の相互導線が無い」という内部リンクの弱さに対応し、SEO流入・教材ページの
回遊率・無料ユーザーの継続導線を強化した。

**現状調査（実施結果）**:
- `/materials`から各教材詳細への導線はカテゴリ別セクション表示のみで、セクションへの
  アンカージャンプは無かった
- `/materials/[id]`から関連教材への導線は皆無（`/materials`一覧への「戻る」リンクのみ）
- `/dictionary`から教材・単語帳への導線は無く、検索機能のみだった
- `/guide`・`/grammar`・`/faq`はいずれも下部CTAが`/signup`または`/contact`のみで、
  `/materials`・`/dictionary`への相互リンクが無かった
- 教材詳細ページのSEO title/descriptionは既に動的生成（`generateMetadata`）でキーワードを
  含む具体的な内容になっていた（例: 「TOEIC 基礎100【スターターパック】単語帳【無料】
  TOEIC基礎レベル・TOEIC対策 | Loop Vocabulary」）
- Breadcrumb構造化データは`/materials/[id]`・`/grammar/[slug]`には既にあったが、
  `/dictionary`には無かった
- FAQ構造化データは`/faq`に既に実装済みだった
- 公開ページ（`/materials`・`/materials/[id]`・`/dictionary`・`/guide`・`/grammar`・`/faq`）は
  いずれも未ログインで本文閲覧・回遊が可能だった
- `materials.exam_type`は全43教材で必ず設定されており（NULL無し）、値は
  `大学受験`(11)・`高校入試`(5)・`英検`(10)・`高校英語`(2)・`大学入試`(2)・`一般`(7)・
  `TOEIC`(4)・`ビジネス英語`(2)の8種類。カテゴリごとに表記ゆれがあるため、そのまま
  `exam_type`だけで関連判定するとグルーピングが崩れる（例: 「高校入試」と「高校英語」は
  本来同じ括り）ことを確認した

**実装内容**:
- `src/app/materials/[id]/page.tsx`: `EXAM_TYPE_GROUP`マップで8種類の`exam_type`を
  「大学受験・共通テスト」「中学・高校基礎」「英検対策」「TOEIC・ビジネス英語」
  「日常会話・学び直し」の5グループに正規化。同グループの他教材を`material_words`を
  取得しない軽量クエリ（4列のみ・`.limit(6)`）で最大6件取得し、「関連する教材」
  セクションとして表示（自身は`.neq("id", material.id)`で除外）。既存のBreadcrumb
  JSON-LD・インポート導線は無変更。教材⇄辞書の回遊のため「🔍 辞書で単語を調べる」
  「📚 教材一覧に戻る」のリンク行も追加。
- `src/app/dictionary/page.tsx`: 「単語帳を自分で作るのが大変な方へ」というカードを
  検索カードの下に追加し、`/materials`への導線を新設（未ログインユーザーにも表示）。
  Breadcrumb JSON-LD（ホーム→辞書検索の2階層）も新規追加。
- `src/app/materials/page.tsx`: カテゴリ別表示の各`<section>`に`id={group.id}`を付与し、
  検索バーの下に絵文字+ラベルのアンカーリンク一覧（クイックジャンプ）を追加。ページ内
  スクロールのみで新規ページ作成は無し。
- `src/app/grammar/page.tsx`・`src/app/guide/page.tsx`・`src/app/faq/page.tsx`: 下部の
  リンク行に`/materials`（教材一覧）・`/dictionary`（辞書検索）への相互リンクを追加。

**関連教材ロジックの検証**: TOEIC 基礎100（`exam_type=TOEIC`）で確認したところ、同じ
「TOEIC・ビジネス英語」グループに属するビジネス英語 基礎100（`exam_type=ビジネス英語`）・
会議/メール英語100・TOEIC頻出動詞100・既存TOEIC頻出単語800/600の計5件が正しく関連教材に
表示され、2026-07-04に追加したばかりの新規TOEIC/ビジネス教材も自動的にこの仕組みに
乗ることを確認した（手動でのリンク登録は不要）。

**テスト**: `scripts/testing/e2e/internal-links.mjs`（新規、`npm run test:internal-links`）
を新設し、`test:e2e`にも15フロー目として統合。実ブラウザで、(1)カテゴリクイックジャンプの
表示、(2)関連教材セクションの表示・新規ビジネス英語教材が含まれること・自分自身が
除外されていること、(3)関連教材リンクのクリック遷移、(4)教材詳細→辞書、(5)辞書→教材一覧
の相互導線、(6)既存の無料登録CTA（インポート導線）が壊れていないこと、(7)モバイル幅
(375px)で横スクロールが発生しないこと、をすべて検証。

**変更ファイル**: `src/app/materials/[id]/page.tsx`、`src/app/dictionary/page.tsx`、
`src/app/materials/page.tsx`、`src/app/grammar/page.tsx`、`src/app/guide/page.tsx`、
`src/app/faq/page.tsx`、`scripts/testing/e2e/internal-links.mjs`（新規）、`package.json`
（`test:internal-links`スクリプト追加）、`scripts/testing/run-e2e.mjs`（15フロー目として
統合）、`NEXT_IMPROVEMENTS.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2ロジック、
teacher機能、教材データ本体（`material_words`の内容は一切変更していない）、AdSense広告枠
（学習中・復習中画面への追加はしていない）、既存のSEOメタ情報（すでに強かったため
`/dictionary`のBreadcrumb追加以外は変更なし）、既存の教材インポート導線。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:internal-links`（単独実行、全項目PASS） / `npm run test:materials:e2e`
（25/25、回帰なし） / `npm run test:e2e`（15フロー全PASS） / `npm run verify:prod` /
`npm run verify:srs-global`。

**残課題**: 関連教材の並び順は現状「タイトルのアルファベット/五十音順」のみ（レベル近似度
による並び替えは未実装）。カテゴリ別のLP新設（TOEIC向け公開LP等）は今回のスコープ外
（教材追加の状況を見てから検討）。

---

## 2026-07-04 復習リカバリーモードの実装

**目的**: 前回の収益化・成長監査で確認した「復習の雪だるま問題」（`/review`の復習キューは
`.limit(50)`のみで、サボった後の救済導線が一切無い）に対応するため、復習待ちが溜まった時に
少量から再開できる「リカバリーモード」を実装した。

**現状調査（実施結果）**:
- `/review`のdue取得は`.eq("user_id",...).or("next_review_at.lte.now,is_weak.eq.true").order("next_review_at",{ascending:true}).limit(50)`で、`book`パラメータ指定時は`.eq("word_book_id", book)`を追加する設計だった
- due単語は最大50件まで一括取得され、`start=1`時は`FlipCardRunner`にpool全体（最大50件）が
  そのまま渡され、**間に区切りなく全件を通しでこなす設計**だった（例えば45件溜まっていれば
  45件を一度に消化しないと「完了」画面に辿り着かない）
- ダッシュボードの「復習待ち」は`dueCount`（`.select("*",{count:"exact",head:true})`、
  50件制限を受けない実際の総数）を生の数字でそのまま表示していた
- 優先順位付けは`next_review_at`昇順（最も遅延している単語が先）のみで、正答率・wrong_count・
  ease_factorによる重み付けは無かった
- book指定時と全単語帳時の違いは、due取得クエリへの`.eq("word_book_id", book)`追加の有無のみ
- SRS V2の採点・更新（`saveStudyResult`→`applySrsV2`）は1問ごとに`FlipCardRunner`から
  呼ばれる設計で、「どの単語がpoolに含まれるか」とは完全に独立していることを確認
  （リカバリーモードを追加してもこのロジックには一切触れる必要が無いことを確認済み）

**実装方針**: DBスキーマ変更・SRS中核ロジック変更はせず、復習セッションの入り口と表示改善のみに
限定した。

**実装内容**:
- `src/app/review/page.tsx`: due取得クエリに`wrong_count`を追加選択し、
  `.order("next_review_at",{ascending:true})`に続けて`.order("wrong_count",{ascending:false})`
  を追加（同時刻の場合のタイブレークとして正答率が低い単語を優先。既存の第一優先順位は無変更）。
  `RECOVERY_THRESHOLD=20`語以上の時にリカバリーバナー（「復習が少し溜まっています」+
  「まず10語だけ」「20語だけ進める」ボタン）を表示。`mode=recovery`のとき、既に取得済みの
  poolを`Array.slice(0, limit)`するだけで追加クエリなしに出題数を絞る（`limit`は`?limit=`から
  取得、1〜50の範囲にクランプ）。`book`パラメータは既存の仕組みをそのまま通すため、
  リカバリーモードも自動的に単語帳スコープに対応する。
- `src/components/review/FlipCardRunner.tsx`: `recoveryMode`/`recoveryTotalDue`propsを追加。
  完了画面で、通常時は「完了！」のまま、リカバリーモード時は「今日はここまででOK！」+
  「残り{N}語は少しずつ消化していきましょう」（残りが無ければ「すべて終えました」）という
  前向きな表示に切り替える。セッション中も「🌱 リカバリーモード（N語だけ）」の小さな
  バッジを表示。ユーザーを責める文言（「サボった」「遅れた」等）は一切使っていない。
  `saveStudyResult`の呼び出し方・SRS V2の採点ロジックは一切変更していない。
- `src/app/dashboard/page.tsx`: 「🔁 今日の復習」ボタンの下に、`dueCount>=20`の時だけ
  「復習が少し溜まっています。まずは10語だけ →」という控えめなテキストリンクを追加
  （`/review?start=1&mode=recovery&limit=10`）。既存のボタン・バッジ表示は無変更。

**URLの設計**: `/review?mode=recovery&limit=10`・`/review?mode=recovery&limit=20`・
`/review?book=<id>&mode=recovery&limit=10`のいずれにも対応。`mode`パラメータは既存の
`flip`/`choice`と同列の第3の値として`recovery`を追加する形にし、既存の2値との衝突は無い。

**テスト作成中に発見した2つの誤り（いずれもテストスクリプト側の問題、アプリ側は正常）**:
1. `FlipCardRunner`の次カードへの切り替わり待ちを固定時間（450ms）で行っていたところ、
   ネットワーク往復（Supabaseへの複数回の書き込み）に対して待ち時間が不足しタイムアウトする
   ことがあったため、`data-word`属性の変化を待つ`waitForFunction`方式（既存の`srs.mjs`と
   同じパターン）に変更して解消した。
2. `next_review_at`の更新確認を文字列の完全一致(`!==`)で行っていたところ、PostgRESTが返す
   タイムスタンプの文字列表現がinsert時のISO文字列と一致しないことがあり、更新されていない
   単語まで「更新された」と誤判定していた。`new Date(...).getTime()`で実際の時刻を比較する
   方式に変更して解消した。

**テスト**: `scripts/testing/e2e/recovery-mode.mjs`（新規、`npm run test:recovery-mode`）を
新設し、`test:e2e`にも14フロー目として統合。実ブラウザで、35語due（メイン単語帳）+
5語due（デコイ単語帳、スコープ隔離確認用）を用意し、(1)バナー表示、(2)「まず10語だけ」で
ちょうど10語出題・DBで10語のみ更新、(3)残り25語でバナー継続、(4)「20語だけ進める」で
20語出題、(5)残り5語でバナー消滅、(6)通常復習(`mode=flip`)が残り全5語を出題（capなし）、
(7)デコイ単語帳が一切更新されない（book指定のスコープ隔離）、をすべて検証。

**変更ファイル**: `src/app/review/page.tsx`、`src/components/review/FlipCardRunner.tsx`、
`src/app/dashboard/page.tsx`、`scripts/testing/e2e/recovery-mode.mjs`（新規）、`package.json`
（`test:recovery-mode`スクリプト追加）、`scripts/testing/run-e2e.mjs`（14フロー目として統合）、
`NEXT_IMPROVEMENTS.md`。

**変更していないもの**: DBスキーマ（マイグレーション無し）、RLS、SRS V2の採点・更新ロジック
（`src/lib/srs/`配下は無変更）、teacher機能、教材データ、単語帳削除機能、AdSense広告枠
（学習中・復習中画面への追加はしていない）、通常復習（`mode=flip`/`mode=choice`）の挙動。
「リセット」「復習スケジュールの一括再調整」は今回意図的にスコープ外とした（別タスク）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:recovery-mode`（単独実行、全項目PASS） / `npm run test:e2e`（14フロー全PASS）/
`npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: 「復習スケジュールの一括再調整」「due単語のリセット」機能は別タスクとして検討。
リカバリーモードの閾値（20語）・選択肢（10/20語）は初期値として設定したもので、実際の
利用状況を見てから調整の余地がある。

---

## 2026-07-04 TOEIC・ビジネス英語スターターパック4種の追加（計400語）

**目的**: 前回の収益化・成長監査で確認した「TOEIC/ビジネス教材が弱い」（全39教材中TOEIC
2件・ビジネス専用0件）という課題に対応するため、社会人・TOEICユーザー向けのスターターパック
4種を追加した。

**追加した教材パック**:
1. **TOEIC 基礎100**（`10000000-0000-0000-0000-000000000109`、100語）—
   TOEIC Part 3/4/7で頻出するオフィス・日常業務の基本語彙（office/meeting/report/client/
   schedule等）。TOEIC初心者・社会人の学び直し向け
2. **TOEIC 頻出動詞100**（`...0110`、100語）— TOEICの文書・メール・案内文で頻出する
   ビジネス動詞（confirm/submit/arrange/attend/provide等）。TOEIC 500〜700点目標向け
3. **ビジネス英語 基礎100**（`...0111`、100語）— 職場・取引先・キャリアで使う実務語彙
   （deadline/proposal/invoice/department/manager等）。TOEIC以外の職場英語全般でも使える語を優先
4. **会議・メール英語100**（`...0112`、100語）— 会議・議事録・メール・依頼・日程調整で使う
   実践語彙（agenda/minutes/attachment/request/follow-up等）

すべてオリジナル作成で、市販教材・TOEIC公式問題集の本文・配列からの転載は一切していない。
追加前に既存のTOEIC/一般教材（`loop学びなおし英単語`4種・TOEIC頻出単語800/600等、計1,000語）
の語彙をDBから抽出して照合し、重複を避けて語彙を選定した。

**教材メタ情報**: 各パックにgrade（対象学年）・purpose（目的）・recommendedWeeks（推奨期間）・
dailyWordTarget（1日目安語数）・category・tagsを設定した。
- TOEIC基礎100: 社会人・TOEIC初心者 / 2週間 / 1日7語 / category=toeic / exam_type=TOEIC /
  level=TOEIC基礎 / tags=[TOEIC対策, はじめての人におすすめ, 社会人向け, 基礎固め, 短期集中]
- TOEIC頻出動詞100: 社会人・TOEIC500〜700点 / 2週間 / 1日7語 / category=toeic /
  exam_type=TOEIC / level=TOEIC / tags=[TOEIC対策, 動詞強化, 社会人向け, 基礎固め, 短期集中]
- ビジネス英語基礎100: 社会人 / 2週間 / 1日7語 / category=toeic / exam_type=ビジネス英語 /
  level=ビジネス基礎 / tags=[ビジネス英語, 社会人向け, 仕事で使える英語, はじめての人におすすめ,
  基礎固め, 短期集中]
- 会議・メール英語100: 社会人 / 2週間 / 1日7語 / category=toeic / exam_type=ビジネス英語 /
  level=ビジネス実践 / tags=[ビジネス英語, 社会人向け, 仕事で使える英語, 基礎固め, 短期集中]

**表示・メタ情報の拡張**: `ALLOWED_TAGS`に「ビジネス英語」「社会人向け」「仕事で使える英語」を
追加（DBスキーマ変更なし・表示専用）。`/materials`の「TOEIC・ビジネス英語」セクションの一致
条件（`CATEGORY_GROUPS`）を、従来の`exam_type === "TOEIC"`判定に加えて
`exam_type === "ビジネス英語"`・`level`が"ビジネス"で始まる場合も一致するよう拡張し、
ビジネス英語基礎100・会議/メール英語100もこのセクションに表示されるようにした（既存の
TOEIC判定・他セクションの判定は無変更）。`LEVEL_COLOR`に新レベル用のバッジ色
（TOEIC基礎/TOEIC/ビジネス基礎/ビジネス実践、いずれも既存カラーパレットの範囲内）を追加した。

**実装**: `src/data/presets/`に4ファイル（`toeic-basic-100.ts`、
`toeic-frequent-verbs-100.ts`、`business-basic-100.ts`、`meeting-email-english-100.ts`）を
新規追加し、`index.ts`の`PRESET_PACKS`に登録。既存の`presetMeta.ts`は`PRESET_PACKS`から
自動導出する仕組みのため、新4パックのメタデータは追加コード不要で`/materials`・
`/materials/[id]`に自動反映された。

**関連スクリプトの更新**: `scripts/materials/{validate-materials,test-materials,
seed-preset-materials}.mjs`の3スクリプト（いずれも対象パックをハードコードでimportする既存
パターンのため）を更新し、新4パックを追加。

**執筆時の修正**: 当初の下書きではTOEIC基礎100が101語、会議・メール英語100が107語になって
いた（重複はなく、計画時より単語数が多くなっていただけ）ため、各パックの主旨に照らして
重要度が低い語（例: 会議・メール英語100の"cc list"「attachment size」等、既存語と機能が
近い語）を間引いて厳密に100語に揃えた。

**品質チェック結果**: `validate:materials`で12パック中errors=0（警告2件はフレーズ動詞
「catch/caught」「bounce back」の語幹検出における既知の誤検知で、既存パックにも同種の
警告が1件ある。実際の例文品質には問題なし）。`test:materials`で新4パックのDB投入・語数
一致・インポート後のSRS/PDF互換性を確認（34項目、全PASS）。既存31教材+旧8パック
（39件）は無変更、新4パック追加後は43教材・総語数33,092語（32,692語+400語）。

**教材一覧・詳細での見え方**: `test:materials:e2e`で実際のインポートフロー（未ログイン時の
CTA・ログイン後インポート・再インポート時の重複防止・PDFテスト導線・review導線）を確認
（25項目、全PASS）。「TOEIC 基礎100」「TOEIC 頻出動詞100」「ビジネス英語 基礎100」
「会議・メール英語100」はいずれも`/materials`の「TOEIC・ビジネス英語」セクションに表示される。

**既存教材への影響**: 既存31教材・旧8スターターパックのデータ・表示には一切変更なし。
DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、AdSense広告枠
の追加なし。前回修正した単語帳削除機能・教材詳細ページの総語数表示・教材インポート後導線は
いずれも回帰なし（`test:e2e`13フローに含めて確認）。

**変更ファイル**: `src/data/presets/toeic-basic-100.ts`（新規）、
`src/data/presets/toeic-frequent-verbs-100.ts`（新規）、
`src/data/presets/business-basic-100.ts`（新規）、
`src/data/presets/meeting-email-english-100.ts`（新規）、`src/data/presets/index.ts`、
`src/lib/materials/types.ts`（ALLOWED_TAGS拡張）、`src/app/materials/page.tsx`
（CATEGORY_GROUPS一致条件・LEVEL_COLOR拡張）、`scripts/materials/validate-materials.mjs`、
`scripts/materials/test-materials.mjs`、`scripts/materials/seed-preset-materials.mjs`、
`NEXT_IMPROVEMENTS.md`。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run
validate:materials`（12パック、errors=0） / `npm run test:materials`（34/34） /
`npm run test:materials:e2e`（25/25、回帰なし） / `npm run test:e2e`（13フロー全PASS）/
`npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global`。

**次に追加すべき教材候補**: TOEIC 頻出名詞100（今回見送り、動詞パックと対）、英検2級 基礎100、
大学受験 基礎形容詞100、日常英会話 超基礎50 Part2（旅行編）、経済ニュース英単語100・
企業ニュース英単語100（専門分野・ニュース語彙拡充、収益化監査#3の次の一手）。

---

## 2026-07-04 収益化・成長観点の監査 + 単語帳削除バグの修正

**目的**: Loop Vocabularyを「ただの英単語アプリ」から収益化できる強いWebアプリにするため、
事業・収益・継続率・SEO流入の観点でコード・DB・教材・導線を監査し、優先順位付きロードマップに
反映した。全実装は行わず、Phase 0（監査）→Phase 1（最優先バグ確認・修正）→Phase 2
（ロードマップ反映）の順で進めた。

**監査方法**: 3体のExplore系サブエージェントを並列起動し、(1)教材のTOEIC/ビジネス/専門分野
語彙の充実度、(2)SEO メタ情報・構造化データ・内部リンク、(3)ゲーミフィケーション・
ダッシュボード可視化・SRS復習スケジューリングの3領域を独立調査。単語帳削除バグの調査
（Phase 1最優先事項）は自分で直接コード・スキーマを確認した。

**監査結果サマリー（詳細は[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)「💰 収益化・成長 監査」参照）**:
- **TOEIC/ビジネス教材が弱い（確認済み）**: 全39教材・32,692語のうちTOEICはわずか2件
  （計2,763語）、ビジネス英語専用教材は0件。ユーザーの問題意識通り、大学受験(9件)・
  英検(11件)に比べて明確に手薄だった。
- **復習の雪だるま問題への救済導線が未実装（確認済み）**: `/review`の復習キューは`.limit(50)`
  のハード上限のみで、ソフト上限・「今日はここまで」提案・「まず10語だけ」ボタン・
  非難しないメッセージング等はいずれも存在しなかった。優先順位付け（`next_review_at`昇順）
  自体は妥当な設計で機能している。
- **専門分野・ニュース語彙がほぼ無い（確認済み）**: 経済・金融・企業・決算・株式・
  テクノロジー・バイオ・医療をタイトルに含む教材は「loop学びなおし英単語③【ニュース・教養】」
  （300語、一般教養寄り）の1件のみ。専門特化デッキは0件。
- **ダッシュボードの進捗可視化は想定よりかなり充実していた**: ストリーク・目標進捗バー・
  3統計カード・状況に応じたCTA・デイリーミッション・バッジ・次バッジ進捗・週間チャレンジ・
  XP/レベル・90日カレンダー・最近の単語・今日の単語まで既に実装済み。唯一の欠落は
  `words.mastery`（習得率）がダッシュボードに一切表示されていない点。
- **ゲーミフィケーションも想定よりかなり充実していた**: バッジ6種・週間ランキング（公開）・
  XP/レベル・デイリーミッション・週間チャレンジが既に実装済み。ユーザーが「不足」と想定していた
  要素の多くが既にあった。唯一の欠落はバッジ/ストリーク達成とリワードチケットシステムの連携。
- **SEO・メタ情報・構造化データは想定より強かった**: `/materials`・`/materials/[id]`
  （動的generateMetadata）・`/dictionary`・`/guide`・`/grammar`・`/faq`いずれもキーワードを
  含む具体的なtitle/description、8ファイルにJSON-LD構造化データ（BreadcrumbList・
  FAQPage・Article・ItemList）実装済み、sitemapも動的ルートを網羅。実質的な弱点は
  内部リンクの密度（関連教材リンク・辞書→教材導線が無い）のみだった。
- **調べる→登録→復習→テストの導線は前回までにほぼ整備済み**: 2026-07-04の他ラウンドで
  単語帳詳細への7導線整理・教材インポート後CTAをすでに実施済みで、大きな穴はなかった。
- **AI復習最適化は土台はあるが分析機能は未実装**: SRS V2・`is_weak`フラグ・正誤カウントは
  既に出題重み付けに活用されているが、「品詞別弱点分析」等のユーザー向け分析UIはまだ無い。

**Phase 1: 単語帳削除バグの確認・修正（最優先事項、本当にバグがあった）**

`/wordbooks`（一覧）・`/wordbooks/[id]`（詳細）のいずれにも単語帳を削除するUIが一切存在せず、
`src/app/api/wordbook/`配下にもDELETEハンドラを持つルートが存在しなかった。RLS
（`word_books owner all`ポリシー、`for all using (auth.uid()=user_id)`）は削除自体を
禁止していなかったため、原因は**RLSではなく純粋なアプリ側の機能欠落**だった。

放置した場合の設計上の問題も確認: `words.word_book_id`は`on delete set null`のため、
仮に将来DB側だけで単語帳を削除しても単語が孤立し（`word_book_id = null`）、`/review`の
デフォルト（`book`パラメータ未指定時）復習プールは`user_id`のみでスコープされているため、
削除したはずの単語帳の単語が復習キューに永久に残り続ける「幽霊単語」問題が起きる設計だった。
これを避けるため、単語帳削除時は紐づく単語も明示的に削除する仕様にした
（`study_results.word_id`は`on delete cascade`のため学習履歴も安全に連鎖削除される。
`daily_stats`は日次集計のみで単語IDに依存しないため影響なし。共有単語帳の`import-shared`は
取込時に単語を丸ごとコピーする設計のため、元の単語帳を後で削除しても他ユーザーの
取込先単語帳には影響しないことも確認済み）。

**実装内容**:
- `src/app/api/wordbook/[id]/route.ts`（新規）: DELETEハンドラ。認証確認→所有権確認
  （`user_id`一致、`requireUser`と同等のパターン）→紐づく単語を削除→単語帳本体を削除。
  DBスキーマ変更・RLS変更は一切行っていない。
- `src/components/wordbooks/DeleteWordbookButton.tsx`（新規）: 確認ダイアログ
  （単語帳名・語数を明示）付きの削除ボタン。既存の`WordListWithDrawer.tsx`の単語削除UXと
  同じ`confirm()`パターンを踏襲。
- `src/app/wordbooks/[id]/page.tsx`: 共有セクションの下に、危険操作として控えめに配置。

**検証**: `scripts/testing/e2e/wordbook-delete.mjs`（新規、`npm run test:wordbook-delete`）を
新設し、`test:e2e`にも13フロー目として統合。実ブラウザで、削除ボタン表示→削除実行→
`/wordbooks`へリダイレクト→DB上でword_books行・words行の両方が削除されている（孤立無し）→
`/wordbooks`一覧・`/dashboard`・`/review`に残骸が出ない→削除済みIDへの直接アクセスが404、
までを検証。テスト作成中に2つの誤検知を発見・修正: (1) `router.push`直後にDOM検証すると
クライアント遷移が完了する前に古いページ内容を読んでしまうタイミング問題（`waitForLoadState`
+短い待機を追加）、(2) `page.textContent("body")`はNext.jsが埋め込む非表示のRSCフライト
データ`<script>`タグの中身まで拾ってしまうため、実際に画面表示されるテキストのみを見る
`page.locator("body").innerText()`に変更。いずれもテストスクリプト側の問題で、アプリの
実装自体に問題はなかった。

**Phase 2: ロードマップ反映**: [NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)に完了項目20
（単語帳削除修正）と新セクション「💰 収益化・成長 監査」（観点別サマリー表＋9観点の詳細）を
追加し、優先度A/B/Cに新規項目（復習リカバリーモード・教材内部リンク強化・TOEIC/ビジネス
教材追加・ダッシュボード習得率/苦手単語カード・ゲーミフィケーション/リワード連携・
AI弱点クラスタ分析・専門分野語彙拡充）を追加した。[PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md)
にも本監査の運用への反映事項と、13フローに更新された`test:e2e`の内訳を追記した。

**Phase 3は今回実装せず、次の高ROI改善として3つに絞って提案**（完了報告参照）。

**変更ファイル**: `src/app/api/wordbook/[id]/route.ts`（新規）、
`src/components/wordbooks/DeleteWordbookButton.tsx`（新規）、
`src/app/wordbooks/[id]/page.tsx`、`scripts/testing/e2e/wordbook-delete.mjs`（新規）、
`package.json`（`test:wordbook-delete`スクリプト追加）、
`scripts/testing/run-e2e.mjs`（13フロー目として統合）、
`NEXT_IMPROVEMENTS.md`・`PRODUCTION_MONITORING.md`。

**変更していないもの**: SRS V2の中核ロジック（間隔計算・評価ロジック）、teacher機能、
DBスキーマ（マイグレーション無し）、RLS、課金機能の本番導入、教材データの大量追加
（TOEIC/ビジネス/専門分野語彙は別タスクとして計画のみ）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:wordbook-delete`（単独実行、全項目PASS） / `npm run test:e2e`
（13フロー、全PASS） / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: 優先度A/B/Cに記載した各項目（詳細は[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)
参照）。特にTOEIC/ビジネス/専門分野語彙の教材追加は、内容作成のボリュームが大きいため
明示的に別タスクとして計画する。

---

## 2026-07-04 AdSense広告ユニットの本番投入（1箇所限定でスタート）

**経緯**: 前回のAdSense調査ラウンドで、AdSense管理画面のオーナー確認結果が共有された。
`loop-vocabulary.app`は`Getting ready`（審査未確定）だが、ads.txtはAuthorized、
ポリシーセンター警告なし、自動広告ON、広告ユニット作成可能な状態。オーナーがAdSense管理画面で
ディスプレイ広告ユニット「Loop Vocabulary Display Banner」（レスポンシブ）を作成し、
`data-ad-slot="5952840845"`が発行された。Publisher ID（`ca-pub-5148247638505100`）は
既存のまま、新規作成はしていない。

**環境変数設定**: `NEXT_PUBLIC_ADSENSE_SLOT_BANNER=5952840845`を`vercel env add`で
Vercel Production環境に追加（Preview/Developmentには追加していない）。設定作業に着手する前に
一度、ユーザーの発言が明確な承認か確認を要する状況が生じ、作業を止めて確認を取ってから
再開した（このやり取り自体はこの回のスコープ外だが、以降のオーナー指示は明確な承認として扱った）。

**表示箇所の絞り込み**: `NEXT_PUBLIC_ADSENSE_SLOT_BANNER`が設定されると、`AdSenseBanner`
（`BannerAdPlaceholder`から呼ばれる)が有効化され、修正前の実装のままでは以下9ページ10箇所で
一斉に実広告が表示される状態だった: `dashboard`・`materials`（検索結果/カテゴリ一覧の2箇所）・
`materials/[id]`・`review`・`road`・`settings`・`stats`・`weak`・`wordbooks/[id]`・
`learn`（レッスン結果画面）。AdSenseがまだ`Getting ready`であることを踏まえ、オーナーからの
「表示箇所が過剰なら減らしてほしい」という方針に沿って、**最初の実配置は`/dashboard`の
1箇所のみに限定**し、残り8ページからは`BannerAdPlaceholder`の呼び出しとimportを削除した
（コメントアウトではなく削除。復元する場合は該当コミットの差分を参照）。
各ページの`NativeAdCard`呼び出しはそのまま残置——`NEXT_PUBLIC_ADSENSE_SLOT_INFEED`が
未設定のため本番では引き続き何も表示されない（内部で`AdSenseInFeed`→スロット無しで
`AdPlaceholder`→本番ではnullを返す設計のため、コード上残っていても無害）。

`/dashboard`の配置は、統計カード・学習導線などのメインコンテンツすべての後、「先生向け機能への
導線」よりさらに下というページ最下部（そのページの最後の要素）にあり、学習操作やボタンを
妨げない。`AdSenseBanner`は`minHeight: 90`を指定しているため、広告が配信されない場合も
レイアウトが潰れない。クリック誘導文（「広告をクリックしてください」等）は元々使用しておらず、
今回も追加していない。

**変更ファイル**: `src/app/materials/page.tsx`・`src/app/materials/[id]/page.tsx`・
`src/app/review/page.tsx`・`src/app/road/page.tsx`・`src/app/settings/page.tsx`・
`src/app/stats/page.tsx`・`src/app/weak/page.tsx`・`src/app/wordbooks/[id]/page.tsx`・
`src/app/learn/LearnRunner.tsx`（いずれも`BannerAdPlaceholder`の呼び出し+importを削除）、
`ADSENSE_SETUP.md`・`PRODUCTION_MONITORING.md`・`NEXT_IMPROVEMENTS.md`（ドキュメント更新）。
DBスキーマ・RLS・SRS V2ロジック・教材データ・teacher機能・課金機能はいずれも変更していない。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:e2e`（9フロー全PASS、`/dashboard`・`/materials`・`/wordbooks`への回帰なし
確認済み） / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: AdSense審査が`準備完了`になり、`/dashboard`での配信・収益・レイアウトに
問題が無いことを確認できた段階で、他ページへの再展開をオーナー承認の上で検討する
（詳細は[ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4-3参照）。

---

## 2026-07-04 AdSense審査状況の確認・アプリ側の不足項目整理

**目的**: 広告掲載の準備状況とAdSense審査に必要な要件を確認。AdSense管理画面へのログインが
必要な操作はオーナー側の作業とし、アプリ側の実装・公開状態・確認手順の整理のみを担当した。

**調査結果**: AdSense関連の実装はプレースホルダではなく、アカウントレベルで実際に接続済み
だった。`src/app/layout.tsx`に`<meta name="google-adsense-account" content="ca-pub-
5148247638505100">`が常時出力され、Vercel Production環境に`NEXT_PUBLIC_ADSENSE_CLIENT`が
設定済み。設定時は`adsbygoogle.js`を読み込み自動広告（`enable_page_level_ads`）を有効化する
実装が`src/app/layout.tsx`にすでに存在した。`public/ads.txt`（`google.com, pub-
5148247638505100, DIRECT, f08c47fec0942fa0`）もPublisher IDと一致して公開済み。個別広告
ユニットのスロットID（`NEXT_PUBLIC_ADSENSE_SLOT_BANNER`/`_RECTANGLE`/`_INFEED`）は未設定の
ため、`src/components/ads/AdSense.tsx`の各コンポーネントは何も表示しない設計になっており、
本番での広告過剰表示のリスクは無いことを確認した。

robots.txt/sitemap/Search Console登録状況は2026-07-01の監査（`SEARCH_CONSOLE_SETUP.md`）で
既に整合済みで、AdSense審査の妨げになる不整合は無かった。未ログインでの公開ページ
（トップ・`/materials`一覧/詳細・`/dictionary`・`/guide`・`/grammar`・`/faq`・`/terms`・
`/privacy`・`/contact`）はすべて本文が閲覧可能で、ログイン必須ページは学習系機能
（`/dashboard`等）のみに限定されていることも確認した。

**発見した唯一の実質的な不足点**: `src/app/privacy/page.tsx`の「3. 広告について」は、
Android/iOSアプリ版のGoogle AdMobのみを記載し、Web版のGoogle AdSense・広告Cookie・
第三者配信・オプトアウト手段への言及が無かった。AdSenseのプログラムポリシーは広告Cookieの
使用と第三者配信について開示することを推奨しているため、既存のAdMob段落は変更せず、
Web版AdSenseに関する新しい段落を追加した（Google広告設定 <https://adssettings.google.com/>
とGoogleの広告ポリシー <https://policies.google.com/technologies/ads> へのリンクを含む）。

**Publisher ID・広告IDは一切新規作成・推測していない**: 既存の`ca-pub-5148247638505100`
（Web）・`pub-7135124532952935`（app-ads.txt、AdMob用、別アカウントで想定通り）をそのまま
使用。広告ユニットのスロットIDはAdSense管理画面でオーナーが発行する必要があるため、
アプリ側では未設定のまま維持した。

**ドキュメント整備**: 新規`ADSENSE_SETUP.md`を作成し、(1)現在の実装ステータス、
(2)アプリ側チェック結果一覧、(3)AdSense管理画面でオーナーが確認すべき項目（サイト審査
ステータス・ads.txt警告・ポリシーセンター警告・広告ユニット作成可否・自動広告有効化可否）、
(4)修正した実装内容、(5)次回共有してほしい情報、をまとめた。`README.md`§7は「プレース
ホルダ実装 (AdMob/GAM への差し替え前提)」という古い説明を、実際にAdSense/AdMobへ接続済み
である現状に合わせて更新（コンポーネント対応表・`ADSENSE_SETUP.md`への参照を追加）。
`PRODUCTION_MONITORING.md`§9にも`ADSENSE_SETUP.md`への参照とプライバシーポリシー修正の
記録を追記。`NEXT_IMPROVEMENTS.md`に完了項目18として追加し、項目11（AdSense承認後の広告枠
最適化）の説明もこの調査結果を踏まえて更新した。

**変更していないもの**: SRS V2ロジック、教材データ、teacher機能、DBスキーマ、RLS、課金・
Premium機能の本番導入（すべて制約により対象外）。README.mdの他のAdMob関連記述（ネイティブ
アプリ側のAdMob導入手順、行377/383/571-577/605/627/650/702付近）は、Web版AdSenseの不足とは
無関係で内容自体は現在も正確なため、意図的に変更していない。

**変更ファイル**: `src/app/privacy/page.tsx`、`README.md`、`ADSENSE_SETUP.md`（新規）、
`PRODUCTION_MONITORING.md`、`NEXT_IMPROVEMENTS.md`。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run test:smoke` /
`npm run test:e2e`（9フロー全PASS） / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: AdSense管理画面での実際の審査ステータス（準備完了/レビュー中/不承認）・
ポリシーセンター警告の有無・広告ユニット作成可否はオーナー確認待ち。広告ユニットの
スロットIDが発行され次第、Vercel環境変数に設定して段階的に広告表示を有効化する
（詳細は[ADSENSE_SETUP.md](ADSENSE_SETUP.md)参照）。

---

## 2026-07-04 教材パックの追加拡充 Part2（4パック・計350語）

2026-07-02に追加した初回4スターターパックに続き、追加の4パックを新規作成した。
すべてオリジナル作成、市販単語帳・教材の本文からの転載は一切していない。

**追加した教材パック**:
1. **英検3級 基礎100**（`10000000-0000-0000-0000-000000000105`、100語）—
   季節・場所・家族・基本動詞/形容詞など、英検3級で問われる日常語彙
2. **高校英単語 基礎100 Part2**（`...0106`、100語）— 既存「高校英単語 基礎100」の続編。
   共通テスト・大学受験で狙われる分析・論証系の語彙（動詞・名詞・形容詞・つなぎの副詞）
3. **大学受験 基礎名詞100**（`...0107`、100語）— 既存「大学受験 基礎動詞100」の姉妹編。
   長文読解で頻出する抽象的な基礎名詞（社会・経済・環境・文学など）
4. **日常英会話 超基礎50**（`...0108`、50語）— 既存「日常英会話 基礎フレーズ」（1500語）
   は初学者には多すぎるため、あいさつ・簡単なフレーズに絞った入門版として追加

**教材メタ情報**: 各パックにgrade（対象学年）・purpose（目的）・recommendedWeeks（推奨
期間）・dailyWordTarget（1日目安語数）・category・tagsを設定した。
- 英検3級基礎100: 中学2〜3年 / 2週間 / 1日7語 / category=eiken / tags=[英検対策,
  中学生向け, 基礎固め, 短期集中]
- 高校英単語基礎100 Part2: 高校1〜2年 / 2週間 / 1日7語 / category=highschool /
  tags=[高校生向け, 大学受験基礎, 基礎固め, 短期集中]
- 大学受験基礎名詞100: 高校2〜3年 / 2週間 / 1日7語 / category=university /
  tags=[大学受験基礎, 短期集中, 基礎固め]
- 日常英会話超基礎50: 社会人・学び直し / 1週間 / 1日7語 / category=general /
  tags=[はじめての人におすすめ, 日常会話, 基礎固め, 短期集中]

**実装**: `src/data/presets/`に4ファイル（`eiken3-basic-100.ts`、
`highschool-basic-100-part2.ts`、`university-basic-nouns-100.ts`、
`daily-conversation-ultra-basic-50.ts`）を新規追加し、`index.ts`の`PRESET_PACKS`に
登録した。`src/lib/materials/presetMeta.ts`は`PRESET_PACKS`から`grade`/`purpose`/
`recommendedWeeks`/`dailyWordTarget`/`category`/`tags`を自動導出する仕組みのため、
新4パックのメタデータは追加コード不要で`/materials`・`/materials/[id]`に自動反映された。

**関連スクリプトの更新**: `scripts/materials/validate-materials.mjs`・
`scripts/materials/test-materials.mjs`・`scripts/materials/seed-preset-materials.mjs`
の3スクリプトは、いずれも対象パックを`import`文とハードコードされた`PRESET_PACKS`
配列で管理する設計だったため、新4パックを同じパターンで追加した（`src/data/presets/
index.ts`の`PRESET_PACKS`をこれらのスクリプトが動的に参照する構造ではないため、
新パック追加時は今後もこの3ファイルの更新が必要）。

**品質チェック結果**: `validate:materials`で8パック中errors=0（`大学受験 基礎動詞100`の
既存1件の警告のみ、今回の新パックには警告なし）。パック内の単語重複は`grep`で機械的に
確認し0件。`test:materials`で新4パックのDB投入・語数一致・インポート後のSRS/PDF互換性を
確認（26項目、全PASS）。既存31教材+旧4パック（35件）は無変更、新4パック追加後は
39教材・総語数32,692語（32,342語+350語）。

**教材一覧・詳細での見え方**: dev previewで実際に確認。「英検3級 基礎100」は
`/materials`の「英検対策」セクションに、「日常英会話 超基礎50」は「はじめての人に
おすすめ」と「日常会話・学び直し」の両セクションに表示され、詳細ページでは
タグ・目安期間・1日語数・対象学年・収録単語一覧が正しく表示されることを確認した。

**既存教材への影響**: 既存31教材・旧4スターターパックのデータ・表示には一切変更なし。
DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
品詞未設定6,730件・意味違い重複1,952件には触れていない。前回修正した教材詳細ページの
総語数表示（`.limit()`欠如バグ）・教材インポート後導線（3ボタンCTAパネル）・学習モード
入口はいずれも回帰なし。

**変更ファイル**: `src/data/presets/eiken3-basic-100.ts`（新規）、
`src/data/presets/highschool-basic-100-part2.ts`（新規）、
`src/data/presets/university-basic-nouns-100.ts`（新規）、
`src/data/presets/daily-conversation-ultra-basic-50.ts`（新規）、
`src/data/presets/index.ts`、`scripts/materials/validate-materials.mjs`、
`scripts/materials/test-materials.mjs`、`scripts/materials/seed-preset-materials.mjs`。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run
validate:materials`（8パック、errors=0） / `npm run test:materials`（26/26） /
`npm run test:materials:e2e`（25/25、回帰なし） / `npm run test:e2e`（9フロー全PASS）/
`npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global`。

**次に追加すべき教材候補**: 英検2級 基礎100（英検3級・準2級の次のステップ）、
TOEIC 基礎100（既存TOEIC教材は大規模のみでスターター規模が無い）、大学受験 基礎形容詞100
（基礎動詞100・基礎名詞100と対になる形容詞版）、日常英会話 超基礎50 Part2（旅行・買い物編）。

---

## 2026-07-04 教材詳細ページの総語数集計バグを修正（Supabase既定1000件上限）

前回のpresetMeta拡張の目視確認中に発見した`/materials/[id]`の総語数表示バグに対応。

**原因**: `src/app/materials/[id]/page.tsx`が総語数(`totalWords`)を`material_words`
テーブルから`level`列のみ全行取得し`.length`で数える方式だったが、このクエリに
`.limit()`が一切無かった。PostgREST(Supabaseの内部REST層)は1リクエストあたりの
応答行数に既定上限(1000件)があり、明示的にページングしない限りその上限で暗黙的に
打ち切られる。そのため1,000語を超える教材では実際の語数によらず「全1,000語」と
表示されていた。

**調査結果**:
- `/materials`一覧ページの語数表示は`get_material_word_counts` RPC（`SELECT
  material_id, COUNT(*) ... GROUP BY material_id`をDB側で実行するSQL関数）を使って
  おり、この不具合の対象外であることを確認した。
- 教材インポートAPI(`/api/material/[id]/import/route.ts`)の単語コピー処理は、元から
  `.range(offset, offset+PAGE_SIZE-1)`によるページングループが実装済みで、この不具合の
  対象外であることを確認した。
- `PdfTestBuilder.tsx`の教材ソース取得(`.limit(500)`)はPDF生成用の出題数上限という
  別の意図された制約であり、この不具合とは無関係。

**修正内容**: 総語数(`totalWords`)は`.select("*", { count: "exact", head: true })`
による厳密なcountクエリに変更し、行データを一切取得せずDB側で正確な件数のみを
取得する形にした（ユーザー指定の方針通り）。レベル別タブの件数内訳
（`levelCounts`、例:「英検2級 (799)」の内訳表示）はPostgRESTがSELECTのGROUP BY
集計を返せないため、`level`列のみを`.range()`でページングして全件取得する方式を
維持した（word/meaning等の重い列を含まない軽量なクエリ）。表示用の単語リスト自体
（`baseWordsQuery`の`.limit(3000)`）は現状の最大教材(2,500語)を上回る余裕があり
不具合の対象ではなかったため無変更のまま残した。

**確認した教材**: 「日常英会話 基礎フレーズ」（実際1,500語、修正前は「全1,000語」と
誤表示）で「全1,500語」、「大学入試頻出英単語 2000+」（実際2,000語）で「全2,000語」
と正しく表示されることを実ブラウザで確認した。新規4スターターパック（各100語）の
表示も従来通り壊れていないことを確認した。

**変更ファイル**: `src/app/materials/[id]/page.tsx`、`scripts/testing/e2e/materials.mjs`。

**追加したテスト**: `scripts/testing/e2e/materials.mjs`に、実際に1,000語を超える
既存教材（1,500語・2,000語、教材データ自体は変更せず閲覧のみ）の教材詳細ページを
訪問し、正しい総語数が表示されることを確認するテストを追加（18項目→25項目）。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run
validate:materials` / `npm run test:materials`（18/18）/ `npm run
test:materials:e2e`（25/25、新規2項目含む）/ `npm run test:e2e`（9フロー全PASS）/
`npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**: なし。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
教材データ（単語本体・削除・上書き）変更なし、presetMetaの内容は無変更。

---

## 2026-07-04 既存31教材へのpresetMeta拡張（対象学年・目的・推奨期間・タグ）

前回の教材インポート後導線整理で残課題としていた「既存31教材にpresetMetaが未登録」に
対応。DBスキーマは変更せず、コード側の表示専用レジストリに既存31教材ぶんのメタデータを
追加した。

**既存31教材の一覧調査**: Supabase本番DBに直接クエリし、35教材（既存31件+新規4スターター
パック）の`id`/`title`/`level`/`exam_type`/`description`/語数を取得。既存31教材は
中学・高校入試向け4件、高校基礎〜大学受験向け12件、英検向け8件、TOEIC向け2件、
日常会話・学び直し向け5件に大別できることを確認した（`MATERIALS_AUDIT.md`の既存監査結果と
語数は完全一致、ドリフトなし）。

**presetMetaの既存教材対応**: `PRESET_META_BY_MATERIAL_ID`は従来`PRESET_PACKS`（単語データ
本体を含む新規4パック定義）から`Object.fromEntries`で自動導出される構造で、既存31教材ぶん
のエントリを直接追加できる形ではなかった。そこで、単語データを持たない表示専用の新規
レジストリ`src/lib/materials/existingMaterialMeta.ts`（`EXISTING_MATERIAL_META: Record<string,
PresetMeta>`）を追加し、`presetMeta.ts`で`{ ...EXISTING_MATERIAL_META, ...PRESET_PACK_META }`
としてマージする形に変更した。`PresetMeta`型に`category`フィールドを追加（新規4パックは
`PresetMaterialPack`が既に`category`を持っていたため無変更で対応可能）。
`src/lib/materials/types.ts`の`ALLOWED_TAGS`に「大学受験向け」「TOEIC対策」「日常会話」
「重要語」「完成・発展」を、`ALLOWED_CATEGORIES`に「toeic」「general」を追加し、既存31教材の
実態に合わせて許容タグ・カテゴリの語彙を拡張した。

grade（対象学年）・purpose（目的）・recommendedWeeks（推奨期間）・dailyWordTarget（1日目安
語数）は、各教材のtitle・level・exam_type・語数から自然に推定できる範囲でのみ設定し
（推奨期間 ≈ 語数 ÷ (1日目安語数 × 7) となるよう概算）、市販教材の説明文の転載はしていない。
推定が難しい・幅広い対象を持つ教材（学び直し系など）は「社会人・学び直し」のような汎用的な
表記にとどめ、断定的な学年表記は避けた。

**教材一覧・詳細での見え方**:
- `/materials/[id]`詳細ページは既存の`{preset && (...)}`ブロック（grade/purpose/
  recommendedWeeks/dailyWordTarget/tagsをすべて表示）が無変更のまま、既存31教材でも
  自動的にメタデータが表示されるようになった。
- `/materials`一覧ページのカードに`preset.grade`を追加表示（従来はrecommendedWeeks/
  dailyWordTarget/tagsの一部のみ表示していた）。
- 従来どの`CATEGORY_GROUPS`セクションにも属していなかった「学び直し・日常会話」系5教材
  （`loop学びなおし英単語`①〜④、`日常英会話 基礎フレーズ`、いずれも`exam_type="一般"`）が
  検索以外では一覧に表示されない状態だったため、新セクション「日常会話・学び直し」を追加した。
- 実際の`/materials`・`/materials/[id]`をdev previewで目視確認し、既存教材にも
  「対象学年・目安期間・1日語数・タグ」が正しく表示されること、新設「日常会話・学び直し」
  セクションが表示されることを確認した。

**副次的発見（今回は未修正）**: dev previewでの目視確認中、`/materials/[id]`の総語数集計
クエリ（`material_words`から`level`列のみ取得する箇所）に`.limit()`が無く、Supabaseの既定
上限1000件で頭打ちになるバグを発見した（例: 実際1,500語の教材が「全1,000語」と表示される）。
1000語超の教材が既存31教材中15件以上存在するため広く影響するが、今回のpresetMeta拡張とは
無関係のスコープのため修正せず、別セッション用のタスクとして提案した（`task_b6814f96`）。

**変更ファイル**: `src/lib/materials/existingMaterialMeta.ts`（新規）、
`src/lib/materials/presetMeta.ts`、`src/lib/materials/types.ts`、
`src/app/materials/page.tsx`、`README.md`。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run validate:materials`
（4パック errors=0、既存監査レポート再生成）/ `npm run test:materials`（18/18、既存31教材の
非破壊回帰ガード含む）/ `npm run test:materials:e2e`（23/23、回帰なし）/ `npm run test:e2e`
（9フロー全PASS）/ `npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global`。

**残課題**:
- `/materials/[id]`の総語数集計クエリの`.limit()`欠如バグ（`task_b6814f96`として提案済み）。
- 既存31教材のgrade/purpose/recommendedWeeks/dailyWordTargetは推定値であり、実際の学習者の
  フィードバックを見て調整が必要になる可能性がある。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、教材データ
（単語本体）変更なし、品詞未設定6,730件・意味違い重複1,952件には触れていない。

---

## 2026-07-04 教材インポート後導線の整理（ImportMaterialButton）

前回の学習モード入口整理で残課題としていた「`ImportMaterialButton.tsx`の
「テスト開始」ボタンが`/test/choice?book=`固定」に対応した。

**現状調査結果**:
- インポートAPI(`/api/material/[id]/import`)は新規インポート・既にインポート済み
  いずれの場合も`{ bookId, ... }`を返しており、`word_book_id`は使っていない
  （フィールド名`bookId`で一貫）。
- 新規インポート時: 従来は成功メッセージ表示後、800msの`setTimeout`で自動的に
  `/wordbooks/<bookId>`へ遷移するのみで、ユーザーが選択できるボタンは一切
  表示されていなかった。
- 既にインポート済み時: 「単語帳を開く」（`/wordbooks/<bookId>`）と「テスト開始」
  （`/test/choice?book=<bookId>`固定）の2ボタンのみで、「すでにインポート済みです」
  という案内文もなく、いきなりボタンが並ぶだけの状態だった。
- 教材詳細ページ(`/materials/[id]`)からインポートすると、いずれのケースでも最終的に
  前回整理した`/wordbooks/[id]`（学習モード選択ハブ）へ到達できる導線は既にあった。

**修正後のインポート後導線**: 新規インポート・既インポート済みの両方で同じ3ボタン
パネルに統一した。
- メインCTA: 「📖 単語帳で学習モードを選ぶ」→ `/wordbooks/<bookId>`
- サブCTA: 「🎯 4択で始める」→ `/test/choice?book=<bookId>`
- サブCTA: 「📄 PDFテストを作る」→ `/pdf?book=<bookId>`

**新規インポート時の挙動**: インポート完了後、自動遷移は行わず「N 語を
インポートしました！」というメッセージと上記3ボタンパネルを表示し、ユーザーが
次の行動を選べるようにした。

**既にインポート済み時の挙動**: 「この教材はすでに単語帳にインポート済みです」
という案内文を追加した上で、同じ3ボタンパネルを表示する（単に無反応で終わらせない）。

**変更ファイル**: `src/app/materials/[id]/ImportMaterialButton.tsx`、
`scripts/testing/e2e/materials.mjs`。教材データ・DBスキーマ・SRS V2ロジック・
teacher機能・Premium制限の仕様は変更していない。

**追加・更新したテスト**: `scripts/testing/e2e/materials.mjs`を更新（23項目）。
従来「インポートボタンをクリックすると自動的に/wordbooksへ遷移する」という
アサーションが今回の変更で成立しなくなるため、「CTAパネル表示→メインCTAを
クリックして遷移」という形に更新。新規追加: インポート完了メッセージの内容確認、
サブCTA「4択で始める」→`/test/choice?book=<id>`遷移確認、サブCTA「PDFテストを
作る」→`/pdf?book=<id>`遷移確認、再訪問時の「すでにインポート済み」案内文確認。
既存の単語帳作成・SRS既定値・重複防止・PDF導線・review導線の検証は変更なし。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` /
`npm run test:materials:e2e`（23/23） / `npm run test:entry-points:e2e`（33/33、
回帰なし） / `npm run test:e2e`（9フロー全PASS） / `npm run test:smoke` /
`npm run verify:prod` / `npm run verify:srs-global`。

**残課題**:
- attackモード・入力テスト・リスニングへの直接サブCTAは追加していない（UIが
  ごちゃつくことを避けるため、メインCTAの単語帳詳細ページ経由で到達可能とした）。
  必要になれば`ImportMaterialButton`にモード選択UIを追加することも検討できる。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
教材データ変更なし、Premium制限の仕様変更なし。

---

## 2026-07-04 学習モード入口の整理・対象範囲ラベルの全モード統一

出題ロジックの改善(SRS考慮・attack単語帳スコープ)に続き、「どの単語帳で、どの
学習モードを使っているか」がユーザーに分かりやすくなるよう、単語帳詳細ページの
導線と各テスト画面の対象範囲表示を整理した。

**整理した導線**: `src/app/wordbooks/[id]/page.tsx`のアクショングリッドを再編し、
「この単語帳で学習する」セクションに以下7モードへの導線をまとめた。すべて
`?book=<word_book_id>`を引き継ぐ:
- 🎯 4択テスト・✏️ 入力テスト・⌨️ タイピング（Premium）・🎧 リスニング（Premium）・
  ⚡ タイムアタック・📄 PDFテスト・🔁 SRS復習

調査時点では入力テスト・リスニング・PDFテストへの導線が単語帳詳細ページに
存在していなかった（4択・タイピング・復習の3つのみ）。既存の＋単語追加/📖レッスン/
📁CSVインポートは維持し、UIの大枠(グリッドレイアウト・Buttonコンポーネント)は
変更していない。

**各モードの対象範囲表示**: attackモードで先に導入した「「◯◯」から出題中」/
「全単語帳から出題中」ラベル（`data-testid="quiz-scope-label"`）のロジックを
`src/lib/learning/scopeLabel.ts`（新規共有ヘルパー、`resolveScopeLabel()`）に切り出し、
以下全モードへ統一適用した:
- `/test/choice`・`/test/input`・`/test/typing`・`/test/listening`・`/test/attack`
  （page.tsxでラベルを算出しRunnerへ`scopeLabel`propとして渡す形に統一。各Runner
  の「← 中断 / N問中M問目」ヘッダー行の直下に表示）
- `/review`（一覧画面・フラッシュカード・4択復習の両実行画面）
- `/pdf`（単語帳選択時のみ「対象語数: N語」を表示。ダミーの語数取得ではなく実際に
  `words`テーブルをcountクエリで取得）

**PDFの`?book=`対応**: `src/app/pdf/page.tsx`が`searchParams`を受け取り、
`PdfTestBuilder.tsx`に`initialBookId`propとして渡すよう変更。従来PDFページには
クエリパラメータの受け口が一切なく、単語帳選択は常に先頭固定だった。

**reviewの引き継ぎバグ修正**: `/review?book=<id>`で表示した「復習待ち」件数は
book指定を反映していたが、「フラッシュカードで復習」「4択テストで復習」ボタンの
リンクが`book`パラメータを引き継いでおらず、実際に復習を開始すると対象範囲が
全単語帳に戻ってしまうバグがあった。両リンクに`&book=<id>`を追加して修正。

**Premium機能の見せ方**: typing/listeningは従来通りルート単位でPremium判定する
既存方式（`/test/typing`・`/test/listening`にアクセスすると、非Premiumはランナーに
一切到達せず全画面のプレミアム案内のみが表示され、Premiumなら正常に機能する）を
維持。単語帳詳細ページのボタンラベルに「（Premium）」を付けることで、非Premium
ユーザーにも機能の存在自体は伝わるようにした。ゲーティングの仕組み自体（AiSuggestButton
のようなインライン表示への変更）は今回行わず、既存の実装のみ流用した。

**変更ファイル**: `src/app/wordbooks/[id]/page.tsx`、`src/lib/learning/scopeLabel.ts`
（新規）、`src/app/test/{choice,input,typing,listening,attack}/page.tsx`、
`src/app/test/choice/ChoiceTestRunner.tsx`、`src/app/test/input/InputTestRunner.tsx`、
`src/app/test/typing/TypingTestRunner.tsx`、`src/app/test/listening/ListeningTestRunner.tsx`、
`src/app/review/page.tsx`、`src/components/review/FlipCardRunner.tsx`、
`src/app/pdf/page.tsx`、`src/app/pdf/PdfTestBuilder.tsx`、
`scripts/testing/e2e/entry-points.mjs`（新規）、`package.json`、`scripts/testing/run-e2e.mjs`。

**追加したテスト**: `scripts/testing/e2e/entry-points.mjs`（新規、`npm run
test:entry-points:e2e`、33項目、`test:e2e`にも12フロー目として統合）。対象単語帳＋
デコイ単語帳を用意し、①単語帳詳細ページの7導線がすべて正しい`?book=`href付きで
存在する、②choice/input/attackのスコープラベルに単語帳名が表示される、③typing/
listeningは非Premiumではランナーに到達せず既存のプレミアム案内のまま、④Premiumでは
ランナーに到達しスコープラベルが表示される、⑤PDFで単語帳がプリセレクトされ対象
語数(6語、デコイを含まない)が表示される、⑥reviewの一覧・フラッシュカード実行画面
双方でスコープラベルが表示されbookパラメータが引き継がれる、⑦dashboard/wordbooks/
materialsへの回帰なし、を検証。

**検証結果（全通過）**: `npx tsc --noEmit` / `npm run build` / `npm run
test:learning-modes:e2e`（25/25、ラベル追加後も既存アサーションに影響なし） /
`npm run test:premium-gating`（21/21） / `npm run test:entry-points:e2e`（33/33） /
`npm run test:e2e`（12フロー全PASS） / `npm run test:smoke` / `npm run verify:prod` /
`npm run verify:srs-global`。

**残課題**:
- typing/listeningのPremiumゲーティングは今回ルート単位ブロックのまま維持した。
  AiSuggestButtonのような「同一ページ内でインライン表示を切り替える」方式への
  変更は行っていない（要望が出た場合に検討）。
- `ImportMaterialButton.tsx`の「テスト開始」ボタンは引き続き`/test/choice?book=`
  固定（NEXT_IMPROVEMENTS.md 2f、既存の残課題のまま）。
- PDFの対象語数表示は`words`テーブルの単純な件数のみで、SRS状態別（未学習/苦手等）
  の内訳は表示していない（既存の「絞り込み」セレクトで対応可能なため今回は追加せず）。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
教材データ変更なし、課金本番導入なし。既存の全単語帳横断モードは維持（book未指定時は
従来通り全単語帳から出題）。

---

## 2026-07-03 profiles.planバグを全体修正（wordbooks/[id]・plan・extract・weak・AI系API）

前回のattackモード単語帳スコープ対応の調査中に発見した`wordbooks/[id]/page.tsx`の
`profiles.plan`参照バグ（存在しないカラムのため`isPremium`が常に`false`扱い）を修正し、
同じバグパターンが他に残っていないか全体検索した。

**原因**: `profiles`テーブルには`plan`カラムが存在しない（実際の列は`is_premium`
boolean）。`.select("plan")...single()`は該当行なしでエラーになりprofileがnullになる
ため、`profile?.plan === "premium"`は常に`false`と評価される。前回`/test/listening`で
発見・修正したのと全く同じバグパターンが、独立に複数箇所へ横展開されていた。

**全体検索結果**: `wordbooks/[id]/page.tsx`（ユーザーが別セッションで先に修正済み）に加え、
以下6箇所で同じパターンを発見:
- `src/app/plan/page.tsx`（AIパーソナル学習プラン）
- `src/app/extract/page.tsx`（英文からの単語自動抽出）
- `src/app/weak/page.tsx`（苦手単語のAI弱点分析）
- `src/app/api/ai/weakness-analysis/route.ts`
- `src/app/api/ai/extract-words/route.ts`
- `src/app/api/wordbook/[id]/ai-suggest/route.ts`
- `src/app/api/wordbook/[id]/ai-suggest/add/route.ts`

いずれも`.select("plan")...single()` → `.select("is_premium")...maybeSingle()`、
`profile?.plan === "premium"` → `profile?.is_premium ?? false`（APIは
`!(profile?.is_premium ?? false)`で403判定）に統一。`src/app/api/stripe/checkout/route.ts`
の`plan`（monthly/yearly課金プラン種別）と`src/app/api/stripe/webhook/route.ts`の
`session.metadata?.plan`は同名だが無関係の概念（Stripe決済プラン種別）であり修正対象外。

**修正内容**: 上記7箇所すべてを`profiles.is_premium`参照に統一。`AiSuggestButton.tsx`に
`data-testid="ai-suggest-locked"`/`"ai-suggest-button"`を追加（E2E用、ロジック無変更）。

**Premium/非Premiumの確認結果**: 非Premium状態では全ページがプレミアム誘導表示・全APIが
403、Premium状態では全ページが機能フォーム表示・全APIがpremium判定を通過（実際に
Anthropic APIまで到達しstatus 200を確認）することを実ブラウザ+実APIコールで検証。

**追加したテスト**: `scripts/testing/verify-premium-gating.mjs`（新規、
`npm run test:premium-gating`、21項目）。test+onboardingアカウントのis_premiumを
true/false切り替えながら、7箇所の表示・ステータスコード分岐と、choice/input/typing/
listening/attackへの回帰なしを検証。`run-e2e.mjs`に8フロー目として統合。

**検証結果**: `tsc --noEmit` / `build` / `test:smoke` / `test:e2e`（8フロー全PASS） /
`verify:prod` / `verify:srs-global`、全通過。検証中、たまたま同時間帯に別セッションが
同じリポジトリ・同じテストポート(3799)・同じテストアカウントで並行してビルド/テストを
実行しており、一時的に`.next`ビルド競合とテストデータ競合によるテスト失敗が発生したが、
競合が解消してから再実行したところ全て解消し、コード自体の問題ではないことを確認した
（`.next`キャッシュを1回削除して再ビルド）。

**変更ファイル**: `src/app/wordbooks/[id]/page.tsx`（別セッションで先に修正済み）、
`src/app/plan/page.tsx`、`src/app/extract/page.tsx`、`src/app/weak/page.tsx`、
`src/app/api/ai/weakness-analysis/route.ts`、`src/app/api/ai/extract-words/route.ts`、
`src/app/api/wordbook/[id]/ai-suggest/route.ts`、
`src/app/api/wordbook/[id]/ai-suggest/add/route.ts`、
`src/components/wordbooks/AiSuggestButton.tsx`、
`scripts/testing/verify-premium-gating.mjs`（新規）、`package.json`、
`scripts/testing/run-e2e.mjs`。

**残課題**: なし（`profiles.plan`参照は全体検索で0件を確認済み）。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
教材データ変更なし、課金本番導入・プラン設計変更なし。

---

## 2026-07-03 attackモードに単語帳スコープ対応（?book=）を追加

前回のSRS考慮型出題ロジック横展開の際に残課題として記録した「attackモードが
`word_book_id`でスコープされておらず口座全体から出題される」問題に対応した。

**現状調査結果**:
- パラメータ名は`book`で全モード共通（`?book=<word_book_id>`）。choice/input/typing/
  listeningの4モードは`page.tsx`で`if (sp.book) query = query.eq("word_book_id", sp.book)`
  という共通の慣用パターンを既に実装済みだった。attackだけが`searchParams`自体を
  受け取っておらず、`word_book_id`フィルタも一切なかった。
- ナビゲーション面の調査では、単語帳詳細ページ(`wordbooks/[id]/page.tsx`)と教材
  インポート完了ボタン(`ImportMaterialButton.tsx`)が実際に`?book=`付きリンクを構築して
  いるのはchoice/typingのみで、attackへのリンク自体がどこにも存在しなかった
  （input/listeningもリンクは無いが受け口は既にあった）。
- 5モードいずれも、画面上に「どの単語帳から出題中か」を示すラベルは存在しなかった。

**修正内容**:
- `src/app/test/attack/page.tsx`: `searchParams: Promise<{ book?: string }>`を追加し、
  他4モードと同じ慣用パターンで`sp.book`があれば`.eq("word_book_id", sp.book)`を適用。
  `sp.book`があれば単語帳タイトルを取得し、「「◯◯」から出題中」／未指定時は
  「全単語帳から出題中」という対象範囲ラベル（`data-testid="quiz-scope-label"`）を新設。
  `src/lib/learning/wordSelection.ts`本体・SRS V2ロジック・DBスキーマは無変更。
- `src/app/test/attack/AttackRunner.tsx`: 出題語数表示に`data-testid="quiz-pool-size"`を
  追加（E2E検証用、表示ロジック自体は無変更）。
- `src/app/wordbooks/[id]/page.tsx`: 単語帳詳細ページのアクショングリッドに
  「⚡ タイムアタック」ボタン（`/test/attack?book=${book.id}`）を新規追加。従来attackへの
  導線が単語帳詳細ページに存在しなかったため、これで4択テストと同様に単語帳文脈から
  スコープ付きでattackへ遷移できるようになった。
- `ImportMaterialButton.tsx`（教材インポート後の「テスト開始」）は今回意図的に変更せず、
  従来通り`/test/choice?book=`のまま（推奨初回モードとして4択を維持する判断、
  NEXT_IMPROVEMENTS.md 2fに残課題として記録）。

**単語帳指定あり/なしの挙動**:
- `?book=<id>`指定時: その単語帳の単語のみが出題プールになる（他単語帳の単語は
  一切混入しない）。未学習優先・SRS考慮の出題ロジック自体は従来通り機能する。
- 指定なし時: 従来通りログインユーザーの全単語帳から出題される（既存挙動を維持、
  デフォルトの全単語帳横断attackは完全に残っている）。

**追加したテスト**:
`scripts/testing/e2e/learning-modes.mjs`のattackセクションを拡張。対象単語帳＋デコイ
単語帳（別タグの単語群）を同時に用意し、①`?book=`指定時はスコープラベルに単語帳
タイトルが表示される、②出題語数が対象単語帳の語数のみになっている（デコイを含まない）、
③出題キューを2周分消化してもデコイ単語帳の単語が一度も出題されない、④1問目は未学習
単語、⑤正解時にSRSフィールドが更新される、⑥指定なし時はラベルが「全単語帳から出題中」
になる、⑦出題語数が対象＋デコイの合計になる（全単語帳横断の確認）、を検証。
`npm run test:learning-modes:e2e`が20項目→25項目に拡張、全PASS。

**検証結果（全通過）**:
`npx tsc --noEmit` / `npm run build` / `npm run test:learning-selection`（27/27、
`wordSelection.ts`本体は無変更のため既存件数のまま）/ `npm run test:learning-modes:e2e`
（25/25）/ `npm run test:smoke` / `npm run test:e2e`（7フロー全PASS、choice/input/typing/
listening/review/pdf/materials/teacher/adminに回帰なし）/ `npm run verify:prod` /
`npm run verify:srs-global`。

**残課題**:
- `ImportMaterialButton.tsx`からattackへの直接導線は追加していない
  （NEXT_IMPROVEMENTS.md 2f）。
- 調査中に`wordbooks/[id]/page.tsx`で存在しないカラム`profiles.plan`を参照する
  未修正バグを発見した（`isPremium`が常に`false`扱いになる、`AiSuggestButton`にのみ影響）。
  今回のスコープ外のため修正せず、NEXT_IMPROVEMENTS.md 2gに記録。
- `suspended`ラベル・直近出題履歴のセッション横断永続化は引き続き未実装
  （NEXT_IMPROVEMENTS.md 2d）。

DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
教材データ変更なし。

---

## 2026-07-03 SRS考慮型の出題ロジックを他4学習モードへ横展開（input/typing/listening/attack）

前回4択テスト（/test/choice）に導入したSRS考慮型出題ロジックを、他の学習モードにも
横展開した。共有ライブラリを`src/lib/quiz/wordSelection.ts`から、より汎用的な
`src/lib/learning/wordSelection.ts`へ移動（内容は同一、importパスのみ変更）。

**現状調査結果（各モード）**:
- **input（穴埋め）・typing（タイピング）**: 4択テストの旧実装と全く同じパターン
  （`sample(pool, count)`の完全ランダム、SRSフィールド未取得・未参照）。修正方針は
  choiceと同一で適用可能と判断
- **listening（リスニング）**: `order("last_studied_at", ascending: nullsFirst)`で
  「未学習寄り」の粗い近似はしていたが、`correct_count`/`wrong_count`/`next_review_at`等は
  未考慮。さらに2件の独立したバグを発見:
  1. **`ListeningTestRunner.submit()`が`saveStudyResult()`を一切呼んでいなかった**
     （回答してもSRSフィールドが更新されない、正誤記録が学習に反映されない不具合）
  2. **`page.tsx`が存在しないカラム`profiles.plan`を参照していた**（実際のカラムは
     `is_premium`）。PostgRESTのクエリが失敗し`profile`が常にnullになるため、
     **全ユーザーが恒久的にPremiumペイウォール表示のまま利用不能**になっていた
     （typing/page.tsxは同じチェックを`is_premium`で正しく実装しており、参照実装として
     揃えた）
- **attack（タイムアタック）**: `order("last_studied_at", ascending: nullsFirst)`で
  取得後、クライアント側で`shuffle(pool)`→順番に消化→尽きたら再シャッフル、という方式。
  SRSフィールド未考慮。ダミー選択肢も`shuffle(pool).slice(0,3)`のみで品詞・重複配慮なし。
  **既存の設計上の特徴として、`page.tsx`が`word_book_id`でスコープしておらず
  ログインユーザーの単語帳全体から出題する**（他4モードは`?book=`パラメータに対応）。
  今回はこの挙動自体は変更していない（テスト側で考慮済み、詳細は後述）

**適用内容**:
- input/typing: `sample(pool, count)` → `selectQuizWords(pool, count)`に置き換え
  （4択と同じ関数、選定ロジックの重複実装なし）
- listening: `pool.slice(0, count)` → `selectQuizWords(pool, count)`に置き換え。
  上記の2バグ（`saveStudyResult()`呼び出し漏れ、`profiles.plan`→`profiles.is_premium`）
  も併せて修正
- attack: `shuffle(pool)`による全体シャッフル→順番消化方式を、`selectQuizWords(pool,
  pool.length, {excludeIds})`による優先順位付き出題キューに置き換え。ダミー選択肢も
  `pickDistractors()`に統一。直近出題した単語IDを`useRef`で保持し、出題キューを
  使い切って再構築する際に除外することで、末尾と先頭が隣接して同じ単語が連続
  出題されるのを防ぐ
- 各モードのServer Component（page.tsx）で、SRSフィールド（correct_count/wrong_count/
  next_review_at/interval_days/ease_factor/last_studied_at/pos/importance）を
  select()に追加。listening/attackで使っていた`order("last_studied_at",...)`による
  粗い近似ソートは、より正確な`selectQuizWords`側の優先度ロジックに置き換えたため削除

**変更しなかったもの**: SRS V2のコア計算ロジック（`applySrsV2`/`saveStudyResult`の
更新式）、DBスキーマ、RLS、teacher機能、attackのword_book非スコープという既存設計
（意図的な仕様と判断し変更していない）。

**追加・更新したテスト**:
- `scripts/testing/test-learning-selection.mjs`（旧`test-quiz-selection.mjs`から改名。
  `npm run test:quiz` / `npm run test:learning-selection`のどちらからも実行可能）:
  n=pool.length（attackモードの「プール全体を優先順に並べた出題キュー」用途）でも
  unseenが先頭にまとまることを確認するテストを追加。既存のclassifyWordState/
  selectQuizWords/pickDistractorsのテストと合わせて計27項目、全PASS
- `scripts/testing/e2e/learning-modes.mjs`（新規、`npm run test:learning-modes:e2e`、
  `test:e2e`にも7フロー目として統合）: input/typing/listening/attackの4モードそれぞれで
  「未学習単語が1問目に出る」「正解後にSRSフィールド(correct_count/last_studied_at)が
  更新される」「console error/5xxがない」ことを検証。listeningでは従来SRS未更新
  だった不具合の回帰確認、typing/listeningはPremium限定機能のためテスト実行中のみ
  test+onboardingの`is_premium`を一時的にtrueにし終了後に元へ戻す。最後に
  /test/choice・/review・/pdf・/materialsへの回帰がないことも確認。計20項目、全PASS
  （teacher/adminへの回帰は既存の`test:teacher`/`test:admin`フローでカバー済みのため
  重複させていない）

**検証**: `npx tsc --noEmit` / `npm run build` / `npm run test:quiz`（27項目PASS） /
`npm run test:learning-modes:e2e`（20項目PASS） / `npm run test:smoke` /
`npm run test:e2e`（7フロー全PASS） / `npm run verify:prod` / `npm run verify:srs-global`
全通過。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2コアロジック不変、teacher機能・
教材データには触れていない。`suspended`ラベルは今回も未実装（前回と同様）。

---

## 2026-07-03 4択テストの出題ロジックをSRS状態考慮型に修正（未学習優先・重複抑制）

**報告された問題**: 4択クイズ（/test/choice）で、まだ一度も出ていない単語より既出単語ばかり
繰り返し出題されているように感じる。

**調査結果（Explore agentによる詳細調査を実施）**:
- `/test/choice`の出題ロジックは`src/lib/utils/shuffle.ts`の`sample()`（Fisher-Yatesシャッフル
  →先頭n件）のみで、SRSフィールド（correct_count/wrong_count/is_weak/next_review_at/
  interval_days/ease_factor/last_studied_at）を一切取得・参照していなかった
  （`page.tsx`の`select()`が`id, word, meaning, streak, is_weak`のみに限定されていた）
- 未学習単語の判定ロジック自体が存在せず、既学習・未学習が完全に等確率で出題されていた
- 直近出題履歴を見ないため、同一セッション内での連続再出題を抑制する仕組みもなかった
- 4択のダミー選択肢も同様に`sample()`によるランダム抽選のみで、品詞を揃える・正解と同じ意味の
  選択肢を除外する、といった配慮が一切なかった（複数の「正解」が選択肢に並ぶ事故が起こりうる状態）
- `/review`（SRS V2復習）は`next_review_at`でソートしており、`/test/choice`とは完全に独立した
  別系統の実装だった。`input`・`typing`も同じ`sample()`を使用しランダム、`listening`のみ
  `last_studied_at`昇順ソートを実装済み、`attack`は全体シャッフル後に順番出題

**学習状態ラベル設計（DBスキーマ変更なし。既存のSRSカラムから都度算出）**:
`src/lib/quiz/wordSelection.ts`（新規）に`classifyWordState()`を実装。
`unseen`（correct_count=0かつwrong_count=0かつlast_studied_at未設定）→`due`
（next_review_atが到来済み。is_weak/masteredより優先し、定着済みでも期限が来れば`due`に
再分類される）→`weak`（is_weak=trueかつ未到来）→`mastered`（correct_count≥5かつ
interval_days≥14かつ未到来）→`learning`（累計解答数が少ない）→`reviewing`（その他）
の優先順で判定。`suspended`（出題を一時停止）は対応するカラムが存在しないため実装していない
（必要な場合は別途boolean列追加のmigration設計から着手する）。

**出題ロジック（`selectQuizWords`）**: 単語帳内に未学習(`unseen`)単語が残っている場合は
全件を優先的に採用（シャッフルした順で上限n件まで）。残り枠は`due`>`weak`>`learning`>
`reviewing`>`mastered`の順に重み付けした重み付きランダム抽選で埋める（同じ状態の単語ばかり
連続しないよう毎回ランダム、`mastered`も完全排除はせず低頻度で出題される）。
直近出題済みID（`excludeIds`）はプールから除外するが、除外すると必要数を満たせない小さい
単語帳では自動的に除外を解除する。

**選択肢生成ロジック（`pickDistractors`）**: 正解と全く同じ表記（大小文字・空白差異を無視）の
候補は除外（複数正解事故の防止）、空欄候補は除外、可能な限り正解と同じ品詞(pos)を優先、
選択肢同士の表記重複を排除。厳密条件で必要数に満たない極小プールでは、表記重複のみ避けて
補充するフォールバックを用意。

**適用範囲**: `src/app/test/choice/page.tsx`（select()にSRSフィールドを追加）・
`ChoiceTestRunner.tsx`（新ロジックの利用、直近出題履歴をコンポーネント内`useRef`で保持し
「もう一度」でも引き継ぐ）のみ。`input`・`typing`・`listening`・`attack`は今回変更していない
（同じ`selectQuizWords`/`pickDistractors`を将来的に適用できるが、最小限の変更方針のため
今回はスコープ外。`NEXT_IMPROVEMENTS.md`に残課題として記録）。

**SRS V2との関係**: 出題後の正誤判定・`ease_factor`/`interval_days`/`correct_count`/
`wrong_count`/`is_weak`/`next_review_at`更新ロジック（`saveStudyResult`/`applySrsV2`）は
一切変更していない。`/review`と`/test/choice`は同じ`saveStudyResult`を共有しているため、
このロジック自体は既存のSRS V2 E2E（`test:srs`）で引き続き検証される。

**発見・修正したE2Eテスト基盤の不備**: `resetOnboardingUser()`（`scripts/testing/seed-test-data.mjs`）
が`word_books`/`words`のみリセットし`study_results`/`daily_stats`をリセットしていなかったため、
今回追加した4択E2E（実際に解答してSRSを更新する初のE2E）が`test+onboarding`アカウントに
学習履歴を残し、dashboardの「はじめの3ステップ」ガイド（`everStudied`で表示制御）を前提とする
`onboarding-dictionary.mjs`のFlow Aが恒久的に失敗する状態になっていた。
`resetOnboardingUser()`に`study_results`/`daily_stats`の削除を追加し、`quiz.mjs`自身の後始末
でも同様に削除するよう修正して解消（他の3テストアカウントには影響しない）。

**追加したテスト**:
- `scripts/testing/test-quiz-selection.mjs`（`npm run test:quiz`、DB不要の単体テスト）:
  `classifyWordState`の7ケース、`selectQuizWords`の出題順テスト6件（未学習優先・全既習時は
  due優先・weak/masteredが排除されない・masteredの頻度低下・直近出題除外・除外解除
  フォールバック）、`pickDistractors`の選択肢テスト6件（4件・正解1つ・重複なし・空欄なし・
  同義語除外・品詞優先・フォールバック）。計24項目、全PASS
- `scripts/testing/e2e/quiz.mjs`（`npm run test:quiz:e2e`、`test:e2e`にも6フロー目として統合）:
  実ブラウザで未学習2語・due1語・weak1語・mastered2語の単語帳を用意し、未学習語が確実に
  先頭に出題されること・4択の健全性（4件・空欄なし・重複なし・正解1つ）・同一セッション内で
  単語が重複出題されないこと・正解後にDBの`correct_count`が更新されること・`/review`/`/pdf`
  への遷移に回帰がないことを検証。計25項目、全PASS

**検証**: `npx tsc --noEmit` / `npm run build` / `npm run test:quiz`（24項目PASS） /
`npm run test:smoke` / `npm run test:e2e`（6フロー全PASS、`resetOnboardingUser`修正後に
再確認） / `npm run verify:prod` / `npm run verify:srs-global` 全通過。

**制約**: DBスキーマ変更なし（学習状態は既存カラムから都度算出）、RLS変更なし、SRS V2の
コア計算ロジック（`applySrsV2`）は不変、teacher機能・教材データには触れていない。

**残課題**（`NEXT_IMPROVEMENTS.md`に記録）: `input`/`typing`/`listening`/`attack`への同ロジック
適用、`suspended`ラベルの実装（要migration検討）、直近出題履歴のセッション間永続化
（現状はページ表示中のみ・タブを閉じるとリセット）。

---

## 2026-07-03 品詞(pos)自動補完候補3,267件の実補完（ユーザー承認済み）

前回のdry-run計画（自動補完候補3,267件、高信頼度ルール1〜5のみ）についてユーザーの承認を
得て、実データ補完を実施した。承認範囲は3,267件のみで、慎重に扱うべき6,730件（追加提案
ルール・複数品詞の可能性・熟語句動詞・meaning短すぎ・判断材料なし）・意味違い重複1,952件・
pos以外の列（word/meaning/example/example_ja等）は一切対象外。

**backup JSONの追加**: dry-run時に生成していなかった`reports/materials-pos-fill-backup.json`
（補完対象行の更新前スナップショット）を、[scripts/materials/fill-material-pos.mjs](scripts/materials/fill-material-pos.mjs)に
生成ロジックを追加した上で実行前に再生成した（完全重複削除時のバックアップ運用と揃えるため）。

**実行前の最終確認（8項目、全て一致を確認してから実行）**:
1. `material_words`のpos未設定件数が9,997件 — SQL照会で確認
2. 自動補完候補が3,267件 — `reports/materials-pos-fill-plan.json`の`primaryCount`と一致
3. 慎重扱いが6,730件 — `reports/materials-pos-audit.json`の`auto_secondary(2,797)+caution(3,933)`と一致
4. 補完対象がpos列のみ — スクリプトのUPDATE文が`{ pos: candidatePos }`のみを設定することを確認
5. backup JSONが存在する — 再生成して確認（3,267行、全てpos=null）
6. rollback SQLが存在する — 確認
7. rollback SQLが3,267件分のpos復元に対応 — `UPDATE ... SET pos = NULL`行数3,267件を確認
8. 既存ユーザーの`words`・SRS履歴・teacher機能には影響しない — スクリプトが`material_words`
   （更新）と`materials`（タイトル参照のみ）以外のテーブルに一切触れないことをコード上で確認

**実補完**: `CONFIRM_MATERIALS_POS_FILL=yes npm run materials:pos:apply` を実行。
3,267件更新成功・失敗0件。

**実行後の確認**:
- `material_words`のpos未設定件数: 9,997件 → **6,730件**（3,267件減、想定通り）
- 総語数32,342件・教材数35件は変化なし
- 完全重複0件・意味違い重複1,952件は変化なし（`npm run audit:materials`で確認）
- word/meaning/example/example_ja/importance/frequency/levelが変更されていないことを、
  補完対象からランダム抽出した100件でDBの現在値とbackup JSONを突合して確認（不一致0件）
- 補完後のposはすべて対象教材の既存表記（"n"/"v"/"adj"等の英語省略形、"名詞"/"動詞"等の
  日本語フルネーム等）に沿った値が書き込まれていることを確認

**バックアップ・ロールバック**: `reports/materials-pos-fill-backup.json`（補完前の3,267行の
全カラムスナップショット）・`reports/materials-pos-fill-rollback.sql`（3,267件のUPDATE、
posをNULLに戻す、冪等）は補完実行後も変更せず保持している。

**検証**: `npm run audit:materials`（完全重複0件・pos未設定6,730件を確認） /
`npm run audit:materials-pos`（自動補完候補0件・分類の再集計を確認） /
`npm run validate:materials`（4パックerrors=0） / `npm run test:materials`（18項目PASS、
新規4パック無傷） / `npm run test:materials:e2e`（18項目PASS、補完後もインポート/SRS初期値/
PDF選択肢反映/再インポート防止が正常動作） / `npm run test:e2e`（8フロー全PASS） /
`npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global` 全通過。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
word/meaning/example/example_jaは変更していない、慎重に扱う6,730件・意味違い重複1,952件には
一切触れていない。

---

## 2026-07-03 品詞(pos)未設定9,997件の補完方針設計 + dry-run

完全重複行削除に続き、既存教材の技術的負債の2つ目「品詞(pos)未設定9,997件」の補完方針を
設計し、dry-run計画を作成した。**実データへの補完は一切実行していない。**

**現状調査**: 既存pos表記は教材ごとに大きくばらつきがあることが判明（"名詞"/"noun"/"n"、
"動詞"/"verb"/"v" 等、日本語フルネーム・英語省略形・英語フルネームの3系統が教材単位で
概ね統一されているが、教材間では全く異なる）。品詞未設定が0%の教材から100%の教材まで存在し、
6教材（大学受験英単語1500・英検準2級 重要単語・英検2級 必須単語800・英検準1級 必須単語600・
TOEIC頻出単語600・中学校英単語 基礎・標準、計4,026件）はpos設定済み行が教材内に1件もなく、
教材内の表記方式を参照できない。

**分類ロジック（[scripts/materials/lib/posDetection.mjs](scripts/materials/lib/posDetection.mjs)、監査/補完計画で共有）**:
教材ごとに既存pos表記から支配的な表記方式（日本語フルネーム/英語省略形/英語フルネーム）を検出し、
補完時はその教材の既存表記に合わせる（全教材に手がかりがない場合は、コーパス全体で最多派の
英語省略形をデフォルトとする）。分類ルールは優先順で適用:

1. 熟語・句動詞（複数語）→ 常に慎重に扱う（他の判定より優先）
2. meaningが1文字以下 → 慎重に扱う
3. 同じword+同じmeaningが他教材にpos設定済み → 自動補完（最高信頼度）
4. 代名詞・前置詞・接続詞・冠詞の固定辞書 → 自動補完（前置詞/接続詞/基本副詞は
   前置詞・接続詞・副詞のいずれにもなりうる多義語(since/until/before/after/while/though/
   still/even/only/just/yet/today/tomorrow等)を意図的に除外し、単一機能の語のみ収録）
5. 数詞・曜日・月・基本副詞の固定辞書 → 自動補完
6. meaningが「〜する」で終わる → 動詞と推定・自動補完
7. meaningが「〜な/〜の」で終わる → 形容詞と推定・自動補完
8.（追加提案・今回の既定対象外）同じwordが他教材に存在し意味は問わず品詞が一貫 → 提案のみ
9. 同じwordで複数品詞が他教材で見つかる（例: claim/concern/debate/benefit等の名詞/動詞
   兼用語）→ 慎重に扱う
10. 上記いずれにも該当しない → 慎重に扱う

**安全確認**: 補完によって同一教材内に新たな完全重複（word/meaning/pos/example/example_ja/
importance/frequency/levelが全て一致する行）が生じないかを事前検証し、**0件**であることを
確認済み（該当があれば自動的に補完対象から除外する仕組みも実装済み）。

**dry-run結果**:
- 品詞未設定: 9,997件
- 自動補完候補（ルール3〜7、高信頼度、既定のdry-run/apply対象）: **3,267件**
- 追加提案（ルール8、同一word一貫性、既定では対象外）: 2,797件
- 慎重に扱う（自動補完しない）: 6,730件
  （熟語・句動詞1,888件、判断材料なし1,600件、複数品詞345件、meaning短すぎ100件、
  上記の重複を除いた実数。詳細は[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)参照）

**新規スクリプト・npm script**:
- `scripts/materials/lib/posDetection.mjs`（新規）: 分類ロジック・固定辞書・教材別表記方式検出
- `scripts/materials/audit-materials-pos.mjs`（新規、`npm run audit:materials-pos`）: 品詞未設定の
  内訳監査（[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md) / `reports/materials-pos-audit.json`を生成）
- `scripts/materials/fill-material-pos.mjs`（新規）: dry-run（既定）/ apply（`--apply`）の両方を持つ。
  実補完は環境変数`CONFIRM_MATERIALS_POS_FILL=yes`の明示指定がなければ即エラー終了する二重ガード付き。
  word/meaning/exampleは一切変更しない。
- `npm run materials:pos:dry-run` / `npm run materials:pos:apply`（新規）

**今回実施していないこと**: `materials:pos:apply`の実行（実データ補完）。ユーザーの承認を
得てから別途実施する。追加提案ルール8（2,797件）・慎重に扱う6,730件のいずれにも触れていない。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
word/meaning/exampleは変更対象外、市販教材や外部辞書のコピーなし、実データの補完・上書きなし
（dry-runのみ）。

**検証**: `tsc --noEmit` / `build` / `audit:materials`（完全重複0件・pos未設定9,997件のまま
変化なしを確認） / `validate:materials`（4パックerrors=0） / `test:materials`（18項目PASS） /
`test:materials:e2e`（18項目PASS） / `test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

---

## 2026-07-02 完全重複行245件の実削除（ユーザー承認済み）

前回のdry-run計画（完全重複行245件、14教材）についてユーザーの承認を得て、実データ削除を実施した。

**実行前の最終確認（8項目、全て一致を確認してから実行）**:
1. `material_words`総件数が32,587件 — SQL照会で確認
2. 完全重複削除対象が245件 — `reports/materials-duplicate-delete-plan.json`と独立SQLクエリが一致
3. 対象教材が14件 — 一致
4. 意味違い重複は削除対象に含まれていない — 削除候補245件全てが「残す行」とバイト単位で
   完全一致することをNodeスクリプトで個別検証（不一致0件）
5. `reports/materials-duplicate-backup.json`が存在 — 確認
6. `reports/materials-duplicate-rollback.sql`が存在 — 確認
7. rollback SQLが245件分の復元に対応 — `INSERT INTO`行数245件を確認
8. `words`側（ユーザー単語帳・SRS履歴）には影響しない — `material_words.id`を参照する外部キーが
   DB上に存在しないことを事前確認済み（前回のdry-run時に検証済み）

**実削除**: `CONFIRM_MATERIALS_DEDUPE=yes npm run materials:dedupe:apply` を実行。
245件削除成功・失敗0件。

**実行後の確認**:
- `material_words`総件数: 32,587件 → **32,342件**（245件減、想定通り）
- 完全重複行: 245件 → **0件**
- 意味違いの重複行: 2,181件 → 1,952件（削除された完全重複ペアの一部が同じ見出し語グループ内に
  混在していたため、グループ構造の変化に伴い減少。削除計画は完全重複のみを対象にしており
  意味違いの行そのものは削除していない。減少分は「完全重複2件のみで構成されていたグループが
  1件を残して重複グループでなくなった」ケースであり、内容の欠落ではない）
- 品詞(pos)未設定: 10,004件 → 9,997件（削除された重複行のうち7件がpos未設定だったため連動して減少）
- 既存35教材（既存31 + 新規プリセット4）は全て残存、総語数0の教材なし
- `words`（ユーザーの単語帳・SRS履歴）: 削除前後で無関係に推移（外部キー無し、想定通り無影響）

**バックアップ・ロールバック**: `reports/materials-duplicate-backup.json`（削除前の全488行）・
`reports/materials-duplicate-rollback.sql`（245件のINSERT、`ON CONFLICT (id) DO NOTHING`で冪等）は
削除実行後も変更せず保持している。復元が必要な場合はSupabase SQL Editor等で
rollback.sqlを実行すればよい。

**検証**: `npm run audit:materials`（完全重複0件・意味違い1,952件・35教材・32,342語）/
`npm run validate:materials`（4パックerrors=0） / `npm run test:materials`（18項目PASS、
新規4パック無傷・既存教材数維持を再確認） / `npm run test:materials:e2e`（18項目PASS、
削除後もインポート・SRS初期値・PDF選択肢反映・再インポート防止が正常動作） /
`npm run test:e2e`（8フロー全PASS） / `npm run test:smoke` / `npm run verify:prod` /
`npm run verify:srs-global` 全通過。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし。
意味違いの重複1,952件・品詞未設定9,997件には触れていない（優先度Bとして継続検討）。

---

## 2026-07-02 完全重複行の削除計画（dry-run）+ 重複検出ロジックの精緻化

前回の監査で見つかった「完全重複行237件」について、削除の**dry-run（計画作成のみ・実削除なし）**
を実施した。ユーザーからの明示的な承認が出るまで、実データの削除は一切行っていない。

**重複検出ロジックの精緻化（237件→245件に修正）**:
dry-run計画を厳密に作るにあたり、既存の`audit-existing-materials.mjs`の重複判定ロジックに
分類バグを発見して修正した。旧ロジックは「同じ見出し語(大文字小文字無視)のグループ全体が
一様に完全一致する場合のみ」完全重複と判定しており、例えば5行中4行が完全一致・1行だけ
内容が異なる、というケースは全て「意味違いの重複」側に誤分類していた（本来は4行のうち
3行を安全に削除できるはずだった）。新ロジック（[scripts/materials/lib/duplicateDetection.mjs](scripts/materials/lib/duplicateDetection.mjs)、
監査・削除計画の両スクリプトで共有）は教材内の各行を
word(前後空白除去・大文字小文字区別)/meaning/pos/example/example_ja/importance/frequency/level
の厳密なタプルでグルーピングし直し、正確な完全重複238→245件・意味違いの重複2,181件を算出した
（Supabase上のSQLクエリで独立に再計算し一致することを確認済み）。

**dry-run結果**:
- 完全重複グループ: 243件 / 削除対象行: **245件** / 影響教材: **14件**
  （loop受験英単語②【高校入試】92件、loop受験英単語①【中学完成】59件 が上位2件、他12教材は
  1〜28件。詳細は[reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md)）
- 残す行の基準: グループ内で`created_at`が最古の行（同点は`id`昇順）
- 影響確認: `material_words.id`を参照する外部キーはDB上に存在しないため、削除しても
  `words`（ユーザーの単語帳・SRS履歴）・インポート済みデータには一切影響しない
  （import APIは`material_words`の内容を`words`にコピーするだけで以後は独立するため）
- バックアップ: 削除対象グループの全488行（残す行含む）を[reports/materials-duplicate-backup.json](reports/materials-duplicate-backup.json)に保存
- ロールバック: [reports/materials-duplicate-rollback.sql](reports/materials-duplicate-rollback.sql)（`INSERT ... ON CONFLICT (id) DO NOTHING`で冪等）

**新規スクリプト・npm script**:
- `scripts/materials/lib/duplicateDetection.mjs`（新規）: 完全重複検出の共有ロジック
- `scripts/materials/deduplicate-material-words.mjs`（新規）: dry-run（既定）/ apply（`--apply`）の
  両方を持つ。実削除は環境変数`CONFIRM_MATERIALS_DEDUPE=yes`の明示指定がなければ即エラー終了する
  二重ガード付き。dry-run/apply いずれのモードでも同じ4ファイル
  （delete-plan.json/md、backup.json、rollback.sql）を生成する
- `npm run materials:dedupe:dry-run` / `npm run materials:dedupe:apply`（新規）

**今回実施していないこと**: `materials:dedupe:apply`の実行（実データ削除）。ユーザーの承認を
得てから別途実施する。意味違いの重複2,181件・品詞未設定10,004件にも触れていない。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
実データの削除・上書きなし（dry-runのみ）。

**検証**: `tsc --noEmit` / `build` / `audit:materials`（245件と再確認） / `validate:materials`
（4パックerrors=0） / `test:materials`（18項目PASS） / `test:materials:e2e`（18項目PASS） /
`test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

---

## 2026-07-02 既存教材の品質監査基盤 + 教材インポートE2E追加

前回のプリセット教材パック基盤構築で見つかった「既存31教材・約32,000語の技術的負債」に対応する
第一段階。**いきなり修正はせず、まず監査レポートと検証基盤を整備し、修正方針を提案するところまで**を
実施した（実データの削除・上書きは一切行っていない）。

**1. 既存教材の品質監査**

新規スクリプト [scripts/materials/audit-existing-materials.mjs](scripts/materials/audit-existing-materials.mjs)
（読み取り専用）を作成。DB上の全35教材（既存31 + 新規プリセット4）について、教材ごとに
総語数・教材内重複（完全重複／意味違い重複を区別）・pos未設定・meaning/example/example_ja空欄・
difficulty(importance)範囲外・level/exam_typeの不整合・インポート可否・PDF/SRS互換性を集計し、
[MATERIALS_AUDIT.md](MATERIALS_AUDIT.md)（人間向け）と`reports/materials-audit.json`（機械可読）に出力する。

重複検出は「完全重複行」（同一教材内でword/meaning/pos/example/example_jaが全て一致する余剰コピー。
情報損失なく削除できる）と「意味違いの重複行」（同じ見出し語でも意味・品詞・例文が異なる。
複数の意味を持つ単語や、教材の意図上の重複の可能性があり自動削除しない）を明確に区別した。

**監査結果（2026-07-02時点）**:
- 対象35教材・総語数32,587語
- 完全重複行: 237件（0.7%）— 削除しても情報損失なしと判断できる
- 意味違いの重複行: 1,954件（6.0%）— 手動確認が必要
- 品詞(pos)未設定: 10,004件（30.7%）
- meaning/word空欄: 0件、example空欄: 29,746件（91.3%、主に大規模教材のフィールド未投入）
- difficulty範囲外: 0件
- タグ/カテゴリ不整合（level/exam_type空 or 未知値）のある教材: 1件
- インポート不可・PDF/SRS互換性に問題のある教材: 0件

**2. 修正方針の分類（提案のみ・未実行）**

- **自動修正してよい可能性が高いもの**: 完全重複行237件の削除（全項目一致のため情報損失なし）、
  前後空白・大文字小文字の表記ゆれ正規化（詳細スキャンは次のステップとして提案）
- **慎重に扱うべきもの**: 意味違いの重複行1,954件（別義の可能性）、品詞未設定10,004件の
  自動一括補完（辞書API等による誤判定リスク）、教材をまたぐ重複（意図的な設計のため対象外）

実データの削除・上書きは、対象・件数・リスク・ロールバック方法を別途報告してから着手する方針とし、
今回は着手していない。詳細は`NEXT_IMPROVEMENTS.md`優先度B-2a/2bに記録。

**3. 検証基盤への統合（非破壊・非ブロッキング）**

- `npm run validate:materials`: 従来のプリセットパック静的検証（4パック限定・ブロッキング）に加え、
  末尾で上記の監査を実行しレポートを再生成するステップを追加。**既存教材のデータ品質は
  このコマンドの合否判定には影響しない**（新規パックのCIゲートとしての機能を維持するため）。
- `npm run test:materials`: 末尾に「既存教材への非破壊確認」ステップを追加。プリセットパック以外の
  教材が31件以上維持されているか、総語数0の教材が発生していないかを回帰ガードとして検証（18項目、全PASS）。
- `npm run audit:materials`: 監査レポートを単独で再生成するための新規コマンド。

**4. 教材インポートの実ブラウザE2E追加**

新規 [scripts/testing/e2e/materials.mjs](scripts/testing/e2e/materials.mjs)（`npm run test:materials:e2e`、
`test:e2e`にも8フロー目として統合）。検証内容:
- 未ログイン時は無料登録CTA（`/signup?next=...`）を表示し、実際のインポートボタンは表示しない
- ログイン済みで教材詳細ページを開き「自分の単語帳にインポート」で単語帳が作成される
- 実際のAPI（`/api/material/[id]/import`）経由でインポートされた単語がSRS既定値
  （ease_factor=2.5, interval_days=0, next_review_at=+24h想定）を持つことをDBで確認
- /pdf の「自分の単語帳」選択肢にインポート後の単語帳が反映され、生成ボタンが有効化される
- /review は本日分の復習対象0件（next_review_atが翌日のため想定通りの空状態）
- 同一教材への再インポート（APIを直接2回呼び出し）が`alreadyImported:true`を返し、
  単語帳・単語データが重複増殖しないことを確認
- 対応するUI側に`data-testid`を追加（`ImportMaterialButton.tsx`・`materials/[id]/page.tsx`・
  `PdfTestBuilder.tsx`）。表示ロジック・スタイルは変更していない。

全18項目PASS。`npm run test:e2e`実行時も8フロー全PASS（onboarding/dictionary・SRS V2・teacher・
admin・教材インポート）。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
既存教材データの削除・上書きなし（監査は読み取り専用）。

**検証**: `tsc --noEmit` / `build` / `validate:materials`（4パックerrors=0） / `test:materials`
（18項目全PASS） / `test:materials:e2e`（18項目全PASS） / `test:e2e`（8フロー全PASS） /
`test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

**残課題**（`NEXT_IMPROVEMENTS.md`優先度Bに記録）: 完全重複行237件の削除実施（要事前承認）、
品詞未設定10,004件の補完方針検討、既存31教材へのpresetMeta拡張。

---

## 2026-07-02 プリセット教材パック基盤の構築 + スターターパック4種を追加

「登録直後から学習を始められる英単語教材アプリ」への強化フェーズ第一弾。教材データの
標準フォーマット・品質チェック・投入導線を整備した上で、小規模・高品質な教材パック4種を追加した。

**現状調査で判明したこと**（想定より大規模な既存システムがあった）:
- `materials`/`material_units`/`material_words`（教材本体）と`word_books`/`words`（ユーザー単語帳）
  は分離されており、`/api/material/[id]/import`がmaterial_wordsをコピーしてユーザー自身の
  `words`行を作る設計（教材側は読み取り専用の"マスタ"、インポート後は完全に独立したコピー）
- 本番には**既に31教材・約32,187語**が稼働中（`scripts/seed-words.mjs`・`admin/seed-vocab`経由で
  AI生成データを投入済み。中学〜大学受験・英検5級〜1級・TOEIC・日常会話まで広くカバー）
- `/materials`は既にカテゴリ別表示（大学受験/英検/TOEIC/中学高校基礎）・検索・インポート状況・
  学習進捗表示・「はじめての方へ」導線を備えた成熟したページだった
- インポートされた単語は`words.material_id`で教材と紐付いたまま、SRS(ease_factor/interval_days
  はDBデフォルトの2.5/0で開始・next_review_atは24時間後に設定)・PDFテスト生成（`word_book_id`
  または`material_id`のどちらでも生成可能）の両方でそのまま利用できる設計だった
- **既存データの品質チェックで技術的負債を発見**: 同一教材内での単語重複1,137件、
  品詞(pos)未設定10,004件（全体の約31%）。今回は修正せず`NEXT_IMPROVEMENTS.md`優先度Bに記録
  （実害が出てから対応を判断する方針）

**教材データの標準フォーマット**（DBスキーマは変更せず、TS型として設計）:
[src/lib/materials/types.ts](src/lib/materials/types.ts)に`PresetMaterialPack`/`PresetWordEntry`
型を定義。教材ID・タイトル・対象レベル(level)・対象学年(grade)・目的(purpose)・推奨学習期間
(recommendedWeeks)・1日あたりの目安語数(dailyWordTarget)・カテゴリ(category)・タグ(tags)・
確認テスト対象か(testTarget)・SRS対象か(srsTarget)をパック単位、単語(word)・意味(meaning)・
品詞(pos)・例文(example)・例文訳(example_ja)・難易度(difficulty)を単語単位で持つ。
`grade`/`purpose`/`recommendedWeeks`/`dailyWordTarget`/`tags`はDBカラムを追加せず、
[presetMeta.ts](src/lib/materials/presetMeta.ts)が教材IDをキーにしたレジストリとして
表示時のみ参照する設計にした（DBスキーマ変更ゼロ）。

**品質チェックの仕組み**:
- `npm run validate:materials`（[scripts/materials/validate-materials.mjs](scripts/materials/validate-materials.mjs)）:
  DB不要の静的チェック。word/meaning/example/example_jaが空でない、教材内で単語が重複していない、
  posが許容値（noun/verb/adjective/adverb/preposition/conjunction/pronoun/interjection/phrase）
  の範囲内、difficultyが1〜5の整数、タグが許容セットの範囲内、例文に見出し語の語幹が含まれているか
  （簡易ヒューリスティック、外れても警告のみ）を検証
- `npm run test:materials`（[scripts/materials/test-materials.mjs](scripts/materials/test-materials.mjs)）:
  上記の静的検証→materials/material_wordsへの冪等投入→DB上の語数がパック定義と一致するか→
  実際のインポートAPIと同一ロジックでtest+onboardingアカウントにインポートし、結果の`words`行が
  SRS既定値(ease_factor=2.5, interval_days=0, next_review_at設定済み)・PDFテスト対象
  (word_book_id設定済み)になっているかを確認→テストデータを削除して冪等性を確保、の一連を実行。
  2回連続実行して冪等性を確認済み

**追加した教材パック**（すべてオリジナル作成・市販教材からの転載なし、計400語）:
1. [中学英単語 基礎100](src/data/presets/junior-basic-100.ts) — 中学1〜2年、高校入試対策
2. [高校英単語 基礎100](src/data/presets/highschool-basic-100.ts) — 高校1〜2年、大学受験基礎
3. [英検準2級 基礎100](src/data/presets/eiken-pre2-basic-100.ts) — 高校1〜2年、英検対策（動詞中心）
4. [大学受験 基礎動詞100](src/data/presets/university-basic-verbs-100.ts) — 高校2〜3年、長文読解基礎動詞

各パックとも推奨学習期間2週間・1日7語ペース。`materials.license_status='original'`
（自社オリジナル）・`is_public=true`で本番に投入済み（`test:materials`実行時に投入、
固定UUID `10000000-0000-0000-0000-000000000101`〜`104`を使用し、既存31教材とは完全に独立）。

**アプリ内導線**:
- [materials/page.tsx](src/app/materials/page.tsx): 新規カテゴリ「🔰 はじめての人におすすめ」を
  最上部に追加（`presetMeta`の`はじめての人におすすめ`タグでフィルタ）。既存の4カテゴリ
  （大学受験・英検・TOEIC・中学高校基礎）にも各パックのlevel/exam_typeに応じて重複表示される
  （既存の大規模教材と同じ表示ロジックを踏襲）。`MaterialCard`に推奨期間・1日目安語数・タグの
  バッジを追加（`presetMeta`が無い既存31教材は従来通りlevel/exam_typeのみ表示、影響なし）
- [materials/[id]/page.tsx](src/app/materials/[id]/page.tsx): プリセットパックの詳細ページに、
  タグ・目的・対象学年・目安期間・目安ペースを表示する情報パネルと「単語帳に追加すると、そのまま
  復習（SRS）・PDFテストに進めます」という案内文を追加

**検証**: `tsc --noEmit` / `build` / `validate:materials`(400語・エラー0件、警告1件は
"catch/caught"の語幹ヒューリスティックの想定内の誤検知) / `test:materials`(15項目全PASS、
2回連続実行で冪等性確認) / `test:smoke` / `test:e2e`(4フロー全PASS) / `verify:prod` /
`verify:srs-global` すべて通過。プレビューで`/materials`一覧・`/materials/[id]`詳細の両方を
実際に表示確認（スターターパックの表示・バッジ・情報パネルが意図通り機能することを確認）。

**制約**: DBスキーマは変更なし（`materials`/`material_words`の既存カラムのみ使用）、RLS変更なし、
SRS V2ロジック変更なし、teacher機能は無関係のため触れていない、既存31教材・既存ユーザーの
word_books/wordsには一切影響なし（新規4材料IDのみ操作）。

**残課題**: 既存31教材の重複/pos補完（技術的負債）、`presetMeta`の既存教材への拡張、
教材インポートの実ブラウザPlaywright E2E追加（今回はDBレベルのシミュレーションで代替）、
`/road`ページのMATERIAL_MAP統合。いずれも`NEXT_IMPROVEMENTS.md`優先度Bに記録。

---

## 2026-07-02 運用状態の整理・本番ヘルスチェック（優先度A完了の棚卸し）

新機能追加はせず、優先度Aの完了状況をドキュメント上で棚卸しし、本番ヘルスチェックを実施、
次の優先度を再整理した。

**優先度A完了状況の確認**（`NEXT_IMPROVEMENTS.md`とのズレを修正）:
1. ✅ Google Search Console対応（2026-07-01完了）— `NEXT_IMPROVEMENTS.md`の未完了表記を修正
2. ✅ SRS V2の利用状況可視化（`/admin/srs`、2026-07-02完了）
3. ✅ teacher招待コード失効・再発行（migration 013、2026-07-02完了）
4. ✅ admin向けE2E検証基盤（`test+admin`、2026-07-02完了）— 元々`NEXT_IMPROVEMENTS.md`の
   独立項目ではなかったため、今回完了済み項目として新規追記
5. ✅ JST日付統一（streak/カレンダー本体+関連4ファイル、2026-07-01〜07-02完了）— 同上、新規追記
6. ✅ 未使用・壊れたAPI(`api/ranking/route.ts`)削除（2026-07-02完了）— 同上、新規追記

いずれも実装・検証・本番デプロイまで完了済みであることをコード（該当ファイルの存在・内容）と
過去のWORK_HISTORYエントリで再確認した。`NEXT_IMPROVEMENTS.md`を全面的に整理し、
「✅完了済み」セクションに6項目すべてを明記、以降の優先度A/B/Cを再分類した（詳細は
[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)参照）。

**本番ヘルスチェック結果（2026-07-02実施、すべてPASS）**:
- `npm run test:dates`: 39 passed, 0 failed
- `npm run test:smoke`: build成功＋日付ユーティリティ39ケース＋公開/認証/API healthチェック 全PASS
- `npm run test:e2e`: 4フロー（onboarding/dictionary・SRS V2・teacher（招待コードライフサイクル含む）・admin）全PASS
- `npm run verify:prod`: 本番の公開ページ200／認証ページ307／POST専用API 405（`/api/teacher/invite-code`含む）全PASS
- `npm run verify:srs-global`: SRS V2グローバルフラグが個人フラグに関係なく本番で有効に効いていることを確認

E2E実行で招待コードが再発行/無効化された状態になったため、`seed-test-data.mjs`で
本番テストクラスの招待コードを既知の状態（`TESTCLS1`・無期限・有効）にリセット済み。

**現在の本番状態: 安定運用中**。優先度Aの主要6項目はすべて実装・デプロイ・検証済みで、
既知の未解決バグ・回帰は無い。DBスキーマ・RLS・SRS V2ロジックは今回変更していない
（本エントリはドキュメント整理と検証のみで、コード変更は無し）。

**次に推奨する作業**（詳細は`NEXT_IMPROVEMENTS.md`）: 新機能追加は見送り、
(1) Search Console初回結果確認（2026-07-08頃目安）、(2) 週次運用チェックリスト
（PRODUCTION_MONITORING.md §2）を定常運用として回す、の2点を推奨。優先度B以降
（教材ワンタップ導入短縮・通知強化・SEO記事追加・teacher生徒詳細画面等）は
利用データが蓄積してから着手判断する方針とした。

## 2026-07-02 teacher招待コードの失効・再発行・期限管理

`NEXT_IMPROVEMENTS.md`の優先度A項目3「招待コード失効・再発行」を実施。長期間使い回せていた
招待コードに、失効・再発行・使用停止・期限管理を追加した。

**現状調査で確認した内容**:
- `classes.invite_code`（`unique not null`）は生成時(`generateInviteCode`)以降ずっと不変で、
  失効・期限の概念がなかった
- 参加処理は `lookup_class_by_code(p_code)` RPC（SECURITY DEFINER）でコード→クラスを解決し、
  `/join/[code]`（表示）と`/api/teacher/join`（実際の参加）の両方がこのRPCを共有していた
- teacher画面（`/teacher`一覧・`/teacher/[classId]`ロスター）で招待コードを表示していた

**DB変更**: `supabase/migrations/013_invite_code_lifecycle.sql`（本番Supabaseに適用済み）。
- `classes`に`invite_code_expires_at` / `invite_code_revoked_at` / `invite_code_updated_at`
  （すべてnullable。`invite_code_updated_at`のみ`default now()`）を追加。既存データは変更なし
- `lookup_class_by_code`をDROP+CREATEで再作成し、`status`列（'ok'|'revoked'|'expired'）を追加
  （PostgreSQLは`CREATE OR REPLACE`で`RETURNS TABLE`の列構成を変更できないためDROP必須）。
  `archived=false`の絞り込みは既存のまま変更なし
- RLS変更なし。招待コードの更新は既存の"classes teacher all"ポリシー(`teacher_id = auth.uid()`)が
  そのまま保護する

**既存データへの影響**: 適用後に確認（本番のクラスは1件、`TEST_検証クラス`）。
`invite_code_expires_at`/`invite_code_revoked_at`とも`null`のまま＝無期限・有効を維持し、
`lookup_class_by_code`は`status='ok'`を返すことを確認。既存の参加導線は無変更で動作する。

**アプリ変更**:
- [src/lib/teacher/code.ts](src/lib/teacher/code.ts): `INVITE_CODE_DEFAULT_TTL_DAYS=90`と
  `inviteCodeExpiresAtFromNow()`を追加
- [api/teacher/classes](src/app/api/teacher/classes/route.ts)（クラス新規作成）: 新規クラスは
  作成時から90日後の期限を設定（安全側のデフォルト。既存クラスはこのカラムがnullのまま不変）
- [api/teacher/invite-code](src/app/api/teacher/invite-code/route.ts)（新規）: `POST {classId,
  action:"reissue"|"revoke"}`。reissueは新コード発行＋期限90日でリセット＋無効化解除、revokeは
  即座に無効化。所有確認（`teacher_id = auth.uid()`一致）に失敗すると404、未ログインは401
- [api/teacher/join](src/app/api/teacher/join/route.ts): `status`が'revoked'/'expired'の場合は
  410でエラーメッセージを返すよう変更（従来の「見つからない」404とは別メッセージ）
- [join/[code]/page.tsx](src/app/join/[code]/page.tsx): 「見つからない」「無効化されています」
  「期限切れです」を区別して表示
- [teacher/[classId]/InviteCodeManager.tsx](src/app/teacher/[classId]/InviteCodeManager.tsx)（新規）:
  現在のコード・状態（有効/無効化済み/期限切れ）・有効期限を表示し、再発行/無効化ボタンを提供
- [teacher/page.tsx](src/app/teacher/page.tsx)（クラス一覧）にも状態バッジを追加

**E2E**: [scripts/testing/e2e/teacher.mjs](scripts/testing/e2e/teacher.mjs)を拡張（新規ファイルは
作らず既存を拡張、npm run test:teacher / test:e2e の両方に含まれる）。追加した検証:
teacher視点で招待コード管理セクション表示・再発行（コードが変わる）・無効化（状態表示・ボタンdisabled化）、
生徒視点で旧コード失効・新コード参加可・無効化後は理由付きで参加不可、非teacher(test+srs)は
他人のクラスを再発行/無効化できない(404)、未ログインはAPI操作不可(401)・`/join/[code]`は`/login`へ誘導。
[scripts/testing/seed-test-data.mjs](scripts/testing/seed-test-data.mjs)の`seedTeacherClass`を、
毎回招待コードを既知の値(`TESTCLS1`・無期限・有効)にリセットするよう変更（前回実行で再発行/無効化
されていても次回実行で復元される冪等性を確保。2回連続実行して確認済み）。
[smoke.mjs](scripts/testing/smoke.mjs)/[verify-prod.mjs](scripts/testing/verify-prod.mjs)の
POST専用APIチェックにも`/api/teacher/invite-code`を追加。

**検証**: `tsc --noEmit` / `build` / `test:teacher`（新規22項目含め全PASS、2回連続実行で冪等性確認）/
`test:e2e`（4フロー全PASS）/ `test:smoke`（新チェック含め全PASS）/ `verify:srs-global` 全通過。
`verify:prod`はデプロイ前時点では新ルート未反映のため`/api/teacher/invite-code`が404で一時的に
FAILしたが、これは想定通り（デプロイ後に再実行して確認）。

**制約**: DBスキーマは追加のみ（破壊的変更なし）、RLSは変更なし、SRS V2には触れていない、
実ユーザーのクラス・参加データは削除していない、既存招待コードをいきなり無効化していない。

## 2026-07-02 admin向けE2E検証基盤の整備（`test+admin`アカウント + `/admin/srs`自律検証）

前回の`/admin/srs`実装で残課題としていた「admin権限を持つE2Eテストアカウントが未整備」を解消。
管理画面も手動確認に頼らず自律的に検証できる状態にした。

**テストアカウント**: `test+admin@loop-vocabulary.app`を新規作成（既存の`setup-test-users.mjs`/
`TEST_ACCOUNTS`の仕組みをそのまま踏襲）。`profiles.is_test_account=true`に加え、このアカウントのみ
`profiles.is_admin=true`を付与（[scripts/testing/lib/testAccounts.mjs](scripts/testing/lib/testAccounts.mjs)に
`isAdmin: true`フラグを追加し、[setup-test-users.mjs](scripts/testing/setup-test-users.mjs)が
`cfg.isAdmin === true`の場合のみ`is_admin`をtrueにするよう変更。他の既存テストアカウント・実ユーザーの
`is_admin`/`role`には一切影響しない）。パスワードは`.env.local`の`TEST_ADMIN_PASSWORD`にのみ保存。

**E2E追加**: [scripts/testing/e2e/admin.mjs](scripts/testing/e2e/admin.mjs)（新規、`npm run test:admin`・
`npm run test:e2e`の両方から実行可能）。検証内容:
- `test+admin`で`/admin/srs`にアクセスでき、主要指標・異常値検知の各セクションが表示される
- ページ本文に個別の単語・意味データ（テスト単語帳の実単語）や`user_id`ラベルが含まれていない
- ページ表示前後で`words`テーブルの総行数が変化しない（書き込みが発生しないことの実測確認）
- 非admin(`test+srs`)で`/admin/srs`にアクセスすると`/dashboard`にリダイレクトされる
- 未ログインで`/admin/srs`にアクセスすると`/login`にリダイレクトされる

[src/app/admin/srs/page.tsx](src/app/admin/srs/page.tsx)には上記アサーション用に
`data-testid="admin-srs-page"` / `admin-srs-metrics-section` / `admin-srs-anomalies-section` を
追加（表示ロジック・集計ロジックは変更なし）。

**認可への影響**: なし。既存の`requireAdmin()`をそのまま使用しており、実装や判定ロジックは変更していない。
テスト用admin以外のユーザーのroleや権限も変更していない。DBスキーマ・RLSも変更なし
（`is_admin`は既存カラムへのデータ更新のみで、対象は`test+admin`という管理下のメールアドレス1件のみ）。

**検証**: `tsc --noEmit` / `build` / `test:admin`（新規、全項目PASS） / `test:e2e`（4フロー全PASS、
admin含む） / `test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

ドキュメント: `PRODUCTION_MONITORING.md`（自動検証コマンド表に`test:admin`追加、weekly checklistの
`test:e2e`を4フロー表記に更新、`/admin/srs`項目を「値の異常確認のみでよい」と明確化）を更新。

## 2026-07-02 SRS V2利用状況モニタリング画面 `/admin/srs` を追加

`NEXT_IMPROVEMENTS.md`の優先度A項目「SRS V2の利用状況可視化」を実施。SRS V2が全ユーザーONに
なったことを受け、管理者が異常を早期発見できる読み取り専用ダッシュボードを追加。

**実装**: [src/app/admin/srs/page.tsx](src/app/admin/srs/page.tsx)（新規）。既存の`requireAdmin()`
（`/admin`配下の他ページと同じ認可方式）を使用し、`words`テーブルから集計に必要な列
（`ease_factor, interval_days, correct_count, wrong_count, is_weak, next_review_at, last_studied_at`）
のみを取得してJS側で集計。`word`/`meaning`等の学習内容や`user_id`は一切取得しない
（個別ユーザー・単語は非表示、全体集計のみ）。

**表示指標**: 総単語数／復習対象単語数（現在復習待ち・滞留含む）／今日・明日・7日以内に復習予定
（JST基準）／`is_weak`件数・比率／`ease_factor`平均・最小・最大／`interval_days`平均・最大／
正解数・不正解数合計・正答率／異常値5種（`ease_factor`範囲外・`interval_days`上限超過・
`next_review_at`異常未来・`next_review_at`未設定の既学習単語・7日以上滞留・`is_weak`比率過多）。
しきい値は`src/lib/srs/index.ts`の`SRS_V2`定数（`EASE_MIN/MAX`, `INTERVAL_MAX`）をそのまま import して
使用し、SRS V2の計算ロジック自体には一切触れていない。

**負荷確認**: 実装前に本番`words`テーブルの行数を確認（2026-07-02時点で1,069件）。この規模では
全件取得＋JS集計で十分軽量なため、SQL集計RPCの追加は見送り。念のため取得上限
（`FETCH_LIMIT=50000`）を設け、上限に達した場合はページ上に警告を表示する。将来的に単語数が
大きく増えた場合はRPC化を検討（`NEXT_IMPROVEMENTS.md`に残課題として記載）。

**認可・RLS**: 新規テーブル・カラムなし。既存の`words`/`profiles`のRLSは変更していない
（`createAdminClient()`はservice_roleのため元々RLSをバイパスするが、これは既存の`/admin/stats`等の
他adminページと同じ方式を踏襲したもの）。`requireAdmin()`により`profiles.is_admin=true`のユーザー
以外は`/dashboard`にリダイレクトされ、書き込み操作は一切ない。

**検証**: `tsc --noEmit` / `build` / `test:smoke` / `verify:prod` / `verify:srs-global`
全通過。SRS V2ロジック・onboarding/dictionary・teacherフローには触れていないため`test:e2e`は
今回スキップ（判断として明記）。

## 2026-07-02 未使用・壊れたAPI `api/ranking/route.ts` を削除

前回のJST日付修正で「スコープ外」としてフラグした`src/app/api/ranking/route.ts`を精査し削除。

**確認内容**:
- 呼び出し元: リポジトリ全体を検索しても`/api/ranking`への参照はゼロ
  （`ranking/page.tsx`はこのAPIを使わず、Server Componentとして直接DBをクエリしている）
- 外部公開API意図: READMEに公開APIとしての言及なし。`requireUser()`は同一オリジン内部認証のみで
  APIキー/CORS設計もなく、外部（モバイルアプリ等）向けの意図は確認できなかった
  （`mobile-shell/`はCapacitor用の静的PWAシェルのみで、このAPIには依存していない）
- 実際に呼ばれた場合の挙動: `daily_stats`の実カラムは`day`/`studied_count`
  （[supabase/schema.sql](supabase/schema.sql)で確認）。ルートが参照していた`words_studied`/
  `studied_date`は存在しないため、呼び出せば必ず500エラーになる機能不全のコードだった

**判断**: 未使用・呼び出し不可能なコードのため削除（DBスキーマ・RLS・rankingページのUI挙動・
SRS V2・先生機能には触れていない）。以前spawnしたフォローアップタスク(`task_fc910af5`)は
このセッションで対応したため取り下げ。

**検証**: `tsc --noEmit` / `build` / `test:smoke` / `verify:prod`（デプロイ前後）全通過。

## 2026-07-02 残り4ファイルのUTC日付パターンをJST基準に統一（本番デプロイ済 `d816edd`）

前回（2026-07-01）のstreak/カレンダー修正で「未対応」として報告した残り4ファイルを対応。
すべて `new Date().toISOString().slice(0,10)` 相当のUTC暦日切り出しがJST境界
（00:00〜09:00 JST）でズレる同一バグパターン。

**修正内容**（すべて `src/lib/utils/date.ts` の既存JSTユーティリティを利用）:
- [ranking/page.tsx](src/app/ranking/page.tsx): 週間ランキングの週起点(月曜0:00)を
  `now.getDay()`/`getDate()`/`setHours()`（サーバーのローカルTZ依存）から
  `todayJST()`+`jstWeekdayIndex()`+`daysAgoJST()`に変更
- [api/cron/weekly-digest/route.ts](src/app/api/cron/weekly-digest/route.ts):
  対象週(7日前)の起点を`daysAgoJST(7)`に統一（`next_review_at`比較用の`now`は
  TIMESTAMPTZ絶対比較のため変更不要と判断し据え置き）
- [api/export/stats/route.ts](src/app/api/export/stats/route.ts) /
  [settings/ExportButton.tsx](src/app/settings/ExportButton.tsx):
  CSV出力ファイル名の日付を`todayJST()`に統一（PDFエクスポートには日付付きファイル名なし、対象外）
- [plan/StudyPlanClient.tsx](src/app/plan/StudyPlanClient.tsx): AIプランのmin-date(14日後)を
  `toJstDateString()`でJST暦日として文字列化（+14日の絶対時刻計算自体は変更なし）

**スコープ外として意図的に見送ったもの**: `api/ranking/route.ts` は同じUTC日付バグに加え、
存在しないカラム(`words_studied`/`studied_date`。実際は`studied_count`/`day`)を参照しており、
grepで呼び出し元ゼロ（未使用コード）と確認済み。日付ズレ修正のスコープからは外れるため触れず、
別タスクとして`spawn_task`済み（`task_fc910af5`）。

**テスト**: `test-date-utils.mjs`に4区分・11ケース追加（週間ランキング境界／weekly digest対象週／
エクスポートファイル名／AIプランmin-date）、いずれもJST早朝(00:00-09:00)でUTC基準との乖離が
起きることを再現しつつ、JST基準実装が正しい値を返すことを検証。ホストのローカルタイムゾーンに
依存しないよう、テスト内の「旧実装」比較はミリ秒演算またはUTC ISO文字列のみで構成（`setDate`等の
ローカルTZ依存メソッドは使わず、ホスト環境が変わっても結果が一定になるようにした）。
合計39ケース全PASS（既存25＋新規11＋todayJST健全性3の内訳）。

**制約**: 既存データの削除・補正なし、DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、
先生機能変更なし。日付表示・集計境界・ファイル名のUTC由来ズレ修正のみに限定。

**検証**: `test:dates`(39 passed) / `tsc --noEmit` / `build` / `test:smoke` /
`test:e2e`(onboarding・SRS V2・teacherの3フロー全PASS) / `verify:prod` / `verify:srs-global`
すべてデプロイ前後の両方で実施、全通過。

**デプロイ**: commit `d816edd` → push → Vercel `dpl_CpKrBpBLfBES3e6PQ9F5kDJn4NsR` READY
（`loop-vocabulary.app`エイリアス反映確認済み）→ 本番`verify:prod`/`verify:srs-global`再実行、
回帰なし。

## 2026-07-01 streak/カレンダーの日付バグ修正（本番デプロイ済 `bc04e47`）

**原因**: `new Date().toISOString().slice(0,10)`（UTC日付）が `daily_stats.day` の書き込み・
streak計算・カレンダー表示など9ファイルで使われており、JST(UTC+9)の 0:00〜9:00 の間は
UTC日付が前日のままになるため、①1つのJST日の学習が2つのUTC日にまたがって記録され
streakが不正に増える／減る、②`StudyWeekGraph`で日付キー(UTC)と曜日ラベル(ローカル時刻)が
別々のタイムゾーンで計算され曜日と日付が一致しない、という2つのバグが発生していた。

**修正**: `src/lib/utils/date.ts`（新規）に固定UTC+9オフセット計算のJSTユーティリティを実装
（`todayJST`/`daysAgoJST`/`jstWeekdayIndex`/`lastNDaysJST`/`jstHour`/`jstDayOfMonth`/
`todayStartJstISO`）。`saveResult.ts`（daily_stats書き込み元）・`dashboard/page.tsx`・
`stats/page.tsx`・カレンダー2種・`StudyWeekGraph`・`admin/stats`・AI/PDFの日次クォータに適用。
DBスキーマ・RLS・SRS V2の算出ロジック・先生機能・課金には触れていない。
**既存データの補正（過去のdaily_stats行の是正）は実施していない**（低価値・高リスクと判断、
理由は完了報告で説明済み）。

**テスト**: `scripts/testing/test-date-utils.mjs`（`npm run test:dates`、`test:smoke`にも組込）
25ケース全PASS。`test:e2e`3本も回帰なし。

## 2026-07-01 Google Search Console 登録完了

- オーナーが `https://loop-vocabulary.app`（URLプレフィックス）を登録・所有権確認済み
  （既存のGoogleアカウント/GA連携により、私の想定していたHTMLタグ追加は不要だった）
- sitemap送信済み: ステータス **Success**、**Discovered pages: 69**（sitemap全体は78件、クロール遅延の範囲内）
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) を実態に合わせて更新（§0にステータス追記）
- 次回: 1週間後目安に「ページ」タブでインデックス済み/除外の内訳を確認

## 2026-07-01 SRS V2 全ユーザーON（本番反映済）

- Vercel CLI（`vercel env add` / `vercel --prod`）で `NEXT_PUBLIC_SRS_V2=1` を
  **Production のみ**に追加し、同一コミット(`4a29a8f`)のまま再デプロイして反映。
  デプロイ `dpl_CybPCKKWxmPjath6PGuQg1e9QA9K` READY・`https://loop-vocabulary.app` エイリアス済み。
- `npm run verify:prod`: 全チェックPASS（回帰なし）。
- **本番でのグローバル有効化を実地確認**: test+srsアカウントの個人フラグ(`profiles.srs_v2`)を
  明示的に`false`に固定した状態で本番`/review`にアクセスし、4段階評価UI(V2)が表示されることを確認
  （個人フラグに関係なくグローバルenvだけで有効化されている＝正しく本番ビルドに反映）。
  確認用に `scripts/testing/check-prod-srs-v2-global.mjs`（`npm run verify:srs-global`）を追加。
- **ロールバック手順（維持・未実施）**: `vercel env rm NEXT_PUBLIC_SRS_V2 production` → 再デプロイ
  → 全ユーザーV1へ復帰。個人opt-in(`profiles.srs_v2`)は引き続き独立して機能する。
- 主要ページ回帰: `verify:prod`で確認済み（公開200・認証307・API405）。

## 2026-07-01 既存バグ2件の修正（本番デプロイ済 `17015d9`）

- `ReferralCard.tsx`: `typeof window!=="undefined"` 分岐を廃止、`NEXT_PUBLIC_SITE_URL`
  （ビルド時に静的インライン化＝サーバー/クライアントで同一値）を初期値にし、
  マウント後に実際のoriginが異なる場合（vercel.appエイリアス等）のみ`useEffect`で補完。
  → ハイドレーションミスマッチ解消（E2Eの警告が1〜2件→0件に）。
- `SrsModeToggle.tsx` / `NotificationToggles.tsx`: PATCH後に`router.refresh()`を追加。
  同一プロセス内でページ再訪問してもSSR結果が古いままだった問題を解消。
- 副次的に発見: `srs.mjs`のE2Eで4件目（最後）の評価だけ保存前にタブを離れるレースが
  あり修正（毎回の評価後、次のカードへの遷移＝保存完了を待ってから次に進む設計に統一）。

**検証**: tsc✓ build✓ `test:e2e`（3本全PASS・警告0件）✓ `verify:prod`（本番）✓。

## 2026-07-01 自律E2E検証基盤の構築（本番デプロイ済 `8af9a79`）

**目的**: 今後のログイン後UI確認をオーナーに戻さず、テスト専用アカウント/データで自律検証する体制。

- migration 012（本番適用済・非破壊）: `profiles.is_test_account` フラグ。
- テストアカウント3件（Supabase Admin Auth APIで冪等作成、パスワードは`.env.local`のみ保存・非コミット）:
  `test+onboarding@loop-vocabulary.app`（0件リセット用）/ `test+srs@loop-vocabulary.app`（SRS検証・先生ロスター用生徒）/
  `test+teacher@loop-vocabulary.app`（先生ロール）。
- テストデータ投入（`scripts/testing/seed-test-data.mjs`、冪等・対象は上記3IDのみ）: SRSユーザーに復習期限切れ8語、
  先生用クラス+同意済みメンバー。
- data-testid属性を追加（非機能変更）: FlipCardRunner・SrsModeToggle・DictionarySearch・
  EnsureDefaultWordbook・FirstStepsGuide・review空状態・teacherロスター・MyClasses・join同意・login。
- Playwright実ブラウザE2E（`scripts/testing/e2e/`）: onboarding/dictionary・srs・teacher の3本。
  **`next build && next start`（本番ビルド）に対して実行**（`next dev`はSSRデータの
  再訪問時キャッシュ不具合があり検証に不向きと判明したため）。
- smoke/verify-prod（HTTPのみ・ブラウザ不要）を追加。
- npm scripts: `test:setup` `test:e2e` `test:srs` `test:teacher` `test:onboarding` `test:smoke` `verify:prod`。

**検証結果**: tsc✓ build✓ 3本のE2E全PASS（SRS V2はDB直読みで
ease_factor/interval_days/next_review_at/streak/is_weak/correct_count/wrong_count が
4評価すべてで期待値と一致、先生ロスターは集計のみ・生データ非開示・同意撤回で即除外を確認）。
smoke✓ verify:prod（本番）✓。

**発見した既存の課題（今回のスコープ外・spawn_task で別途フラグ済み）**:
1. `ReferralCard.tsx` の `typeof window !== "undefined"` 分岐によるハイドレーションミスマッチ
   （`NEXT_PUBLIC_SITE_URL`以外のオリジンで発生。vercel.appエイリアスでも起こりうる）。
2. `SrsModeToggle`等のトグルがPATCH後に`router.refresh()`を呼んでおらず、同一サーバプロセス内で
   `/settings`等を再訪問してもSSR結果が更新されない（DBは正しく更新される。UIの見た目のみ古い）。
   `next dev`/`next start`両方で再現。E2Eはこれを踏まえDB直読みで正解性を判定する設計にした。

## 2026-07-01 /dictionary 直行時のデフォルト単語帳保証（本番デプロイ済 `e078cd5`）

- `DictionarySearch.tsx`: マウント時、**ログイン済み＆単語帳0件**なら既存 `/api/wordbook/ensure-default`
  を呼び冪等にデフォルト単語帳を用意（`ensured` refで1回のみ）。作成後は追加先を自動設定し即追加可能に。
  未ログイン(`!loggedIn`)・単語帳保有済みは早期returnで対象外＝発火しない。
- `api/wordbook/ensure-default`: 表示精度のため title も返すよう変更（既存冪等ロジックは不変）。
- 検証: tsc/build、preview(anon)で ensure非発火・検索UI健全・mobile崩れ無し(overflow 0)・エラー無し、
  本番回帰(anon /dictionary 200・API GET405・公開200)、DB(既存3件・重複なし)。

## 2026-07-01 デフォルト単語帳の自動作成 + 追加後導線（本番デプロイ済 `08a3f5b`）

- `.claude/launch.json` を origin状態（`loop-vocabulary`/port3000/整形）に復元し working tree クリーン化。
- 新規 `api/wordbook/ensure-default`（**冪等**: 単語帳0件のときのみ「マイ単語帳」を作成。既存ユーザーは不変・重複なし）。
- 新規 `components/dashboard/EnsureDefaultWordbook.tsx`: 単語帳0件ユーザーのダッシュボードで自動作成＋「作成しました」案内（作成できたときのみ表示・×で閉じる）。
- `dashboard/page.tsx`: 単語帳count取得＋0件時に上記をマウント。
- `DictionarySearch.tsx`: 1語追加後に「復習で覚える/テスト」CTAを表示。
- 検証: tsc/build、本番回帰（API GET405・/dashboard307・公開200）、DB確認（既存3件のまま・重複作成なし）。
- 補足: 実際の自動作成はログイン済み0件ユーザーのダッシュボード表示時に発火（既存2ユーザーは保有済みで対象外）。dictionary直行の0件ケースは従来通り（主要導線のダッシュボードでカバー）。

## 2026-07-01 導線最適化（新規ユーザー動線・本番デプロイ済 `c2287dc`）

- `dashboard/page.tsx`: アクションCTAを動的化。**単語0件→「辞書で追加/教材から追加」を最優先**、
  単語あり→復習(due>0)またはレッスンを優先。文言で迷いを軽減。
- `materials/page.tsx`: 未インポートのログインユーザーに「はじめての方へ」ヒントを追加。
- 検証: tsc/build、モバイル(375px) /materials 崩れ無し(overflow 0)・エラー無し、本番回帰(認証307・公開200)。

## 2026-07-01 初回オンボーディング改善（本番デプロイ済 `d7c847d`）

- 新規 `components/dashboard/FirstStepsGuide.tsx`: ダッシュボード上部に「はじめの3ステップ」
  （単語追加→学習→復習）を表示。ステップは wordCount/学習有無で自動判定、現在ステップにCTA。
  **一度でも学習すると非表示**（`!everStudied` で制御）。既存 OnboardingModal（目標/レベル選択）と併存。
- `dashboard/page.tsx`: 上記ガイド＋先生機能への軽い導線を追加。
- `review/page.tsx`: 復習0件の空状態を「辞書/教材で単語を追加」CTA付きに改善。
- 検証: tsc/build、本番回帰（/dashboard・/review→login・500なし、公開200）。
- ※認証必須画面のため実UIはログイン後にご確認ください（表示コンポーネント＋Linkのみで低リスク）。

## 2026-07-01 保留分の整理 & 残SEO・UI改善（本番デプロイ済）

**B/C保留分の整理**:
- `94ff6fc` feat: 目標パーソナライズ（road/dashboard/GoalProgress）を別コミット化・本番化。回帰なし。
- `d5b5ec2` chore: content生成スクリプト（scripts/*.mjs）を追跡開始（ビルド非関与）。
- `.claude/launch.json`: **巻き戻し候補として held のまま**（意図不明の局所dev変更・本番非関与・理由明記済）。未コミット・未変更。

**残SEO・UI改善** `577d9aa`:
- landing の教材カテゴリ表記ゆれを表示時に統合（大学入試→大学受験, 高校英語→高校入試等。**データ不変・表示のみ**）＋フォールバック更新。
- `/signup`（indexable・コンバージョン）/`/login`（noindex）に layout.tsx でメタデータ付与。
- モバイル(375px)landing検証: 横崩れ無し(overflow 0)・コンソールエラー無し・フッター正常。
- 監査: 主要公開ページのmetadataは概ね網羅（/test はログイン必須で対象外）。OGP/Twitter/JSON-LD/Breadcrumbは既存で網羅。

## 2026-07-01 Phase 2-B: 先生向け進捗管理 MVP — 先生UI（本番デプロイ済 `35d2c17`）

- ページ: `/teacher`（先生ダッシュボード・role昇格・クラス作成・招待コード）、
  `/teacher/[classId]`（`get_class_progress`ロスター・所有ガード・集計のみ）、
  `/join/[code]`（`lookup_class_by_code`＋**明示同意画面**→参加）。
- 設定: 参加中クラス一覧＋同意撤回/退出（`get_my_memberships`＋`/api/teacher/membership`）、/teacher導線。
- API: `promote` / `classes`(作成・role検証・招待コードリトライ) / `join`(consent必須) / `membership`。
- 規約/プライバシー: 先生機能・進捗共有・同意撤回の節を追記。
- **検証**: tsc/build、本番DBライフサイクル(作成→参加→ロスター1→撤回0→退出0)PASS・残存0、
  本番回帰(非ログイン307、API GET405、公開200)。生徒の生データは先生に非開示（集計RPCのみ）。
- 補足: `/teacher` は非先生でも「先生機能の案内＋昇格CTA」を表示（データ非開示）。クラス作成・
  ロスター閲覧は role/所有/RPC認可で厳格ガード。

## 2026-07-01 Phase 2-B: 先生向け進捗管理 MVP — DB基盤（migration 011・本番適用済）

**目的**: 塾講師/家庭教師が担当生徒の学習状況を集計で把握。生の単語データは見せない。
- `supabase/migrations/011_teacher.sql`（**本番適用済・非破壊**）:
  - `profiles.role`（student/teacher）追加、`classes` / `class_members`（consent付）新規、index。
  - **新規テーブルにのみ RLS**（既存RLSは不変）: classes=先生本人CRUD / class_members=生徒本人RW＋先生は自クラスのみread。
  - **SECURITY DEFINER RPC**: `get_class_progress`（先生所有＆consent検証→集計のみ）、`lookup_class_by_code`、`get_my_memberships`。authenticatedのみ実行可（anon revoke）。
- **認可テスト（本番DBで一時フィクスチャ→検証→削除）全PASS**:
  - 非先生の `get_class_progress` 呼び出し → `blocked: not authorized`
  - 先生呼び出し → 同意済み生徒1件
  - 同意撤回後 → 0件（集計対象外）
  - テストデータ削除済み・RLS3ポリシー/RPC3種存在確認。
- **未実装（次段階）**: 先生UI（/teacher, /teacher/[classId]）、参加(/join/[code])＋同意画面、設定の同意撤回、teacherロール昇格、利用規約/プライバシー追記。
- 生UIが無いため現状は**完全にinert**（本番影響なし）。migration 011 は本番適用済み・ファイルはこのコミットで追跡開始。

## 2026-07-01 Phase 2-A(続): SRS V2 per-user opt-in（本番デプロイ済・V2はグローバルOFF）

- `supabase/migrations/010_srs_v2_optin.sql`（**本番適用済・非破壊**）: `profiles.srs_v2 bool default false`。
- `srsV2EnabledFor(profileFlag)` = env `NEXT_PUBLIC_SRS_V2` OR ユーザーの `profiles.srs_v2`。
- `saveStudyResult` が per-user で V2 判定。review ページが `v2Enabled` を FlipCardRunner に渡す。
- 設定に「学習設定 → 動的復習アルゴリズム(β)」トグル＋ `/api/settings/srs` PATCH。
- コミット `c60f4b4`・本番デプロイREADY。回帰なし（/settings /review→login, 公開200, /api/settings/srs→405）。
- opted-in=0（全員V1）。**オーナーは設定トグルONで自分だけV2検証可**。全ユーザーONは検証後に env フリップ。

## 2026-07-01 Phase 2-C: PDFカスタマイズ強化（本番デプロイ済）

- `PdfTestBuilder.tsx`: 段組み(1/2列)・解答用紙分離(改ページ)・印刷レイアウト改善（氏名/日付/得点欄）。commit `ba81db9`。

## 2026-07-01 Phase 2-A: 動的SRS基盤（本番デプロイ済・flag OFF）

- `applySrsV2`(SM-2簡易)・`saveResult` flag分岐・`FlipCardRunner` 4評価UI・migration 009。commit `a8501ed`。サンプル12/12 PASS。

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
