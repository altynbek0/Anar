-- =============================================
-- 004: Observation Reactions (teacher emoji reactions)
-- =============================================

create table observation_reactions (
  id uuid primary key default uuid_generate_v4(),
  observation_id uuid not null references observations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null check (emoji in (
    'thumbs_up', 'thumbs_down', 'laugh', 'sad', 'angry', 'surprised', 'clap'
  )),
  created_at timestamptz default now(),
  -- One reaction per user per observation (picking another emoji replaces it)
  unique (observation_id, user_id)
);

create index on observation_reactions(observation_id);

-- =============================================
-- RLS
-- =============================================
alter table observation_reactions enable row level security;

-- Staff can see reactions on observations within their school
create policy "staff see reactions in same school"
  on observation_reactions for select
  using (
    exists (
      select 1
      from observations o
      join students s on s.id = o.student_id
      where o.id = observation_reactions.observation_id
        and s.school_id = get_my_school_id()
    )
  );

-- A user can add their own reaction to observations within their school
create policy "user adds own reaction"
  on observation_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from observations o
      join students s on s.id = o.student_id
      where o.id = observation_id
        and s.school_id = get_my_school_id()
    )
  );

-- A user can remove their own reaction
create policy "user removes own reaction"
  on observation_reactions for delete
  using (user_id = auth.uid());
