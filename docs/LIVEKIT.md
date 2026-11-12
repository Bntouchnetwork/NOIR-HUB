# Sala ao vivo com LiveKit

A sala dos encontros usa o [LiveKit](https://livekit.io): vídeo e áudio em tempo real, compartilhamento de tela, chat e gravação.

Sem configuração, a sala abre em **modo demonstração**: câmera, microfone e tela funcionam de verdade, e os outros participantes são simulados. Siga os passos abaixo para fazer encontros reais.

## O que tem na sala

| Recurso | Aluno | Mentor |
| --- | --- | --- |
| Pré-sala com teste de câmera, microfone e escolha de dispositivo | ✓ | ✓ |
| Vídeo em grade que se ajusta ao número de pessoas, com destaque de quem fala | ✓ | ✓ |
| Compartilhar a tela (vira destaque para todos) | ✓ | ✓ |
| Chat e levantar a mão | ✓ | ✓ |
| Lista de participantes | ✓ | ✓ |
| Abaixar a mão, silenciar e remover participantes | | ✓ |
| Gravar e parar a gravação | | ✓ |
| Encerrar o encontro para todos | | ✓ |

A gravação não mostra aviso aos alunos na sala do Noir Hub. O consentimento vem dos termos aceitos na inscrição (`enrollments.terms_accepted_at`). Valide o texto dos termos com um advogado (LGPD e leis de consentimento de gravação nos EUA).

## Como as peças se ligam

```
Navegador (sala.js)
  ├─ POST livekit-token ──> Supabase Function ──> devolve o token LiveKit
  ├─ conecta no LiveKit com o token (vídeo, áudio, tela, chat)
  └─ mentor: POST livekit-admin (gravar, silenciar, remover, encerrar)
                                  └─> API do LiveKit (Egress grava em MP4 no Storage)
LiveKit ── webhook egress_ended ──> livekit-webhook ──> tabela recordings
                                                        └─> admin › Live para gravado
```

O API secret do LiveKit fica só no Supabase. O navegador recebe apenas tokens de 4 horas, presos a uma sala.

## Passo a passo

### 1. Projeto no LiveKit Cloud
1. Crie uma conta em cloud.livekit.io e um projeto (ex.: `noir-hub`).
2. Em **Settings › Keys**, crie uma chave. Guarde a **URL** (`wss://noir-hub-xxxx.livekit.cloud`), o **API key** e o **API secret**.

### 2. Banco
Aplique as migrações `supabase/migrations/0001_schema.sql` e `0002_livekit.sql`. Cada encontro em `live_sessions` recebe um `room_name` (ex.: `noir-encontro-5`), que é o nome da sala no LiveKit.

### 3. Bucket das gravações
No Supabase Storage, crie um bucket **privado** `gravacoes`. Em **Storage › Settings › S3 Connection**, gere um par de chaves de acesso e anote o endpoint e a região.

### 4. Segredos das funções
```bash
supabase secrets set \
  LIVEKIT_URL=wss://noir-hub-xxxx.livekit.cloud \
  LIVEKIT_API_KEY=APIxxxx \
  LIVEKIT_API_SECRET=xxxx \
  MENTOR_CODIGO=um-codigo-forte \
  GRAVACAO_S3_ENDPOINT=https://SEU-PROJETO.supabase.co/storage/v1/s3 \
  GRAVACAO_S3_REGIAO=us-east-1 \
  GRAVACAO_S3_BUCKET=gravacoes \
  GRAVACAO_S3_ACCESS_KEY=xxxx \
  GRAVACAO_S3_SECRET=xxxx \
  ORIGENS_PERMITIDAS=https://bntouchnetwork.github.io
```
`MENTOR_CODIGO` é o código que o Léo digita na pré-sala enquanto o login real não existe. Quando o login do Supabase estiver ligado, o admin (`profiles.role = 'admin'`) entra direto como mentor.

Só para testes, `PERMITIR_ALUNO_SEM_LOGIN=true` deixa qualquer pessoa entrar como aluno. Remova antes de abrir para o público.

### 5. Publicar as funções
```bash
supabase functions deploy livekit-token --no-verify-jwt
supabase functions deploy livekit-admin --no-verify-jwt
supabase functions deploy livekit-webhook --no-verify-jwt
```
(`supabase/config.toml` já marca as três com `verify_jwt = false`; cada uma faz a própria checagem.)

### 6. Webhook no LiveKit
Em **Settings › Webhooks** do LiveKit Cloud, adicione `https://SEU-PROJETO.supabase.co/functions/v1/livekit-webhook`.

### 7. Ligar o site
Preencha `config.js` na raiz do repositório e faça o push:
```js
window.NOIR_CONFIG = {
  livekitUrl: "wss://noir-hub-xxxx.livekit.cloud",
  tokenUrl: "https://SEU-PROJETO.supabase.co/functions/v1/livekit-token",
  adminUrl: "https://SEU-PROJETO.supabase.co/functions/v1/livekit-admin",
  supabaseAnonKey: "chave anon do Supabase"
};
```
Pronto: no admin, **Sala ao vivo** passa a mostrar “LiveKit conectado”.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `assets/sala.js`, `assets/sala.css` | Sala ao vivo (pré-sala, grade, controles, chat, participantes) |
| `assets/vendor/livekit-client.umd.js` | SDK oficial `livekit-client` 2.23.0, carregado só ao entrar na sala |
| `config.js` | Endereços do LiveKit e das funções |
| `supabase/functions/livekit-token` | Libera o acesso (aluno matriculado ou mentor) |
| `supabase/functions/livekit-admin` | Gravar, parar, silenciar, remover, encerrar |
| `supabase/functions/livekit-webhook` | Salva a gravação pronta em `recordings` |

## O que já foi testado

- Sala em modo demonstração, no Chrome com câmera e microfone simulados: pré-sala, grade, destaque de quem fala, tela compartilhada, chat, mão levantada, silenciar, remover, gravar, encerrar, celular.
- Caminho real até a conexão: o SDK carrega, o erro de acesso aparece em português e a falha de conexão é tratada.
- Funções rodando localmente com Deno: tokens corretos para aluno e mentor, bloqueios de acesso, validação da sala, ações do mentor restritas à própria sala, webhook recusando avisos sem assinatura.

Ainda falta testar com um projeto LiveKit real: conexão de várias pessoas, gravação gerando o MP4 no Storage e webhook gravando em `recordings`.
