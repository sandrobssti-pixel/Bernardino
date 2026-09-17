import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AutoIncrement,
  DataType
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";
import Ticket from "./Ticket";

@Table({
  tableName: "Notifications"
})
class Notification extends Model<Notification> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "sla_risk" | "sla_overdue" | "supervisor_message"
  @Column
  type: string;

  @Column
  title: string;

  @Column(DataType.TEXT)
  message: string;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

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

export default Notification;
