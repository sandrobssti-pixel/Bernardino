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
import OfficialCampaign from "./OfficialCampaign";
import ContactListItem from "./ContactListItem";

@Table({ tableName: "OfficialCampaignShipping" })
class OfficialCampaignShipping extends Model<OfficialCampaignShipping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  jobId: string;

  @Column
  number: string;

  @Default("PENDENTE")
  @Column
  status: string;

  @Column(DataType.TEXT)
  preview: string;

  @Column(DataType.TEXT)
  error: string;

  @Column(DataType.DATE)
  deliveredAt: Date;

  @Column
  ticketId: number;

  @ForeignKey(() => ContactListItem)
  @Column
  contactId: number;

  @BelongsTo(() => ContactListItem)
  contact: ContactListItem;

  @ForeignKey(() => OfficialCampaign)
  @Column
  officialCampaignId: number;

  @BelongsTo(() => OfficialCampaign)
  officialCampaign: OfficialCampaign;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default OfficialCampaignShipping;
