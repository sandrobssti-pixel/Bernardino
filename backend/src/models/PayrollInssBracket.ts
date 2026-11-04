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
import PayrollInssTable from "./PayrollInssTable";

// Faixa de uma versão da tabela de INSS. Cálculo progressivo:
// desconto = salário × (rate / 100) − deduction, dentro da faixa.
@Table
class PayrollInssBracket extends Model<PayrollInssBracket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @ForeignKey(() => PayrollInssTable)
  @Column
  inssTableId: number;

  @BelongsTo(() => PayrollInssTable)
  inssTable: PayrollInssTable;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  minSalary: number;

  // NULL = sem limite superior (última faixa).
  @Column(DataType.DECIMAL(12, 2))
  maxSalary: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(5, 2))
  rate: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  deduction: number;

  @AllowNull(false)
  @Column
  sortOrder: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollInssBracket;
