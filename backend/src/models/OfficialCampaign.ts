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
  HasMany,
  DataType,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import ContactList from "./ContactList";
import Whatsapp from "./Whatsapp";
import OfficialCampaignShipping from "./OfficialCampaignShipping";

@Table({ tableName: "OfficialCampaigns" })
class OfficialCampaign extends Model<OfficialCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Default("INATIVA")
  @Column
  status: string;

  @Column(DataType.DATE)
  scheduledAt: Date;

  @Column(DataType.DATE)
  completedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => ContactList)
  @Column
  contactListId: number;

  @BelongsTo(() => ContactList)
  contactList: ContactList;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column(DataType.STRING)
  templateIdMeta: string;

  @Column(DataType.STRING)
  templateName: string;

  @Column(DataType.STRING)
  templateLanguage: string;

  @Column(DataType.STRING)
  templateCategory: string;

  @Column(DataType.JSONB)
  templateComponents: any;

  @Column(DataType.JSONB)
  headerVariables: string[];

  @Column(DataType.STRING)
  headerMediaUrl: string;

  @Column(DataType.JSONB)
  bodyVariables: string[];

  @Default("closed")
  @Column
  statusTicket: string;

  @HasMany(() => OfficialCampaignShipping)
  shipping: OfficialCampaignShipping[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default OfficialCampaign;
