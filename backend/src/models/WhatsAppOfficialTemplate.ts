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
  AllowNull
} from "sequelize-typescript";

import Whatsapp from "./Whatsapp";

@Table({ tableName: "WhatsAppOfficialTemplates" })
class WhatsAppOfficialTemplate extends Model<WhatsAppOfficialTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Whatsapp)
  @AllowNull(false)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Column(DataType.STRING)
  templateIdMeta: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  language: string;

  @Column(DataType.STRING)
  status: string;

  @Column(DataType.STRING)
  category: string;

  @Column(DataType.JSONB)
  components: any;

  @Column(DataType.DATE)
  lastSyncedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsAppOfficialTemplate;
