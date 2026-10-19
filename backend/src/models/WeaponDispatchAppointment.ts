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
import WeaponDispatchProcess from "./WeaponDispatchProcess";

// Agendamento (psicoteste ou laudo de capacidade técnica de tiro) de um
// processo — substitui a base solta "AGENDA AVALIAÇÕES PSICO - TIRO" do
// Notion do cliente, que hoje não tem vínculo estruturado com o cliente/
// processo (só casava por nome digitado). Aqui sempre pertence a um
// WeaponDispatchProcess de verdade (FK), nunca texto livre. Ver
// docs/MANUAL_TECNICO.md.
@Table
class WeaponDispatchAppointment extends Model<WeaponDispatchAppointment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "psychTest" | "shootingTest"
  @AllowNull(false)
  @Column
  type: string;

  @AllowNull(false)
  @Column
  scheduledAt: Date;

  // "scheduled" | "done" | "canceled" | "rescheduleNeeded"
  @Default("scheduled")
  @Column
  status: string;

  @Column(DataType.TEXT)
  observations: string;

  @ForeignKey(() => WeaponDispatchProcess)
  @AllowNull(false)
  @Column
  processId: number;

  @BelongsTo(() => WeaponDispatchProcess)
  process: WeaponDispatchProcess;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WeaponDispatchAppointment;
