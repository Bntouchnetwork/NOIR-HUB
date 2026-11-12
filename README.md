# Noir Hub

Plataforma de educação em comunicação com mentoria de **Léo Figueiredo**: cursos ao vivo, curso gravado com acesso vitalício e mentoria individual.

## Ver online

**https://bntouchnetwork.github.io/NOIR-HUB/**

A página inicial é a landing page de vendas. Clique em **Entrar** e escolha **Área do aluno** ou **Área do administrador**. No protótipo, qualquer e-mail e senha entram.

### Ativar o GitHub Pages (uma vez)
1. No repositório, abra **Settings › Pages**.
2. Em **Build and deployment › Source**, escolha **GitHub Actions**.
3. Pronto: a cada push na branch `main`, o workflow `.github/workflows/pages.yml` publica o site.

## O que já está pronto (fase 1)

`index.html` é o protótipo navegável completo, em português e responsivo (celular, tablet e computador). Abra no navegador ou publique no GitHub Pages.

- **Página de vendas:** apresentação, os três formatos com carrinho, biografia do mentor, como funciona, diretório público de alunos e dúvidas frequentes.
- **Login:** botão "Entrar" com menu para Área do aluno ou Área do administrador.
- **Carrinho:** nome, e-mail, WhatsApp e aceite dos termos (inclui gravação das lives). Botão de pagamento pronto para a Stripe.
- **Área do aluno:** início, trilha gravada com desbloqueio sequencial, aulas ao vivo, certificado, comunidade com busca e perfil público.
- **Área do administrador:** visão geral, cursos, novo curso ao vivo (gera as datas no calendário), novo curso gravado com upload de vídeo, sala ao vivo com gravação, ferramenta "Live para gravado", alunos, comunicados por e-mail/WhatsApp e edição da página do mentor.

No protótipo os dados são de exemplo e ficam na memória da página. A fase 2 liga tudo ao Supabase.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Next.js + Tailwind (migração do protótipo) |
| Banco, login e arquivos | Supabase (Postgres, Auth, Storage, RLS) |
| Pagamentos | Stripe Checkout + webhooks |
| E-mail | Resend |
| WhatsApp | WhatsApp Business Cloud API |
| Vídeo ao vivo | Mesmo provedor usado na Aurotech |
| Hospedagem | Vercel |

## Estrutura do repositório

```
noir-hub/
├── index.html                     # landing page + login + áreas (GitHub Pages)
├── 404.html                       # redireciona para a página inicial
├── .nojekyll
├── .github/workflows/pages.yml    # deploy automático no GitHub Pages
├── docs/
│   ├── PROMPT.md                  # prompt mestre do produto
│   ├── ARQUITETURA.md             # fluxos, regras de negócio e integrações
│   └── ROADMAP.md                 # fases de desenvolvimento
├── supabase/migrations/
│   └── 0001_schema.sql            # tabelas, RLS e funções
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
