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

// Cadastro de Sócio da empresa-cliente (RH, ver docs/MANUAL_TECNICO.md).
// Chamado "CompanyPartner" pra não colidir com o model `Partner` já
// existente no projeto (parceiro de indicação/comissão, outro
// conceito). NÃO é um Funcionário — sem regime CLT/PJ/Estagiário/Menor
// Aprendiz, sem vínculo empregatício. `prolaboreValue` é só cadastro
// por enquanto, não entra na Folha Mensal (ver comentário na migration
// de criação).
@Table
class CompanyPartner extends Model<CompanyPartner> {
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
  @Column
  name: string;

  @Column
  photoUrl: string;

  @Column
  cpf: string;

  @Column
  rg: string;

  @Column
  email: string;

  @Column
  phone: string;

  @Column
  zipCode: string;

  @Column
  street: string;

  @Column
  number: string;

  @Column
  complement: string;

  @Column
  neighborhood: string;

  @Column
  city: string;

  @Column
  state: string;

  @Column
  bankName: string;

  @Column
  bankAgency: string;

  @Column
  bankAccount: string;

  @Column
  bankAccountType: string;

  @Column
  pixKey: string;

  @Column(DataType.DATEONLY)
  partnershipStartDate: string;

  @Column(DataType.DATEONLY)
  partnershipEndDate: string;

  @Column(DataType.DECIMAL(5, 2))
  ownershipPercentage: number;

  @Column
  isAdministrator: boolean;

  @Column(DataType.DECIMAL(12, 2))
  prolaboreValue: number;

  // "active" | "withdrawn"
  @Default("active")
  @Column
  partnerStatus: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyPartner;
