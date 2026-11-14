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
  Default
} from "sequelize-typescript";
import FinanceCashRegister from "./FinanceCashRegister";

// Item de um lançamento do Caixa Registradora — "frente de caixa" pra
// vendas sem nota fiscal (pedido do cliente, v2.3.292). Mesmos nomes de
// coluna já usados em SaleItem (unit/quantity/unitPrice/totalPrice),
// mais `itemType`: tipo do item digitado manualmente (texto livre, sem
// catálogo fixo) — diferente do campo `type` do FinanceCashRegister
// (lista fixa Dinheiro físico/Promissória/Cheque/Venda sem nota
// fiscal). Ver docs/MANUAL_TECNICO.md.
@Table
class FinanceCashRegisterItem extends Model<FinanceCashRegisterItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default("")
  @Column
  itemType: string;

  @AllowNull(false)
  @Column
  description: string;

  @Default("UN")
  @Column
  unit: string;

  @Default("1")
  @Column
  quantity: string;

  @Default("0")
  @Column
  unitPrice: string;

  @Default("0")
  @Column
  totalPrice: string;

  @ForeignKey(() => FinanceCashRegister)
  @AllowNull(false)
  @Column
  cashRegisterId: number;

  @BelongsTo(() => FinanceCashRegister)
  cashRegister: FinanceCashRegister;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FinanceCashRegisterItem;
