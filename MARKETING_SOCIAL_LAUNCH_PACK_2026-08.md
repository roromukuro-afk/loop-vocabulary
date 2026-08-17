# MARKETING_SOCIAL_LAUNCH_PACK_2026-08 — 最初のSNS投稿パック(8本)

> Issue #98対応。SNSをSEOと独立したAcquisitionチャネルとして立ち上げるための、
> 最初のpublish-ready投稿8本。30日分を機械的に作らず、まずこの8本で
> `audit:social-acquisition-snapshot`により実際の反応(landing→ツール/ガイド利用→
> value event→signup→save)を計測してから次のバッチを検討する。
>
> トーン・禁止事項は`MARKETING_X_PLAYBOOK.md`に準拠する(断定表現禁止、
> 効果保証禁止、絵文字は1投稿2〜3個まで、架空の数字禁止)。SRS間隔は
> `MARKETING_10THEMES_CONTENT_KIT.md`テーマ3の注記と同じ理由で具体的な日数を
> 断定しない。
>
> 各投稿は投稿前に本文をもう一度確認し、「必ず/絶対/確実に」等の断定表現が
> 紛れ込んでいないかチェックすること。

## 共通のUTM契約

- `utm_medium=social` 固定
- `utm_campaign=vocab_test_maker_launch` 固定(このパック共通)
- `utm_content=<投稿ID>`(下記の各投稿見出しに記載)
- 値は全て固定識別子のみ。自由記述のユーザーデータは含めない。

---

## X ①: 登録不要の英単語テストメーカー

- **platform**: X
- **purpose**: `/tools/vocab-test-maker`への最初の認知・流入
- **hook**: 「英単語の小テスト、自分で一から作ってませんか?」
- **body**:
  > 英単語の小テスト、自分で一から作ってませんか?
  >
  > 単語リストを貼り付けるだけで、小テストがその場で作れるツールを無料公開しました。
  > 登録は不要です。出題形式(記述/4択)や解答用紙の有無も選べます。
  >
  > 作ったテストはブラウザの印刷機能でPDF保存もできます。
- **CTA**: 「自分の単語で試してみる →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `x`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `x_launch_01`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=x&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=x_launch_01`

---

## X ②: 学校/塾の単語テスト作成用途

- **platform**: X
- **purpose**: 塾講師・学校の先生への認知(既存`/guide/vocabulary-quiz-pdf-for-teachers`と同じ層)
- **hook**: 「単語テストの作成、地味に時間かかりますよね」
- **body**:
  > 単語テストの作成、地味に時間かかりますよね。
  >
  > 覚えさせたい単語リストを貼り付けるだけで、記述・4択が選べる小テストを作れる
  > 無料ツールを公開しました。解答用紙を分けるか、同じページ末尾に載せるかも選べます。
  >
  > 登録不要、印刷してそのまま配れます。
- **CTA**: 「テストを作ってみる →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `x`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `x_launch_02`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=x&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=x_launch_02`

---

## X ③: 生成したテストからLoopで復習へ移る導線

- **platform**: X
- **purpose**: テストメーカー利用者に、続けて使える復習機能(Loop本体)を知ってもらう
- **hook**: 「単語テストを作って終わり、じゃもったいない」
- **body**:
  > 単語テストを作って終わり、じゃもったいないので。
  >
  > 貼り付けた単語は、テスト作成後にそのままLoop Vocabularyの復習(間隔反復)へ
  > 引き継げます。テスト作成は登録不要、復習へ引き継ぐ場合だけ無料登録が必要です。
- **CTA**: 「テストを作って試す →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `x`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `x_launch_03`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=x&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=x_launch_03`

---

## Threads ①: 単語リスト→貼付→テスト作成→印刷/PDF保存

> Xの文面をそのまま複製せず、会話的な言い回しに調整。

- **platform**: Threads
- **purpose**: ワークフロー訴求(貼付→作成→印刷の3ステップ)
- **hook**: 「単語リスト持ってるだけで小テスト作れるって知ってました?」
- **body**:
  > 単語リスト持ってるだけで小テスト作れるって知ってました?
  > 貼り付け→形式選ぶ→印刷、これだけです。
  > 登録も不要なので、思い立ったらすぐ試せます。
  > PDF保存もブラウザの印刷機能でそのままできます。
- **CTA**: 「試してみる →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `threads`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `threads_launch_01`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=threads&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=threads_launch_01`

---

## Threads ②: 英検2級単語対策

- **platform**: Threads
- **purpose**: `/guide/eiken-2kyu-tango`への流入
- **hook**: 「英検2級の単語、テーマ別に覚えると定着しやすいらしいです」
- **body**:
  > 英検2級の単語、テーマ別に覚えると定着しやすいらしいです。
  > 頻出テーマ別の覚え方と無料の単語一覧をまとめた記事を書きました。
  > 自分の単語でテストを作れるツールへのリンクもあります。
- **CTA**: 「記事を読む →」
- **destination**: `/guide/eiken-2kyu-tango`
- **utm_source**: `threads`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `threads_launch_02`
- **full URL**: `https://loop-vocabulary.app/guide/eiken-2kyu-tango?utm_source=threads&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=threads_launch_02`

---

## Short video ①(TikTok): 登録不要の英単語テストメーカー・デモ

- **platform**: TikTok(縦動画、Instagram Reels / YouTube Shortsへ転用可)
- **purpose**: 「実際に何ができるか」を数秒で見せる機能デモ
- **hook**: 「学校の単語テスト、自分で一から作ってませんか?」
- **script**(実装確認済みのUIフローに基づく台本):
  - [0-2s] テロップ「学校の単語テスト、自分で一から作ってませんか?」
  - [2-6s] 画面録画: 単語リストをテキストエリアに貼り付ける
  - [6-10s] 画面録画: 出題方向(英→日/日→英)・出題形式(記述/4択)を選ぶ
  - [10-14s] 画面録画: 「テストを作成する」を押す→印刷プレビューが開く→PDF保存
  - [14-18s] テロップ「無料・登録不要」
- **CTA**: 「自分の単語で試す →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `tiktok`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `tiktok_launch_01`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=tiktok&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=tiktok_launch_01`

---

## Short video ②(YouTube Shorts): 学校/塾の単語テスト作成用途

- **platform**: YouTube Shorts(縦動画、TikTok / Instagram Reelsへ転用可)
- **purpose**: 塾講師・学校の先生向け訴求
- **hook**: 「配布用の単語テスト、毎回手作業で作ってませんか?」
- **script**:
  - [0-2s] テロップ「配布用の単語テスト、毎回手作業で作ってませんか?」
  - [2-6s] 画面録画: 覚えさせたい単語リストを貼り付ける
  - [6-10s] 画面録画: 解答用紙を分ける/同ページ末尾/なし、を選ぶ
  - [10-14s] 画面録画: 印刷プレビュー→そのまま印刷 or PDF保存
  - [14-18s] テロップ「登録不要ですぐ使えます」
- **CTA**: 「テストを作ってみる →」
- **destination**: `/tools/vocab-test-maker`
- **utm_source**: `youtube`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `youtube_launch_01`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=youtube&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=youtube_launch_01`

---

## Short video ③(Instagram Reels): 語彙力チェックとテストメーカーの違い

- **platform**: Instagram Reels(縦動画、TikTok / YouTube Shortsへ転用可)
- **purpose**: 「今の語彙力を知りたい人」と「自分の単語でテストを作りたい人」を
  正しい入口へ振り分ける(混同による離脱を防ぐ)
- **hook**: 「語彙力チェックとテストメーカー、実は目的が違います」
- **script**:
  - [0-3s] テロップ「語彙力チェックとテストメーカー、実は目的が違います」
  - [3-9s] 画面録画: `/vocab-check`で20問診断→今のレベルの目安を表示
  - [9-15s] 画面録画: `/tools/vocab-test-maker`で自分の単語リストからテストを作成
  - [15-18s] テロップ「レベルを知りたいなら診断、自分の単語でテストを作りたいならテストメーカー」
- **CTA**: 「両方とも無料・登録不要 →」
- **destination**: `/tools/vocab-test-maker`(このパックの主目的である公開ツールへの流入を優先)
- **utm_source**: `instagram`
- **utm_medium**: `social`
- **utm_campaign**: `vocab_test_maker_launch`
- **utm_content**: `instagram_launch_01`
- **full URL**: `https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=instagram&utm_medium=social&utm_campaign=vocab_test_maker_launch&utm_content=instagram_launch_01`

---

## 公開後の確認手順

1. 各投稿を手動で公開する(このリポジトリ・このIssueの範囲では自動投稿は行わない)。
2. 公開から最低7日経過後、`npm run audit:social-acquisition-snapshot` を実行し、
   `utm_content`別の内訳(このパックの8つの`utm_content`値)でlanding→funnel→signupを確認する。
3. 反応が良かったテーマ・プラットフォームを踏まえて次バッチ(第2弾)を検討する。
   このパック自体を機械的に30日分へ拡張しない。
