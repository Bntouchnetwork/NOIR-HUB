-- Noir Hub: resumos dos encontros (legendas + IA)
create table if not exists meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  title text,
  summary text not null,
  transcript jsonb default '[]'::jsonb,
  polls jsonb default '[]'::jsonb,
  pitches jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists meeting_summaries_room on meeting_summaries (room_name, created_at desc);

alter table meeting_summaries enable row level security;
create policy "admin gerencia resumos" on meeting_summaries for all using (is_admin());
-- Alunos matriculados leem os resumos dos encontros do seu curso.
create policy "aluno lê resumos do seu curso" on meeting_summaries for select using (
  exists (
    select 1 from live_sessions s join enrollments e on e.course_id = s.course_id
    where s.room_name = meeting_summaries.room_name and e.user_id = auth.uid() and e.status = 'active'
  )
);
