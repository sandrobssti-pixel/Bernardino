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
import Company from "./Company";
import User from "./User";

// Auditoria de USO do certificado digital da entidade — ver comentário
// da migration create-company-certificate-access-logs. Nunca grava o
// certificado/senha aqui, só QUEM/QUANDO/POR QUÊ. Ver
// docs/MANUAL_TECNICO.md.
@Table
class CompanyCertificateAccessLog extends Model<CompanyCertificateAccessLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Default(Date.now)
  @Column
  accessedAt: Date;

  @Column
  reason: string;

  @ForeignKey(() => User)
  @Column
  accessedByUserId: number;

  @BelongsTo(() => User)
  accessedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyCertificateAccessLog;
