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

// Cadastro de produtos/serviços do módulo Financeiro (Fase 1 do roadmap —
// ver docs/MANUAL_TECNICO.md, seção 6.2). Campos como NCM já ficam previstos
// aqui pra facilitar a Fase 3 (módulo fiscal / NF-e), sem uso ainda.
@Table
class FinanceProduct extends Model<FinanceProduct> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  // "product" (produto, pode ter estoque) ou "service" (serviço)
  @Default("product")
  @Column
  type: string;

  @Default("")
  @Column
  sku: string;

  // Nomenclatura Comum do Mercosul — usada na emissão de NF-e (Fase 3, ainda
  // não implementada). Fica só armazenado por enquanto.
  @Default("")
  @Column
  ncm: string;

  @Default("UN")
  @Column
  unit: string;

  // Valores como string (mesma convenção de Plan.amount/Company) pra evitar
  // problema de arredondamento de ponto flutuante — formatação fica a cargo
  // do frontend.
  @Default("0")
  @Column
  price: string;

  @Default("0")
  @Column
  costPrice: string;

  @Default(false)
  @Column
  controlStock: boolean;

  @Default(0)
  @Column
  stockQuantity: number;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

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

export default FinanceProduct;
