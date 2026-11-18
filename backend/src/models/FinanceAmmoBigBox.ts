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
  Default
} from "sequelize-typescript";
import Company from "./Company";
import FinanceProduct from "./FinanceProduct";
import FinanceAmmoVolume from "./FinanceAmmoVolume";

// "Caixa grande" de munição (v2.3.300, pedido do cliente) — a compra
// chega numa caixa fechada maior (ex.: 20/32/10/12 unidades, conforme
// o produto), vinculada a um Produto (FinanceProduct, type
// "ammunition") já cadastrado. Dentro dela vêm várias caixinhas/
// cartelas menores (FinanceAmmoVolume), todas com o MESMO lote da
// caixa grande — por isso o lote mora AQUI (na caixa grande), não mais
// repetido manualmente em cada caixinha. Fluxo real: cadastra a caixa
// grande primeiro (produto + lote + total de unidades), depois
// cadastra cada caixinha de dentro, vinculada a ela.
//
// Lote vem em DOIS campos (LE/LF — nomenclatura própria do fabricante/
// munição; não é um número único) — nunca juntar os dois num campo só,
// cliente foi explícito: "lote LE um campo e LF outro campo".
@Table
class FinanceAmmoBigBox extends Model<FinanceAmmoBigBox> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FinanceProduct)
  @AllowNull(false)
  @Column
  productId: number;

  @BelongsTo(() => FinanceProduct)
  product: FinanceProduct;

  @AllowNull(false)
  @Column
  lotLE: string;

  @AllowNull(false)
  @Column
  lotLF: string;

  // Total de unidades (cartuchos) declarado pra essa caixa grande —
  // referência/conferência; não precisa bater exatamente com a soma
  // das caixinhas já cadastradas (uma caixa grande pode estar
  // parcialmente aberta/cadastrada ainda).
  @AllowNull(false)
  @Default(0)
  @Column
  totalUnits: number;

  @Default("")
  @Column
  notes: string;

  @HasMany(() => FinanceAmmoVolume)
  volumes: FinanceAmmoVolume[];

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

export default FinanceAmmoBigBox;
