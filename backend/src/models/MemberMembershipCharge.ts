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
import Member from "./Member";
import FinanceReceivable from "./FinanceReceivable";

// "Etiqueta" de cobrança de filiação em cima de um FinanceReceivable já
// existente (módulo Financeiro, reaproveitado por pedido do cliente) —
// ver comentário da migration create-member-membership-charges. Quando
// o FinanceReceivable vinculado fica "received", um hook em
// FinanceReceivable.ts estende Member.filiationValidUntil até
// "coverageEnd" desta linha. Ver docs/MANUAL_TECNICO.md.
@Table
class MemberMembershipCharge extends Model<MemberMembershipCharge> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Member)
  @AllowNull(false)
  @Column
  memberId: number;

  @BelongsTo(() => Member)
  member: Member;

  @ForeignKey(() => FinanceReceivable)
  @AllowNull(false)
  @Column
  receivableId: number;

  @BelongsTo(() => FinanceReceivable)
  receivable: FinanceReceivable;

  @Default(12)
  @Column
  periodMonths: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  coverageStart: Date;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  coverageEnd: Date;

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

export default MemberMembershipCharge;
