-- Loop Autonomous Improvement System: scripts/improvement/patch-agent.mjs(決定的パッチAgent)向けの
-- 構造化パッチ仕様カラム。AUTONOMOUS_ENGINEERING_POLICY.md「コード修正」の実行主体の節を参照。
--
-- patch_specはissue本文等の自由記述テキストではなく、人間/Claude Codeの対話的セッションが
-- 事前に組み立てる、固定4種類の決定的操作(create_file/append_line_to_file/replace_exact_text/
-- insert_after_line_containing)の配列(jsonb)。patch-agent.mjsはこれを解釈して適用するのみで、
-- 自由記述から任意のコードを生成することはない。

alter table improvement_tasks
  add column if not exists patch_spec jsonb;

comment on column improvement_tasks.patch_spec is
  '決定的パッチ操作の配列。scripts/improvement/patch-agent.mjsが解釈できる4種類の操作'
  '(create_file/append_line_to_file/replace_exact_text/insert_after_line_containing)のみを許可する。'
  '未設定の場合、コード修正は人間/Claude Codeの対話的セッションがbranchへ直接pushする従来の経路のみ。';
