-- Noir Hub: ligações com o LiveKit

-- Cada encontro ao vivo tem uma sala no LiveKit (ex.: "noir-encontro-5").
alter table live_sessions add column if not exists room_name text unique;

-- Cada gravação guarda o id do egress do LiveKit, para o webhook não duplicar.
alter table recordings add column if not exists egress_id text unique;

-- Gravações só podem ser lidas por administradores (já coberto pela política
-- "admin gerencia gravações"). O bucket de vídeos deve ser privado; o site
-- usa URLs assinadas do Storage para tocar os vídeos.
