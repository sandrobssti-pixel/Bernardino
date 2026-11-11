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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

// Certificado digital A1 (.pfx/.p12) da ENTIDADE — ver comentário da
// migration create-company-digital-certificates. Um por empresa
// (companyId único). O arquivo e a senha SEMPRE ficam criptografados
// (utils/companyCertificateCrypto.ts) — nunca expostos em resposta de
// API (ver CompanyCertificateService.PUBLIC_ATTRIBUTES). Ver
// docs/MANUAL_TECNICO.md.
@Table
class CompanyDigitalCertificate extends Model<CompanyDigitalCertificate> {
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
  @Column(DataType.TEXT)
  pfxEncrypted: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  passwordEncrypted: string;

  @Column
  fileName: string;

  // CN extraído do certificado na hora do upload (ex.: "CACTUS CLUBE DE
  // TIRO:00188333000196") — só informativo, pra tela confirmar qual
  // certificado está carregado sem precisar decifrar nada.
  @Column
  subjectName: string;

  @Column
  validUntil: Date;

  @ForeignKey(() => User)
  @Column
  uploadedByUserId: number;

  @BelongsTo(() => User)
  uploadedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CompanyDigitalCertificate;
