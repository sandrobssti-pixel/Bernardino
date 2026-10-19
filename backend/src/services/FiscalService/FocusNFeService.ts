import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import Sale from "../../models/Sale";
import FiscalConfig from "../../models/FiscalConfig";
import Company from "../../models/Company";

// Adapter pro gateway de emissão fiscal Focus NFe (focusnfe.com.br) — Fase 3
// do roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2. Escolhido porque cobre
// NF-e/NFC-e/NFS-e num único contrato de API, com documentação em
// português — bom encaixe pra um adapter só cobrir os 3 tipos de documento.
//
// ⚠️ IMPORTANTE — sem teste end-to-end contra o gateway de verdade: este
// adapter foi implementado a partir da documentação pública da Focus NFe,
// mas nunca foi validado contra uma chave de sandbox real (esta sessão não
// tem uma). O formato dos campos de request/response (nomes exatos, nesting)
// pode precisar de ajuste fino assim que a empresa-cliente configurar um
// token de homologação de verdade em Configuração Fiscal e emitir a
// primeira nota de teste — comparar a resposta real com o parsing abaixo
// (`parseDocumentResponse`) e ajustar se necessário. Erros da API ficam
// registrados no campo `errorMessage` do FiscalDocument pra facilitar esse
// ajuste sem precisar instrumentar nada na hora.
//
// v2.3.166 — indicadores fiscais pedidos pelo contador do cliente (tipo de
// operação/idDest, natureza da operação, presença do consumidor/indPres,
// intermediador/indIntermed, consumidor final/indFinal, indicador IE do
// destinatário, forma de pagamento/tPag) — ver `buildIndicadores` e
// `IE_INDICATOR_CODES`/`OPERATION_TYPE_CODES`/`INTERMEDIARY_CODES`/
// `PAYMENT_METHOD_CODES` mais abaixo. Os CÓDIGOS oficiais da Sefaz usados
// aí têm confiança alta (conferidos contra o schema público); o NOME de
// cada chave no JSON que a Focus NFe espera é que carrega o mesmo nível de
// incerteza do resto deste adapter — testar contra Homologação antes de
// confiar isso em Produção, já que o contador tratou esses campos como
// obrigatórios pra evitar problema com o fisco.
// Exportados pra FiscalDocumentService.resolveDocumentUrls poder prefixar
// caminho_danfe/caminho_xml_nota_fiscal (relativos) sem duplicar os hosts.
export const BASE_URL_SANDBOX = "https://homologacao.focusnfe.com.br";
export const BASE_URL_PRODUCTION = "https://api.focusnfe.com.br";

export interface FocusEmitResult {
  status: "processing" | "authorized" | "error";
  number: string;
  series: string;
  accessKey: string;
  xmlUrl: string;
  pdfUrl: string;
  errorMessage: string;
  raw: unknown;
}

const buildClient = (config: FiscalConfig): AxiosInstance => {
  // Qual ambiente usar é derivado direto do toggle "Produção habilitada"
  // (v2.3.112) — não tem mais um seletor separado pra isso, ver
  // FiscalConfigService.isProductionActive.
  const isProduction = !!config.productionEnabled;
  const baseURL = isProduction ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
  const token = isProduction ? config.gatewayTokenProduction : config.gatewayTokenSandbox;

  return axios.create({
    baseURL,
    auth: { username: token, password: "" },
    headers: { "Content-Type": "application/json" },
    timeout: 30000
  });
};

const documentEndpoint = (type: string): string => {
  if (type === "nfce") return "nfce";
  if (type === "nfse") return "nfse";
  return "nfe";
};

// A Focus NFe processa de forma assíncrona: o POST inicial normalmente
// retorna "processando_autorizacao", e o status final (autorizado/erro) só
// fica disponível numa consulta GET seguinte ou via webhook. Por isso o
// mesmo parser serve tanto pra resposta do POST quanto do GET de status.
//
// `caminho_danfe`/`caminho_xml_nota_fiscal` vêm da Focus como CAMINHO
// relativo (ex.: "/v2/nfe/.../danfe.pdf"), não URL completa — guardado
// cru aqui de propósito. Quem resolve pra URL absoluta (prefixando o
// host certo, sandbox/produção) é `FiscalDocumentService.resolveDocumentUrls`,
// no momento de SERVIR o documento pro frontend — não aqui no momento de
// salvar — porque isso também conserta documentos que já foram emitidos
// e salvos ANTES dessa correção existir (v2.3.131), sem precisar de
// nenhuma migração/backfill: o `environment` ("sandbox"/"production") já
// fica gravado em cada `FiscalDocument` desde a v2.3.125.
const parseDocumentResponse = (data: any): FocusEmitResult => {
  const rawStatus = String(data?.status || "").toLowerCase();

  let status: FocusEmitResult["status"] = "processing";
  if (rawStatus.includes("autorizado") && !rawStatus.includes("nao")) {
    status = "authorized";
  } else if (rawStatus.includes("erro") || rawStatus.includes("rejeitad") || rawStatus.includes("denegad")) {
    status = "error";
  }

  // A Focus NFe costuma devolver uma `mensagem` GENÉRICA ("Erro na
  // validação do Schema XML, verifique o detalhamento dos erros") separada
  // de `erros`, um array com o detalhe campo a campo de verdade. Antes
  // (v2.3.113-118) `mensagem` tinha prioridade no `||` e o `erros` nunca
  // aparecia — a mensagem genérica saía inteira na tela, mas sem o
  // "detalhamento" que ela mesma promete. Agora sempre concatena os dois
  // quando `erros` existe, em vez de escolher um ou outro.
  const genericMessage = String(data?.mensagem_sefaz || data?.mensagem || "");
  const detailedErrors = Array.isArray(data?.erros)
    ? data.erros
        .map((e: any) => (typeof e === "string" ? e : e?.mensagem || e?.message || JSON.stringify(e)))
        .filter(Boolean)
        .join("; ")
    : "";
  const errorMessage =
    status === "error"
      ? [genericMessage, detailedErrors].filter(Boolean).join(" — ") || "Erro não detalhado retornado pelo gateway."
      : "";

  return {
    status,
    number: String(data?.numero || ""),
    series: String(data?.serie || ""),
    accessKey: String(data?.chave_nfe || data?.chave_nfce || data?.chave_acesso || ""),
    xmlUrl: String(data?.caminho_xml_nota_fiscal || data?.caminho_xml || ""),
    pdfUrl: String(data?.caminho_danfe || data?.caminho_pdf || data?.caminho_nfse_pdf || ""),
    errorMessage,
    raw: data
  };
};

// A Sefaz exige NCM com exatamente 8 dígitos — um valor presente mas com
// formato errado (ex.: "0", espaço, menos de 8 dígitos) passava direto pelo
// `item.ncm || "00000000"` antigo (qualquer string não-vazia é truthy),
// causando "não é do tamanho correto" no gateway (v2.3.123). Agora valida o
// formato, não só a presença.
const normalizeNcm = (ncm: string | null | undefined): string => {
  const digits = (ncm || "").replace(/\D/g, "");
  return digits.length === 8 ? digits : "00000000";
};

// Monta o payload de itens compartilhado entre NF-e e NFC-e — estruturalmente
// muito parecidas na API da Focus NFe (a NFC-e é uma NF-e simplificada pro
// consumidor final).
// SIGMA/SINARM, lote de munição e ID de embalagem (v2.3.166) — exigidos
// pela legislação de controle de armas/munições (Exército/Polícia
// Federal), mas não existem como campo próprio no schema padrão da
// NF-e/NFC-e — vão como texto nas informações adicionais do PRODUTO
// (infAdProd), prática comum pra dado regulatório sem campo dedicado.
// Só gera texto quando pelo menos um dos três estiver preenchido (a
// maioria dos itens de uma venda não é arma/munição).
const buildItemAdditionalInfo = (item: Sale["items"][number]): string | undefined => {
  const parts: string[] = [];
  if (item.sigmaSinarm) parts.push(`SIGMA/SINARM: ${item.sigmaSinarm}`);
  if (item.ammoLot) parts.push(`Lote de munição: ${item.ammoLot}`);
  if (item.packageId) parts.push(`ID de embalagem: ${item.packageId}`);
  return parts.length > 0 ? parts.join(" | ") : undefined;
};

// ICMS por item (v2.3.167) — lido da aba "Dados Fiscais" do Produto
// (`FinanceProduct`), confirmado contra 4 notas fiscais reais do cliente
// (venda a consumidor final + 3 compras de fornecedores CBC/Pavei/
// Inbramun): CSOSN 101/102 pro regime Simples Nacional (mesmo regime já
// assumido em `buildEmitente`), Origem variando de verdade por produto
// ("0" e "5" vistos em notas reais, nunca fixo), CFOP 5102 interno / 61xx
// interestadual. O CSOSN usado depende de quem é o destinatário
// (`sale.ieIndicator` — Contribuinte usa `csosnContribuinte`, os outros
// dois usam `csosnNaoContribuinte`, mesma lógica do sistema de
// referência do cliente). ICMS-ST (base/alíquota/MVA) só entra quando o
// produto tem `icmsSubstitution` marcado — nenhuma das 4 notas reais
// teve ICMS-ST, então esse caminho nunca foi validado contra nota de
// verdade, só contra o schema público — mesmo aviso de confiança do
// resto do arquivo.
const buildItemIcms = (item: Sale["items"][number], sale: Sale) => {
  const product = item.product;
  const csosn =
    sale.ieIndicator === "contributor"
      ? product?.csosnContribuinte || "101"
      : product?.csosnNaoContribuinte || "102";

  const fields: Record<string, unknown> = {
    icms_origem: product?.icmsOrigin || "0",
    icms_situacao_tributaria: csosn
  };

  if (!product?.icmsExempt) {
    const rate = Number(product?.icmsRate) || 0;
    if (rate > 0) {
      fields.icms_percentual = rate;
      fields.icms_modalidade_base_calculo = product?.icmsBcModality || "3";
    }
  }

  if (product?.icmsSubstitution) {
    const stRate = Number(product?.icmsStRate) || 0;
    const mva = Number(product?.icmsStMva) || 0;
    if (stRate > 0 || mva > 0) {
      fields.icms_modalidade_base_calculo_st = product?.icmsStBcModality || "4";
      if (mva > 0) fields.icms_percentual_margem_valor_adicionado_st = mva;
      if (stRate > 0) fields.icms_aliquota_st = stRate;
    }
  }

  return fields;
};

const buildItemsPayload = (sale: Sale) =>
  (sale.items || []).map((item, index) => ({
    numero_item: index + 1,
    // Código do produto que vai na nota: o SKU real do cadastro (snapshot em
    // SaleItem.sku no momento da venda) — nunca o id interno do banco, que
    // não tem nenhum significado fora do AtendeFlow e não é o "código do
    // produto" que a Sefaz/o cliente espera ver na nota.
    codigo_produto: item.sku || (item.productId ? String(item.productId) : `ITEM-${index + 1}`),
    descricao: item.description,
    informacoes_adicionais_produto: buildItemAdditionalInfo(item),
    codigo_ncm: normalizeNcm(item.ncm),
    cfop: item.cfop || "5102",
    unidade_comercial: item.unit || "UN",
    quantidade_comercial: Number(item.quantity) || 0,
    valor_unitario_comercial: Number(item.unitPrice) || 0,
    valor_bruto: Number(item.totalPrice) || 0,
    unidade_tributavel: item.unit || "UN",
    quantidade_tributavel: Number(item.quantity) || 0,
    valor_unitario_tributavel: Number(item.unitPrice) || 0,
    ...buildItemIcms(item, sale),
    // Grupo do PIS/COFINS, que faltava por completo (rejeição Sefaz 745,
    // "NF-e sem grupo do PIS", v2.3.126) — a Sefaz exige o grupo mesmo
    // quando não há valor a destacar. "99" = Outras Operações, o CST
    // correto pra regime Simples Nacional (PIS/COFINS são recolhidos via
    // DAS, não destacados nota a nota — confirmado: nenhuma das 4 notas
    // reais usadas pra validar esta entrega teve PIS/COFINS destacado
    // nas vendas do cliente, só nas compras de fornecedor que não é
    // Simples — esse lado, de quem RECEBE a nota, não é modelado aqui).
    pis_situacao_tributaria: "99",
    pis_valor_base_calculo: 0,
    pis_aliquota_porcentual: 0,
    pis_valor: 0,
    cofins_situacao_tributaria: "99",
    cofins_valor_base_calculo: 0,
    cofins_aliquota_porcentual: 0,
    cofins_valor: 0
  }));

// indIEDest (Sefaz) — "1" Contribuinte ICMS, "2" Contribuinte isento de
// Inscrição, "9" Não Contribuinte. Código confirmado contra o schema
// público da NF-e; o NOME do campo que a Focus NFe espera no JSON
// (`indicador_ie`) é um palpite consistente com o resto do adapter
// (nunca testado contra conta de homologação de verdade — mesmo aviso do
// topo do arquivo).
const IE_INDICATOR_CODES: Record<string, string> = {
  contributor: "1",
  exempt: "2",
  non_contributor: "9"
};

const buildDestinatario = (sale: Sale) => {
  const customer = sale.customer;
  if (!customer) return {};

  const isCnpj = customer.documentType === "cnpj";
  return {
    nome_destinatario: customer.name,
    ...(isCnpj
      ? { cnpj_destinatario: (customer.document || "").replace(/\D/g, "") }
      : { cpf_destinatario: (customer.document || "").replace(/\D/g, "") }),
    email_destinatario: customer.email || undefined,
    telefone_destinatario: customer.phone || undefined,
    logradouro_destinatario: customer.street || undefined,
    numero_destinatario: customer.number || undefined,
    bairro_destinatario: customer.neighborhood || undefined,
    municipio_destinatario: customer.city || undefined,
    uf_destinatario: customer.state || undefined,
    cep_destinatario: (customer.zipCode || "").replace(/\D/g, "") || undefined,
    indicador_ie: IE_INDICATOR_CODES[sale.ieIndicator] || IE_INDICATOR_CODES.non_contributor
  };
};

// ⚠️ Campos fiscais pedidos pelo contador do cliente (v2.3.166) — cada
// indicador abaixo tem um código OFICIAL da Sefaz (conferido contra o
// schema público da NF-e/NFC-e, confiança alta nesse código em si), mas o
// NOME EXATO que a Focus NFe espera pra cada chave no JSON não veio de
// nenhum exemplo real testado (mesma ressalva do topo do arquivo) —
// validar contra uma nota de Homologação de verdade antes de confiar em
// Produção, e ajustar o nome da chave aqui se a Focus devolver erro de
// campo desconhecido.
//
// idDest (Identificador de local de destino da operação): 1-Interna,
// 2-Interestadual, 3-Exterior.
const OPERATION_TYPE_CODES: Record<string, string> = {
  internal: "1",
  interstate: "2",
  foreign: "3"
};

// indIntermed: 0-Operação sem intermediador, 1-Operação em site ou
// plataforma de terceiro. "none" (sem int./site próprio) não manda o
// campo — só obrigatório quando existe de fato uma plataforma de
// terceiro envolvida.
const INTERMEDIARY_CODES: Record<string, string> = {
  own_site: "0",
  marketplace: "1"
};

// Forma de pagamento (tPag) — tabela oficial da Sefaz. "cash_upfront"
// ("À vista") e "money" ("Dinheiro") foram pedidos como DUAS opções
// separadas pelo cliente, mas a Sefaz só tem um código de dinheiro ("01")
// — mapeadas iguais aqui de propósito. "imported_xml" ("Importado do
// XML") não corresponde a nenhum código oficial conhecido — tratado como
// "99" (Outros) até o contador confirmar o que esse caso realmente
// significa pra nota fiscal.
const PAYMENT_METHOD_CODES: Record<string, string> = {
  cash_upfront: "01",
  money: "01",
  credit_card: "03",
  debit_card: "04",
  pix: "17",
  no_payment: "90",
  imported_xml: "99"
};

const buildIndicadores = (sale: Sale) => {
  const fields: Record<string, unknown> = {
    natureza_operacao: sale.operationNature || "Venda",
    id_destino: OPERATION_TYPE_CODES[sale.operationType] || OPERATION_TYPE_CODES.internal,
    consumidor_final: sale.finalConsumerType === "normal" ? "0" : "1"
  };

  if (sale.intermediaryType && sale.intermediaryType !== "none") {
    // Quando a venda é por marketplace/plataforma de terceiro, a Sefaz
    // também exige CNPJ + identificador do intermediador — não coletado
    // ainda (não fazia parte do pedido original), então só o indicador
    // vai por enquanto. Terminar isso exige um campo novo se algum
    // cliente usar NFC-e via marketplace de verdade.
    fields.indicador_intermediador = INTERMEDIARY_CODES[sale.intermediaryType] || "0";
  }

  const paymentCode = PAYMENT_METHOD_CODES[sale.paymentMethod];
  if (paymentCode) {
    fields.formas_pagamento = [
      {
        forma_pagamento: paymentCode,
        valor_pagamento: paymentCode === "90" ? 0 : Number(sale.totalValue) || 0
      }
    ];
  }

  return fields;
};

const buildEmitente = (company: Company, config: FiscalConfig) => ({
  cnpj_emitente: (company.document || "").replace(/\D/g, ""),
  nome_emitente: company.name,
  regime_tributario_emitente: config.taxRegime === "simples" || config.taxRegime === "mei" ? "1" : "3",
  // Formatada com pontuação no cadastro (ex.: "182.174.539") — a Sefaz
  // espera só dígitos nesse campo; achado comparando com o print da tela
  // de Configuração Fiscal do cliente (v2.3.122), causa provável de o
  // erro de schema continuar mesmo depois do endereço do emitente ter
  // sido preenchido corretamente.
  inscricao_estadual_emitente: config.stateRegistrationExempt
    ? "ISENTO"
    : (config.stateRegistration || "").replace(/\D/g, ""),
  // Endereço do emitente — obrigatório no XML (enderEmit), faltava por
  // completo até a v2.3.119 (causa raiz confirmada do "Erro na validação
  // do Schema XML" no primeiro teste real).
  logradouro_emitente: config.emitterStreet || undefined,
  numero_emitente: config.emitterNumber || undefined,
  complemento_emitente: config.emitterComplement || undefined,
  bairro_emitente: config.emitterNeighborhood || undefined,
  municipio_emitente: config.emitterCity || undefined,
  uf_emitente: config.emitterState || undefined,
  cep_emitente: (config.emitterZipCode || "").replace(/\D/g, "") || undefined,
  telefone_emitente: (config.emitterPhone || "").replace(/\D/g, "") || undefined
});

const buildNfePayload = (sale: Sale, company: Company, config: FiscalConfig) => ({
  data_emissao: new Date().toISOString(),
  tipo_documento: "1",
  finalidade_emissao: "1",
  cnpj_emitente: buildEmitente(company, config).cnpj_emitente,
  serie: config.nfeSeries,
  // Campo obrigatório que faltava por completo (nunca foi enviado) — causa
  // confirmada de erro de schema no primeiro teste real (v2.3.123, resposta
  // bruta da Focus NFe). "9" = sem frete/sem ocorrência de transporte, o
  // padrão certo pra venda de balcão sem transportadora.
  modalidade_frete: "9",
  // indPres (presença do consumidor) — nome de campo usado aqui
  // (`indicador_presenca`) é diferente do usado em NFC-e
  // (`presenca_comprador`, convenção já existente antes desta entrega);
  // ver aviso de confiança em `buildIndicadores`.
  indicador_presenca: sale.consumerPresence || "1",
  ...buildIndicadores(sale),
  ...buildEmitente(company, config),
  ...buildDestinatario(sale),
  items: buildItemsPayload(sale)
});

const buildNfcePayload = (sale: Sale, company: Company, config: FiscalConfig) => ({
  data_emissao: new Date().toISOString(),
  presenca_comprador: sale.consumerPresence || "1",
  serie: config.nfceSeries,
  ...buildIndicadores(sale),
  ...buildEmitente(company, config),
  ...buildDestinatario(sale),
  items: buildItemsPayload(sale)
});

// NFS-e é a mais dependente de município (layout varia por prefeitura) — o
// payload aqui é um denominador comum simplificado (concatena a descrição
// dos itens como "discriminação do serviço"). Municípios com exigências
// próprias (código de serviço específico, retenções, etc.) provavelmente
// vão precisar de ajuste caso a caso conforme forem testados de verdade.
const buildNfsePayload = (sale: Sale, company: Company, config: FiscalConfig) => {
  const discriminacao = (sale.items || [])
    .map(item => `${item.description} (qtd: ${item.quantity})`)
    .join("; ");

  return {
    data_emissao: new Date().toISOString(),
    prestador: {
      cnpj: (company.document || "").replace(/\D/g, ""),
      inscricao_municipal: config.municipalRegistration,
      codigo_municipio: config.cityCode
    },
    tomador: sale.customer
      ? {
          cpf: sale.customer.documentType !== "cnpj" ? (sale.customer.document || "").replace(/\D/g, "") : undefined,
          cnpj: sale.customer.documentType === "cnpj" ? (sale.customer.document || "").replace(/\D/g, "") : undefined,
          razao_social: sale.customer.name,
          email: sale.customer.email || undefined
        }
      : undefined,
    servico: {
      discriminacao,
      valor_servicos: Number(sale.totalValue) || 0,
      codigo_municipio: config.cityCode
    }
  };
};

const buildPayload = (type: string, sale: Sale, company: Company, config: FiscalConfig) => {
  if (type === "nfce") return buildNfcePayload(sale, company, config);
  if (type === "nfse") return buildNfsePayload(sale, company, config);
  return buildNfePayload(sale, company, config);
};

// Emite um documento fiscal — cria um `ref` único (idempotência do lado da
// Focus NFe: reenviar o mesmo `ref` não duplica a nota) e faz o POST.
export const emit = async (
  type: string,
  sale: Sale,
  company: Company,
  config: FiscalConfig
): Promise<{ externalRef: string; result: FocusEmitResult }> => {
  const client = buildClient(config);
  const externalRef = `atendeflow-${company.id}-${sale.id}-${uuidv4().slice(0, 8)}`;
  const payload = buildPayload(type, sale, company, config);
  const endpoint = documentEndpoint(type);

  try {
    const { data } = await client.post(`/v2/${endpoint}?ref=${externalRef}`, payload);
    return { externalRef, result: parseDocumentResponse(data) };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      externalRef,
      result: {
        status: "error",
        number: "",
        series: "",
        accessKey: "",
        xmlUrl: "",
        pdfUrl: "",
        errorMessage:
          String(responseData?.mensagem || responseData?.mensagem_sefaz || err?.message || "Falha ao comunicar com o gateway fiscal."),
        raw: responseData || null
      }
    };
  }
};

// Consulta o status atual de um documento já emitido (POST assíncrono —
// pode levar alguns segundos pra sair de "processando").
export const getStatus = async (
  type: string,
  externalRef: string,
  config: FiscalConfig
): Promise<FocusEmitResult> => {
  const client = buildClient(config);
  const endpoint = documentEndpoint(type);

  try {
    const { data } = await client.get(`/v2/${endpoint}/${externalRef}`);
    return parseDocumentResponse(data);
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      status: "error",
      number: "",
      series: "",
      accessKey: "",
      xmlUrl: "",
      pdfUrl: "",
      errorMessage: String(responseData?.mensagem || err?.message || "Falha ao consultar status no gateway fiscal."),
      raw: responseData || null
    };
  }
};

export const cancel = async (
  type: string,
  externalRef: string,
  justification: string,
  config: FiscalConfig
): Promise<{ ok: boolean; errorMessage: string }> => {
  const client = buildClient(config);
  const endpoint = documentEndpoint(type);

  try {
    await client.delete(`/v2/${endpoint}/${externalRef}`, {
      data: { justificativa: justification }
    });
    return { ok: true, errorMessage: "" };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      ok: false,
      errorMessage: String(responseData?.mensagem || err?.message || "Falha ao cancelar no gateway fiscal.")
    };
  }
};

// ⚠️ As cinco funções abaixo usam endpoints confirmados pelo próprio cliente
// (curls copiados direto da documentação oficial da Focus NFe, v2.3.106) —
// método/URL têm certeza alta. O FORMATO DO CORPO de cada request (nomes de
// campo) não veio nos exemplos (só `{}`/`{"items":[]}` genéricos), então foi
// reconstruído por conhecimento geral da API — mesmo nível de confiança que
// o resto do adapter (emit/getStatus/cancel): precisa validar contra conta
// de homologação de verdade antes de confiar em produção.

// Carta de Correção — só existe pra NF-e (modelo 55), não pra NFC-e/NFS-e.
export const emitCorrectionLetter = async (
  type: string,
  externalRef: string,
  correctionText: string,
  config: FiscalConfig
): Promise<{ ok: boolean; errorMessage: string }> => {
  if (type !== "nfe") {
    return { ok: false, errorMessage: "ERR_FISCAL_CORRECTION_LETTER_ONLY_NFE" };
  }

  const client = buildClient(config);

  try {
    await client.post(`/v2/nfe/${externalRef}/carta_correcao`, { correcao: correctionText });
    return { ok: true, errorMessage: "" };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      ok: false,
      errorMessage: String(responseData?.mensagem || err?.message || "Falha ao emitir carta de correção no gateway fiscal.")
    };
  }
};

export const sendByEmail = async (
  type: string,
  externalRef: string,
  emails: string[],
  config: FiscalConfig
): Promise<{ ok: boolean; errorMessage: string }> => {
  const client = buildClient(config);
  const endpoint = documentEndpoint(type);

  try {
    await client.post(`/v2/${endpoint}/${externalRef}/email`, { emails });
    return { ok: true, errorMessage: "" };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      ok: false,
      errorMessage: String(responseData?.mensagem || err?.message || "Falha ao enviar a nota por e-mail pelo gateway fiscal.")
    };
  }
};

// Pré-visualização — monta o mesmo payload de `emit`, mas chama o endpoint
// de prévia (não transmite nada pra Sefaz, não gera `ref`/FiscalDocument).
// Só existe pra NF-e. Resposta é o PDF em binário, não JSON.
export const previewDanfe = async (
  sale: Sale,
  company: Company,
  config: FiscalConfig
): Promise<{ ok: boolean; pdf: Buffer | null; errorMessage: string }> => {
  const client = buildClient(config);
  const payload = buildNfePayload(sale, company, config);

  try {
    const { data } = await client.post("/v2/nfe/danfe", payload, { responseType: "arraybuffer" });
    return { ok: true, pdf: Buffer.from(data), errorMessage: "" };
  } catch (err: any) {
    return {
      ok: false,
      pdf: null,
      errorMessage: err?.message || "Falha ao gerar a pré-visualização do DANFe no gateway fiscal."
    };
  }
};

// Inutilização de numeração — nível empresa/série, não está ligado a um
// FiscalDocument específico (é justamente pra um número que NUNCA foi
// usado). Só existe pra NF-e.
export const invalidateNumbering = async (
  series: string,
  numberStart: number,
  numberEnd: number,
  justification: string,
  config: FiscalConfig
): Promise<{ ok: boolean; errorMessage: string; raw: unknown }> => {
  const client = buildClient(config);

  try {
    const { data } = await client.post("/v2/nfe/inutilizacao", {
      serie: series,
      numero_inicial: numberStart,
      numero_final: numberEnd,
      justificativa: justification
    });
    return { ok: true, errorMessage: "", raw: data };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      ok: false,
      errorMessage: String(responseData?.mensagem || err?.message || "Falha ao inutilizar numeração no gateway fiscal."),
      raw: responseData || null
    };
  }
};

// Bug real batido em produção (v2.3.115): sem try/catch aqui, qualquer
// falha nessa chamada (ex.: a Focus NFe não tem nenhuma inutilização
// registrada ainda e responde de um jeito que a lib de HTTP trata como
// erro) derrubava a Configuração Fiscal inteira com 500 — a tela chama
// isso toda vez que abre (`NumberingInvalidationPanel`). Mesmo padrão das
// outras seis funções deste arquivo: nunca deixar a UI quebrar por causa
// de uma falha de rede/API do gateway.
export const listInvalidations = async (config: FiscalConfig): Promise<unknown[]> => {
  const client = buildClient(config);

  try {
    const { data } = await client.get("/v2/nfe/inutilizacoes");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};
