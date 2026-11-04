import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  HasMany,
  DataType
} from "sequelize-typescript";
import PayrollIrrfBracket from "./PayrollIrrfBracket";

// Versão da tabela de IRRF (RH — Fase 2). GLOBAL, versionada, mesmo
// espírito de PayrollInssTable. `dependentDeductionValue` é o valor
// abatido da base de cálculo por dependente (não por faixa — um valor
// único por versão da tabela).
//
// LIMITAÇÃO CONHECIDA: não inclui o redutor adicional da Lei
// 15.270/2025 (isenção efetiva até R$5.000/mês, redução decrescente até
// R$7.350) — ver comentário completo na migration
// 20261104150100-create-payroll-irrf-tables.ts.
@Table
class PayrollIrrfTable extends Model<PayrollIrrfTable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  effectiveFrom: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  dependentDeductionValue: number;

  @Column
  sourceReference: string;

  @HasMany(() => PayrollIrrfBracket)
  brackets: PayrollIrrfBracket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollIrrfTable;
