# Assistente de apresentação com IA

Dentro da sala ao vivo, o mentor pede em português e a IA cria ou muda os slides. Quando ele clica em **Apresentar para todos**, os slides aparecem em destaque no palco de todos os participantes, sincronizados pelo LiveKit.

## Como usar (mentor)

1. Na sala, abra **Mais › Assistente de apresentação** (ou a aba **Slides** do painel lateral).
2. Escreva ou dite o pedido (botão do microfone). Exemplos:
   - “Crie 6 slides sobre negociação”
   - “Transforme o que foi falado até agora em slides” (usa as legendas ao vivo)
   - “Monte um slide com o resultado da última enquete”
   - “Mude o título deste slide para Negociar é ouvir”, “Deixe este slide mais curto”, “Remova o slide 3”, “Mova este slide para o fim”
3. Confira na prévia. **Desfazer** e **Refazer** voltam e avançam entre as versões.
4. **Apresentar para todos** coloca o slide em destaque no palco. Troque de slide pelas setas do teclado (← →, PageUp/PageDown) ou pelos botões no próprio slide. Se alguém compartilhar a tela, a apresentação continua em destaque e a tela vai para a coluna lateral.
5. **Baixar PDF** gera um slide por página (16:9) pela janela de impressão do navegador.

Os alunos só veem os slides. As **notas do mentor** (dicas de fala geradas pela IA) ficam só no painel dele e não são enviadas para a sala.

A apresentação fica salva no navegador do mentor por sala. Com o Supabase ligado, cada versão também vai para `presentation_versions`, e o assistente recupera a última ao entrar.

## Layouts

`capa`, `topicos`, `duas-colunas`, `numero`, `citacao`, `grafico`, `passos`, `encerramento`. Todos usam a identidade NOIR (Oswald, DM Sans, preto e branco) e escalam com a tela. A IA só preenche dados; quem desenha é o próprio site, então nenhum HTML vindo da IA é executado.

## Modo demonstração

Sem `assistenteUrl` em `config.js`, o assistente roda localmente com um motor de demonstração: entende pedidos simples (criar N slides sobre um tema, transformar falas e enquetes em slides, mudar título, encurtar, remover, mover, adicionar). O conteúdo é de exemplo. Com o motor de IA ligado, o texto é escrito sob medida.

## Ligar o motor de IA

1. Aplique a migração `supabase/migrations/0004_assistente_ia.sql`.
2. Configure os segredos:
   ```bash
   supabase secrets set \
     ANTHROPIC_API_KEY=sk-ant-… \
     ASSISTENTE_MODELO=claude-sonnet-5-5 \
     IA_MOTOR=claude
   ```
3. Publique a função: `supabase functions deploy assistente-ia --no-verify-jwt`
4. Em `config.js`, preencha `assistenteUrl: "https://SEU-PROJETO.supabase.co/functions/v1/assistente-ia"`.

A função só atende quem tem o token LiveKit de mentor (administrador) da sala ou de uma sala de networking dela.

## Independência e o motor da Endeavor

O Noir Hub **não está conectado** ao motor de IA da Endeavor Business Solutions e funciona sem ele. O assistente foi dividido em camadas para que essa ligação, quando vier, não exija reconstruir nada:

```
Navegador (assets/sala.js + assets/apresentacao.js)
   │  sempre o mesmo contrato: { acao, sala, instrucao, apresentacao, slideAtual, contexto }
   ▼
Função assistente-ia (Supabase)  ── valida o mentor, limpa o pedido, valida a resposta, salva a versão
   │  escolhe o motor por variável de ambiente
   ├── motores/claude.ts     (ligado hoje)
   └── motores/endeavor.ts   (pronto, desligado)
```

Para trocar de motor, mude só variáveis do servidor:

| Variável | Uso |
| --- | --- |
| `IA_MOTOR` | `claude` (padrão) ou `endeavor` |
| `IA_MOTOR_RESERVA` | motor usado se o principal falhar (ex.: `claude`) |
| `ENDEAVOR_API_URL`, `ENDEAVOR_API_KEY` | endpoint e chave da Endeavor |
| `ENDEAVOR_TIMEOUT_MS` | tempo máximo de resposta (padrão 60000) |

O contrato que a API da Endeavor precisa cumprir está em **[CONTRATO-MOTOR-IA.md](CONTRATO-MOTOR-IA.md)**.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `assets/apresentacao.js` | Formato, validação, desenho dos slides, motor de demonstração e cliente do servidor |
| `assets/apresentacao.css` | Visual dos 8 layouts |
| `assets/sala.js` | Aba Slides, apresentação no palco e sincronização (text stream `noir-apres`) |
| `supabase/functions/assistente-ia/` | Função e motores |
| `supabase/functions/_shared/apresentacao.ts` | Mesma validação do navegador, do lado do servidor |
| `supabase/migrations/0004_assistente_ia.sql` | Histórico de versões |
| `testes/paridade-validacao.ts` | Garante que navegador e servidor validam igual |

## Testes feitos

- Navegador (modo demonstração): criar, editar, desfazer/refazer, apresentar para todos, setas, apresentação junto com tela compartilhada, PDF, salvar e recuperar; aluno recebendo e acompanhando a troca de slide; celular. Sem erros no console.
- Função `assistente-ia` com servidores simulados do Claude e da Endeavor: 15 cenários (permissões, erros, resposta fora do contrato, apresentação inválida, 429, tempo esgotado, reserva).
- Paridade da validação: 413 casos, nenhuma diferença.

Ainda falta testar com um projeto LiveKit real (sincronização entre várias pessoas) e com uma chave válida da Anthropic.
