// Motor "endeavor": adaptador para o motor de IA da Endeavor Business Solutions.
//
// AINDA NÃO LIGADO. O Noir Hub funciona sem ele. Para ligar, configure as variáveis e mude
// IA_MOTOR para "endeavor" (veja docs/CONTRATO-MOTOR-IA.md). Nada no navegador muda.
//
// Variáveis: ENDEAVOR_API_URL (endpoint que implementa o contrato), ENDEAVOR_API_KEY,
//            ENDEAVOR_TIMEOUT_MS (opcional, padrão 60000).

import type { PedidoAssistente, RespostaMotor } from "../../_shared/apresentacao.ts";
import { ErroMotor, type MotorIA } from "./tipos.ts";

export const VERSAO_CONTRATO = 1;

export function motorEndeavor(): MotorIA {
  return {
    nome: "endeavor",
    async gerar(p: PedidoAssistente, sinal: AbortSignal): Promise<RespostaMotor> {
      const url = Deno.env.get("ENDEAVOR_API_URL"), chave = Deno.env.get("ENDEAVOR_API_KEY");
      if (!url || !chave) throw new ErroMotor("O motor de IA da Endeavor ainda não está configurado.", "ENDEAVOR_API_URL ou ENDEAVOR_API_KEY ausente", 500);

      const tempo = AbortSignal.timeout(Number(Deno.env.get("ENDEAVOR_TIMEOUT_MS")) || 60_000);
      let r: Response;
      try {
        r = await fetch(url, {
          method: "POST",
          signal: AbortSignal.any([sinal, tempo]),
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${chave}`,
            "X-Noir-Contrato": String(VERSAO_CONTRATO),
            "X-Noir-Origem": "noir-hub",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ contrato: VERSAO_CONTRATO, tarefa: "apresentacao.editar", pedido: p }),
        });
      } catch (e) {
        throw new ErroMotor("O motor da Endeavor não respondeu a tempo.", String(e));
      }
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const msg = r.status === 429 ? "O motor da Endeavor está ocupado. Tente de novo em instantes."
          : r.status === 401 || r.status === 403 ? "O Noir Hub não está autorizado no motor da Endeavor."
          : "O motor da Endeavor não conseguiu atender agora.";
        throw new ErroMotor(msg, `Endeavor ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
      }
      if (!j || j.contrato !== VERSAO_CONTRATO || !j.apresentacao) {
        throw new ErroMotor("O motor da Endeavor respondeu fora do contrato.", `resposta=${JSON.stringify(j).slice(0, 400)}`);
      }
      return { apresentacao: j.apresentacao, mensagem: String(j.mensagem ?? "Pronto."), foco: Number.isInteger(j.foco) ? j.foco : undefined };
    },
  };
}
