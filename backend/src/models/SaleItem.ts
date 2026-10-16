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
  Default
} from "sequelize-typescript";
import Sale from "./Sale";
import FinanceProduct from "./FinanceProduct";

// Item de uma venda (Fase 3 — ver Sale.ts). Guarda uma cópia de
// descrição/NCM/CFOP no momento da venda (em vez de só referenciar o
// produto) porque a nota fiscal precisa refletir o que foi vendido NAQUELE
// momento — se o cadastro do produto mudar depois (nome, NCM), notas já
// emitidas não podem mudar retroativamente.
@Table
class SaleItem extends Model<SaleItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  // Código/SKU do produto no momento da venda — mesma lógica de snapshot do
  // description/ncm/cfop acima (cadastro do produto pode mudar depois, a
  // venda e a nota fiscal já emitida não devem mudar retroativamente).
  @Default("")
  @Column
  sku: string;

  @Default("")
  @Column
  ncm: string;

  // Código Fiscal de Operações e Prestações — ex.: 5102 (venda de mercadoria
  // adquirida/produzida pelo estabelecimento, dentro do estado).
  @Default("5102")
  @Column
  cfop: string;

  @Default("UN")
  @Column
  unit: string;

  @Default("1")
  @Column
  quantity: string;

  @Default("0")
  @Column
  unitPrice: string;

  @Default("0")
  @Column
  totalPrice: string;

  // Snapshot do custo/alíquota de imposto do produto no momento da venda
  // (dashboard de lucro, v2.3.117) — mesma lógica de snapshot do
  // description/sku/ncm/cfop acima: se o cadastro do produto mudar depois
  // (custo, alíquota), o lucro de uma venda já feita não deve mudar
  // retroativamente.
  @Default("0")
  @Column
  costPrice: string;

  @Default("0")
  @Column
  taxRate: string;

  // Reforma Tributária 2027 (CBS/IBS) — snapshot do cálculo no momento da
  // venda (mesma lógica de snapshot acima). Populado só quando
  // `FiscalConfig.reform2027Enabled` for true (`Iva2027Service.ts` via
  // `SaleService.buildItemRows`); até lá, fica tudo "0", sem efeito no
  // faturamento atual. `ivaIbsStateValue`/`ivaIbsCityValue` (vIBS_UF/
  // vIBS_Mun do spec): a proporção exata do split estadual x municipal do
  // IBS ainda não foi regulamentada por cada UF/município — por ora todo
  // o valor do IBS calculado vai pra `ivaIbsStateValue`, `ivaIbsCityValue`
  // fica "0" até a regra de rateio existir de verdade.
  @Default("0")
  @Column
  ivaNetUnitPrice: string;

  @Default("0")
  @Column
  ivaNetTotalPrice: string;

  @Default("0")
  @Column
  ivaCbsBase: string;

  @Default("0")
  @Column
  ivaIbsBase: string;

  @Default("0")
  @Column
  ivaCbsRateApplied: string;

  @Default("0")
  @Column
  ivaIbsRateApplied: string;

  @Default("0")
  @Column
  ivaCbsValue: string;

  @Default("0")
  @Column
  ivaIbsStateValue: string;

  @Default("0")
  @Column
  ivaIbsCityValue: string;

  @ForeignKey(() => Sale)
  @AllowNull(false)
  @Column
  saleId: number;

  @BelongsTo(() => Sale)
  sale: Sale;

  @ForeignKey(() => FinanceProduct)
  @Column
  productId: number;

  @BelongsTo(() => FinanceProduct)
  product: FinanceProduct;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaleItem;
