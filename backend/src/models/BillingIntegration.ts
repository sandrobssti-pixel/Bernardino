import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "BillingIntegrations"
})
class BillingIntegration extends Model<BillingIntegration> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.TEXT)
  provider: string;

  @Column(DataType.TEXT)
  name: string;

  @Default(true)
  @Column
  isActive: boolean;

  @Column(DataType.JSONB)
  credentials: Record<string, unknown>;

  @Column(DataType.JSONB)
  settings: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default BillingIntegration;
