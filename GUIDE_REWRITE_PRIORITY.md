# 上位記事リライト優先度リスト（Phase 6）

Search Console掲載可能性・内部リンク価値・AdSense審査における信頼性価値の3軸で選定。AEO強化(結論ブロック・H2直下回答・table化)は既に前ラウンドで完了済みのため、今回のギャップは「対象者の明示」「出典・参考文献」「執筆者/確認者/最終更新日」「更新履歴」の欠落だった。

## 全面対応済み（5記事）

新設の `GuideByline` コンポーネント（`src/components/guide/GuideByline.tsx`）を追加し、対象者・出典・執筆確認者・最終更新日・更新履歴を明示した。試験情報系(Phase2)・比較記事系(Phase3)と対象が重複しない、評価・信頼性軸で優先度の高い学習法系記事を選定。

1. `/guide/how-to-memorize-english-words`（英単語の覚え方）
2. `/guide/spaced-repetition-english-vocabulary`（忘却曲線）
3. `/guide/flashcards-vs-multiple-choice`（フラッシュカード vs 4択）
4. `/guide/ai-vocabulary-learning`（AI活用）
5. `/guide/listening-and-pronunciation-vocabulary`（音声ファースト学習法）

## Phase 2/3で対応済み・対応中（重複回避のため本リストでは対象外）

英検/TOEIC/大学受験/高校英語/定期テスト関連記事（`EXAM_INFO_SOURCE_POLICY.md`）、単語帳比較・市販教材名を含む記事（`EXTERNAL_MATERIALS_RIGHTS_AUDIT.md`）は、それぞれのPhaseで最終確認日・出典・非公式disclaimerの追加を実施。

## 次回対応候補（TODO・優先度順）

| 優先度 | slug | 理由 |
|---|---|---|
| 高 | `eitango-oboerarenai`（`guide/[slug]/page.tsx`内で処理） | 「覚えられない」系は検索ボリュームが大きい典型クエリだが、動的ルート内のコンテンツのため`GuideByline`適用に個別対応が必要 |
| 高 | `eiken-conversation`（英検面接・スピーキング対策） | 現状カバーが薄く、内部リンク価値が高い |
| 中 | `eitango-ichinichi-nanko`（1日の学習語数の目安） | 具体的な数字を扱うため出典明記の価値が高い |
| 中 | `genzaikanryo-kakokei-chigai`（現在完了と過去形の使い分け） | affect/effect等の使い分け系と同カテゴリ、AEO価値が高い |
| 低 | `eigo-dokkai-houhou`（英文読解法） | 学習法系だが優先5記事と内容がやや近いため後回し |

## テスト

`scripts/testing/e2e/guide-quality-signals.mjs`（`npm run test:guide-quality-signals`）で、対応済み5記事に対象者・出典・最終更新日・更新履歴が実際に表示されていることを継続監視する。
