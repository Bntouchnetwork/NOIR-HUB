# Prompt mestre: Noir Hub

Você é um engenheiro full-stack sênior e designer de produto. Construa a **Noir Hub**, plataforma profissional de educação em comunicação tendo **Léo Figueiredo** como mentor. Tudo em português do Brasil, responsivo (celular, tablet, desktop), visual premium e escuro, coerente com o nome Noir.

## Página pública
Hero com a proposta de valor da mentoria; biografia do mentor; três formatos com carrinho (Curso ao vivo, Curso gravado, Mentoria individual); como funciona; diretório público de alunos; dúvidas frequentes; botão "Entrar" com menu Aluno / Administrador.

## Pagamento
Stripe Checkout para os três produtos. O webhook `checkout.session.completed` cria a matrícula, libera o acesso e dispara boas-vindas por e-mail e WhatsApp. O aceite dos termos (incluindo gravação das lives) é registrado na matrícula.

## Área do aluno
Login; painel com progresso; curso gravado com aulas sequenciais (a aula N só libera após concluir a N−1); aulas ao vivo com botão de entrada na sala; certificado em PDF ao concluir 100%; perfil público (nome, profissão, o que faz, links, opção de aparecer no diretório); comunidade com busca para networking.

## Área do administrador
Criar curso ao vivo com calendário (data, frequência, número de aulas, gravação automática, lembretes); criar curso gravado com módulos e upload de vídeo; sala ao vivo com LiveKit (vídeo bidirecional, tela, chat, mão levantada, gravação); ferramenta **Live para gravado**, que junta gravações, corta trechos de alunos, divide em módulos e cria um novo curso gravado como rascunho; gestão de alunos e pagamentos; comunicados por e-mail e WhatsApp; edição da página do mentor.

## Dados
Supabase (Postgres, Auth, Storage, RLS). Esquema em `supabase/migrations/0001_schema.sql`.
