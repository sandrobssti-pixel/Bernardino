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
import Company from "./Company";
import FinanceProduct from "./FinanceProduct";

// Volume pequeno de munição (v2.3.223, pedido do cliente) — mesmo
// princípio já usado pra arma por número de série (FinanceWeaponUnit,
// v2.3.205/207), aplicado a munição vendida em caixa fechada ("caixa
// cheia"): o Produto (FinanceProduct, type "ammunition") representa a
// CAIXA CHEIA (SKU), e cada "caixa pequena"/"cartela" física que sai de
// dentro dela ao ser aberta ganha uma linha aqui — com o próprio lote
// (o mesmo pra todas as caixinhas da mesma caixa cheia/remessa) e um ID
// próprio (código de barras, diferente em cada caixinha). Motivo
// explícito do cliente: duas remessas diferentes da mesma caixa cheia
// podem estar em estoque ao mesmo tempo com lotes diferentes — uma
// venda de 100 unidades (2 caixinhas de 50) pode sair de uma caixinha
// do lote antigo e outra do lote novo; rastrear por CAIXINHA (não só
// por produto) é o que permite saber exatamente qual lote saiu em cada
// venda, e evita vender a mesma caixinha física duas vezes (conferida
// pelo ID). Ver docs/MANUAL_TECNICO.md, seção correspondente.
@Table
class FinanceAmmoVolume extends Model<FinanceAmmoVolume> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FinanceProduct)
  @AllowNull(false)
  @Column
  productId: number;

  @BelongsTo(() => FinanceProduct)
  product: FinanceProduct;

  // Lote da CAIXA CHEIA de onde essa caixinha veio — mesmo valor nas
  // várias caixinhas abertas de uma mesma remessa (confirmado com o
  // cliente: "dentro da caixa cheia só tem o mesmo lote"), mas pode
  // divergir entre caixinhas de remessas/épocas diferentes do mesmo
  // produto, por isso mora aqui (por caixinha), não só no Produto.
  @AllowNull(false)
  @Column
  lotNumber: string;

  // Código de barras/ID da caixinha pequena — único por empresa,
  // diferente em cada uma das caixinhas de uma mesma caixa cheia. É o
  // que o vendedor confere na hora da venda pra nunca vender a mesma
  // caixinha física duas vezes.
  @AllowNull(false)
  @Column
  barcodeId: string;

  // Quantas unidades (cartuchos) tem DENTRO dessa caixinha física — ex.:
  // 50 (caixa cheia de 20x50=1000) ou 10 (cartela, caixa cheia de
  // 32x10=320). Por caixinha, não fixo no Produto, porque o cliente
  // mencionou exceção real ("as vezes pode acontecer que tem uma caixa
  // que está terminando" — uma caixinha pode sair com quantidade
  // diferente da padrão).
  @AllowNull(false)
  @Default(0)
  @Column
  unitQuantity: number;

  // "in_stock" (em estoque) | "reserved" (venda em aberto) | "sold"
  // (nota fiscal autorizada) — mesmo ciclo de vida de FinanceWeaponUnit,
  // ver FinanceAmmoVolumeService.ts.
  @Default("in_stock")
  @Column
  status: string;

  @Default("")
  @Column
  notes: string;

  // Mesmo padrão de FinanceWeaponUnit.saleItemId — sem FK formal de
  // propósito (SaleItem guarda o próprio snapshot); só serve pra navegar
  // até a venda que consumiu esta caixinha.
  @Column
  saleItemId: number;

  @Column
  soldAt: Date;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceAmmoVolume;
