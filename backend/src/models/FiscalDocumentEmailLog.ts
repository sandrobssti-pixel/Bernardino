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
import User from "./User";
import Company from "./Company";
import FiscalDocument from "./FiscalDocument";

// Auditoria de envio/reenvio de nota fiscal por e-mail (v2.3.190) — pedido
// do cliente: registrar quem pediu o reenvio, quando, pra qual(is)
// e-mail(s) e se deu certo. Uma linha por TENTATIVA (não só a última) —
// `FiscalDocumentService.sendByEmail` grava aqui tanto sucesso quanto
// falha, seja o envio pela Focus NFe ou pela Resend (ResendEmailService).
@Table
class FiscalDocumentEmailLog extends Model<FiscalDocumentEmailLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  emails: string;

  @Default(false)
  @Column
  success: boolean;

  @Default("")
  @Column(DataType.TEXT)
  errorMessage: string;

  @ForeignKey(() => FiscalDocument)
  @AllowNull(false)
  @Column
  fiscalDocumentId: number;

  @BelongsTo(() => FiscalDocument)
  fiscalDocument: FiscalDocument;

  @ForeignKey(() => User)
  @Column
  requestedByUserId: number;

  @BelongsTo(() => User)
  requestedByUser: User;

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

export default FiscalDocumentEmailLog;
