-- =============================================
-- 006: История версий ИИ-сводок (по всем разделам, кроме «Обзора»)
-- =============================================

-- Append-only: каждое изменение раздела добавляет строку. «Обзор» не сохраняем.
create table if not exists ai_insight_versions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  section text not null,  -- имя колонки ai_insights: interests/academic/extracurricular/achievements/psychology
  content text not null,
  created_at timestamptz default now()
);
create index if not exists ai_insight_versions_lookup
  on ai_insight_versions(student_id, section, created_at);

-- RLS: чтение для сотрудников своей школы. Запись — через service role (минует RLS).
alter table ai_insight_versions enable row level security;

create policy "staff see ai versions"
  on ai_insight_versions for select
  using (school_id = get_my_school_id());
