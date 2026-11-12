# Arquitetura e regras de negócio

## Fluxo de compra
1. Visitante escolhe o formato e preenche nome, e-mail, WhatsApp e aceite dos termos.
2. Front chama `/api/checkout`, que cria a Stripe Checkout Session com `metadata.course_id` e `metadata.user_email`.
3. Stripe envia `checkout.session.completed` para `/api/webhooks/stripe`.
4. O webhook cria ou localiza o usuário no Supabase Auth e grava `enrollments` com `status = 'active'` e `terms_accepted_at`.
5. Dispara e-mail (Resend) e WhatsApp (Cloud API) com o link de acesso.

## Trilha sequencial
- `lessons.position` define a ordem dentro do curso.
- `can_access_lesson(user, lesson)` é verdadeira se for a primeira aula ou se a anterior estiver em `lesson_progress`.
- A URL do vídeo só é assinada (signed URL do Storage) se a função permitir.

## Certificado
Quando o aluno conclui todas as aulas do curso, um trigger cria o registro em `certificates`. O PDF é gerado por uma Edge Function e salvo no Storage.

## Aulas ao vivo e gravação
- `live_sessions` guarda início, fim, link da sala e `record = true`.
- Vídeo pelo LiveKit. `livekit-token` libera o acesso, o mentor grava pela `livekit-admin` (Egress em MP4 no Storage) e `livekit-webhook` salva a gravação pronta em `recordings`. Detalhes em `docs/LIVEKIT.md`.
- **Consentimento:** a sala não mostra aviso de gravação; o consentimento vem do aceite dos termos na matrícula (`enrollments.terms_accepted_at`). Valide o texto dos termos com um advogado (LGPD e leis de consentimento de gravação nos EUA).

## Live para gravado
1. Admin seleciona gravações (`recordings`) ou envia um vídeo.
2. Uma Edge Function cria um job em `compile_jobs`.
3. Um worker (FFmpeg + transcrição) junta, corta trechos com alunos, divide em capítulos e gera títulos.
4. Cria `courses` com `type = 'recorded'` e `status = 'draft'`, e as `lessons` correspondentes.
5. Admin revisa e publica.

## Lembretes
Função agendada no Supabase envia e-mail e WhatsApp 24h e 1h antes de cada `live_sessions.starts_at`.

## Papéis
`profiles.role` = `student` ou `admin`. RLS libera tudo para admin; alunos veem só os próprios dados e os perfis públicos.
