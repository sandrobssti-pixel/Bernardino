import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

// Cadastro de produtos/serviços do módulo Financeiro (Fase 1 do roadmap —
// ver docs/MANUAL_TECNICO.md, seção 6.2). Campos como NCM já ficam previstos
// aqui pra facilitar a Fase 3 (módulo fiscal / NF-e), sem uso ainda.
@Table
class FinanceProduct extends Model<FinanceProduct> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  // "product" (produto, pode ter estoque) ou "service" (serviço)
  @Default("product")
  @Column
  type: string;

  @Default("")
  @Column
  sku: string;

  // Nomenclatura Comum do Mercosul — usada na emissão de NF-e (Fase 3, ainda
  // não implementada). Fica só armazenado por enquanto.
  @Default("")
  @Column
  ncm: string;

  @Default("UN")
  @Column
  unit: string;

  // Valores como string (mesma convenção de Plan.amount/Company) pra evitar
  // problema de arredondamento de ponto flutuante — formatação fica a cargo
  // do frontend.
  @Default("0")
  @Column
  price: string;

  @Default("0")
  @Column
  costPrice: string;

  // Alíquota de imposto única (%), usada pro dashboard de lucro (v2.3.117) —
  // lucro líquido = preço de venda - custo - (preço de venda × taxRate/100).
  // Simplificação de propósito (um % só, não o detalhamento de ICMS/PIS/
  // COFINS/IPI/ISS separados) — decisão confirmada com o cliente.
  @Default("0")
  @Column
  taxRate: string;

  // Reforma Tributária 2027 (CBS/IBS) — CST e alíquotas estimadas, mais o
  // indicador de redução de 60% pra curso/treinamento. Sem efeito nenhum
  // enquanto `FiscalConfig.reform2027Enabled` for false — ver
  // `Iva2027Service.ts`.
  @Default("")
  @Column
  ivaCstCbs: string;

  @Default("")
  @Column
  ivaCstIbs: string;

  @Default("0")
  @Column
  ivaCbsRate: string;

  @Default("0")
  @Column
  ivaIbsRate: string;

  @Default(false)
  @Column
  ivaEducationReduction: boolean;

  @Default(false)
  @Column
  controlStock: boolean;

  @Default(0)
  @Column
  stockQuantity: number;

  // Aviso de estoque baixo (Painel Financeiro) dispara quando
  // `stockQuantity <= minStockQuantity` — `0` (padrão) significa "sem
  // aviso configurado", nunca entra na lista de estoque baixo mesmo
  // zerado, até o cliente definir um mínimo de propósito pra esse produto.
  @Default(0)
  @Column
  minStockQuantity: number;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  // Foto do produto (v2.3.167, pedido do cliente) — mesmo padrão de
  // WeaponDispatchClient.photoUrl: upload via rota dedicada depois do
  // produto já existir (precisa de um id pra saber em qual pasta
  // gravar), nunca parte do payload JSON do cadastro em si.
  @Default("")
  @Column
  photoUrl: string;

  // --------------------------------------------------------------------
  // Cadastro de armas/munições/insumos controlados (clube de tiro, loja de
  // armas, armaria) — type "weapon"/"ammunition". Normas de referência:
  // Decreto 11.615/2023, Decreto 12.345/2024, Estatuto do Desarmamento
  // (Lei 10.826/2003). Campos só preenchidos/exibidos quando aplicável
  // (financeConfig.js, `visibleWhen`) — ver docs/MANUAL_TECNICO.md.
  // --------------------------------------------------------------------

  // Pistola, revólver, fuzil, carabina, espingarda, submetralhadora...
  @Default("")
  @Column
  weaponType: string;

  // Fabricante (Taurus, Glock, CBC, Imbramun...) — texto livre, não select,
  // pra não travar em uma lista fixa de marcas.
  @Default("")
  @Column
  brand: string;

  @Default("")
  @Column
  model: string;

  // Calibre nominal (ex.: ".40 S&W", "9mm", "12", "5.56x45mm") — usado
  // tanto em arma quanto em munição/insumo.
  @Default("")
  @Column
  caliber: string;

  // Número de série da arma — único por empresa (índice parcial na
  // migration), obrigatório quando type = "weapon" (FinanceProductService).
  @Column
  serialNumber: string;

  @Column
  cartridgeCapacity: number;

  // Semiautomática, repetição, ação simples, ação dupla, automática...
  @Default("")
  @Column
  operatingMode: string;

  @Column
  barrelCount: number;

  // Comprimento do cano, em centímetros.
  @Column
  barrelLength: number;

  // "Lisa" (espingarda) ou "raiada" (pistola/revólver/fuzil/carabina).
  @Default("")
  @Column
  boreType: string;

  // Energia cinética da munição, em Joules — um dos critérios usados pelos
  // decretos citados pra classificar uso permitido x restrito.
  @Column
  kineticEnergyJ: number;

  // "Permitido" ou "Restrito" — classificação de uso regulatória. Campo
  // informativo preenchido manualmente: a validação final de qual
  // classificação se aplica a cada arma/munição é responsabilidade do
  // usuário/especialista legal, não calculada automaticamente aqui.
  @Default("")
  @Column
  useClassification: string;

  // Número de registro no SIGMA/SINARM (Exército).
  @Default("")
  @Column
  sigmaRegistrationNumber: string;

  // "Nacional" ou "Importada".
  @Default("")
  @Column
  origin: string;

  // Situação da arma: em estoque, vendida, em manutenção, baixada...
  @Default("")
  @Column
  weaponStatus: string;

  // Munição/insumo controlado (CBC, Imbramun) — lote de fabricação, pra
  // rastreabilidade.
  @Default("")
  @Column
  manufacturingLotNumber: string;

  // Código de barras/código da embalagem da munição/insumo.
  @Default("")
  @Column
  packageBarcode: string;

  // --------------------------------------------------------------------
  // Aba "2 - Dados Fiscais" (v2.3.167) — modelo exato que o cliente mandou
  // de um sistema de referência (print de tela), confirmado contra 4 notas
  // fiscais reais do cliente (venda a consumidor + compras de fornecedores
  // CBC/Pavei/Inbramun). IPI foi pedido explicitamente "zerado" (fora de
  // escopo, nenhum campo de IPI aqui — ver seção 145 do manual técnico).
  // Nem todo campo abaixo vai de verdade no payload da Focus NFe ainda —
  // ver aviso de confiança em FocusNFeService.ts/buildIndicadores.
  // --------------------------------------------------------------------

  @Default(false)
  @Column
  icmsExempt: boolean;

  @Default(false)
  @Column
  icmsSubstitution: boolean;

  // Origem da mercadoria (Sefaz) — "0" a "8". Confirmado variar de
  // verdade por produto (visto "0" e "5" em notas reais do mesmo
  // fornecedor), nunca fixar um valor só.
  @Default("0")
  @Column
  icmsOrigin: string;

  // CSOSN (Simples Nacional) — um valor pra quando o destinatário é
  // Contribuinte do ICMS, outro pra Não Contribuinte (indIEDest da Venda,
  // ver Sale.ieIndicator) — mesma ideia do sistema de referência do
  // cliente. Defaults 101/102 batem com o que já era hardcoded antes
  // desta entrega e com a nota real de venda (CSOSN 0102 pra consumidor
  // final).
  @Default("101")
  @Column
  csosnContribuinte: string;

  @Default("102")
  @Column
  csosnNaoContribuinte: string;

  // Modalidade de determinação da BC do ICMS — "0" a "3". "3" (Valor da
  // Operação) é o padrão mais comum, confirmado no print do cliente.
  @Default("3")
  @Column
  icmsBcModality: string;

  // Modalidade de determinação da BC do ICMS-ST — "0" a "6". Só relevante
  // quando `icmsSubstitution` true.
  @Default("")
  @Column
  icmsStBcModality: string;

  @Default("0")
  @Column
  icmsRate: string;

  // "ICMS ECF" — campo do sistema de referência do cliente, formato não
  // documentado por ele; guardado como texto livre, sem uso no payload da
  // Focus NFe ainda (não confirmado contra nenhuma nota real).
  @Default("")
  @Column
  icmsEcf: string;

  @Default("0")
  @Column
  icmsDesoneration: string;

  @Default("0")
  @Column
  icmsStRate: string;

  // IVA-ST / MVA (Margem de Valor Agregado) — só relevante quando
  // `icmsSubstitution` true.
  @Default("0")
  @Column
  icmsStMva: string;

  @Default("")
  @Column
  taxableUnit: string;

  // CFOP padrão pra venda dentro da Bahia (interna) — usado como default
  // ao escolher o produto numa venda (ver SaleModal.js), não trava o CFOP
  // do item (sempre editável por venda).
  @Default("5102")
  @Column
  cfopPrincipal: string;

  // CFOP padrão pra venda interestadual (fora da BA) — mesma lógica
  // acima, usado quando `Sale.operationType` for "interstate".
  @Default("6102")
  @Column
  cfopOutState: string;

  @Default("")
  @Column
  taxArticle: string;

  @Default("")
  @Column
  fiscalBenefitCode: string;

  // "Utilizar Alíq. de Fundo de Combate à Pobreza (FCP)" — guardado por
  // enquanto só como registro/exibição. Nenhuma das 4 notas reais usadas
  // pra validar esta entrega teve FCP destacado, então NÃO está sendo
  // mandado no payload da Focus NFe ainda (sem percentual confirmado pra
  // usar com segurança) — ver seção 145 do manual técnico.
  @Default(false)
  @Column
  usesFcp: boolean;

  // "Desconto Condicional na NFe/NFCe" — informativo por enquanto (o
  // sistema ainda não tem campo de desconto por item de venda).
  @Default(false)
  @Column
  conditionalDiscountNfe: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceProduct;
