/* Configuração da sala ao vivo (LiveKit).
 *
 * Deixe livekitUrl e tokenUrl vazios para usar o modo demonstração.
 * Para encontros reais, siga docs/LIVEKIT.md e preencha:
 *
 *   livekitUrl      endereço do seu projeto LiveKit, ex.: "wss://noir-hub-abc123.livekit.cloud"
 *   tokenUrl        função que libera o acesso, ex.: "https://SEU-PROJETO.supabase.co/functions/v1/livekit-token"
 *   adminUrl        função das ações do mentor (gravar, transmitir, salas de networking,
 *                   silenciar, remover, encerrar), ex.: "https://SEU-PROJETO.supabase.co/functions/v1/livekit-admin"
 *   resumoUrl       função do resumo do encontro com IA,
 *                   ex.: "https://SEU-PROJETO.supabase.co/functions/v1/resumo-encontro"
 *   assistenteUrl   função do assistente de apresentação (Claude hoje; Endeavor no futuro,
 *                   trocado só no servidor), ex.: "https://SEU-PROJETO.supabase.co/functions/v1/assistente-ia"
 *                   Vazio: o assistente funciona em modo demonstração, sem IA.
 *   supabaseAnonKey chave pública (anon) do Supabase. É pública por natureza; nunca coloque aqui
 *                   a service_role nem o API secret do LiveKit.
 */
window.NOIR_CONFIG = {
  livekitUrl: "",
  tokenUrl: "",
  adminUrl: "",
  resumoUrl: "",
  assistenteUrl: "",
  supabaseAnonKey: ""
};
