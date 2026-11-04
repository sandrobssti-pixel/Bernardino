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

// Folha Mensal (RH — Fase 2) — um registro persistido por
// funcionário/competência (mês/ano), resultado do cálculo de
// INSS/IRRF/FGTS/VT (ver PayrollCalculationService/PayrollEntryService).
// Guarda SNAPSHOT dos dados usados no cálculo — o cadastro do
// funcionário pode mudar depois sem afetar folhas já calculadas.
// Recalcular a mesma competência faz UPSERT (índice único
// employeeId+competencyMonth+competencyYear), não duplica.
@Table
class PayrollEntry extends Model<PayrollEntry> {
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
  competencyMonth: number;

  @AllowNull(false)
  @Column
  competencyYear: number;

  @AllowNull(false)
  @Column
  workRegimeSnapshot: string;

  @Column(DataType.DECIMAL(12, 2))
  grossSalarySnapshot: number;

  @AllowNull(false)
  @Column
  dependentsCountSnapshot: number;

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

  @ForeignKey(() => PayrollIrrfTable)
  @Column
  irrfTableId: number;

  @BelongsTo(() => PayrollIrrfTable)
  irrfTable: PayrollIrrfTable;

  @Column(DataType.DECIMAL(12, 2))
  fgtsValue: number;

  @Column(DataType.DECIMAL(12, 2))
  vtDiscount: number;

  @Column(DataType.DECIMAL(12, 2))
  netSalary: number;

  @AllowNull(false)
  @Column
  calculatedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollEntry;
