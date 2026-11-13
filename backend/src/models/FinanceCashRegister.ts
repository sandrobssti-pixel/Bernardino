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

// "Caixa Registradora" — pedido do cliente: lembrete de valores físicos
// dentro da empresa (dinheiro em espécie, promissórias, cheques). NÃO
// tem nenhum vínculo com o resto do Financeiro — não gera Conta a Pagar/
// Receber sozinho, é só um lembrete. Se o valor for usado, o usuário
// cadastra a Conta a Pagar manualmente e remove esta linha. Ver
// docs/MANUAL_TECNICO.md.
@Table
class FinanceCashRegister extends Model<FinanceCashRegister> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "physical_cash" | "promissory_note" | "check"
  @AllowNull(false)
  @Default("physical_cash")
  @Column
  type: string;

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

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceCashRegister;
