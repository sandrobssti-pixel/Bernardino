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
  HasMany
} from "sequelize-typescript";
import Contact from "./Contact";
import Message from "./Message";

import Plan from "./Plan";
import Queue from "./Queue";
import Setting from "./Setting";
import Ticket from "./Ticket";
import TicketTraking from "./TicketTraking";
import User from "./User";
import UserRating from "./UserRating";
import Whatsapp from "./Whatsapp";
import CompaniesSettings from "./CompaniesSettings";
import Invoices from "./Invoices";
import BirthdaySettings from "./BirthdaySettings";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  phone: string;

  @Column({
    set(value: string | null | undefined) {
      this.setDataValue(
        "email" as any,
        (value == null ? value : String(value).trim().toLowerCase()) as any
      );
    }
  })
  email: string;

  @Column({ defaultValue: "" })
  document: string;

  @Column({ defaultValue: "" })
  paymentMethod: string;

  @Column
  lastLogin: Date;

  @Column
  status: boolean;

  @Column
  dueDate: string;

  @Column
  recurrence: string;

  @Column({
    type: DataType.JSONB
  })
  schedules: [];

  @Column({
    type: DataType.JSONB
  })
  holidaySchedules: [];

  // 🔹 CONFIGURAÇÕES GLOBAIS (ADMIN / SAAS)

  @Column({ defaultValue: "" })
  mpAccessToken: string;

  @Column({ defaultValue: "mercadopago" })
  paymentGateway: string;

  @Column({ defaultValue: "" })
  asaasApiKey: string;

  @Column({ defaultValue: "" })
  asaasWebhookSecret: string;

  @Column({ type: DataType.TEXT, defaultValue: "" })
  efiClientId: string;

  @Column({ type: DataType.TEXT, defaultValue: "" })
  efiClientSecret: string;

  @Column({ type: DataType.TEXT, defaultValue: "" })
  efiCertificate: string;

  @Column({ defaultValue: "" })
  efiCertificatePassphrase: string;

  @Column({ defaultValue: "" })
  efiPixKey: string;

  @Column({ defaultValue: false })
  efiSandbox: boolean;

  @Column({ type: DataType.TEXT, defaultValue: "" })
  pushinPayToken: string;

  @Column({ defaultValue: "" })
  smtpHost: string;

  @Column({ defaultValue: "" })
  smtpPort: string;

  @Column({ defaultValue: "" })
  smtpSecure: string; // "true" ou "false"

  @Column({ defaultValue: "" })
  smtpUser: string;

  @Column({ defaultValue: "" })
  smtpPass: string;

  @Column({ defaultValue: "" })
  smtpFrom: string;

  @ForeignKey(() => Plan)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  folderSize: string;

  @Column
  numberFileFolder: string;

  @Column
  updatedAtFolder: string;

  @HasMany(() => User, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  users: User[];

  @HasMany(() => UserRating, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  userRatings: UserRating[];

  @HasMany(() => Queue, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  queues: Queue[];

  @HasMany(() => Whatsapp, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  whatsapps: Whatsapp[];

  @HasMany(() => Message, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  messages: Message[];

  @HasMany(() => Contact, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  contacts: Contact[];

  @HasMany(() => Setting, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  settings: Setting[];

  @HasMany(() => CompaniesSettings, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  companieSettings: CompaniesSettings;

  @HasMany(() => Ticket, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  tickets: Ticket[];

  @HasMany(() => TicketTraking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  ticketTrankins: TicketTraking[];

  @HasMany(() => Invoices, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  invoices: Invoices[];

  @HasMany(() => BirthdaySettings, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  birthdaySettings: BirthdaySettings[];
}

export default Company;
