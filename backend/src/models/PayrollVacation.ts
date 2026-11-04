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

// Férias GOZADAS (RH) — registro POR PERÍODO AQUISITIVO (ver
// PayrollCalculationService.calculateVacation e a migration de
// criação pro raciocínio completo).
@Table
class PayrollVacation extends Model<PayrollVacation> {
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
  periodNumber: number;

  @Column(DataType.DATEONLY)
  periodStart: string;

  @Column(DataType.DATEONLY)
  periodEnd: string;

  @Column
  daysEntitled: number;

  @Column
  daysTaken: number;

  @Column
  daysSold: number;

  @Column(DataType.DATEONLY)
  vacationStartDate: string;

  @Column(DataType.DATEONLY)
  vacationEndDate: string;

  @Column(DataType.DECIMAL(12, 2))
  grossSalarySnapshot: number;

  @Column(DataType.DECIMAL(12, 2))
  vacationGrossValue: number;

  @Column(DataType.DECIMAL(12, 2))
  vacationBonusValue: number;

  @Column(DataType.DECIMAL(12, 2))
  soldValue: number;

  @Column(DataType.DECIMAL(12, 2))
  soldBonusValue: number;

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
  netValue: number;

  @AllowNull(false)
  @Column
  calculatedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollVacation;
