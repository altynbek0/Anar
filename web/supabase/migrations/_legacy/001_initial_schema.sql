-- =============================================
-- 001: Initial Schema
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- SCHOOLS
-- =============================================
create table schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- =============================================
-- USERS (staff profiles linked to auth.users)
-- =============================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  role text not null check (role in (
    'admin', 'deputy', 'teacher', 'class_teacher',
    'psychologist', 'nurse', 'security', 'manager'
  )),
  full_name text not null,
  email text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- =============================================
-- CLASSES
-- =============================================
create table classes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  teacher_id uuid references users(id) on delete set null,
  year int not null default extract(year from now()),
  created_at timestamptz default now()
);

-- =============================================
-- STUDENTS
-- =============================================
create table students (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  full_name text not null,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  risk_level text not null default 'none' check (risk_level in ('none', 'medium', 'high')),
  goals jsonb default '[]',
  parent_name text,
  parent_phone text,
  created_at timestamptz default now()
);

-- =============================================
-- OBSERVATIONS
-- =============================================
create table observations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  category text not null check (category in (
    'academic', 'behavior', 'psychology', 'sport', 'creative', 'social'
  )),
  content text not null,
  is_alert boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- STUDENT INTERESTS
-- =============================================
create table student_interests (
  student_id uuid primary key references students(id) on delete cascade,
  hobbies jsonb default '[]',
  sports jsonb default '[]',
  subjects jsonb default '[]',
  updated_at timestamptz default now()
);

-- =============================================
-- AI INSIGHTS (cached)
-- =============================================
create table ai_insights (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  content jsonb not null default '{}',
  generated_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index on users(school_id);
create index on classes(school_id);
create index on students(school_id);
create index on students(class_id);
create index on students(risk_level);
create index on observations(student_id);
create index on observations(author_id);
create index on observations(created_at desc);
create index on ai_insights(school_id);
create index on ai_insights(student_id);
