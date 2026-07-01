# PHASE2B_TEACHER_DESIGN — 先生向け進捗管理（実装前レビュー用）

> Phase 2-B。塾講師・家庭教師が担当生徒の学習状況を把握できる管理機能。
> **本書は設計のみ。実装・本番DB変更・RLS変更は、承認後に着手する。**
> 最終更新: 2026-07-01

前提ルール（オーナー方針）:
- 本番DB変更・RLS変更・権限設計の変更は**実行前に必ず報告・承認**。
- 目的外の変更を混ぜない／機能単位でコミット／tsc・build必須／デプロイ後は本番確認。
- 個人情報（未成年含む生徒データ）を扱うため**プライバシー最優先**。

---

## 1. 目的とスコープ
先生が担当生徒の **学習日数 / 学習語数 / 正答率 / 苦手単語 / 復習実施状況** を一覧で確認できる。
生徒データは**本人同意（オプトイン）**のもとで、**集計中心・最小開示**で共有する。

## 2. 権限設計（講師/生徒）
- `profiles.role text default 'student'`（`'student' | 'teacher'`）。
  - teacher でも通常の学習機能はそのまま使える（capability追加であり制限ではない）。
  - teacher への昇格フローは MVP では管理者付与 or 申請制（将来は塾プラン課金と連携）。
- 生徒は複数クラスに所属可。先生は複数クラスを持てる。
- **重要原則**: 先生は「自分のクラスに所属し、かつ同意済みの生徒」の**集計のみ**閲覧可。生の単語行や個人を特定する生データはRLSで直接開示しない。

## 3. DB設計（追加のみ・既存不変）
```sql
-- 010_teacher.sql（案）
alter table public.profiles
  add column if not exists role text not null default 'student';  -- 'student' | 'teacher'

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  invite_code text not null unique,       -- 生徒参加用の短いランダム
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on public.classes(teacher_id);

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',   -- 'active' | 'left'
  consent boolean not null default false,  -- 学習状況の共有への同意
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists class_members_student_idx on public.class_members(student_id);
```
既存 `words` / `daily_stats` は変更しない。

## 4. RLS設計（漏えい防止が最重要）
- **classes**
  - teacher 本人のみ CRUD: `using (teacher_id = auth.uid())`。
  - 招待コードでのクラス名参照は、RLSで全公開せず **SECURITY DEFINER RPC `lookup_class_by_code(code)`** が「クラス名など最小情報のみ」を返す。
- **class_members**
  - 生徒本人: 自分の行を select/insert/update（参加・同意・退出）: `using (student_id = auth.uid())`。
  - 先生: 自分のクラスの行を select のみ: `using (exists(select 1 from classes c where c.id = class_members.class_id and c.teacher_id = auth.uid()))`。
- **生徒の学習データ（words / daily_stats）**
  - **RLSは owner-only のまま変更しない**（先生に直接開放しない）。
  - 先生への提供は **SECURITY DEFINER RPC** 経由に限定:
    - `get_class_progress(p_class_id uuid)` … 呼び出し元が当該クラスの teacher であることを関数内で検証し、`consent=true and status='active'` の生徒についてのみ、集計値（studied_days / total_learned / accuracy / weak_count / last_studied_at / reviews_this_week）を返す。
    - `get_student_detail(p_class_id, p_student_id)` … 同様の認可＋同意チェックの上で、苦手単語トップN・学習カレンダーなど**限定情報**のみ返す。
  - RPC内で「teacher所有 && consent」を必ず二重チェック。生の全単語リストは返さない。

## 5. 招待コード方式
- クラス作成時に短いランダムコード生成（例: 8文字、紛らわしい文字を除いた charset、`invite_code` UNIQUE）。
- 生徒は `/join/[code]` でコード入力 → **共有内容を明示した同意画面** → `class_members` 作成（consent=true）。
- コードの**ローテーション/失効**を将来対応（漏洩時に無効化）。MVPは再発行ボタンのみ。

## 6. 画面構成
- `/teacher`（role=teacher ガード）… クラス一覧・作成・招待コード表示。
- `/teacher/[classId]` … 生徒ロスター表（学習日数・累計語数・平均正答率・苦手数・最終学習日・今週の復習回数）。ソート/フィルタ。
- `/teacher/[classId]/[studentId]` … 生徒詳細（苦手トップN・カレンダー）※同意済みのみ。MVPでは後回し可。
- `/join/[code]` … 生徒の参加＋**同意オンボーディング**（何が先生に見えるか明記）。
- `/settings` … 生徒が「参加クラス一覧・同意状況の確認/撤回・退出」を操作。

## 7. MVP範囲
- **含む**: role、classes、class_members（consent）、招待参加、`get_class_progress` RPC、`/teacher` + `/teacher/[classId]`（5指標の読み取り専用ロスター）、同意/撤回、`/join/[code]`。
- **含まない（後続）**: 生徒詳細ドリルダウン、課題配信、CSVエクスポート、複数担任、学校/組織アカウント、メッセージング、課金連携。

## 8. プライバシー・法務上の注意点
- 生徒（**未成年を含みうる**）の学習データを第三者（先生）に見せる → **明示的オプトイン同意必須・いつでも撤回可能・最小開示**。
- **利用規約 / プライバシーポリシーの改訂が必要**（誰が・何を・どの範囲で見るか、保持期間、目的外利用の禁止）。
- 未成年の同意は**保護者同意**の扱いを方針決定（サービスとして要検討事項）。
- 日本の個人情報保護法観点: 「第三者提供」ではなく**本人同意に基づく共有**として設計。データ最小化を徹底。
- 退会・クラス削除時のデータ削除フロー（cascade）を明示。
- 先生アカウントの本人確認は将来課題（MVPは招待コード＋同意で運用リスクを限定）。

## 9. 実装手順（承認後）
1. **migration 010**（profiles.role + classes + class_members + index + RLS + RPC）を作成 → **本番適用前に内容を報告・承認**。
2. TypeScript型を更新（必要なら型生成）。
3. `/join/[code]` + 同意フロー。
4. `/teacher` ガード + クラス作成/招待コード表示。
5. `get_class_progress` RPC → `/teacher/[classId]` ロスターUI。
6. `/settings` に「参加クラス管理・同意撤回」。
7. 規約/プライバシー改訂文言。
8. tsc / build / ローカル検証 → **機能単位でコミット** → デプロイ → 本番確認。
9. （feature flag 推奨）`NEXT_PUBLIC_TEACHER=1` 等でUI露出をgateし、OFFで完全非表示にできるようにして段階公開。

## 10. ロールバック方法
- **UI/ルート隔離**: feature flag OFF もしくは `/teacher` ルート撤去で機能を無効化（DBは残置可・無害）。
- **RPC**: `drop function get_class_progress(...)` 等で撤去可能。
- **DB**: 追加テーブル/カラムのため、撤去は `drop table class_members, classes; alter table profiles drop column role;`（**データ削除を伴うため要承認**）。通常はflag OFFで足り、DB撤去は最終手段。
- RLSは既存 words/daily_stats を変更しない設計なので、機能撤去で既存学習機能に影響しない。

## 11. 主要リスク
- **RLS/RPCの認可ミス = 情報漏えい（最重大）** → SECURITY DEFINER内で teacher所有＆consent を厳格チェック、負テスト必須。
- 集計クエリのスケール（多人数）→ インデックス設計、必要なら事前集計テーブル。
- 同意管理の複雑さ・撤回時の即時反映。
- 未成年/保護者同意の法務対応。

---

## 次アクション
この設計でMVP範囲・プライバシー方針・課金有無（無料/塾プラン）を確定いただければ、
**手順9の順で実装**に進みます（migration 010 は本番適用前に必ず内容を再提示します）。
