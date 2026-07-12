# 試験情報アキュラシー監査（フェーズ2） — 英検・TOEIC・大学受験・高校英語・定期テスト

監査実施日: 2026-07-12
対象範囲: `src/app/guide/**`（英検・TOEIC・大学受験・高校英語・定期テスト関連）、`src/app/materials/eiken|toeic|university-exam`、`src/app/vocab-check/eiken|toeic`

関連ドキュメント: `EXAM_INFO_SOURCE_POLICY.md`（今後の運用ルール）

凡例: 「最終確認日」列は `ExamInfoDisclaimer` コンポーネントまたはページ内注記で「最終確認日: 2026-07-12」が表示されているか。「ソース注記」列は、出題形式・問題数等が年度で変わりうる旨の注記があるか。

## 修正したページ

| ページ | 見つかった問題 | 適用した修正 | 最終確認日表示 | ソース注記 |
|---|---|---|---|---|
| `src/app/guide/eiken-jun1-tango/page.tsx` | 「合格スコア目安: 約72%(一次)」を断定的な数値カードで表示。英検はCSEスコア判定のためこの表現は不正確 | ラベルを「一次スコアの目安（過去傾向）」に変更し「約72%相当」に軟化。`ExamInfoDisclaimer kind="eiken" showCseNote` を追加（CSE注記+最終確認日） | あり | あり |
| `src/app/guide/eiken-2kyu-tango/page.tsx` | 「65% / 合格ライン」という断定的な数値カード | 「約65% / 合格ラインの目安（過去傾向）」に軟化。`ExamInfoDisclaimer kind="eiken" showCseNote` を追加 | あり | あり |
| `src/app/guide/eiken-3kyu-tango/page.tsx` | 「65% / 合格ライン」という断定的な数値カード | 同上（「約65% / 合格ラインの目安（過去傾向）」）。`ExamInfoDisclaimer` 追加 | あり | あり |
| `src/app/guide/eiken-jun2-tango/page.tsx` | 「60% / 合格ライン」という断定的な数値カード | 同上（「約60% / 合格ラインの目安（過去傾向）」）。`ExamInfoDisclaimer` 追加 | あり | あり |
| `src/app/guide/eiken-1kyu-tango/page.tsx` | 出題数（大問1・25問）を断定的に記載、試験形式の変更可能性への言及なし | `ExamInfoDisclaimer kind="eiken"` を追加（CSE注記は無し。数値カードに合否率の記載がないため） | あり | あり |
| `src/app/guide/toeic-tango/page.tsx` | スコア帯別必要語彙数（600/730/860/990点）を断定的に提示 | `ExamInfoDisclaimer kind="toeic"` を追加 | あり | あり |
| `src/app/guide/toeic-900ten/page.tsx` | パート別の問題数（Part1:6問, Part2:25問, Part3:39問, Part5:30問, Part7:54問等）を断定的な表として提示 | パート別攻略セクションの直前に `ExamInfoDisclaimer kind="toeic"` を追加 | あり | あり |
| `src/app/guide/daigaku-juken-tango/page.tsx` | タイトル・OGP・H1・JSON-LD headlineに「【2025年版】」という古くなりうる年号が固定表示（現在日付2026-07-12時点で1年以上前の年号が"版"として生き続けていた）。レベル別必要語彙数を断定的に提示 | 年号をすべて除去し「【共通テスト〜難関大対応】」に変更（今後年号更新が不要な evergreen タイトルに）。`dateModified` を2026-07-12に更新。`ExamInfoDisclaimer kind="university"` を追加 | あり | あり |
| `src/app/guide/koukou-eigo-tango/page.tsx` | 共通テスト必要語彙数等を断定的に提示 | `ExamInfoDisclaimer kind="university"` を追加 | あり | あり |
| `src/app/guide/page.tsx` | ガイド一覧カードで daigaku-juken-tango の紹介文が「【2024年版】」となっており、実記事側の「【2025年版】」とも食い違っていた（既存の不整合バグ） | タイトルを「【共通テスト〜難関大対応】」に統一 | — | — |
| `src/app/guide/university-exam-vocabulary/page.tsx` | 関連ガイドリンクの表示テキストが「【2025年版】」のまま | 「【共通テスト〜難関大対応】」に統一 | 既存のまま（このページ自体は元々CSE非該当・disclaimer済み） | — |
| `src/app/guide/[slug]/page.tsx`（動的記事: `eiken-2kyu-tango-nanko`） | 実際に配信されるページ（静的ルートと衝突しない独立スラッグ）で「頻出上位1,500語を確実にすることが合格の最短ルート」「合格ラインに届く」等、CSE注記なしに断定的な合否表現。出題数（大問1・25問）も注記なしで記載 | 本文中に英検CSEスコア制度に関する注記パラグラフを追加し、「最短ルート」等の断定表現を「効率的な学習ルートの一つ」等に軟化。文末に「最終確認日: 2026-07-12」と公式サイト確認の案内を追加。FAQの回答も同様に軟化 | あり（本文内テキストで表示） | あり（本文内テキストで表示） |

## 重要な発見: 静的ルートと動的ルートのスラッグ衝突バグ（今回の監査で発見・是正）

`src/app/guide/[slug]/page.tsx` の `ARTICLES` オブジェクトには、**すでに静的ルート（`src/app/guide/<slug>/page.tsx`）が存在する slug と同名のエントリが8件**残っていた: `daigaku-juken-tango`, `eiken-2kyu-tango`, `chugaku-eigo-tango`, `eiken-conversation`, `ielts-tango`, `eiken-jun1-tango`, `business-english-tango`, `toeic-tango`。

当初「静的ルートが常に優先されるため、これらは到達不能なデッドコードだろう」と想定して年号表記のみ軽微に修正していたが、E2Eテスト (`exam-info-sources.mjs`) を実データのビルド（`next build && next start`）で実行したところ、**`eiken-jun1-tango`・`eiken-2kyu-tango`・`daigaku-juken-tango`・`toeic-tango` の4件は実際には `[slug]/page.tsx` 側の `ARTICLES` エントリ（静的folder側ではない方）が配信されていた**ことが判明した。Next.js のビルド時、`generateStaticParams` が返す動的ルートのパラメータに、既存の静的ルートと同名の slug が含まれる場合、どちらの出力が実際に `.next/server/app/guide/<slug>.html` に書き込まれるかはビルド順に依存し、静的ルート側が必ず勝つとは限らない（少なくとも今回の環境では動的ルート側が上書きしていた）。

**特に `eiken-jun1-tango` の `ARTICLES`版には、静的folder版よりも悪い未是正の断定表現が含まれていた**: 「合格率は約15〜20%と難関です」（英検CSEスコア注記なしの断定的合格率）、「語彙問題（大問1）は41問中25問を占め」（注記なしの出題数）。これは静的folder版の是正（`ExamInfoDisclaimer` 追加）だけでは実際のユーザーには届いていなかったことを意味する。

### 是正内容

安全のため、大規模なコード削除（`ARTICLES` の重複エントリ削除によるルーティング衝突の根本解消）は行わなかった（このセッションの権限ポリシー上、事前確認なしの一括800行削除が「元に戻せない大規模破壊的操作」としてブロックされたため）。代わりに、**衝突している両方のバージョンの本文を個別に是正**することで、どちらが実際に配信されてもフェーズ2の是正内容（CSE注記・出典注記・最終確認日）が読者に見える状態にした。

| 該当slug | `ARTICLES` エントリで見つかった問題 | 適用した修正 |
|---|---|---|
| `eiken-jun1-tango` (L587〜) | 「合格率は約15〜20%と難関です」という断定的合格率。「語彙問題は41問中25問」の出題数を注記なしで記載 | 合格率の表現を「過去の傾向では〜台とされる」に軟化。CSEスコア制度・出題形式変更可能性・最終確認日（2026-07-12）の注記パラグラフを追加 |
| `eiken-2kyu-tango` (L178〜) | 「語彙問題（大問1）で25問出題される」を断定的に記載、CSE注記なし | 「現行では25問程度」に軟化。CSEスコア制度・出典注記・最終確認日の注記パラグラフを追加 |
| `daigaku-juken-tango` (L94〜) | タイトルは既に年号除去済みだったが、本文に出典・最終確認日の注記がなかった | 必要語彙数のセクションに出典注記＋最終確認日を追加 |
| `toeic-tango` (L793〜) | スコア帯別語彙数の表に出典注記がなかった | 出典注記（ETS公式TOEIC情報・IIBC公式サイト）＋最終確認日を追加 |

`chugaku-eigo-tango` / `eiken-conversation` / `ielts-tango` / `business-english-tango` の4件も同じ衝突構造を持つが、本文を確認したところ断定的な合否率・CSE関連の記述は無かったため、フェーズ2（試験情報アキュラシー）の対象外として今回は変更していない。

### 推奨するフォローアップ（未実施・スコープ外）

このスラッグ衝突は本質的にはルーティング/コンテンツ管理のバグであり、`ARTICLES` 側の重複8エントリ（と対応する `BOOKS`・`GUIDE_MATERIALS` エントリ）を削除して静的folder側に一本化するのが正しい恒久対応。今回はE2E検証の過程で偶然発見したものであり、大規模な削除は本フェーズのスコープ外（かつ800行規模の一括削除は安全性の観点でブロックされた）ため、別セッションでの対応を推奨する。

## 新規作成したコンポーネント

- `src/components/guide/ExamInfoDisclaimer.tsx`: 出題形式・問題数・試験時間の変更可能性、および英検CSEスコア制度の注記、最終確認日を表示する共有コンポーネント。`data-testid="exam-info-disclaimer"` と `data-testid="exam-info-last-verified"` を付与し、E2Eテストから検証可能にした。

## 確認したが変更不要と判断したページ

| ページ | 確認内容 | 判断 |
|---|---|---|
| `src/app/guide/eiken-vocabulary-study/page.tsx` | 級別の断定的な数値や出題形式claimなし。既に「合格を確約するような表現は行っていません」等の注意点セクションとdateModifiedを保持 | 変更不要 |
| `src/app/guide/university-exam-vocabulary/page.tsx`（本体） | 同上。既に「合格やスコア向上を確約するような表現は行っていません」の注意点あり | リンクテキストの年号のみ修正（上表） |
| `src/app/guide/school-test-vocabulary/page.tsx` | 学校ごとに範囲・形式が異なる旨を明記済み。断定的な数値なし | 変更不要 |
| `src/app/guide/high-school-english-vocabulary-test/page.tsx` | 「あくまで一般的な目安です」の注記あり。合否・CSE関連claimなし | 変更不要 |
| `src/app/materials/eiken/page.tsx` | 「合格や点数を保証するような表現、誇張した実績の記載は行っていません」の既存注記あり。出題数・試験時間claimなし | 変更不要 |
| `src/app/materials/toeic/page.tsx` | 同上、断定的な試験形式claimなし | 変更不要 |
| `src/app/materials/university-exam/page.tsx` | 同上 | 変更不要 |
| `src/app/vocab-check/eiken/EikenVocabRunner.tsx` + `page.tsx` | 自己診断ツール。結果は「英検◯級レベル」という語彙レベルの目安表示であり、公式の合否判定を主張していない。「合格まで最短ルートで進もう」はCTAの一般的な誘導表現で、数値保証ではない | 変更不要（ただし将来的にCSE言及を追加する場合はPhase3で検討） |
| `src/app/vocab-check/toeic/ToeicVocabRunner.tsx` + `page.tsx` | 同上。TOEICはスコア制のみで合否判定がない試験のためCSE相当の注記は不要 | 変更不要 |
| `src/app/guide/chugaku-eigo-tango/page.tsx` | `datePublished: "2024-12-01"` のみで、タイトルに年号なし。試験formatclaimなし | 変更不要 |
| `src/app/guide/juku-vocabulary-test/page.tsx` | 「正答率」の言及は教員が生徒の小テスト結果を記録する文脈で、断定的な合否主張ではない | 変更不要 |

## スコープ外だが関連して見つかった項目（今回は未対応）

- `src/app/guide/eitango-oboeru-houhou/page.tsx` のタイトルに「【2024年版】」が残っている。この記事は特定の試験（英検/TOEIC/大学受験等）向けではなく汎用の記憶術ガイドのため、今回のフェーズ2（試験情報アキュラシー）の対象リストには含まれていないが、同じ「古い年号タイトル」問題に該当する。`EXAM_INFO_SOURCE_POLICY.md` の年号運用ルールに沿って別途対応することを推奨。
