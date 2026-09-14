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
import Sale from "./Sale";

// Documento fiscal emitido (Fase 3 — ver docs/MANUAL_TECNICO.md, seção 6.2).
// Um registro por tentativa de emissão — se falhar e for reemitida, gera
// outro registro (histórico completo, nunca sobrescreve uma tentativa
// anterior). `externalRef` é a chave que ESTE sistema gera e manda pro
// gateway (Focus NFe usa isso como identificador único da requisição,
// idempotente); `accessKey` é a chave de acesso de 44 dígitos da nota já
// autorizada pela SEFAZ (só existe depois de autorizada).
@Table
class FiscalDocument extends Model<FiscalDocument> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "nfe" | "nfce" | "nfse"
  @AllowNull(false)
  @Column
  type: string;

  // "processing" | "authorized" | "error" | "cancelled"
  @Default("processing")
  @Column
  status: string;

  @AllowNull(false)
  @Column
  externalRef: string;

  @Default("")
  @Column
  number: string;

  @Default("")
  @Column
  series: string;

  @Default("")
  @Column
  accessKey: string;

  @Default("")
  @Column(DataType.TEXT)
  xmlUrl: string;

  @Default("")
  @Column(DataType.TEXT)
  pdfUrl: string;

  @Default("")
  @Column(DataType.TEXT)
  errorMessage: string;

  @Column(DataType.DATE)
  issuedAt: Date;

  @ForeignKey(() => Sale)
  @AllowNull(false)
  @Column
  saleId: number;

  @BelongsTo(() => Sale)
  sale: Sale;

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

export default FiscalDocument;
