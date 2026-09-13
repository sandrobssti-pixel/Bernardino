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
  Default,
  DataType,
  AllowNull,
  Unique
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

@Table
class BirthdaySettings extends Model<BirthdaySettings> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Unique
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default(true)
  @Column
  userBirthdayEnabled: boolean;

  @Default(true)
  @Column
  contactBirthdayEnabled: boolean;

  @Default(
    "🎉 Parabéns, {nome}! Hoje é seu aniversário! Desejamos muito sucesso, saúde e felicidade! ✨"
  )
  @Column(DataType.TEXT)
  contactBirthdayMessage: string;

  @Default("09:00:00")
  @Column(DataType.TIME)
  sendBirthdayTime: string;

  @Default(0)
  @Column(DataType.INTEGER)
  sendIntervalSeconds: number;

  @AllowNull(true)
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId?: number;

  @BelongsTo(() => Whatsapp)
  whatsapp?: Whatsapp;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  static async getCompanySettings(companyId: number): Promise<BirthdaySettings> {
    const [settings] = await BirthdaySettings.findOrCreate({
      where: { companyId },
      defaults: {
        companyId,
        userBirthdayEnabled: true,
        contactBirthdayEnabled: true,
        contactBirthdayMessage:
          "🎉 Parabéns, {nome}! Hoje é seu aniversário! Desejamos muito sucesso, saúde e felicidade! ✨",
        sendBirthdayTime: "09:00:00",
        sendIntervalSeconds: 0,
        whatsappId: null
      }
    });

    return settings;
  }
}

export default BirthdaySettings;
