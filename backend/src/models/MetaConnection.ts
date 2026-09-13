import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table
class MetaConnection extends Model<MetaConnection> {
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
  @Default("meta")
  @Column(DataType.STRING)
  channel: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  appId: string;

  @Column(DataType.TEXT)
  appSecret: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  verifyToken: string;

  @Column(DataType.STRING)
  pageId: string;

  @Column(DataType.TEXT)
  pageAccessToken: string;

  @Column(DataType.STRING)
  instagramBusinessAccountId: string;

  @Column(DataType.STRING)
  businessId: string;

  @AllowNull(false)
  @Default("DISCONNECTED")
  @Column(DataType.STRING)
  status: string;

  @AllowNull(false)
  @Default(true)
  @Column
  isActive: boolean;

  @Column(DataType.JSONB)
  metadata: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MetaConnection;
