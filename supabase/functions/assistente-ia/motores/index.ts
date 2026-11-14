// Escolha do motor de IA. Hoje: "claude". Futuro: "endeavor".
//
//   IA_MOTOR          motor principal (padrão "claude")
//   IA_MOTOR_RESERVA  motor usado se o principal falhar (opcional), ex.: IA_MOTOR=endeavor e IA_MOTOR_RESERVA=claude

import { motorClaude } from "./claude.ts";
import { motorEndeavor } from "./endeavor.ts";
import type { MotorIA } from "./tipos.ts";

const MOTORES: Record<string, () => MotorIA> = {
  claude: motorClaude,
  endeavor: motorEndeavor,
};

export function motoresConfigurados(): MotorIA[] {
  const principal = (Deno.env.get("IA_MOTOR") ?? "claude").trim().toLowerCase();
  const reserva = (Deno.env.get("IA_MOTOR_RESERVA") ?? "").trim().toLowerCase();
  if (!MOTORES[principal]) throw new Error(`IA_MOTOR desconhecido: ${principal}. Use ${Object.keys(MOTORES).join(" ou ")}.`);
  const lista = [MOTORES[principal]()];
  if (reserva && reserva !== principal) {
    if (!MOTORES[reserva]) throw new Error(`IA_MOTOR_RESERVA desconhecido: ${reserva}.`);
    lista.push(MOTORES[reserva]());
  }
  return lista;
}

export { ErroMotor, type MotorIA } from "./tipos.ts";
