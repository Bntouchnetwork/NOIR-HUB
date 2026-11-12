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
| Fundo desfocado ou com a marca NOIR | ✓ | ✓ |
| Ver legendas ao vivo | ✓ | ✓ |
| Votar em enquetes e ver o cronômetro de pitch | ✓ | ✓ |
| Ligar as legendas e gerar o resumo do encontro com IA | | ✓ |
| Lançar enquetes e cronometrar pitches | | ✓ |
| Abrir salas de networking, visitar e chamar todos de volta | | ✓ |
| Transmitir no YouTube e no Instagram | | ✓ |

## Ferramentas (menu “Mais”)

**Fundo da câmera.** Nenhum, desfocado ou a imagem com a marca NOIR (`assets/img/fundo-noir.jpg`). Dá para escolher na pré-sala ou durante o encontro. O recorte da pessoa roda no navegador com o MediaPipe; os arquivos ficam no próprio site (`assets/vendor/mediapipe`, cerca de 10 MB, baixados só quando alguém liga o fundo).

**Legendas ao vivo e resumo.** O mentor liga as legendas para a sala. O navegador de cada participante transcreve a própria fala em português e envia para todos; as legendas aparecem na parte de baixo do vídeo. Funciona no Chrome, no Edge e no Safari. No Firefox a pessoa vê as legendas dos outros, mas a fala dela não é transcrita. No Chrome, o reconhecimento de voz usa o serviço do Google. A transcrição alimenta o **resumo do encontro**: a função `resumo-encontro` envia falas, enquetes e pitches para o Claude e devolve pontos principais, exemplos citados e próximos passos, que o mentor copia ou envia no chat. O resumo fica salvo em `meeting_summaries`.

**Enquetes.** Pergunta com 2 a 4 opções. O mentor escolhe se o resultado aparece para todos durante a votação, pode mostrar o resultado depois e encerrar. O resultado final vai para o chat.

**Cronômetro de pitch.** O mentor escolhe quem apresenta e o tempo (1, 2, 3 ou 5 minutos). Todos veem a contagem; nos últimos 15 segundos ela fica vermelha e um sinal toca no fim. O mentor pode dar +30 segundos ou parar.

**Salas de networking.** O mentor escolhe quantas pessoas por sala e a duração; o sorteio aparece antes de abrir. Cada aluno vai para uma sala LiveKit própria (`<sala>-g1`, `-g2`…) e volta sozinho para a sala principal no fim do tempo. O mentor pode visitar as salas e chamar todos de volta antes (a função `livekit-admin` avisa cada sala). A gravação cobre só a sala principal.

**Transmissão ao vivo.** O mentor informa a chave do YouTube e/ou a URL e a chave do Instagram (Live Producer). O LiveKit envia a sala, com quem está falando em destaque, por RTMP. As chaves são usadas na hora e não ficam salvas. Todos na sala veem o aviso “Ao vivo nas redes”.

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

O API secret do LiveKit e a chave do Claude ficam só no Supabase. O navegador recebe apenas tokens de 4 horas, presos a uma sala.

## Passo a passo

### 1. Projeto no LiveKit Cloud
1. Crie uma conta em cloud.livekit.io e um projeto (ex.: `noir-hub`).
2. Em **Settings › Keys**, crie uma chave. Guarde a **URL** (`wss://noir-hub-xxxx.livekit.cloud`), o **API key** e o **API secret**.

### 2. Banco
Aplique as migrações `supabase/migrations/0001_schema.sql`, `0002_livekit.sql` e `0003_ferramentas_sala.sql`. Cada encontro em `live_sessions` recebe um `room_name` (ex.: `noir-encontro-5`), que é o nome da sala no LiveKit.

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
  ORIGENS_PERMITIDAS=https://bntouchnetwork.github.io \
  ANTHROPIC_API_KEY=sk-ant-… \
  RESUMO_MODELO=claude-sonnet-5-5
```
`MENTOR_CODIGO` é o código que o Léo digita na pré-sala enquanto o login real não existe. Quando o login do Supabase estiver ligado, o admin (`profiles.role = 'admin'`) entra direto como mentor.

Só para testes, `PERMITIR_ALUNO_SEM_LOGIN=true` deixa qualquer pessoa entrar como aluno. Remova antes de abrir para o público.

### 5. Publicar as funções
```bash
supabase functions deploy livekit-token --no-verify-jwt
supabase functions deploy livekit-admin --no-verify-jwt
supabase functions deploy livekit-webhook --no-verify-jwt
supabase functions deploy resumo-encontro --no-verify-jwt
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
  resumoUrl: "https://SEU-PROJETO.supabase.co/functions/v1/resumo-encontro",
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
| `supabase/functions/resumo-encontro` | Resumo do encontro com o Claude |
| `assets/vendor/livekit-fundos.js`, `assets/vendor/mediapipe/` | Fundo desfocado e fundo NOIR |

## O que já foi testado

- Sala em modo demonstração, no Chrome com câmera e microfone simulados: pré-sala, grade, destaque de quem fala, tela compartilhada, chat, mão levantada, silenciar, remover, gravar, encerrar, celular.
- Caminho real até a conexão: o SDK carrega, o erro de acesso aparece em português e a falha de conexão é tratada.
- Funções rodando localmente com Deno: tokens corretos para aluno e mentor, bloqueios de acesso, validação da sala, ações do mentor restritas à própria sala, webhook recusando avisos sem assinatura.

- Ferramentas no modo demonstração, como mentor e como aluno: fundo desfocado e NOIR (recorte real da câmera), legendas, enquete com votos, cronômetro com +30s, salas de networking com visita e retorno, transmissão (aviso para todos) e resumo.
- Funções novas rodando com Deno: chamar de volta as salas de networking, validação dos destinos da transmissão, permissões do resumo e chamada real à API do Claude (recusada por chave de teste, como esperado).

Ainda falta testar com um projeto LiveKit real: conexão de várias pessoas, troca para as salas de networking, gravação e transmissão saindo pelo Egress, webhook gravando em `recordings` e o resumo com uma chave válida do Claude.
