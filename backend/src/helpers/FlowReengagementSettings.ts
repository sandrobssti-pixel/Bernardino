// Config e helpers compartilhados entre ActionsWebhookService (agenda) e o
// job flowReengagementQueue (dispara). Centralizado aqui para as duas pontas
// nunca divergirem sobre o formato salvo em FlowBuilder.flow.settings.reengagement.

export interface FlowReengagementStep {
  minutes: number;
  message: string;
}

export interface FlowReengagementAutoClose {
  enabled: boolean;
  minutes: number;
}

export interface FlowReengagementSettings {
  enabled: boolean;
  steps: FlowReengagementStep[];
  autoClose: FlowReengagementAutoClose;
}

export const FLOW_REENGAGEMENT_QUEUE_KEY = `${process.env.DB_NAME}-flowReengagement`;

// Ativo por padrão: quem controla se o follow-up dispara ou não é o toggle
// "Ativar follow-up" configurado por fluxo no FlowBuilder (settings.reengagement.enabled).
// A variável FLOW_REENGAGEMENT_ENABLED no .env vira só um freio de emergência
// opcional (FLOW_REENGAGEMENT_ENABLED=false desliga tudo sem precisar de deploy),
// lido uma única vez na carga do módulo. Checado tanto na hora de agendar quanto
// na hora de processar o job, para que desligar a flag também impeça jobs que
// já estejam pendentes no Redis de disparar após um restart.
export const FLOW_REENGAGEMENT_ENABLED =
  process.env.FLOW_REENGAGEMENT_ENABLED !== "false";

// Cada job agendado precisa de um ID único: o Bull deduplica jobs pelo ID
// (se já existe uma chave com o mesmo ID no Redis, o add() é ignorado
// silenciosamente). Como o job do próximo passo (ou do fechamento) é
// agendado de dentro do handler do job anterior — que ainda está "ativo"
// no Redis nesse momento —, reusar o mesmo ID por ticket faz o novo
// agendamento ser descartado sem erro. Por isso o ID inclui um sufixo
// único; buildFlowReengagementJobId segue existindo só como prefixo
// para leitura/debug.
export const buildFlowReengagementJobId = (ticketId: number) =>
  `flowReengagement:${ticketId}`;

export const buildUniqueFlowReengagementJobId = (ticketId: number) =>
  `${buildFlowReengagementJobId(ticketId)}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;

// Aceita tanto o formato novo (settings.reengagement.steps: [{minutes,message}])
// quanto o formato antigo de passo único (settings.reengagement.{minutes,message})
// para não quebrar fluxos salvos antes desta mudança.
export const parseFlowReengagementSettings = (
  flowSettings: any
): FlowReengagementSettings => {
  const reengagement = flowSettings?.reengagement || {};

  const rawSteps = Array.isArray(reengagement.steps)
    ? reengagement.steps
    : reengagement.minutes || reengagement.message
    ? [{ minutes: reengagement.minutes, message: reengagement.message }]
    : [];

  const steps: FlowReengagementStep[] = rawSteps
    .map((step: any) => ({
      minutes: Number(step?.minutes) || 0,
      message: String(step?.message || "").trim()
    }))
    .filter(step => step.minutes >= 1 && step.message.length > 0);

  const rawAutoClose = reengagement.autoClose || {};
  const autoClose: FlowReengagementAutoClose = {
    enabled: Boolean(rawAutoClose.enabled),
    minutes: Number(rawAutoClose.minutes) || 0
  };

  return {
    enabled: Boolean(reengagement.enabled),
    steps,
    autoClose
  };
};
