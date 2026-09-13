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
  DataType,
  Default,
  AllowNull
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";

@Table
class Task extends Model<Task> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  title: string;

  @Default("")
  @Column(DataType.TEXT)
  description: string;

  @Default("")
  @Column(DataType.TEXT)
  comments: string;

  @Default("")
  @Column(DataType.STRING)
  dueDate: string;

  @Default("pending")
  @Column(DataType.STRING)
  status: string;

  @Default("medium")
  @Column(DataType.STRING)
  priority: string;

  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  responsibleUserId: number;

  @Default("Usuário")
  @Column(DataType.STRING)
  responsibleUserName: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  createdByUserId: number;

  @Default("Usuário")
  @Column(DataType.STRING)
  createdByUserName: string;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User, "responsibleUserId")
  responsibleUser: User;

  @BelongsTo(() => User, "createdByUserId")
  createdByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Task;
