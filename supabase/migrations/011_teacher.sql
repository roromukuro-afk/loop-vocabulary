-- ============================================================
-- 011_teacher.sql — 先生向け進捗管理 MVP のDB基盤
-- ------------------------------------------------------------
-- ・新規テーブル追加＋profiles.role 追加（既存カラム・既存データ・既存RLSは変更しない）
-- ・新規テーブルにのみ RLS を付与（既存RLSの緩和はしない）
-- ・生徒の生データ(words等)は先生に直接開放せず、SECURITY DEFINER RPC 経由で
--   「自分のクラスかつ同意済みの生徒」の集計のみ返す。
-- ============================================================

alter table public.profiles
  add column if not exists role text not null default 'student';  -- 'student' | 'teacher'

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  invite_code text not null unique,
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

-- ============== RLS（新規テーブルのみ）==============
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- classes: 先生本人のみ CRUD
drop policy if exists "classes teacher all" on public.classes;
create policy "classes teacher all" on public.classes
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- class_members: 生徒本人は自分の所属を管理（参加・同意・退出）
drop policy if exists "class_members student rw" on public.class_members;
create policy "class_members student rw" on public.class_members
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- class_members: 先生は自分のクラスの所属を select のみ
drop policy if exists "class_members teacher read" on public.class_members;
create policy "class_members teacher read" on public.class_members
  for select using (
    exists (select 1 from public.classes c
            where c.id = class_members.class_id and c.teacher_id = auth.uid())
  );

-- ============== RPC ==============
-- 招待コードからクラスの最小情報を返す（参加画面用）
create or replace function public.lookup_class_by_code(p_code text)
returns table (class_id uuid, class_name text, teacher_name text)
language sql security definer set search_path = public as $$
  select c.id, c.name, coalesce(p.display_name, '先生')
  from public.classes c
  left join public.profiles p on p.id = c.teacher_id
  where c.invite_code = p_code and c.archived = false
  limit 1;
$$;

-- 先生ロスター: 自分のクラスかつ同意済み・在籍中の生徒の「集計のみ」を返す
create or replace function public.get_class_progress(p_class_id uuid)
returns table (
  student_id uuid,
  display_name text,
  total_learned bigint,
  weak_count bigint,
  accuracy numeric,
  studied_days bigint,
  last_studied_at timestamptz,
  reviews_this_week bigint
)
language plpgsql security definer set search_path = public as $$
begin
  -- 認可: 呼び出し元が当該クラスの teacher であること
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.teacher_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  return query
  select
    cm.student_id,
    coalesce(pr.display_name, '生徒'),
    (select count(*) from public.words w where w.user_id = cm.student_id and w.mastery >= 1),
    (select count(*) from public.words w where w.user_id = cm.student_id and w.is_weak),
    (select case when coalesce(sum(w.correct_count + w.wrong_count),0) > 0
        then round(100.0 * sum(w.correct_count) / sum(w.correct_count + w.wrong_count), 1)
        else 0 end
      from public.words w where w.user_id = cm.student_id),
    (select count(distinct ds.day) from public.daily_stats ds
       where ds.user_id = cm.student_id and ds.studied_count > 0),
    (select max(w.last_studied_at) from public.words w where w.user_id = cm.student_id),
    (select coalesce(sum(ds.studied_count),0) from public.daily_stats ds
       where ds.user_id = cm.student_id and ds.day >= (current_date - 6))
  from public.class_members cm
  left join public.profiles pr on pr.id = cm.student_id
  where cm.class_id = p_class_id
    and cm.status = 'active'
    and cm.consent = true;
end;
$$;

-- 生徒: 自分の所属クラス一覧（設定画面の同意管理用）
create or replace function public.get_my_memberships()
returns table (
  class_id uuid, class_name text, teacher_name text,
  consent boolean, status text, joined_at timestamptz
)
language sql security definer set search_path = public as $$
  select cm.class_id, c.name, coalesce(p.display_name, '先生'),
         cm.consent, cm.status, cm.joined_at
  from public.class_members cm
  join public.classes c on c.id = cm.class_id
  left join public.profiles p on p.id = c.teacher_id
  where cm.student_id = auth.uid();
$$;

revoke all on function public.lookup_class_by_code(text) from public, anon;
revoke all on function public.get_class_progress(uuid)   from public, anon;
revoke all on function public.get_my_memberships()        from public, anon;
grant execute on function public.lookup_class_by_code(text) to authenticated;
grant execute on function public.get_class_progress(uuid)   to authenticated;
grant execute on function public.get_my_memberships()        to authenticated;
