# Bing / IndexNow / AIクローラー 方針（Phase 8 → Phase 9で robots.txt 実装）

**2026-07-28更新**: `public/robots.txt` へのAIクローラー個別指定を実装した（T-09/A-02クローズ）。
IndexNow関連の記述（現状確認・次回検討）は本更新でも変更していない。詳細は下記
「robots.txtでのAIクローラー個別指定（実装済み）」セクション参照。

## 現状確認

- **Bing Webmaster Tools**: コード内から設定状況は確認できない（Bing側の管理画面でのサイト登録・確認が必要）。`public/robots.txt` に `Sitemap: https://loop-vocabulary.app/sitemap.xml` の記載があるため、Bingが登録済みであればこのsitemapを自動的に検出できる状態。**要人間確認**: https://www.bing.com/webmasters/ でのサイト登録有無。
- **IndexNow**: 現状コード内に実装なし。IndexNowはURLの追加・更新をBing/Yandex等に即時通知するプロトコルで、実装コストは低い（更新時にURLをPOSTするだけ）。今回は実装しない。理由: このラウンドの優先事項はAdSense審査前の信頼性・権利・noindex監査であり、IndexNow導入は「ページを増やす」方向の施策ではないが検索露出に関わる新機能追加であるため、次ラウンド以降で独立して検討する。
- **robots.txt でのAIクローラー個別指定**: 2026-07-28に実装済み。`OAI-SearchBot` `GPTBot` `ClaudeBot` `Google-Extended` `PerplexityBot` の個別User-agent行を `public/robots.txt` に追加した。それ以外のAIクローラーには引き続き `User-agent: *` の一律ルールが適用される。詳細は下記セクション参照。

## 用語の整理

- **OAI-SearchBot**: ChatGPTの検索機能がWeb検索結果を取得するためのクローラー。これを許可すると「ChatGPT経由の検索流入」につながりうる。モデル学習には使われない。
- **GPTBot**: OpenAIのモデル学習用データ収集クローラー。OAI-SearchBotとは別のクローラーであり、これを許可すると「本サイトのコンテンツがAIモデルの学習データに使われることを容認する」ことになる。
- **ClaudeBot**: Anthropicのモデル学習用データ収集クローラー。ユーザーがClaudeにURLを貼って読ませる場合の取得（ユーザー起点のfetch）とは別物。
- **Google-Extended**: Gemini/Bard/Vertex AIの学習用データ利用を制御するトークン。通常のGooglebot（検索クロール・インデックス登録）には影響しない。
- **PerplexityBot**: Perplexity AIのクローラー。検索回答の引用（出典表示付き）と一部学習の両方に使われており、OpenAI/Anthropicほどクローラーの用途が綺麗に分離されていない。
- **検索流入を得ることと、学習データ利用を許可することは別の意思決定**であり、一方を許可したいからといってもう一方も自動的に許可すべきとは限らない。以下の実装ではこの2軸を明確に分けて、ボットごとに個別のデフォルトを設定した。

## robots.txtでのAIクローラー個別指定（実装済み・2026-07-28）

「方針未確定のため保留」という状態から、**実際に動作する実装 + 明確な理由付きの推奨デフォルト**に進めた（オーナーの一存で不可逆の判断を下したわけではなく、`public/robots.txt` を編集するだけでいつでも個別に変更できる可逆的なデフォルトとして実装している）。`public/robots.txt` に以下の5つのUser-agentブロックを `User-agent: *` ブロックとは独立に追加した:

| User-agent | デフォルト | 理由 |
|---|---|---|
| `OAI-SearchBot` | `User-agent: *` と同じ許可/拒否パス（実質allow） | ChatGPT検索結果への掲載のみに影響し、モデル学習には使われない。他の検索エンジンと同じ価値提供のため、通常の検索エンジンと同様に扱う。 |
| `GPTBot` | `Disallow: /`（全面ブロック） | モデル学習用データ収集。辞書・AI解説などのオリジナルコンテンツはサイトの製品価値・収益モデルの一部であり、学習データとしてのスクレイピングは既定でブロックする方が安全かつ可逆。検索露出には影響しない（それはOAI-SearchBotが別途担当）。 |
| `ClaudeBot` | `Disallow: /`（全面ブロック） | GPTBotと同じ理由（モデル学習用データ収集、オリジナルコンテンツ保護のため既定ブロック、事業判断が変われば可逆）。 |
| `Google-Extended` | `Disallow: /`（全面ブロック） | Gemini/Bard/Vertex AIの学習データ利用を制御。通常のGooglebot検索クロール（`User-agent: *`）には影響しない。GPTBot/ClaudeBotと同じ学習データ保護の理由で既定ブロック。 |
| `PerplexityBot` | `User-agent: *` と同じ許可/拒否パス（実質allow） | 主な用途が出典表示付きの回答引用であり、検索露出と近い価値提供のため許可をデフォルトに。ただしOpenAI/Anthropicのボットほど検索用途と学習用途が明確に分離されていないため、この項目は他より再検討の余地が大きいことをrobots.txt内のコメントにも明記した。 |

**デフォルトを変更する方法**: `public/robots.txt` を開き、変更したいボットの `User-agent:` ブロックを直接編集する（各ブロックは独立しており、他のボットや `User-agent: *` ブロックには影響しない）。変更は次回クロール時から反映される。ただしrobots.txtはあくまで任意規約であり、クローラー側がこれを遵守する保証はない点に注意。

再発防止テスト: `scripts/testing/e2e/ai-crawler-llms-policy.mjs`（`npm run test:ai-crawler-llms-policy`）が、`User-agent: *` ブロックの既存Disallowパスの非退行と、5ボットのUser-agentブロックの存在・構文妥当性、`public/llms.txt` の実ルート整合性を検証する。

## 次回検討する際の論点（判断材料の整理のみ）

1. `OAI-SearchBot` を明示的に `Allow` した（本ラウンドで実装済み）。ChatGPT検索経由の流入をGA4でどう計測するか（リファラ判定・UTM設計）は未着手のため、次回検討する。
2. `GPTBot` を明示的に `Disallow` した（本ラウンドで実装済み）。辞書・ガイド記事などオリジナルコンテンツの学習データ利用を望まない、という意思表示として反映した。
3. 現状 `sitemap.ts` は約167件のURLのみでBing/IndexNowを急いで導入する規模的必然性は低い。ページ数が大きく増えるタイミング（辞書語ページの本格拡張等）で再検討するのが合理的。
4. `PerplexityBot` のデフォルト（許可）は、検索用途と学習用途の分離が他社ほど明確でないため、Perplexity側の方針変化やサイト側の実データを見て再検討する余地がある。

## GA4でのAI経由流入の見方（現状でも確認可能・コード変更不要）

GA4の「トラフィック獲得」レポートで、参照元(`source`)に `chatgpt.com` `perplexity.ai` `bing.com` 等が含まれるセッションを確認できる。現状UTMパラメータの付与や特別なイベント計測は行っていないため、リファラベースの自然流入として計測される。専用の計測を追加する場合は次ラウンドで検討する。
