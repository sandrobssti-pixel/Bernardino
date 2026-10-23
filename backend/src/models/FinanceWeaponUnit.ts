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

// Unidade física de uma arma (v2.3.205, Etapa 1 autorizada) — o Produto
// (FinanceProduct) passa a representar o MODELO/SKU (ex.: "Taurus G2C
// .40", SKU 10034336), e cada arma física desse modelo que entra no
// estoque ganha uma linha aqui, com o próprio número de série. Antes,
// cada arma física era um FinanceProduct inteiro (mesmo SKU repetido
// entre elas). Venda/relatório ficam pras próximas etapas (autorização
// separada) — ver docs/MANUAL_TECNICO.md, seção 184.
@Table
class FinanceWeaponUnit extends Model<FinanceWeaponUnit> {
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

  @AllowNull(false)
  @Column
  serialNumber: string;

  // Número de registro no SIGMA/SINARM (Exército) — é da arma física
  // individual (cada serial tem o seu), não do modelo. Por isso migrou
  // do Produto (onde só cabia 1 valor pra todas as armas do SKU) pra cá.
  @Default("")
  @Column
  sigmaRegistrationNumber: string;

  // "in_stock" (em estoque), "sold" (vendida), "maintenance" (em
  // manutenção), "decommissioned" (baixada/inutilizada) — mesmas opções
  // que já existiam em WEAPON_STATUS_OPTIONS (financeConfig.js).
  @Default("in_stock")
  @Column
  status: string;

  @Default("")
  @Column
  notes: string;

  // Reservado pra Etapa 2 (integração com a Venda) — nenhum código desta
  // etapa lê ou escreve aqui ainda. Sem FK formal de propósito: quando a
  // Venda for integrada, SaleItem guardará seu próprio snapshot; isso
  // aqui só vai servir pra navegar até a venda que consumiu a unidade.
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

export default FinanceWeaponUnit;
