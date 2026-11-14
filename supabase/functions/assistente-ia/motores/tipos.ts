import type { PedidoAssistente, RespostaMotor } from "../../_shared/apresentacao.ts";

/**
 * Um motor de IA recebe o pedido do mentor e devolve a apresentação inteira, já alterada.
 * Para ligar um motor novo, implemente esta interface e registre-o em motores/index.ts.
 */
export interface MotorIA {
  /** Nome curto, mostrado ao mentor ("claude", "endeavor"). */
  nome: string;
  gerar(pedido: PedidoAssistente, sinal: AbortSignal): Promise<RespostaMotor>;
}

/** Falha de um motor. `mensagem` é segura para mostrar ao mentor; `detalhe` vai só para o log. */
export class ErroMotor extends Error {
  constructor(mensagem: string, public detalhe = "", public status = 502) { super(mensagem); }
}
