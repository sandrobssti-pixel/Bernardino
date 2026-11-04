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
// Redutor adicional da Lei 15.270/2025 (em vigor desde jan/2026) — ver
// PayrollCalculationService.ts pro mecanismo completo e
// docs/MANUAL_TECNICO.md seção 219 pra fonte/pesquisa. Resumo: aplicado
// sobre o RENDIMENTO BRUTO mensal (não a base já líquida de INSS) —
// confirmado contra exemplo oficial da Receita Federal.
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

  // Lei 15.270/2025 — redutor adicional (ver comentário acima).
  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  lei15270Tier1Limit: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  lei15270Tier2Limit: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  lei15270MaxReduction: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  lei15270FormulaConstant: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(10, 6))
  lei15270FormulaRate: number;

  @HasMany(() => PayrollIrrfBracket)
  brackets: PayrollIrrfBracket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollIrrfTable;
