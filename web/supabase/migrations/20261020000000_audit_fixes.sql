-- Fixes from the code audit. Apply in the Supabase SQL editor (or `supabase db push`).
-- Safe to run once; every statement is idempotent or guarded.

-- ───────────── 1. Departure date (dashboard "выбыло за месяц") ─────────────
alter table public.students add column if not exists departed_at timestamptz;

-- Deactivated staff: a teacher with observations can't be deleted (observations.author_id FK),
-- so the account is blocked and hidden instead; their observations and authorship are kept.
alter table public.users add column if not exists is_active boolean not null default true;

-- ───────────── 2. "No recent observations" must not be capped at 20 rows ─────────────
-- Callers that only display a few rows slice on the client; counts need the full list.
create or replace function public.get_students_no_recent_obs(p_school_id uuid)
returns table(id uuid, full_name text, class_name text, last_observation_at timestamptz, days_since integer)
language sql security definer set search_path = public as $$
  select
    s.id,
    s.full_name,
    coalesce(c.name, '—') as class_name,
    max(o.created_at) as last_observation_at,
    case
      when max(o.created_at) is null then null
      else extract(day from now() - max(o.created_at))::integer
    end as days_since
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.observations o on o.student_id = s.id and o.source = 'manual'
  where s.school_id = p_school_id
    and p_school_id = public.get_my_school_id()
    and s.status = 'active'
    and s.created_at < now() - interval '14 days'
  group by s.id, s.full_name, c.name
  having max(o.created_at) is null
      or max(o.created_at) < now() - interval '14 days'
  order by days_since desc nulls first
$$;

-- ───────────── 3. School-year rollover must not push classes past grade 11 ─────────────
create or replace function public.increment_class_grades(p_school_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.classes
  set grade = least(grade + 1, 11),
      name = least(grade + 1, 11)::text || coalesce(letter, '')
  where school_id = p_school_id and grade is not null;
end;
$$;

-- ───────────── 4. RLS aligned with what the app lets each role do ─────────────

-- Manager manages classes (edit / graduate / create while adding a student), like admin and deputy.
drop policy if exists "admin and deputy can insert classes" on public.classes;
drop policy if exists "admin and deputy can update classes" on public.classes;
drop policy if exists "admin and deputy can delete classes" on public.classes;
create policy "class managers can insert classes" on public.classes for insert to authenticated
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy','manager'));
create policy "class managers can update classes" on public.classes for update to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy','manager'))
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy','manager'));
create policy "class managers can delete classes" on public.classes for delete to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy','manager'));

-- Class teacher sees the "Add student" button, so the insert must be allowed.
drop policy if exists "staff can insert students" on public.students;
create policy "staff can insert students" on public.students for insert to authenticated
  with check (school_id = public.get_my_school_id()
    and public.get_my_role() in ('admin','deputy','class_teacher','manager'));

-- Manager uploads/changes the school logo (the server action allows admin and manager).
drop policy if exists "admin can update own school" on public.schools;
create policy "admin and manager can update own school" on public.schools for update to authenticated
  using (id = public.get_my_school_id() and public.get_my_role() in ('admin','manager'))
  with check (id = public.get_my_school_id());

drop policy if exists "School logo upload" on storage.objects;
drop policy if exists "School logo update" on storage.objects;
create policy "School logo upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.get_my_role() in ('admin','manager')
    and name like 'schools/' || public.get_my_school_id()::text || '.%');
create policy "School logo update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.get_my_role() in ('admin','manager')
    and name like 'schools/' || public.get_my_school_id()::text || '.%');

-- A class teacher may lead several classes (classes.teacher_id); users.class_id only holds the first.
drop policy if exists "author or admin can update observation" on public.observations;
create policy "author or admin can update observation" on public.observations for update to authenticated
  using (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
    and (
      author_id = (select auth.uid())
      or public.get_my_role() in ('admin','deputy','manager')
      or (public.get_my_role() = 'class_teacher' and exists (
        select 1 from public.students s join public.classes c on c.id = s.class_id
        where s.id = observations.student_id and c.teacher_id = (select auth.uid())))
    )
  )
  with check (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
  );
