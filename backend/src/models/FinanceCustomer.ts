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
import Contact from "./Contact";

// Cadastro de clientes do módulo Financeiro (Fase 1 do roadmap — ver
// docs/MANUAL_TECNICO.md, seção 6.2). Independente do cadastro de `Contact`
// (usado pelo atendimento via WhatsApp) porque precisa de campos fiscais que
// o Contact não tem — mas pode opcionalmente ser vinculado a um Contact já
// existente, pra reaproveitar quando o cliente financeiro também é um
// contato que já conversa pelo CRM.
@Table
class FinanceCustomer extends Model<FinanceCustomer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  // "cpf" ou "cnpj"
  @Default("cpf")
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
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

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

export default FinanceCustomer;
