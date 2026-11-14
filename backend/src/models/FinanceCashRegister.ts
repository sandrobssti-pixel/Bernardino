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
  HasMany,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import FinanceCustomer from "./FinanceCustomer";
import FinanceCashRegisterItem from "./FinanceCashRegisterItem";

// "Caixa Registradora" — virou um mini frente de caixa (pedido do
// cliente, v2.3.292: "vai ser um frente de caixa que só lança vendas
// sem nota fiscal"), além do lembrete original de valores físicos
// (dinheiro em espécie, promissórias, cheques). NÃO tem nenhum vínculo
// com o resto do Financeiro — não gera Conta a Pagar/Receber sozinho,
// é só um registro/lembrete. Se o valor for usado, o usuário cadastra
// a Conta a Pagar manualmente e remove esta linha. Ver
// docs/MANUAL_TECNICO.md.
@Table
class FinanceCashRegister extends Model<FinanceCashRegister> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "physical_cash" | "promissory_note" | "check" | "sale_without_invoice"
  @AllowNull(false)
  @Default("physical_cash")
  @Column
  type: string;

  // Cadastro de cliente ÚNICO (pedido do cliente: "o cadastro do
  // cliente continuar sendo único, ao digitar o nome ou cpf já
  // preenche todos os campo igual a vendas") — liga no MESMO FinanceCustomer
  // já usado em Vendas/Contas a Receber, nunca duplica um cadastro à
  // parte. Opcional — nem todo lançamento tem um cliente identificado
  // (ex.: venda avulsa em dinheiro). `name`/`document`/endereço abaixo
  // são um SNAPSHOT preenchido ao escolher o cliente (mesma lógica já
  // usada em Sale.recipientZipCode etc. — handleCustomerChange no
  // SaleModal), sempre editáveis depois, nunca mudam retroativamente
  // se o cadastro do cliente mudar.
  @ForeignKey(() => FinanceCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => FinanceCustomer)
  customer: FinanceCustomer;

  @Default("")
  @Column
  name: string;

  @Default("")
  @Column
  document: string;

  // Endereço — mesmos nomes de coluna já usados em FinanceCustomer, pra
  // manter consistência com o resto do Financeiro.
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

  // Total do lançamento — calculado automaticamente (soma dos itens,
  // ver FinanceCashRegisterService.ts), nunca digitado direto pelo
  // usuário desde a v2.3.292. Continua sendo o campo somado pelo
  // "Saldo total" da tela (FinanceRecordList.js), sem precisar mudar
  // aquela lógica.
  @Default("0")
  @Column
  value: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => FinanceCashRegisterItem)
  items: FinanceCashRegisterItem[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceCashRegister;
