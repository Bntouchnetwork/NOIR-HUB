-- Noir Hub: esquema inicial
create extension if not exists "pgcrypto";

create type user_role as enum ('student','admin');
create type course_type as enum ('live','recorded','mentoring');
create type course_status as enum ('draft','scheduled','published','archived');
create type enrollment_status as enum ('pending','active','canceled','refunded');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  profession text,
  bio text,
  links jsonb default '{}'::jsonb,
  whatsapp text,
  avatar_url text,
  is_public boolean default true,
  role user_role default 'student',
  created_at timestamptz default now()
);

create table mentor_page (
  id int primary key default 1 check (id = 1),
  name text default 'Léo Figueiredo',
  photo_url text,
  bio text,
  signature_quote text,
  updated_at timestamptz default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type course_type not null,
  status course_status default 'draft',
  price_cents int not null default 0,
  stripe_price_id text,
  seats int,
  created_at timestamptz default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses on delete cascade,
  title text not null,
  position int not null
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses on delete cascade,
  module_id uuid references modules on delete set null,
  title text not null,
  position int not null,
  video_path text,
  duration_seconds int,
  unique (course_id, position)
);

create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses on delete cascade,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room_url text,
  record boolean default true
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid references live_sessions on delete set null,
  title text,
  video_path text not null,
  duration_seconds int,
  created_at timestamptz default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  course_id uuid references courses on delete cascade,
  status enrollment_status default 'pending',
  stripe_session_id text unique,
  terms_accepted_at timestamptz not null,
  created_at timestamptz default now(),
  unique (user_id, course_id)
);

create table lesson_progress (
  user_id uuid references profiles on delete cascade,
  lesson_id uuid references lessons on delete cascade,
  completed_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  course_id uuid references courses on delete cascade,
  issued_at timestamptz default now(),
  pdf_path text,
  unique (user_id, course_id)
);

create table compile_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_ids uuid[] not null,
  new_course_title text not null,
  split_mode text default 'per_live',
  remove_student_segments boolean default true,
  status text default 'queued',
  result_course_id uuid references courses on delete set null,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  channel text not null,
  subject text,
  body text not null,
  sent_at timestamptz default now()
);

-- Funções auxiliares
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function can_access_lesson(p_user uuid, p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with l as (select course_id, position from lessons where id = p_lesson)
  select exists (
      select 1 from enrollments e, l
      where e.user_id = p_user and e.course_id = l.course_id and e.status = 'active'
    )
    and (
      (select position from l) = 1
      or exists (
        select 1 from lessons prev, l, lesson_progress lp
        where prev.course_id = l.course_id and prev.position = l.position - 1
          and lp.lesson_id = prev.id and lp.user_id = p_user
      )
    );
$$;

-- Certificado automático ao concluir todas as aulas
create or replace function issue_certificate() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_total int; v_done int;
begin
  select course_id into v_course from lessons where id = new.lesson_id;
  select count(*) into v_total from lessons where course_id = v_course;
  select count(*) into v_done from lesson_progress lp join lessons l on l.id = lp.lesson_id
    where lp.user_id = new.user_id and l.course_id = v_course;
  if v_done = v_total then
    insert into certificates (user_id, course_id) values (new.user_id, v_course)
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger trg_certificate after insert on lesson_progress
for each row execute function issue_certificate();

-- RLS
alter table profiles enable row level security;
alter table mentor_page enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table live_sessions enable row level security;
alter table recordings enable row level security;
alter table enrollments enable row level security;
alter table lesson_progress enable row level security;
alter table certificates enable row level security;
alter table compile_jobs enable row level security;
alter table announcements enable row level security;

create policy "perfis públicos visíveis" on profiles for select using (is_public or id = auth.uid() or is_admin());
create policy "aluno edita o próprio perfil" on profiles for update using (id = auth.uid());
create policy "admin gerencia perfis" on profiles for all using (is_admin());

create policy "página do mentor pública" on mentor_page for select using (true);
create policy "admin edita mentor" on mentor_page for all using (is_admin());

create policy "cursos publicados visíveis" on courses for select using (status in ('published','scheduled') or is_admin());
create policy "admin gerencia cursos" on courses for all using (is_admin());

create policy "módulos visíveis" on modules for select using (true);
create policy "admin gerencia módulos" on modules for all using (is_admin());

create policy "aulas: matriculado vê a lista" on lessons for select using (
  is_admin() or exists (select 1 from enrollments e where e.course_id = lessons.course_id and e.user_id = auth.uid() and e.status = 'active'));
create policy "admin gerencia aulas" on lessons for all using (is_admin());

create policy "lives: matriculado vê" on live_sessions for select using (
  is_admin() or exists (select 1 from enrollments e where e.course_id = live_sessions.course_id and e.user_id = auth.uid() and e.status = 'active'));
create policy "admin gerencia lives" on live_sessions for all using (is_admin());

create policy "admin gerencia gravações" on recordings for all using (is_admin());

create policy "aluno vê as próprias matrículas" on enrollments for select using (user_id = auth.uid() or is_admin());
create policy "admin gerencia matrículas" on enrollments for all using (is_admin());

create policy "aluno vê o próprio progresso" on lesson_progress for select using (user_id = auth.uid() or is_admin());
create policy "aluno conclui aula liberada" on lesson_progress for insert with check (user_id = auth.uid() and can_access_lesson(auth.uid(), lesson_id));

create policy "aluno vê os próprios certificados" on certificates for select using (user_id = auth.uid() or is_admin());

create policy "admin gerencia compilações" on compile_jobs for all using (is_admin());
create policy "admin gerencia comunicados" on announcements for all using (is_admin());

insert into mentor_page (id) values (1) on conflict do nothing;
