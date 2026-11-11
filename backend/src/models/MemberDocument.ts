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
import Member from "./Member";
import MemberWeapon from "./MemberWeapon";

// Um documento anexado no checklist do associado (ver comentário da
// migration create-member-documents). "documentType" é a chave do
// catálogo (frontend); "weaponId" só preenchido pro CRAF (documento é
// por arma própria/ativa específica). Ver docs/MANUAL_TECNICO.md.
@Table
class MemberDocument extends Model<MemberDocument> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Member)
  @AllowNull(false)
  @Column
  memberId: number;

  @BelongsTo(() => Member)
  member: Member;

  @AllowNull(false)
  @Column
  documentType: string;

  @ForeignKey(() => MemberWeapon)
  @Column
  weaponId: number;

  @BelongsTo(() => MemberWeapon)
  weapon: MemberWeapon;

  // Nome de exibição customizado — só usado pelos tipos "multi" do
  // catálogo (ex.: "Outros Documentos", "Documentos Avulsos"), onde não
  // existe um nome fixo de documento.
  @Default("")
  @Column
  label: string;

  @AllowNull(false)
  @Column
  fileUrl: string;

  @Default("")
  @Column
  fileName: string;

  @AllowNull(false)
  @Column
  uploadedAt: Date;

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

export default MemberDocument;
