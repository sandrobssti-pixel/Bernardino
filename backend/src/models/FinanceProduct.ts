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
