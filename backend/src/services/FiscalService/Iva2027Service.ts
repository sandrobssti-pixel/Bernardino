// Motor de cálculo da Reforma Tributária 2027 (CBS/IBS) — estruturado
// seguindo o pseudocódigo fornecido pelo cliente, aguardando o gatilho de
// `FiscalConfig.reform2027Enabled`. Função pura (sem I/O, sem efeito
// colateral) chamada por `SaleService.buildItemRows` só quando o flag
// global estiver ligado; com o flag desligado, nada aqui é executado e o
// faturamento atual (NF-e/NFC-e/NFS-e, PIS/Cofins/ICMS/ISS tradicionais)
// continua intacto.
//
// Resumo das regras (ver docs/MANUAL_TECNICO.md pra contexto completo):
// - B2C (pessoa física): faturamento simplificado dentro do DAS, sem CBS/
//   IBS destacado por fora — preço final não muda.
// - B2B (empresa) e B2G sem isenção: regime híbrido — o preço digitado JÁ
//   é o preço líquido, e CBS/IBS são somados por fora pra formar o total
//   da nota. Produto/serviço de educação com `ivaEducationReduction`
//   aplica a redução de 60% nas alíquotas (Aliquota_Efetiva = Aliquota × 0,40).
// - B2G (órgão público) com isenção em edital: alíquotas zeradas.
//
// Nota sobre o rateio UF/Município do IBS: a proporção exata entre a
// parte estadual e a parte municipal ainda não foi regulamentada por cada
// UF/município (isso é definido jurisdição por jurisdição, mais perto da
// entrada em vigor) — por isso esta função devolve o valor total do IBS
// só em `ibsStateValue`, com `ibsCityValue` zerado, até essa regra existir
// de verdade. Ver comentário equivalente em `SaleItem.ts`.

export type IvaTaxpayerProfile = "B2C" | "B2B" | "B2G";

export interface IvaCalcInput {
  customerProfile: IvaTaxpayerProfile;
  customerGovExempt: boolean;
  baseNetPrice: number;
  cbsRate: number;
  ibsRate: number;
  educationReduction: boolean;
}

export interface IvaCalcResult {
  netPrice: number;
  cbsRateApplied: number;
  ibsRateApplied: number;
  cbsValue: number;
  ibsStateValue: number;
  ibsCityValue: number;
  totalValue: number;
}

const EDUCATION_REDUCTION_FACTOR = 0.4; // Aplica a redução de 60% (Aliquota_Efetiva = Aliquota × 0,40).

export const calculate = (input: IvaCalcInput): IvaCalcResult => {
  const { customerProfile, customerGovExempt, baseNetPrice, cbsRate, ibsRate, educationReduction } = input;

  // B2G com isenção prevista em edital — alíquotas de CBS/IBS zeradas.
  if (customerProfile === "B2G" && customerGovExempt) {
    return {
      netPrice: baseNetPrice,
      cbsRateApplied: 0,
      ibsRateApplied: 0,
      cbsValue: 0,
      ibsStateValue: 0,
      ibsCityValue: 0,
      totalValue: baseNetPrice
    };
  }

  // B2C — faturamento simplificado dentro do DAS, sem CBS/IBS por fora.
  if (customerProfile === "B2C") {
    return {
      netPrice: baseNetPrice,
      cbsRateApplied: 0,
      ibsRateApplied: 0,
      cbsValue: 0,
      ibsStateValue: 0,
      ibsCityValue: 0,
      totalValue: baseNetPrice
    };
  }

  // B2B e B2G sem isenção — regime híbrido, cálculo por fora.
  const reductionFactor = educationReduction ? EDUCATION_REDUCTION_FACTOR : 1;
  const cbsRateApplied = cbsRate * reductionFactor;
  const ibsRateApplied = ibsRate * reductionFactor;
  const cbsValue = baseNetPrice * (cbsRateApplied / 100);
  const ibsValue = baseNetPrice * (ibsRateApplied / 100);

  return {
    netPrice: baseNetPrice,
    cbsRateApplied,
    ibsRateApplied,
    cbsValue,
    ibsStateValue: ibsValue,
    ibsCityValue: 0,
    totalValue: baseNetPrice + cbsValue + ibsValue
  };
};
