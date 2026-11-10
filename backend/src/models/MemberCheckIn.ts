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
import Member from "./Member";

// Registro de presença (Controle de Acesso) — Decreto nº 11.615/2023,
// art. 38, §5º, III (redação dada pelo Decreto nº 12.345/2024): entidades
// de tiro desportivo devem encaminhar periodicamente ao órgão fiscalizador
// a relação de quem frequentou, "obtida por controle biométrico ou de
// reconhecimento facial" — isso é o que gera essa linha. Ver
// docs/MANUAL_TECNICO.md.
@Table
class MemberCheckIn extends Model<MemberCheckIn> {
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
  checkedInAt: Date;

  // Distância euclidiana entre o descritor cadastrado e o capturado no
  // momento do check-in — quanto menor, mais parecido (face-api.js usa
  // 0.6 como limiar padrão de "é a mesma pessoa"). Guardado pra auditoria/
  // ajuste de limiar futuro, nunca usado como prova sozinho.
  @Column(DataType.FLOAT)
  matchDistance: number;

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

export default MemberCheckIn;
