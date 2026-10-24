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

  // Código sequencial do cliente (v2.3.217, pedido do cliente: "colocar o
  // código do cliente começando por 00001 em ordem crescente") — 5 dígitos
  // com zero à esquerda, sequencial POR EMPRESA (multi-tenant), atribuído
  // sozinho na criação (`FinanceCustomerService.nextCustomerCode`), nunca
  // editável pelo usuário. Diferente de `id` (chave interna do banco, não
  // pensada pra aparecer pro cliente/operador) — esse é o "código" que
  // aparece no painel, visível e sequencial de verdade.
  @Default("")
  @Column
  code: string;

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

  // Separado de `phone` de propósito — pedido do cliente (Despachante
  // Bélico): o número de WhatsApp é o que alimenta disparo automático de
  // cobrança/lembrete (campanha de inadimplência, notificação de troca de
  // status), nem sempre é o mesmo telefone de contato geral cadastrado.
  @Default("")
  @Column
  whatsapp: string;

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

  // Reforma Tributária 2027 (CBS/IBS) — perfil do destinatário da nota
  // ("B2C"/"B2B"/"B2G") e isenção do órgão público (quando B2G), usados
  // pelo motor de cálculo em `Iva2027Service.ts`. Sem efeito enquanto
  // `FiscalConfig.reform2027Enabled` for false.
  @Default("B2C")
  @Column
  ivaTaxpayerProfile: string;

  @Default(false)
  @Column
  ivaGovExempt: boolean;

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
