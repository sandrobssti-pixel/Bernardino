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
import User from "./User";

// Cadastro de Funcionário (RH — Fase 1 de 3, ver docs/MANUAL_TECNICO.md).
// Funcionário NÃO é um User — não tem login nem acesso ao sistema, é só um
// registro de dados de RH. Tabela larga: os campos específicos de regime
// (CLT/PJ/Estagiário/Menor Aprendiz) convivem todos aqui, a maioria nula
// dependendo do `workRegime` escolhido — o formulário decide o que mostrar.
@Table
class Employee extends Model<Employee> {
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

  // "Gestor/Supervisor responsável" — um usuário do AtendeFlow. Reaproveita
  // o mesmo campo pro "Supervisor de Estágio" do regime Estagiário (não
  // duplicado). Usado na Fase 3 (painel de desempenho) pra restringir quem
  // vê a avaliação de quem.
  @ForeignKey(() => User)
  @Column
  managerId: number;

  @BelongsTo(() => User)
  manager: User;

  // --- Comum a todo regime ---
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
  pisPasep: string;

  @Column
  voterTitle: string;

  @Column
  email: string;

  @Column
  phone: string;

  // Endereço — mesma nomenclatura já usada no resto do sistema (ver
  // Customer/SaleModal).
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

  // Dados bancários
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

  // "clt" | "pj" | "intern" | "young_apprentice"
  @Default("clt")
  @Column
  workRegime: string;

  // "active" | "leave" | "terminated"
  @Default("active")
  @Column
  contractStatus: string;

  // --- CLT / Menor Aprendiz ---
  @Column
  ctps: string;

  @Column
  ctpsSeries: string;

  @Column(DataType.DATEONLY)
  admissionDate: string;

  @Column(DataType.DATEONLY)
  terminationDate: string;

  @Column(DataType.DECIMAL(12, 2))
  grossSalary: number;

  @Column
  role: string;

  @Column(DataType.DECIMAL(5, 2))
  weeklyHours: number;

  @Column
  transportVoucher: boolean;

  @Column
  mealVoucher: boolean;

  // --- PJ ---
  @Column
  companyName: string;

  @Column
  cnpj: string;

  @Column
  municipalRegistration: string;

  @Column(DataType.DECIMAL(12, 2))
  monthlyContractValue: number;

  @Column(DataType.DATEONLY)
  contractStartDate: string;

  @Column(DataType.DATEONLY)
  contractEndDate: string;

  @Column(DataType.TEXT)
  contractScope: string;

  // --- Estagiário ---
  @Column
  school: string;

  @Column
  course: string;

  @Column(DataType.DECIMAL(12, 2))
  stipendValue: number;

  @Column(DataType.DECIMAL(12, 2))
  transportAidValue: number;

  @Column(DataType.DATEONLY)
  internshipStartDate: string;

  @Column(DataType.DATEONLY)
  internshipEndDate: string;

  @Column
  lifeInsurancePolicy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Employee;
