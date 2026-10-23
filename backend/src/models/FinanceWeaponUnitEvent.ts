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
  BelongsTo
} from "sequelize-typescript";
import FinanceWeaponUnit from "./FinanceWeaponUnit";
import Company from "./Company";

// Histórico mínimo por unidade de arma (v2.3.205, Etapa 1 autorizada) —
// só "entrada" por enquanto (criação da unidade); `type` já fica pronto
// pra "sale"/"return"/"writeoff" quando a Venda for integrada (etapa
// separada, autorização futura). Ver docs/MANUAL_TECNICO.md, seção 184.
@Table
class FinanceWeaponUnitEvent extends Model<FinanceWeaponUnitEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FinanceWeaponUnit)
  @AllowNull(false)
  @Column
  weaponUnitId: number;

  @BelongsTo(() => FinanceWeaponUnit)
  weaponUnit: FinanceWeaponUnit;

  @AllowNull(false)
  @Column
  type: string;

  @Column
  note: string;

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

export default FinanceWeaponUnitEvent;
