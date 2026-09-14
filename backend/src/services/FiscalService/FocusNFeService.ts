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
const BASE_URL_SANDBOX = "https://homologacao.focusnfe.com.br";
const BASE_URL_PRODUCTION = "https://api.focusnfe.com.br";

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
  const baseURL =
    config.gatewayEnvironment === "production" ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;

  return axios.create({
    baseURL,
    auth: { username: config.gatewayToken, password: "" },
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
const parseDocumentResponse = (data: any): FocusEmitResult => {
  const rawStatus = String(data?.status || "").toLowerCase();

  let status: FocusEmitResult["status"] = "processing";
  if (rawStatus.includes("autorizado") && !rawStatus.includes("nao")) {
    status = "authorized";
  } else if (rawStatus.includes("erro") || rawStatus.includes("rejeitad") || rawStatus.includes("denegad")) {
    status = "error";
  }

  const errorMessage =
    status === "error"
      ? String(data?.mensagem_sefaz || data?.mensagem || (Array.isArray(data?.erros) ? data.erros.join("; ") : "")) ||
        "Erro não detalhado retornado pelo gateway."
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

// Monta o payload de itens compartilhado entre NF-e e NFC-e — estruturalmente
// muito parecidas na API da Focus NFe (a NFC-e é uma NF-e simplificada pro
// consumidor final).
const buildItemsPayload = (sale: Sale) =>
  (sale.items || []).map((item, index) => ({
    numero_item: index + 1,
    codigo_produto: item.productId ? String(item.productId) : `ITEM-${index + 1}`,
    descricao: item.description,
    ncm: item.ncm || "00000000",
    cfop: item.cfop || "5102",
    unidade_comercial: item.unit || "UN",
    quantidade_comercial: Number(item.quantity) || 0,
    valor_unitario_comercial: Number(item.unitPrice) || 0,
    valor_bruto: Number(item.totalPrice) || 0,
    unidade_tributavel: item.unit || "UN",
    quantidade_tributavel: Number(item.quantity) || 0,
    valor_unitario_tributavel: Number(item.unitPrice) || 0,
    icms_origem: "0",
    icms_situacao_tributaria: "102"
  }));

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
    cep_destinatario: (customer.zipCode || "").replace(/\D/g, "") || undefined
  };
};

const buildEmitente = (company: Company, config: FiscalConfig) => ({
  cnpj_emitente: (company.document || "").replace(/\D/g, ""),
  nome_emitente: company.name,
  regime_tributario_emitente: config.taxRegime === "simples" || config.taxRegime === "mei" ? "1" : "3",
  inscricao_estadual_emitente: config.stateRegistrationExempt ? "ISENTO" : config.stateRegistration
});

const buildNfePayload = (sale: Sale, company: Company, config: FiscalConfig) => ({
  natureza_operacao: "Venda",
  data_emissao: new Date().toISOString(),
  tipo_documento: "1",
  finalidade_emissao: "1",
  cnpj_emitente: buildEmitente(company, config).cnpj_emitente,
  serie: config.nfeSeries,
  ...buildEmitente(company, config),
  ...buildDestinatario(sale),
  items: buildItemsPayload(sale)
});

const buildNfcePayload = (sale: Sale, company: Company, config: FiscalConfig) => ({
  natureza_operacao: "Venda ao consumidor",
  data_emissao: new Date().toISOString(),
  presenca_comprador: "1",
  serie: config.nfceSeries,
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
