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
import Employee from "./Employee";

// Rescisão de Contrato / Verbas Rescisórias (RH) — UM registro por
// funcionário, resultado do cálculo de saldo de salário, aviso
// prévio, 13º proporcional, férias proporcionais e multa do FGTS (ver
// PayrollCalculationService.calculateTermination e a migration de
// criação pro raciocínio completo).
@Table
class PayrollTermination extends Model<PayrollTermination> {
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
  terminationType: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  terminationDate: string;

  @Default(false)
  @Column
  noticeWorked: boolean;

  @Column
  yearsOfService: number;

  @Column
  balanceSalaryDays: number;

  @Column(DataType.DECIMAL(12, 2))
  balanceSalaryGross: number;

  @Column(DataType.DECIMAL(12, 2))
  balanceSalaryInss: number;

  @Column(DataType.DECIMAL(12, 2))
  balanceSalaryIrrf: number;

  @Column(DataType.DECIMAL(12, 2))
  balanceSalaryIrrfReduction: number;

  @Column(DataType.DECIMAL(5, 1))
  noticeDays: number;

  @Column(DataType.DECIMAL(12, 2))
  noticeValue: number;

  @Column
  thirteenthMonthsWorked: number;

  @Column(DataType.DECIMAL(12, 2))
  thirteenthGrossValue: number;

  @Column(DataType.DECIMAL(12, 2))
  thirteenthInssValue: number;

  @Column(DataType.DECIMAL(12, 2))
  thirteenthIrrfValue: number;

  @Column(DataType.DECIMAL(12, 2))
  thirteenthIrrfReductionValue: number;

  @Column
  vacationMonthsWorked: number;

  @Column(DataType.DECIMAL(12, 2))
  vacationGrossValue: number;

  @Column(DataType.DECIMAL(12, 2))
  vacationBonusValue: number;

  @Column(DataType.DECIMAL(12, 2))
  fgtsSystemCalculatedBalance: number;

  @Column(DataType.DECIMAL(12, 2))
  fgtsBalanceUsed: number;

  @Column(DataType.DECIMAL(4, 2))
  fgtsFineRate: number;

  @Column(DataType.DECIMAL(12, 2))
  fgtsFineValue: number;

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

export default PayrollTermination;
