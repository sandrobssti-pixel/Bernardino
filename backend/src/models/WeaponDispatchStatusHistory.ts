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
import User from "./User";
import WeaponDispatchProcess from "./WeaponDispatchProcess";

// Auditoria de troca de etapa (stage) de um WeaponDispatchProcess — toda
// mudança (manual pelo analista ou automática pelo robô de consulta de
// protocolo, Fase de automação) grava uma linha aqui, nunca sobrescreve
// "a etapa anterior" sem rastro. `changedByUserId` nulo = mudança
// automática (robô), não um usuário humano. `notificationSent`/
// `notificationChannel` registram se essa troca específica disparou
// WhatsApp/e-mail pro cliente (Fase de notificações, ainda não
// implementada nesta etapa — só o campo já existe pra não precisar de
// migration nova depois). Ver docs/MANUAL_TECNICO.md.
@Table
class WeaponDispatchStatusHistory extends Model<WeaponDispatchStatusHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  previousStage: string;

  @AllowNull(false)
  @Column
  newStage: string;

  @AllowNull(false)
  @Default(Date.now)
  @Column
  changedAt: Date;

  @Default(false)
  @Column
  notificationSent: boolean;

  @Column
  notificationChannel: string;

  @ForeignKey(() => WeaponDispatchProcess)
  @AllowNull(false)
  @Column
  processId: number;

  @BelongsTo(() => WeaponDispatchProcess)
  process: WeaponDispatchProcess;

  // Nulo = mudança automática (robô de consulta de protocolo), não um
  // usuário humano.
  @ForeignKey(() => User)
  @Column
  changedByUserId: number;

  @BelongsTo(() => User)
  changedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WeaponDispatchStatusHistory;
