-- Noir Hub: histórico das apresentações feitas com o assistente de IA
create table if not exists presentation_versions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  instruction text,
  content jsonb not null,          -- formato noir.apresentacao v1
  engine text,                     -- motor que respondeu: claude, endeavor
  message text,
  created_at timestamptz default now()
);
create index if not exists presentation_versions_room on presentation_versions (room_name, created_at desc);

alter table presentation_versions enable row level security;
create policy "admin gerencia apresentações" on presentation_versions for all using (is_admin());
