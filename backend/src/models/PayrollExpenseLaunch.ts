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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import FinanceExpense from "./FinanceExpense";

// Rastreia o lançamento da Folha Mensal em Contas a Pagar — ver
// PayrollExpenseService.ts e a migration de criação pro raciocínio
// completo (um lançamento CONSOLIDADO por competência, não um por
// funcionário).
@Table
class PayrollExpenseLaunch extends Model<PayrollExpenseLaunch> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column
  competencyMonth: number;

  @AllowNull(false)
  @Column
  competencyYear: number;

  @AllowNull(false)
  @ForeignKey(() => FinanceExpense)
  @Column
  financeExpenseId: number;

  @BelongsTo(() => FinanceExpense)
  financeExpense: FinanceExpense;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  totalValue: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollExpenseLaunch;
