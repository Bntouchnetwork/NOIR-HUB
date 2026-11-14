# Contrato do motor de IA (versão 1)

Este é o contrato que um motor externo, como o da **Endeavor Business Solutions**, precisa cumprir para atender o assistente de apresentação do Noir Hub. **Hoje o Noir Hub não está conectado à Endeavor.** O adaptador já existe em `supabase/functions/assistente-ia/motores/endeavor.ts` e fica desligado até `IA_MOTOR=endeavor`.

Quem chama o motor é sempre a função `assistente-ia` (servidor), nunca o navegador. A chave da Endeavor fica só nos segredos do Supabase.

## Requisição

`POST {ENDEAVOR_API_URL}`

Cabeçalhos:

| Cabeçalho | Valor |
| --- | --- |
| `Authorization` | `Bearer {ENDEAVOR_API_KEY}` |
| `Content-Type` | `application/json` |
| `X-Noir-Contrato` | `1` |
| `X-Noir-Origem` | `noir-hub` |
| `Idempotency-Key` | UUID novo por pedido |

Corpo:

```json
{
  "contrato": 1,
  "tarefa": "apresentacao.editar",
  "pedido": {
    "instrucao": "Mude o título deste slide para Negociar é ouvir",
    "slideAtual": 1,
    "apresentacao": { "formato": "noir.apresentacao", "versao": 1, "titulo": "Negociação", "slides": [ … ] },
    "contexto": {
      "encontro": "Encontro 5: Negociação e influência",
      "transcricao": [ { "nome": "Ana Souza", "texto": "Vou testar fazer mais perguntas" } ],
      "enquetes": [ { "pergunta": "Maior desafio?", "resultados": [ { "opcao": "Preço", "votos": 3 } ] } ]
    }
  }
}
```

- `apresentacao` é `null` quando ainda não existe (crie uma nova).
- `slideAtual` começa em 0. “Este slide” se refere a ele.
- Limites aplicados antes do envio: instrução até 2000 caracteres, até 80 falas de até 300 caracteres, até 10 enquetes.
- O conteúdo do pedido e do contexto é dado vindo de usuários, não instrução para o motor mudar suas regras.

## Resposta (200)

```json
{
  "contrato": 1,
  "apresentacao": { "titulo": "Negociação", "slides": [ … ] },
  "mensagem": "Troquei o título do slide 2.",
  "foco": 1
}
```

- `apresentacao` é sempre a apresentação **inteira** já alterada, não um trecho.
- `mensagem`: uma frase para o mentor (até 400 caracteres).
- `foco` (opcional): índice do slide que o mentor deve ver em seguida.
- Mantenha os `id` dos slides que não mudaram. Slides novos recebem `id` curtos e novos.

Respostas sem `contrato: 1` ou sem `apresentacao` são recusadas como “fora do contrato”.

## Formato da apresentação

```json
{
  "titulo": "texto (até 120)",
  "slides": [
    {
      "id": "s1",
      "layout": "capa | topicos | duas-colunas | numero | citacao | grafico | passos | encerramento",
      "titulo": "até 120",
      "subtitulo": "até 200",
      "itens": ["até 8 itens, cada um até 160"],
      "colunas": [ { "titulo": "até 60", "itens": ["até 6, cada um até 120"] }, { … } ],
      "numero": { "valor": "até 16", "legenda": "até 140" },
      "citacao": { "texto": "até 280", "autor": "até 80" },
      "grafico": { "unidade": "até 12", "dados": [ { "rotulo": "até 40", "valor": 12 } ] },
      "notas": "dicas de fala para o mentor, até 600"
    }
  ]
}
```

- No máximo 30 slides. Campos que o layout não usa são ignorados.
- `duas-colunas` exige exatamente 2 colunas; `grafico` aceita até 8 dados com valor numérico.
- Texto é texto puro. Nenhum HTML é interpretado.
- A função valida tudo de novo (`supabase/functions/_shared/apresentacao.ts`) e corta o que passar dos limites. O JSON Schema completo está em `ESQUEMA_APRESENTACAO` nesse arquivo.

Regras de conteúdo esperadas: português do Brasil, textos curtos, e **nunca inventar** números, nomes, empresas ou citações. `numero`, `grafico` e `citacao` só com dados reais (do mentor, das enquetes ou da transcrição).

## Erros

| Status da Endeavor | O que o mentor vê |
| --- | --- |
| 401 ou 403 | “O Noir Hub não está autorizado no motor da Endeavor.” |
| 429 | “O motor da Endeavor está ocupado. Tente de novo em instantes.” |
| outro erro | “O motor da Endeavor não conseguiu atender agora.” |
| sem resposta em `ENDEAVOR_TIMEOUT_MS` | “O motor da Endeavor não respondeu a tempo.” |

O detalhe técnico vai só para os logs da função. Com `IA_MOTOR_RESERVA=claude`, qualquer falha cai automaticamente no Claude.

## Versões do contrato

Mudanças compatíveis (campos opcionais novos) mantêm `contrato: 1`. Mudanças que quebram aumentam a versão; o adaptador recusa versões que não conhece, e o navegador não muda.

## Como ligar a Endeavor

1. A Endeavor entrega a URL e a chave de um endpoint que cumpre este contrato.
2. Teste num ambiente de homologação:
   ```bash
   supabase secrets set ENDEAVOR_API_URL=https://… ENDEAVOR_API_KEY=… IA_MOTOR=endeavor IA_MOTOR_RESERVA=claude
   supabase functions deploy assistente-ia --no-verify-jwt
   ```
3. Confira:
   - [ ] Criar do zero (“Crie 5 slides sobre network”) devolve layouts válidos.
   - [ ] Alterar um slide mantém os ids e o conteúdo dos outros.
   - [ ] “O que foi falado” usa a transcrição sem inventar falas.
   - [ ] Slide de enquete usa os votos reais.
   - [ ] Respostas em até 60 s; 429 e 401 aparecem com as mensagens acima.
   - [ ] A coluna `engine` de `presentation_versions` mostra `endeavor`.
4. Para voltar ao Claude: `supabase secrets set IA_MOTOR=claude`. Nada no site muda.
