-- Follow-up to the baseline, driven by Supabase advisors.

revoke execute on function public.guard_user_roles() from public, anon, authenticated;

drop policy "author can delete own observations" on public.observations;
create policy "author can delete own observations" on public.observations for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy "staff can add observations" on public.observations;
create policy "staff can add observations" on public.observations for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id()));

drop policy "author or admin can update observation" on public.observations;
create policy "author or admin can update observation" on public.observations for update to authenticated
  using (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
    and (
      author_id = (select auth.uid())
      or public.get_my_role() in ('admin','deputy','manager')
      or (public.get_my_role() = 'class_teacher' and exists (
        select 1 from public.students s join public.users u on u.id = (select auth.uid())
        where s.id = observations.student_id and s.class_id = u.class_id))
    )
  )
  with check (
    exists (select 1 from public.students s where s.id = observations.student_id and s.school_id = public.get_my_school_id())
  );

drop policy "user adds own reaction" on public.observation_reactions;
create policy "user adds own reaction" on public.observation_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.observations o join public.students s on s.id = o.student_id
    where o.id = observation_reactions.observation_id and s.school_id = public.get_my_school_id()));

drop policy "user removes own reaction" on public.observation_reactions;
create policy "user removes own reaction" on public.observation_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy "admin and deputy can manage classes" on public.classes;
create policy "admin and deputy can insert classes" on public.classes for insert to authenticated
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'));
create policy "admin and deputy can update classes" on public.classes for update to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'))
  with check (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'));
create policy "admin and deputy can delete classes" on public.classes for delete to authenticated
  using (school_id = public.get_my_school_id() and public.get_my_role() in ('admin','deputy'));
