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
import WeaponDispatchClient from "./WeaponDispatchClient";

// Auditoria de LEITURA da senha do gov.br do cliente (valor decifrado) —
// toda vez que WeaponDispatchClientService.getGovPassword é chamado, grava
// uma linha aqui antes de devolver o valor. Decisão explícita do cliente
// (continuar guardando a senha, mas criptografada + com log de acesso, em
// vez de parar de guardar) — ver docs/MANUAL_TECNICO.md. Nunca grava a
// senha aqui (nem cifrada) — só QUEM acessou, QUANDO, e POR QUÊ.
@Table
class WeaponDispatchGovPasswordAccessLog extends Model<WeaponDispatchGovPasswordAccessLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Default(Date.now)
  @Column
  accessedAt: Date;

  @Column
  reason: string;

  @ForeignKey(() => WeaponDispatchClient)
  @AllowNull(false)
  @Column
  clientId: number;

  @BelongsTo(() => WeaponDispatchClient)
  client: WeaponDispatchClient;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  accessedByUserId: number;

  @BelongsTo(() => User)
  accessedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WeaponDispatchGovPasswordAccessLog;
