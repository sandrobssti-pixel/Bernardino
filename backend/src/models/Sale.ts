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
import FinanceReceivable from "./FinanceReceivable";
import SaleItem from "./SaleItem";

// Venda (Fase 3 do roadmap — módulo fiscal, ver docs/MANUAL_TECNICO.md,
// seção 6.2). Existe porque NF-e/NFC-e exigem itens discriminados (produto,
// quantidade, NCM, CFOP) — uma Conta a Receber (Fase 2) é só um valor total,
// sem itens, então não dá pra virar nota fiscal sozinha. Uma venda
// confirmada gera automaticamente uma FinanceReceivable (o valor a cobrar do
// cliente) e pode, a partir daí, emitir um FiscalDocument (nota fiscal).
@Table
class Sale extends Model<Sale> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.DATEONLY)
  saleDate: Date;

  // "draft" (rascunho, ainda editável) | "confirmed" (fechada, gerou conta a
  // receber) | "cancelled"
  @Default("draft")
  @Column
  status: string;

  // Soma dos itens — mantido como coluna (não só calculado) pra não precisar
  // recalcular toda vez que lista vendas; recalculado a cada save de item.
  @Default("0")
  @Column
  totalValue: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => FinanceCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => FinanceCustomer)
  customer: FinanceCustomer;

  // Conta a receber gerada ao confirmar a venda — null enquanto "draft".
  @ForeignKey(() => FinanceReceivable)
  @Column
  receivableId: number;

  @BelongsTo(() => FinanceReceivable)
  receivable: FinanceReceivable;

  @HasMany(() => SaleItem)
  items: SaleItem[];

  @AllowNull(false)
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

export default Sale;
