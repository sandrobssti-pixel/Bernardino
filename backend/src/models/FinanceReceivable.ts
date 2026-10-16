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
import FinanceCustomer from "./FinanceCustomer";

// Contas a receber, ligadas aos clientes cadastrados — módulo Financeiro,
// Fase 2 do roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2.
@Table
class FinanceReceivable extends Model<FinanceReceivable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  @Default("0")
  @Column
  value: string;

  @Column(DataType.DATEONLY)
  dueDate: Date;

  @Column(DataType.DATEONLY)
  receivedDate: Date;

  // "pending" ou "received". "Vencido" é derivado (pending + dueDate no
  // passado), igual FinanceExpense.
  @Default("pending")
  @Column
  status: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  // Preparação pra Split Payment do IVA via Asaas (Reforma 2027) — nenhum
  // código escreve aqui ainda, é só estrutura pronta pra quando a API do
  // Asaas liberar o split automático do imposto no pagamento online. Ver
  // docs/MANUAL_TECNICO.md.
  @Default("")
  @Column
  asaasPaymentId: string;

  @Default(false)
  @Column
  splitIvaRetido: boolean;

  @Default("0")
  @Column
  netReceivedViaAsaas: string;

  @ForeignKey(() => FinanceCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => FinanceCustomer)
  customer: FinanceCustomer;

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

export default FinanceReceivable;
