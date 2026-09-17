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
  Default
} from "sequelize-typescript";

import Company from "./Company";
import Queue from "./Queue";

@Table({
  tableName: "SlaRules"
})
class SlaRule extends Model<SlaRule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Default(15)
  @Column
  riskMinutes: number;

  @Default(20)
  @Column
  overdueMinutes: number;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

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

export default SlaRule;
