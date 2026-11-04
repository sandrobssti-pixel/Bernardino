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

// Dependente do Funcionário (RH — Fase 2). Usado pra dedução do IRRF
// (ver PayrollCalculationService) e informativo de RH.
@Table
class EmployeeDependent extends Model<EmployeeDependent> {
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
  name: string;

  @Column
  cpf: string;

  @Column(DataType.DATEONLY)
  birthDate: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default EmployeeDependent;
