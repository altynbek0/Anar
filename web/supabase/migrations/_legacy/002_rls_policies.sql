-- =============================================
-- 002: Row Level Security Policies
-- =============================================

-- Enable RLS on all tables
alter table schools enable row level security;
alter table users enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table observations enable row level security;
alter table student_interests enable row level security;
alter table ai_insights enable row level security;

-- =============================================
-- HELPER FUNCTION: get current user's school_id and role
-- =============================================
create or replace function get_my_school_id()
returns uuid language sql security definer stable as $$
  select school_id from users where id = auth.uid()
$$;

create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from users where id = auth.uid()
$$;

-- =============================================
-- SCHOOLS: only see your own school
-- =============================================
create policy "users see own school"
  on schools for select
  using (id = get_my_school_id());

-- =============================================
-- USERS: see all staff in same school
-- =============================================
create policy "users see staff in same school"
  on users for select
  using (school_id = get_my_school_id());

create policy "admin and manager can insert users"
  on users for insert
  with check (
    school_id = get_my_school_id()
    and get_my_role() in ('admin', 'manager')
  );

create policy "admin and manager can update users"
  on users for update
  using (school_id = get_my_school_id())
  with check (get_my_role() in ('admin', 'manager'));

create policy "admin can delete users"
  on users for delete
  using (
    school_id = get_my_school_id()
    and get_my_role() = 'admin'
  );

-- =============================================
-- CLASSES: all staff see classes in their school
-- =============================================
create policy "staff see classes in same school"
  on classes for select
  using (school_id = get_my_school_id());

create policy "admin and deputy can manage classes"
  on classes for all
  using (school_id = get_my_school_id())
  with check (get_my_role() in ('admin', 'deputy'));

-- =============================================
-- STUDENTS: all staff see students in their school
-- =============================================
create policy "staff see students in same school"
  on students for select
  using (school_id = get_my_school_id());

create policy "staff can insert students"
  on students for insert
  with check (
    school_id = get_my_school_id()
    and get_my_role() in ('admin', 'deputy', 'manager')
  );

create policy "staff can update students"
  on students for update
  using (school_id = get_my_school_id())
  with check (get_my_role() in ('admin', 'deputy', 'teacher', 'class_teacher', 'psychologist', 'manager'));

create policy "admin can delete students"
  on students for delete
  using (
    school_id = get_my_school_id()
    and get_my_role() in ('admin', 'deputy')
  );

-- =============================================
-- OBSERVATIONS: all staff can see and add
-- =============================================
create policy "staff see observations in same school"
  on observations for select
  using (
    exists (
      select 1 from students s
      where s.id = observations.student_id
      and s.school_id = get_my_school_id()
    )
  );

create policy "staff can add observations"
  on observations for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from students s
      where s.id = student_id
      and s.school_id = get_my_school_id()
    )
  );

create policy "author or admin can update observation"
  on observations for update
  using (
    author_id = auth.uid()
    or get_my_role() in ('admin', 'deputy')
  );

-- =============================================
-- STUDENT INTERESTS: all staff can see
-- =============================================
create policy "staff see student interests"
  on student_interests for select
  using (
    exists (
      select 1 from students s
      where s.id = student_interests.student_id
      and s.school_id = get_my_school_id()
    )
  );

create policy "staff can manage student interests"
  on student_interests for all
  using (
    exists (
      select 1 from students s
      where s.id = student_interests.student_id
      and s.school_id = get_my_school_id()
    )
  );

-- =============================================
-- AI INSIGHTS: all staff can read
-- =============================================
create policy "staff see ai insights"
  on ai_insights for select
  using (school_id = get_my_school_id());

create policy "service role can manage ai insights"
  on ai_insights for all
  using (school_id = get_my_school_id());
