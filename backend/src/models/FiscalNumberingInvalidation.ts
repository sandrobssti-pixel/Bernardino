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

// Inutilização de numeração de NF-e já CONFIRMADA pelo gateway — registro
// local, não depende de reconsultar o gateway pra listar (ver migration
// de criação desta tabela pro porquê). Nunca é criado pra uma tentativa
// que falhou (`FiscalNumberingService.invalidate` só grava quando o
// gateway responde `ok: true`).
@Table
class FiscalNumberingInvalidation extends Model<FiscalNumberingInvalidation> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  series: string;

  @AllowNull(false)
  @Column
  numberStart: number;

  @AllowNull(false)
  @Column
  numberEnd: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  justification: string;

  @Default("")
  @Column
  protocol: string;

  @Default("")
  @Column
  status: string;

  // "sandbox" | "production" — ambiente ativo no momento da inutilização.
  @Default("")
  @Column
  environment: string;

  @Column(DataType.JSONB)
  raw: unknown;

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

export default FiscalNumberingInvalidation;
