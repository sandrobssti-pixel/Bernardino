import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  HasMany,
  DataType
} from "sequelize-typescript";
import PayrollInssBracket from "./PayrollInssBracket";

// Versão da tabela de INSS (RH — Fase 2). GLOBAL — sem companyId, é lei
// federal igual pra todo mundo. Nunca edita uma versão existente, só
// cadastra uma nova quando os valores oficiais mudam (preserva o
// histórico de cálculos antigos corretos). Ver
// docs/MANUAL_TECNICO.md.
@Table
class PayrollInssTable extends Model<PayrollInssTable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  effectiveFrom: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 2))
  ceilingValue: number;

  @Column
  sourceReference: string;

  @HasMany(() => PayrollInssBracket)
  brackets: PayrollInssBracket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollInssTable;
