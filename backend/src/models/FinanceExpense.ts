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
import FinanceSupplier from "./FinanceSupplier";

// Contas a pagar (custos fixos e variados) do módulo Financeiro — Fase 2 do
// roadmap, ver docs/MANUAL_TECNICO.md, seção 6.2.
@Table
class FinanceExpense extends Model<FinanceExpense> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  // Categoria livre (ex.: Aluguel, Energia, Salários, Fornecedores...) — o
  // frontend sugere categorias comuns, mas não restringe a um enum fixo.
  @Default("Outros")
  @Column
  category: string;

  // "fixed" (custo fixo, se repete todo período) ou "variable" (custo
  // variado, pontual). Sem geração automática de recorrência nesta fase —
  // é só uma classificação pra relatórios/gráficos.
  @Default("variable")
  @Column
  costType: string;

  @Default("0")
  @Column
  value: string;

  @Column(DataType.DATEONLY)
  dueDate: Date;

  @Column(DataType.DATEONLY)
  paymentDate: Date;

  // "pending" ou "paid". "Vencido" é derivado (pending + dueDate no passado),
  // não precisa de um status próprio.
  @Default("pending")
  @Column
  status: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  @ForeignKey(() => FinanceSupplier)
  @Column
  supplierId: number;

  @BelongsTo(() => FinanceSupplier)
  supplier: FinanceSupplier;

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

export default FinanceExpense;
