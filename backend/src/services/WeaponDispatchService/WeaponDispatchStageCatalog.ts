// Catálogo fixo das esteiras do Despachante Bélico — duas trilhas
// (`track`), cada uma com sua sequência própria de etapas (`stage`), igual
// ao pedido original (Fluxo A: CAC/Exército/SisGCorp; Fluxo B: Posse ou
// Porte/Polícia Federal/Sinarm). Fica como arquivo estático (igual CFOP/
// município, ver skill atendeflow-dev seção 11) porque a sequência não
// muda com frequência — mudar a lei (Lei 10.826/2003, Decreto 11.615/2023)
// é uma decisão de produto, não um dado de configuração por empresa.
//
// `type` (WeaponDispatchProcess.type) é diferente de `stage`: `type` é O
// QUE o cliente está pedindo (ex. "CR" = Certificado de Registro novo,
// "GT" = Guia de Tráfego, "RENOVACAO_CR" = renovação) — na base real do
// cliente (Notion, campo "Tipo de processo") isso chega a ter quase 20
// valores diferentes, incluindo reenvio/segundo endereço/mudança de
// endereço/transferência, que não são "um novo processo do zero" mas
// variações do mesmo processo. `stage` é EM QUE PONTO da esteira aquele
// processo está agora — por isso todo tipo cai numa das duas trilhas
// abaixo (a esteira de um "GT" novo ou de uma "RENOVAÇÃO DO CR" é a mesma
// forma, só o ponto de partida pode ser diferente — ex. renovação pode já
// nascer em `readyToFile` se os laudos ainda estão válidos).
export type WeaponDispatchTrack = "cac" | "civil";

export interface WeaponDispatchStage {
  key: string;
  label: string;
}

// Fluxo A — Atirador Desportivo (CAC), Exército/SisGCorp.
const CAC_STAGES: WeaponDispatchStage[] = [
  { key: "preAnalysis", label: "Pré-análise (Filiado? Laudos? Docs?)" },
  { key: "pendingScheduling", label: "Agendamentos pendentes (Psico/Tiro)" },
  { key: "readyToFile", label: "Pronto para protocolo (aguardando analista)" },
  { key: "filedUnderReview", label: "Protocolado / Em análise (Exército)" },
  { key: "noticeRequired", label: "Notificado / Exigência" },
  { key: "crIssued", label: "Concessão de CR emitida (aprovado)" },
  { key: "purchaseAuthorization", label: "Pedido de autorização de compra" },
  { key: "weaponApostille", label: "Apostilamento da arma" },
  { key: "transitGuideIssuance", label: "Emissão de Guia de Tráfego (GT)" },
  { key: "done", label: "Finalizado" }
];

// Fluxo B — Cidadão Comum (Posse/Porte), Polícia Federal/Sinarm.
const CIVIL_STAGES: WeaponDispatchStage[] = [
  { key: "preAnalysis", label: "Pré-análise (Laudos? Docs? Certidões?)" },
  { key: "pendingScheduling", label: "Agendamentos pendentes (Psico/Tiro)" },
  { key: "readyToFile", label: "Pronto para protocolo (aguardando analista)" },
  { key: "filedUnderReview", label: "Protocolado / Em análise (Polícia Federal)" },
  { key: "noticeRequired", label: "Notificado / Exigência" },
  { key: "denied", label: "Indeferido" },
  { key: "approved", label: "Deferido / Aprovado (CRAF + Guia de Trânsito)" },
  { key: "done", label: "Finalizado" }
];

export const WEAPON_DISPATCH_STAGES: Record<WeaponDispatchTrack, WeaponDispatchStage[]> = {
  cac: CAC_STAGES,
  civil: CIVIL_STAGES
};

export const WEAPON_DISPATCH_TRACKS: { key: WeaponDispatchTrack; label: string }[] = [
  { key: "cac", label: "Atirador Desportivo (CAC) — Exército/SisGCorp" },
  { key: "civil", label: "Cidadão Comum (Posse/Porte) — Polícia Federal/Sinarm" }
];

// "Tipo de processo" — o que o cliente pediu, não a etapa atual. Lista
// enriquecida a partir do uso real já em produção no Notion do cliente
// (base PROCESSOS, campo "Tipo de processo"), não só do pedido original.
// Cada tipo já nasce associado a uma trilha — decide o conjunto de etapas
// válidas pra aquele processo.
export interface WeaponDispatchProcessTypeDef {
  key: string;
  label: string;
  track: WeaponDispatchTrack;
}

export const WEAPON_DISPATCH_PROCESS_TYPES: WeaponDispatchProcessTypeDef[] = [
  { key: "CR", label: "Certificado de Registro (CR) — novo", track: "cac" },
  { key: "PDC", label: "Pedido de Autorização de Compra (PDC)", track: "cac" },
  { key: "CRAF", label: "CRAF", track: "civil" },
  { key: "GT", label: "Guia de Tráfego (GT)", track: "cac" },
  { key: "POSSE", label: "Posse", track: "civil" },
  { key: "PORTE", label: "Porte", track: "civil" },
  { key: "RENOVACAO_CR", label: "Renovação do CR", track: "cac" },
  { key: "RENOVACAO_CRAF", label: "Renovação de CRAF", track: "civil" },
  { key: "TRANSFERENCIA", label: "Transferência", track: "cac" },
  { key: "MUDANCA_ENDERECO", label: "Mudança de endereço", track: "cac" },
  { key: "REENVIO_CR", label: "Reenvio de CR", track: "cac" },
  { key: "REVALIDACAO_AUTORIZACAO", label: "Revalidação de autorização", track: "cac" }
];

export const getStagesForTrack = (track: WeaponDispatchTrack): WeaponDispatchStage[] =>
  WEAPON_DISPATCH_STAGES[track] || [];

export const isValidStage = (track: WeaponDispatchTrack, stage: string): boolean =>
  getStagesForTrack(track).some((s) => s.key === stage);

export const getDefaultStage = (track: WeaponDispatchTrack): string =>
  getStagesForTrack(track)[0]?.key || "preAnalysis";

export const getTrackForProcessType = (type: string): WeaponDispatchTrack => {
  const found = WEAPON_DISPATCH_PROCESS_TYPES.find((t) => t.key === type);
  return found ? found.track : "cac";
};
