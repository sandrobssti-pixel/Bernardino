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
import PayrollIrrfTable from "./PayrollIrrfTable";

// Faixa de uma versão da tabela de IRRF. Cálculo progressivo:
// imposto = base × (rate / 100) − deduction, dentro da faixa.
@Table
class PayrollIrrfBracket extends Model<PayrollIrrfBracket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @ForeignKey(() => PayrollIrrfTable)
  @Column
  irrfTableId: number;

  @BelongsTo(() => PayrollIrrfTable)
  irrfTable: PayrollIrrfTable;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  minBase: number;

  // NULL = sem limite superior (última faixa).
  @Column(DataType.DECIMAL(12, 2))
  maxBase: number;

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

export default PayrollIrrfBracket;
