# GROWTH_MEASUREMENT_PLAN — グロース計測イベント設計

作成日: 2026-07-12

## 1. 分析基盤（既存を確認・そのまま利用）

- **GA4は導入済み**（`NEXT_PUBLIC_GA_ID`、本番で`G-TCL19ZZMYT`として稼働中、`src/app/layout.tsx`）
- Microsoft Clarity も併用中（`NEXT_PUBLIC_CLARITY_ID`）
- `src/lib/analytics/events.ts` に既存の`gtag`ラッパー関数群があり、21ファイルから
  利用されている確立されたパターンがある
- 別途、AI機能の利用状況ログ（`ai_usage_events`、service_role限定・個人情報無し）が
  Supabase側に存在するが、これは運用監視用でありGA4とは別物として維持する
  （目的が異なるため統合しない: `ai_usage_events`はコスト監視、GA4はプロダクト行動分析）

このため、今回は**新しい計測基盤を作らず、既存のGA4/gtagパターンをそのまま拡張**した
（オーナー提示の「GA4が既に入っているなら、gtagでイベント送信」の選択肢1）。

## 2. 送信するデータの範囲

すべてのイベントで送信するのは以下の情報のみ。

- ページの種類・診断のバリアント（general/eiken/toeic等）
- 操作したボタン・リンクの種類（`target`パラメータ等）
- 対象の単語スラッグ・記事スラッグ（`/dictionary/analyze`の`analyze`のような、
  そのページのURLから誰でも読み取れる情報であり、個人情報ではない）
- 正誤・問題番号・進捗数などの匿名の操作ログ
- GA4が自動的に付与する匿名クライアントID・タイムスタンプ・URL

**送信しないもの**: メールアドレス・氏名・単語帳名・ユーザーが入力した検索語そのもの
（検索語は件数のみ送信し、語句自体は送らない設計にした。理由は
`ORIGINAL_DATA_REPORTS_PLAN.md`4章参照）・user_id・IPアドレス（GA4のデフォルト挙動に依存）。

## 3. Cookie同意への影響

**今回の変更によるCookie同意要件への影響は無い。** 既にGA4・Clarityは同意バナー無しで
本番稼働しており（`gtag.js`のデフォルト設定のまま）、今回追加したのは同じ`gtag`経由の
イベント送信を増やしただけで、新しいCookie・新しいトラッキング技術・新しい第三者スクリプトは
一切追加していない。既存の同意ポリシー（プライバシーポリシーでの一般的なCookie開示のみ、
専用同意バナー無し）を変更する必要は生じていない。

ただし、今回`/privacy`にGoogle Analytics・Microsoft Clarityの利用を**明示的に**追記した
（従来は「アクセスログ・Cookie」という一般的な記載のみで、具体的な解析ツール名が
書かれていなかったため）。これは新しい追跡を始めたからではなく、既に動いているものを
正しく開示するための修正。

## 4. イベント一覧

### `/vocab-check`（一般・英検・TOEICの3バリアント共通）

| イベント名 | 発火タイミング | 主なパラメータ |
|---|---|---|
| `vocab_check_view` | ページ表示時 | `variant` |
| `vocab_check_start` | 1問目に回答した瞬間 | `variant` |
| `vocab_check_answer` | 各問回答時 | `variant`, `question_index`, `correct` |
| `vocab_check_progress` | 10問目・20問目到達時 | `variant`, `answered`, `total` |
| `vocab_check_result_view` | 結果画面表示時 | `variant`, `level`, `correct`, `total` |
| `vocab_check_share_click` | Xシェアボタン押下時 | `variant` |
| `vocab_check_cta_click` | signup/login/materials/guide/他バリアントへの遷移リンク押下時 | `variant`, `target` |

### `/dictionary`

| イベント名 | 発火タイミング |
|---|---|
| `dictionary_view` | ページ表示時 |
| `dictionary_search_executed` | 検索実行時 |
| `dictionary_search_results` | 検索結果表示時（`result_count`） |
| `dictionary_search_zero` | 検索結果0件時 |
| `dictionary_word_click` | 「よく調べられる単語」リンク押下時（`word_slug`） |
| `dictionary_add_cta_click` | 検索結果の「＋単語帳に追加」押下時 |
| `dictionary_login_prompt_view` | 未ログイン向け登録バナー表示時 |
| `dictionary_signup_cta_click` | 登録CTA押下時（`source`） |

### `/dictionary/[word]`

| イベント名 | 発火タイミング |
|---|---|
| `word_page_view` | ページ表示時（`word_slug`） |
| `word_page_add_cta_click` | 単語帳追加ボタン/登録リンク押下時（`logged_in`） |
| `word_page_vocab_check_click` | 「語彙力チェックへ」リンク押下時 |
| `word_page_guide_click` | 関連ガイド記事リンク押下時（`guide_slug`） |
| `word_page_related_word_click` | 関連語リンク押下時（`related_word`） |

関連語は従来クリック不可の単なるテキストだったため、`/dictionary?q=<関連語>`への
リンクとして機能追加した（辞書検索に自動でその語を検索する）。イベント計測のために
初めて実用的な導線になった。

### `/guide`

| イベント名 | 発火タイミング |
|---|---|
| `guide_read`（既存） | 記事表示時 |
| `guide_cta_click` | 記事内の`/vocab-check`・`/dictionary`・`/premium`・`/materials`・他記事へのリンク押下時 |
| `guide_share_click` | X共有リンク押下時（将来記事に追加された場合に備える） |

37記事超ある静的ファイルを1件ずつ書き換える代わりに、`GuideTracker`コンポーネント
（全記事が既に呼び出し済み）にドキュメント全体へのクリック委譲リスナーを追加し、
1箇所の変更で全記事に自動適用されるようにした。

### PDF小テスト

| イベント名 | 発火タイミング |
|---|---|
| `feature_used`（既存、`feature: "pdf_export"`） | 生成ボタン押下時 |
| `pdf_generate_start` | 生成処理開始時 |
| `pdf_generate_complete` | 印刷ウィンドウが開いた時（`question_count`） |

「PDF印刷/ダウンロード導線クリック」は、実際のUIには生成ボタン以外に独立した
印刷ボタンが存在しない（生成後に自動で`window.print()`が呼ばれる設計のため）ため、
`pdf_generate_start`と同一のクリックとして扱った。

QRコードの遷移先URLに`?utm_source=pdf_qr&utm_medium=offline&utm_campaign=teacher_pdf`を
付与した。紙のQRコード自体にJavaScriptは仕込めないため、着地ページである`/vocab-check`側の
実装は不要（GA4はページ読み込み時にURLのutmパラメータを自動検出する）。

## 5. 実装方式のポイント

- サーバーコンポーネントから計測付きリンクを使うために `src/components/analytics/TrackedLink.tsx`
  を新設した。サーバー→クライアントへ関数を直接渡すことはできないため、
  イベント名（文字列）と引数（シリアライズ可能な値）だけを渡し、実際の`gtag`呼び出しは
  クライアント側のコンポーネント内で行う設計にした
- `/guide`のCTAクリックは、記事ファイルを1つずつ書き換える代わりに`GuideTracker`への
  クリック委譲リスナー追加という1箇所の変更で全記事に対応した

## 6. 計測できないこと（今回のスコープ外）

- 紙のQRコードを読み取った「行為」自体はJavaScriptで検知できないため、
  「QRコードを見た/スキャンした」ではなく「QRコード経由で着地した」までしか分からない
  （UTMパラメータによる間接計測）
- `/vocab-check`の結果は現状DBに保存していないため、GA4のイベントログ以外の場所に
  蓄積されない。将来サーバー側で集計したい場合は`ORIGINAL_DATA_REPORTS_PLAN.md`を参照
