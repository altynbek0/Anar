-- Baseline schema for the Spano clone (snapshot of the previous DB structure + RLS hardening).
-- Replaces the legacy migrations in ./_legacy (not applied).

create extension if not exists "uuid-ossp" with schema extensions;

-- ───────────── Tables ─────────────

create table public.schools (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  school_year integer not null default 2026,
  logo_url text
);

create table public.users (
  id uuid primary key references auth.users(id),
  school_id uuid not null references public.schools(id),
  role text not null check (role in ('admin','deputy','teacher','class_teacher','psychologist','nurse','security','manager')),
  full_name text not null,
  email text not null,
  avatar_url text,
  created_at timestamptz default now(),
  class_id uuid
);

create table public.classes (
  id uuid primary key default extensions.uuid_generate_v4(),
  school_id uuid not null references public.schools(id),
  name text not null,
  teacher_id uuid references public.users(id),
  year integer not null default extract(year from now()),
  created_at timestamptz default now(),
  grade integer,
  letter text,
  type text
);

alter table public.users add constraint users_class_id_fkey foreign key (class_id) references public.classes(id);

create table public.students (
  id uuid primary key default extensions.uuid_generate_v4(),
  school_id uuid not null references public.schools(id),
  class_id uuid references public.classes(id),
  full_name text not null,
  photo_url text,
  status text not null default 'active' check (status in ('active','inactive','departed')),
  risk_level text not null default 'none' check (risk_level in ('none','medium','high')),
  goals jsonb default '[]'::jsonb,
  parent_name text,
  parent_phone text,
  created_at timestamptz default now(),
  departure_reason text,
  family_situation text,
  health_status text,
  dream text,
  parent_goal text,
  enrollment_year text
);

create table public.observations (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.students(id),
  author_id uuid not null references public.users(id),
  category text not null check (category in ('academic','behavior','psychology','sport','creative','social','health')),
  content text not null,
  is_alert boolean default false,
  created_at timestamptz default now(),
  source text not null default 'manual' check (source in ('manual','questionnaire'))
);

create table public.observation_reactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  observation_id uuid not null references public.observations(id),
  user_id uuid not null references public.users(id),
  emoji text not null check (emoji in ('thumbs_up','thumbs_down','laugh','sad','angry','surprised','clap')),
  created_at timestamptz default now()
);

create table public.ai_insights (
  id uuid primary key default extensions.uuid_generate_v4(),
  school_id uuid not null references public.schools(id),
  student_id uuid references public.students(id),
  generated_at timestamptz default now(),
  overview text,
  interests text,
  academic text,
  extracurricular text,
  achievements text,
  psychology text
);

create table public.ai_insight_versions (
  id uuid primary key default extensions.uuid_generate_v4(),
  student_id uuid not null references public.students(id),
  school_id uuid not null references public.schools(id),
  section text not null,
  content text not null,
  created_at timestamptz default now()
);

create table public.school_ai_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  month date not null,
  climate text,
  at_risk_classes text,
  trends text,
  recommendations text,
  generated_at timestamptz default now()
);

create table public.assistant_usage (
  school_id uuid not null references public.schools(id),
  usage_date date not null,
  count integer not null default 0,
  primary key (school_id, usage_date)
);

-- ───────────── Indexes ─────────────

create index ai_insight_versions_lookup on public.ai_insight_versions (student_id, section, created_at);
create index ai_insights_school_id_idx on public.ai_insights (school_id);
create unique index ai_insights_student_id_unique on public.ai_insights (student_id);
create index classes_school_id_idx on public.classes (school_id);
create index observation_reactions_observation_id_idx on public.observation_reactions (observation_id);
create unique index observation_reactions_observation_id_user_id_key on public.observation_reactions (observation_id, user_id);
create index observations_author_id_idx on public.observations (author_id);
create index observations_created_at_idx on public.observations (created_at desc);
create index observations_student_id_idx on public.observations (student_id);
create unique index school_ai_reports_school_id_month_key on public.school_ai_reports (school_id, month);
create index students_class_id_idx on public.students (class_id);
create index students_risk_level_idx on public.students (risk_level);
create index students_school_id_idx on public.students (school_id);
create index users_school_id_idx on public.users (school_id);
create index users_class_id_idx on public.users (class_id);
create index classes_teacher_id_idx on public.classes (teacher_id);
create index observation_reactions_user_id_idx on public.observation_reactions (user_id);
create index ai_insight_versions_school_id_idx on public.ai_insight_versions (school_id);
create index school_ai_reports_school_id_idx on public.school_ai_reports (school_id);

-- ───────────── Helper functions ─────────────

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.get_my_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.users where id = auth.uid()
$$;

-- ───────────── RPC (school is verified against the caller) ─────────────

create or replace function public.get_observation_counts_by_author(p_school_id uuid)
returns table(author_id uuid, observation_count bigint)
language sql security definer set search_path = public as $$
  select o.author_id, count(*) as observation_count
  from public.observations o
  join public.students s on s.id = o.student_id
  where s.school_id = p_school_id
    and p_school_id = public.get_my_school_id()
  group by o.author_id
$$;

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
  limit 20;
$$;

create or replace function public.increment_assistant_usage(p_school_id uuid, p_limit integer)
returns table(allowed boolean, used integer, remaining integer)
language plpgsql security definer set search_path = public as $$
declare
  v_date date := (now() at time zone 'Asia/Bishkek')::date;
  v_count int;
begin
  if p_school_id is distinct from public.get_my_school_id() then
    raise exception 'forbidden';
  end if;

  insert into public.assistant_usage(school_id, usage_date, count)
  values (p_school_id, v_date, 0)
  on conflict (school_id, usage_date) do nothing;

  select count into v_count from public.assistant_usage
  where school_id = p_school_id and usage_date = v_date
  for update;

  if v_count >= p_limit then
    allowed := false; used := v_count; remaining := 0;
    return next;
  else
    update public.assistant_usage set count = count + 1
    where school_id = p_school_id and usage_date = v_date
    returning count into v_count;
    allowed := true; used := v_count; remaining := greatest(p_limit - v_count, 0);
    return next;
  end if;
end;
$$;

-- Called only through the service-role client (see app/(dashboard)/actions/school.ts).
create or replace function public.increment_class_grades(p_school_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.classes
  set grade = grade + 1,
      name = (grade + 1)::text || coalesce(letter, '')
  where school_id = p_school_id and grade is not null;
end;
$$;

create or replace function public.decrement_class_grades(p_school_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.classes
  set grade = greatest(1, grade - 1),
      name = greatest(1, grade - 1)::text || coalesce(letter, '')
  where school_id = p_school_id and grade is not null;
end;
$$;

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.increment_class_grades(uuid), public.decrement_class_grades(uuid) from authenticated;
grant execute on function public.get_my_role(), public.get_my_school_id(),
  public.get_observation_counts_by_author(uuid), public.get_students_no_recent_obs(uuid),
  public.increment_assistant_usage(uuid, integer) to authenticated;

-- ───────────── Privilege-escalation guard on users ─────────────
-- Only an admin may create/modify admins; a manager may not promote anyone to admin.
-- Service-role calls (auth.uid() is null) are unrestricted.

create or replace function public.guard_user_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.get_my_role() = 'admin' then
    return new;
  end if;
  if new.role = 'admin' then
    raise exception 'only an admin can assign the admin role';
  end if;
  if tg_op = 'UPDATE' and old.role = 'admin' then
    raise exception 'only an admin can modify an admin';
  end if;
  return new;
end;
$$;

create trigger users_guard_roles before insert or update on public.users
  for each row execute function public.guard_user_roles();

-- ───────────── RLS ─────────────

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.observations enable row level security;
alter table public.observation_reactions enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_insight_versions enable row level security;
alter table public.school_ai_reports enable row level security;
alter table public.assistant_usage enable row level security;

-- schools
create policy "users see own school" on public.schools for select to authenticated
  using (id = public.get_my_school_id());
create policy "admin can update own school" on public.schools for update to authenticated
  using (id = public.get_my_school_id() and public.get_my_role() = 'admin')
  with check (id = public.get_my_school_id());

-- users
create policy "users see staff in same school" on public.users for select to authenticated
  using (school_id = public.get_my_school_id());
create policy "admin and manager can insert users" on public.users for insert to authenticated
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','manager'));
create policy "admin and manager can update users" on public.users for update to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','manager'))
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','manager'));
create policy "admin can delete users" on public.users for delete to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() = 'admin');

-- classes
create policy "staff see classes in same school" on public.classes for select to authenticated
  using (school_id = public.get_my_school_id());
create policy "admin and deputy can manage classes" on public.classes for all to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'))
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'));

-- students
create policy "staff see students in same school" on public.students for select to authenticated
  using (school_id = public.get_my_school_id());
create policy "staff can insert students" on public.students for insert to authenticated
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy','manager'));
create policy "staff can update students" on public.students for update to authenticated
  using (school_id = public.get_my_school_id())
  with check (school_id = public.get_my_school_id()
    and public.get_my_role() in ('admin','deputy','teacher','class_teacher','psychologist','manager'));
create policy "admin can delete students" on public.students for delete to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'));

-- observations
create policy "staff see observations in same school" on public.observations for select to authenticated
  using (exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id()));
create policy "staff can add observations" on public.observations for insert to authenticated
  with check (author_id = auth.uid()
    and exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id()));
create policy "author or admin can update observation" on public.observations for update to authenticated
  using (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
    and (
      author_id = auth.uid()
      or public.get_my_role() in ('admin','deputy','manager')
      or (public.get_my_role() = 'class_teacher' and exists (
        select 1 from public.students s join public.users u on u.id = auth.uid()
        where s.id = observations.student_id and s.class_id = u.class_id))
    )
  )
  with check (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
  );
create policy "author can delete own observations" on public.observations for delete to authenticated
  using (author_id = auth.uid());

-- observation_reactions
create policy "staff see reactions in same school" on public.observation_reactions for select to authenticated
  using (exists (
    select 1 from public.observations o join public.students s on s.id = o.student_id
    where o.id = observation_reactions.observation_id and s.school_id = public.get_my_school_id()));
create policy "user adds own reaction" on public.observation_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.observations o join public.students s on s.id = o.student_id
    where o.id = observation_reactions.observation_id and s.school_id = public.get_my_school_id()));
create policy "user removes own reaction" on public.observation_reactions for delete to authenticated
  using (user_id = auth.uid());

-- AI tables: read-only for staff; writes go through the service-role client.
create policy "staff see ai insights" on public.ai_insights for select to authenticated
  using (school_id = public.get_my_school_id());
create policy "staff see ai versions" on public.ai_insight_versions for select to authenticated
  using (school_id = public.get_my_school_id());
create policy "staff see own school reports" on public.school_ai_reports for select to authenticated
  using (school_id = public.get_my_school_id());
-- assistant_usage: no policies; accessed only via increment_assistant_usage().

-- ───────────── Storage ─────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Anyone can view avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "Users can upload their own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "Users can update their own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "Users can delete their own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (auth.uid())::text = (storage.foldername(name))[1]);

-- Student photos: students/<student_id>.<ext> (student must belong to the caller's school).
-- School logos: schools/<school_id>.<ext> (admin of that school).
create policy "Staff can upload student photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and exists (
    select 1 from public.students s
    where s.school_id = public.get_my_school_id() and name like 'students/' || s.id::text || '.%'));
create policy "Staff can update student photos" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and exists (
    select 1 from public.students s
    where s.school_id = public.get_my_school_id() and name like 'students/' || s.id::text || '.%'));
create policy "School logo upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.get_my_role() = 'admin'
    and name like 'schools/' || public.get_my_school_id()::text || '.%');
create policy "School logo update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.get_my_role() = 'admin'
    and name like 'schools/' || public.get_my_school_id()::text || '.%');
