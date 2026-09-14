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

// Cadastro de fornecedores do módulo Financeiro (Fase 1 do roadmap — ver
// docs/MANUAL_TECNICO.md, seção 6.2).
@Table
class FinanceSupplier extends Model<FinanceSupplier> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  // "cpf" ou "cnpj"
  @Default("cnpj")
  @Column
  documentType: string;

  @Default("")
  @Column
  document: string;

  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  phone: string;

  @Default("")
  @Column
  zipCode: string;

  @Default("")
  @Column
  street: string;

  @Default("")
  @Column
  number: string;

  @Default("")
  @Column
  complement: string;

  @Default("")
  @Column
  neighborhood: string;

  @Default("")
  @Column
  city: string;

  @Default("")
  @Column
  state: string;

  @Default("")
  @Column
  contactName: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceSupplier;
