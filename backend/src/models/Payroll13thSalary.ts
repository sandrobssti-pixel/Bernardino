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
import Employee from "./Employee";
import PayrollInssTable from "./PayrollInssTable";
import PayrollIrrfTable from "./PayrollIrrfTable";

// 13º Salário (RH) — registro ANUAL (não mensal) por funcionário/ano,
// resultado do cálculo de INSS/IRRF/FGTS sobre a gratificação
// natalina (ver PayrollCalculationService.calculate13thSalary e a
// migration de criação pro raciocínio completo).
@Table
class Payroll13thSalary extends Model<Payroll13thSalary> {
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
  @ForeignKey(() => Employee)
  @Column
  employeeId: number;

  @BelongsTo(() => Employee)
  employee: Employee;

  @AllowNull(false)
  @Column
  year: number;

  @AllowNull(false)
  @Column
  monthsWorked: number;

  @Column(DataType.DECIMAL(12, 2))
  grossSalarySnapshot: number;

  @Column(DataType.DECIMAL(12, 2))
  grossValue: number;

  @Column(DataType.DECIMAL(12, 2))
  firstInstallmentValue: number;

  @Column(DataType.DECIMAL(12, 2))
  secondInstallmentValue: number;

  @Column(DataType.DECIMAL(12, 2))
  inssBase: number;

  @Column(DataType.DECIMAL(12, 2))
  inssValue: number;

  @ForeignKey(() => PayrollInssTable)
  @Column
  inssTableId: number;

  @BelongsTo(() => PayrollInssTable)
  inssTable: PayrollInssTable;

  @Column(DataType.DECIMAL(12, 2))
  irrfBase: number;

  @Column(DataType.DECIMAL(12, 2))
  irrfValue: number;

  @Column(DataType.DECIMAL(12, 2))
  irrfReductionValue: number;

  @ForeignKey(() => PayrollIrrfTable)
  @Column
  irrfTableId: number;

  @BelongsTo(() => PayrollIrrfTable)
  irrfTable: PayrollIrrfTable;

  @Column(DataType.DECIMAL(12, 2))
  fgtsValue: number;

  @Column(DataType.DECIMAL(12, 2))
  netValue: number;

  @AllowNull(false)
  @Column
  calculatedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Payroll13thSalary;
