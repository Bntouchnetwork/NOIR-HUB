# Noir Hub · Projeto N.O.I.R.

Plataforma do **Projeto N.O.I.R.** (Network Orientado por Indicadores e Resultados), mentoria de **Léo Figueiredo** pela MDC Mentoria em Comunicação: turma ao vivo de 6 meses com 12 encontros, versão gravada com acesso vitalício e mentoria individual.

## Ver online

**https://bntouchnetwork.github.io/NOIR-HUB/**

A página inicial é a landing page de vendas. Clique em **Entrar** e escolha **Área do aluno** ou **Área do administrador**. No protótipo, qualquer e-mail e senha entram.

### Ativar o GitHub Pages (uma vez)
1. No repositório, abra **Settings › Pages**.
2. Em **Build and deployment › Source**, escolha **GitHub Actions**.
3. Pronto: a cada push na branch `main`, o workflow `.github/workflows/pages.yml` publica o site.

## O que já está pronto (fase 1)

`index.html` é o protótipo navegável completo, em português e responsivo (celular, tablet e computador). Abra no navegador ou publique no GitHub Pages.

- **Página de vendas** (conteúdo da apresentação *Projeto Noir · Poder do Network Orlando 2025*): o que o projeto faz por você, missão e valores, o que o torna único, como funciona (6 meses, 12 encontros), os 8 módulos, recursos exclusivos, conexões estratégicas com 6 especialistas, por que participar, investimento de US$ 999 (exclusivo para participantes do Poder do Network Orlando 2025), comunidade, dúvidas e contato (WhatsApp, Instagram e site da MDC). Inclui o vídeo do YouTube do projeto.
- **Login:** botão "Entrar" com menu para Área do aluno ou Área do administrador.
- **Inscrição:** turma ao vivo vai para o checkout (pronto para a Stripe); versão gravada abre lista de espera; mentoria individual pede proposta.
- **Área do aluno:** início, os 8 módulos com desbloqueio sequencial, aulas ao vivo, certificado, comunidade com busca e perfil público.
- **Área do administrador:** visão geral, cursos, novo curso ao vivo (gera as datas no calendário), novo curso gravado com upload de vídeo, sala ao vivo com LiveKit (veja abaixo), ferramenta "Live para gravado", alunos, comunicados por e-mail/WhatsApp e edição da página do mentor.

No protótipo os dados são de exemplo e ficam na memória da página. A fase 2 liga tudo ao Supabase.

## Sala ao vivo (LiveKit)

Encontros com vídeo e áudio em tempo real: pré-sala com teste de câmera e microfone, grade que se ajusta, tela compartilhada, chat, mão levantada e lista de participantes. O mentor também grava, silencia, remove e encerra. No menu **Mais**: fundo desfocado ou NOIR, legendas ao vivo com resumo por IA, enquetes, cronômetro de pitch, salas de networking, transmissão no YouTube e no Instagram e o **assistente de apresentação com IA**, que cria e muda slides ao vivo e os mostra em destaque para a turma ([docs/ASSISTENTE-IA.md](docs/ASSISTENTE-IA.md)). Sem configuração, a sala abre em modo demonstração. Para encontros reais, siga **[docs/LIVEKIT.md](docs/LIVEKIT.md)** e preencha `config.js`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Next.js + Tailwind (migração do protótipo) |
| Banco, login e arquivos | Supabase (Postgres, Auth, Storage, RLS) |
| Pagamentos | Stripe Checkout + webhooks |
| E-mail | Resend |
| WhatsApp | WhatsApp Business Cloud API |
| Vídeo ao vivo | LiveKit (`livekit-client` 2.23 no site, funções no Supabase) |
| Hospedagem | GitHub Pages (fase 1) |

## Estrutura do repositório

```
noir-hub/
├── index.html                     # landing page + login + áreas (GitHub Pages)
├── config.js                      # endereços do LiveKit e das funções
├── assets/sala.js, sala.css       # sala ao vivo
├── assets/vendor/                 # SDK livekit-client
├── assets/img/                    # fotos do Léo, dos especialistas e logo MDC
├── assets/fonts/                  # Oswald, DM Sans e Montserrat (licença OFL)
├── 404.html                       # redireciona para a página inicial
├── .nojekyll
├── .github/workflows/pages.yml    # deploy automático no GitHub Pages
├── docs/
│   ├── PROMPT.md                  # prompt mestre do produto
│   ├── ARQUITETURA.md             # fluxos, regras de negócio e integrações
│   ├── LIVEKIT.md                 # configurar a sala ao vivo
│   ├── ASSISTENTE-IA.md           # assistente de apresentação
│   ├── CONTRATO-MOTOR-IA.md       # contrato para o motor da Endeavor (futuro)
│   └── ROADMAP.md                 # fases de desenvolvimento
├── supabase/migrations/
│   ├── 0001_schema.sql            # tabelas, RLS e funções
│   ├── 0002_livekit.sql           # sala de cada encontro e id da gravação
│   ├── 0003_ferramentas_sala.sql  # resumos dos encontros
│   └── 0004_assistente_ia.sql     # versões das apresentações
├── supabase/functions/            # livekit-token, livekit-admin, livekit-webhook, resumo-encontro, assistente-ia
├── testes/paridade-validacao.ts   # validação igual no navegador e no servidor
├── .env.example
└── .gitignore
```

## Como rodar

```bash
git clone https://github.com/Bntouchnetwork/NOIR-HUB.git
cd NOIR-HUB
open index.html        # ou: python3 -m http.server 8000
```

### Supabase (fase 2)
```bash
supabase link --project-ref <ref>
supabase db push
```
Copie `.env.example` para `.env.local` e preencha as chaves.

## Licença
Uso privado. Todos os direitos reservados a Noir Hub.

## Identidade visual

Preto e branco, como a apresentação do projeto. Títulos em **Oswald**, texto em **DM Sans** e a marca NO/IR em **Montserrat**. As fontes ficam em `assets/fonts`, então o site não depende do Google Fonts.

## Pendências de conteúdo

- Valores da versão gravada e da mentoria individual (hoje aparecem como "Em breve" e "Sob consulta").
- Biografia completa do Léo para a seção do mentor.
- Confirmar o uso das fotos dos especialistas no site.
