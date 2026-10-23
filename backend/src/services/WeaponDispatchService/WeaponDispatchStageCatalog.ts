// Catálogo fixo das esteiras do Despachante Bélico — TRÊS trilhas
// (`track`), cada uma com sua sequência própria de etapas (`stage`). Fica
// como arquivo estático (igual CFOP/município, ver skill atendeflow-dev
// seção 11) porque a sequência não muda com frequência — mudar a lei (Lei
// 10.826/2003, Decreto 11.615/2023) é uma decisão de produto, não um dado
// de configuração por empresa.
//
// `type` (WeaponDispatchProcess.type) é diferente de `stage`: `type` é O
// QUE o cliente está pedindo (ex. "CAC_CR_CONCESSAO" = Certificado de
// Registro novo, "CAC_GT_EMISSAO" = Guia de Tráfego) — `stage` é EM QUE
// PONTO da esteira aquele processo está agora. Por isso todo tipo cai numa
// das três trilhas abaixo (a esteira de uma "Emissão de CRAF" nova ou de
// uma "Renovação de CRAF" é a mesma forma, só o ponto de partida pode ser
// diferente — ex. renovação pode já nascer em `readyToFile` se os laudos
// ainda estão válidos).
//
// v2.3.161 — lista de tipos de processo REESCRITA a partir do catálogo
// oficial de serviços que o cliente mandou (Portal PF/Sinarm-CAC,
// SisGCorp/Exército), bem mais completa e correta que a versão anterior
// (baseada só no pedido genérico original). Ganhou a trilha `military`
// nova — Policiais Militares e Militares das Forças Armadas também
// gerenciam arma via SIGMA/SisGCorp (mesmo sistema do CAC), mas são
// clientes diferentes (serviço institucional, não atirador esportivo) —
// cliente confirmou que isso merece a própria esteira, não só entrar
// dentro da trilha CAC. Ver docs/MANUAL_TECNICO.md, seção 140.
export type WeaponDispatchTrack = "cac" | "civil" | "military";

export interface WeaponDispatchStage {
  key: string;
  label: string;
}

// Trilha 1 — Atirador Desportivo (CAC), Exército/SisGCorp.
const CAC_STAGES: WeaponDispatchStage[] = [
  { key: "preAnalysis", label: "Pré-análise (Filiado? Laudos? Docs?)" },
  { key: "pendingScheduling", label: "Agendamentos pendentes (Psico/Tiro)" },
  { key: "readyToFile", label: "Pronto para protocolo (aguardando analista)" },
  { key: "filedUnderReview", label: "Protocolado / Em análise (Exército)" },
  { key: "noticeRequired", label: "Notificado / Exigência" },
  { key: "approved", label: "Concessão/Registro emitido (aprovado)" },
  { key: "purchaseAuthorization", label: "Pedido de autorização de compra" },
  { key: "weaponApostille", label: "Apostilamento / Alteração cadastral" },
  { key: "transitGuideIssuance", label: "Emissão de Guia de Tráfego (GT/GTE)" },
  { key: "done", label: "Finalizado" }
];

// Trilha 2 — Cidadão Comum (Posse/Porte), Polícia Federal/Sinarm.
const CIVIL_STAGES: WeaponDispatchStage[] = [
  { key: "preAnalysis", label: "Pré-análise (Laudos? Docs? Certidões?)" },
  { key: "pendingScheduling", label: "Agendamentos pendentes (Psico/Tiro)" },
  { key: "readyToFile", label: "Pronto para protocolo (aguardando analista)" },
  { key: "filedUnderReview", label: "Protocolado / Em análise (Polícia Federal)" },
  { key: "noticeRequired", label: "Notificado / Exigência" },
  { key: "denied", label: "Indeferido" },
  { key: "approved", label: "Deferido / Aprovado (CRAF/Porte + Guia de Trânsito)" },
  { key: "done", label: "Finalizado" }
];

// Trilha 3 — Policial Militar / Militar das Forças Armadas, SIGMA/SisGCorp.
// Mesmo sistema do CAC, mas sem o checklist de atirador esportivo
// (filiação a clube, laudo psicológico/tiro) — processo institucional,
// vinculado à corporação, não a uma federação de tiro.
const MILITARY_STAGES: WeaponDispatchStage[] = [
  { key: "preAnalysis", label: "Pré-análise (Cadastro no SisGCorp? Docs?)" },
  { key: "readyToFile", label: "Pronto para protocolo (aguardando analista)" },
  { key: "filedUnderReview", label: "Protocolado / Em análise" },
  { key: "noticeRequired", label: "Notificado / Exigência" },
  { key: "approved", label: "Registro/Autorização emitida" },
  { key: "purchaseAuthorization", label: "Pedido de autorização de compra" },
  { key: "weaponApostille", label: "Apostilamento / Alteração cadastral" },
  { key: "transitGuideIssuance", label: "Emissão de Guia de Trânsito/Tráfego" },
  { key: "done", label: "Finalizado" }
];

export const WEAPON_DISPATCH_STAGES: Record<WeaponDispatchTrack, WeaponDispatchStage[]> = {
  cac: CAC_STAGES,
  civil: CIVIL_STAGES,
  military: MILITARY_STAGES
};

export const WEAPON_DISPATCH_TRACKS: { key: WeaponDispatchTrack; label: string }[] = [
  { key: "cac", label: "Atirador Desportivo (CAC) — Exército/SisGCorp" },
  { key: "civil", label: "Cidadão Comum (Posse/Porte) — Polícia Federal/Sinarm" },
  { key: "military", label: "Policial/Militar — SIGMA/SisGCorp" }
];

// "Tipo de processo" — o que o cliente pediu, não a etapa atual. Lista
// reescrita (v2.3.161) a partir do catálogo oficial de serviços que o
// cliente mandou, organizada pelas mesmas etapas/categorias que ele usou
// (Habilitação e Registro / Aquisição e Destinação / Tráfego e Logística
// pro CAC; Posse / Porte / Logística pro Civil; Aquisição e Cadastro /
// Manutenção do Acervo / Porte e Trânsito / Ocorrências e Baixas pro
// Militar). Cada tipo já nasce associado a uma trilha — decide o conjunto
// de etapas válidas pra aquele processo. `key` tem prefixo da trilha
// (CAC_/CIVIL_/MIL_) porque vários nomes se repetem entre trilhas (ex.
// "Renovação de CRAF" existe nas três) — sem o prefixo colidiriam.
export interface WeaponDispatchProcessTypeDef {
  key: string;
  label: string;
  track: WeaponDispatchTrack;
}

export const WEAPON_DISPATCH_PROCESS_TYPES: WeaponDispatchProcessTypeDef[] = [
  // --- CAC — Habilitação e Registro (Identificação) ---
  { key: "CAC_CR_CONCESSAO", label: "Concessão de Certificado de Registro (CR)", track: "cac" },
  { key: "CAC_CR_REVALIDACAO", label: "Revalidação de Certificado de Registro (CR)", track: "cac" },
  { key: "CAC_CR_APOSTILAMENTO", label: "Apostilamento de Certificado de Registro (CR)", track: "cac" },
  { key: "CAC_ALTERACAO_NIVEL", label: "Alteração de Nível para Atirador Desportivo", track: "cac" },
  // --- CAC — Aquisição e Destinação de Armamento ---
  { key: "CAC_AUTORIZACAO_COMPRA", label: "Autorização de Aquisição de Arma de Fogo", track: "cac" },
  { key: "CAC_CRAF_EMISSAO", label: "Registro de Arma de Fogo (Emissão de CRAF)", track: "cac" },
  { key: "CAC_CRAF_RENOVACAO", label: "Renovação de Certificado de Registro de Arma de Fogo (CRAF)", track: "cac" },
  { key: "CAC_TRANSFERENCIA_ARMA", label: "Transferência de Propriedade de Arma de Fogo", track: "cac" },
  { key: "CAC_CESSAO_ARMA", label: "Cessão de Arma de Fogo", track: "cac" },
  { key: "CAC_INATIVACAO_REGISTRO", label: "Inativação de Registro de Arma de Fogo", track: "cac" },
  // --- CAC — Tráfego, Treinamento e Logística ---
  { key: "CAC_GT_EMISSAO", label: "Emissão de Guia de Tráfego para Atirador Desportivo (GT/GTE)", track: "cac" },
  { key: "CAC_AUTORIZACAO_MUNICOES", label: "Autorização de Aquisição de Munições e Insumos", track: "cac" },
  { key: "CAC_AUTORIZACAO_RECARGA", label: "Autorização para Recarga de Munições", track: "cac" },
  { key: "CAC_GUIA_TRANSITO_MANUTENCAO", label: "Guia de Trânsito para Manutenção ou Reparo de Armamento", track: "cac" },

  // --- Civil — Posse de Arma de Fogo ---
  { key: "CIVIL_AUTORIZACAO_COMPRA", label: "Autorização de Aquisição de Arma de Fogo", track: "civil" },
  { key: "CIVIL_CRAF_1VIA", label: "Registro de Arma de Fogo (Emissão do 1º CRAF)", track: "civil" },
  { key: "CIVIL_CRAF_RENOVACAO", label: "Renovação de Registro de Arma de Fogo (CRAF)", track: "civil" },
  { key: "CIVIL_TRANSFERENCIA_ARMA", label: "Transferência de Propriedade de Arma de Fogo", track: "civil" },
  { key: "CIVIL_CRAF_2VIA", label: "2ª Via do Certificado de Registro de Arma de Fogo (CRAF)", track: "civil" },
  // --- Civil — Porte de Arma de Fogo ---
  { key: "CIVIL_PORTE_DEFESA_PESSOAL", label: "Porte de Arma de Fogo para Defesa Pessoal", track: "civil" },
  { key: "CIVIL_PORTE_RENOVACAO", label: "Renovação de Porte de Arma de Fogo", track: "civil" },
  { key: "CIVIL_PORTE_INSTITUCIONAL", label: "Porte de Arma de Fogo Institucional", track: "civil" },
  // --- Civil — Logística, Trânsito e Ocorrências ---
  { key: "CIVIL_GUIA_TRANSITO", label: "Guia de Trânsito para Transporte de Arma de Fogo", track: "civil" },
  { key: "CIVIL_OCORRENCIA", label: "Cadastro de Ocorrência (furto/roubo/extravio/recuperação)", track: "civil" },

  // --- Militar/Policial — Aquisição e Cadastro Inicial ---
  { key: "MIL_AUTORIZACAO_COMPRA", label: "Autorização para Aquisição de Arma de Fogo", track: "military" },
  { key: "MIL_CRAF_1VIA", label: "Emissão do Certificado de Registro de Arma de Fogo (1º CRAF — SIGMA)", track: "military" },
  { key: "MIL_CADASTRO_SISGCORP", label: "Cadastro Inicial Obrigatório no SisGCorp", track: "military" },
  { key: "MIL_AUTORIZACAO_MUNICOES", label: "Autorização para Aquisição de Munições e Insumos", track: "military" },
  // --- Militar/Policial — Manutenção do Acervo e Regularização ---
  { key: "MIL_CRAF_RENOVACAO", label: "Renovação de Certificado de Registro de Arma de Fogo (CRAF)", track: "military" },
  { key: "MIL_CRAF_2VIA", label: "Emissão de 2ª Via de CRAF", track: "military" },
  { key: "MIL_TRANSFERENCIA_ARMA", label: "Transferência de Propriedade de Arma de Fogo", track: "military" },
  { key: "MIL_APOSTILAMENTO", label: "Apostilamento de Alteração de Dados Cadastrais", track: "military" },
  // --- Militar/Policial — Porte, Trânsito e Logística ---
  { key: "MIL_PORTE", label: "Emissão da Autorização de Porte de Arma de Fogo", track: "military" },
  { key: "MIL_GUIA_TRANSITO", label: "Emissão de Guia de Trânsito / Guia de Tráfego", track: "military" },
  { key: "MIL_EMBARQUE_ARMADO", label: "Autorização para Embarque Armado em Aeronaves Civis (SISCAER)", track: "military" },
  // --- Militar/Policial — Ocorrências e Baixas ---
  { key: "MIL_OCORRENCIA", label: "Cadastro de Ocorrências com Armas de Fogo", track: "military" },
  { key: "MIL_INATIVACAO", label: "Inativação de Registro / Baixa de Armamento", track: "military" }
];

export const getStagesForTrack = (track: WeaponDispatchTrack): WeaponDispatchStage[] =>
  WEAPON_DISPATCH_STAGES[track] || [];

export const isValidStage = (track: WeaponDispatchTrack, stage: string): boolean =>
  getStagesForTrack(track).some((s) => s.key === stage);

export const getDefaultStage = (track: WeaponDispatchTrack): string =>
  getStagesForTrack(track)[0]?.key || "preAnalysis";

// Aceita duas formas de `type` (v2.3.165): a chave fixa do catálogo acima
// (ex. "CAC_CR_CONCESSAO", uso direto do catálogo) OU o nome de um Produto
// de verdade cadastrado em Financeiro → Produtos → Serviços, escolhido na
// ficha do cliente — esses nomes são gerados com o mesmo prefixo da
// trilha ("CAC - ...", "Civil - ...", "Militar - ...", mesma convenção da
// planilha de importação, ver seção 140 do manual técnico), então dá pra
// reconhecer a trilha pelo prefixo sem precisar que o nome bata
// exatamente com nenhuma `label` do catálogo.
export const getTrackForProcessType = (type: string): WeaponDispatchTrack => {
  const found = WEAPON_DISPATCH_PROCESS_TYPES.find((t) => t.key === type);
  if (found) return found.track;

  const normalized = (type || "").trim().toLowerCase();
  if (normalized.startsWith("cac -") || normalized.startsWith("cac-")) return "cac";
  if (normalized.startsWith("civil -") || normalized.startsWith("civil-")) return "civil";
  if (normalized.startsWith("militar -") || normalized.startsWith("militar-")) return "military";

  return "cac";
};
