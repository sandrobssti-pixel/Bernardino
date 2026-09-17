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
  Unique,
  Default,
  HasMany,
  ForeignKey,
  BelongsTo,
  BelongsToMany
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import Ticket from "./Ticket";
import Company from "./Company";
import Schedule from "./Schedule";
import ContactTag from "./ContactTag";
import Tag from "./Tag";
import ContactWallet from "./ContactWallet";
import User from "./User";
import Whatsapp from "./Whatsapp";

const buildBackendBaseUrl = (): string => {
  const rawBackendUrl = (process.env.BACKEND_URL || "").trim();
  const proxyPort = (process.env.PROXY_PORT || "").trim();

  if (!rawBackendUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawBackendUrl);
    if (proxyPort && !parsedUrl.port) {
      parsedUrl.port = proxyPort;
    }
    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return rawBackendUrl.replace(/\/+$/, "");
  }
};

const buildNoPictureUrl = (): string => {
  const frontendUrl = (process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (!frontendUrl) return "/nopicture.png";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendUrl)) {
    return "/nopicture.png";
  }
  return `${frontendUrl}/nopicture.png`;
};

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  state: string;

  @AllowNull(false)
  @Unique
  @Column
  number: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  profilePicUrl: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default(false)
  @Column
  disableBot: boolean;

  @Default(true)
  @Column
  acceptAudioMessage: boolean;

  @Default(true)
  @Column
  active: boolean;

  @Default("whatsapp")
  @Column
  channel: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @HasMany(() => ContactTag)
  contactTags: ContactTag[];

  @BelongsToMany(() => Tag, () => ContactTag)
  tags: Tag[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Schedule, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  schedules: Schedule[];

  @Column
  remoteJid: string;

  /* ====== ADIÇÕES PARA SUPORTE A LID/JID (não quebram nada existente) ====== */
  @AllowNull(true)
  @Column
  lid?: string | null;

  @AllowNull(true)
  @Column
  jid?: string | null;

  // Getter utilitário (não persiste em DB): chave canônica do chat
  get chatKey(): string | null {
    return this.lid ?? this.jid ?? null;
  }
  /* ======================================================================== */

  @Column
  lgpdAcceptedAt: Date;

  @Column
  pictureUpdated: boolean;

  @Column
  get urlPicture(): string | null {
    const storedPicture = this.getDataValue("urlPicture");
    if (storedPicture) {
      const baseUrl = buildBackendBaseUrl();
      return storedPicture === "nopicture.png"
        ? buildNoPictureUrl()
        : `${baseUrl}/public/company${this.companyId}/contacts/${storedPicture}`;
    }

    // Fallback global: quando não existe arquivo local, usa a URL remota já salva.
    const profilePicUrl = this.getDataValue("profilePicUrl");
    if (profilePicUrl) {
      return profilePicUrl;
    }

    return buildNoPictureUrl();
  }

  @BelongsToMany(() => User, () => ContactWallet, "contactId", "walletId")
  wallets: ContactWallet[];

  @HasMany(() => ContactWallet)
  contactWallets: ContactWallet[];

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  birthDate?: Date | null;

  /* ====== Cadastro obrigatório de cliente novo/número trocado (ver
     docs/MANUAL_TECNICO.md, seção 14) — CPF/RG, endereço completo e um
     segundo contato, além dos campos já existentes (nome, e-mail,
     number = WhatsApp). ====== */
  @Default("")
  @Column
  document: string;

  @Default("")
  @Column(DataType.TEXT)
  address: string;

  @Default("")
  @Column
  contact2: string;
}

export default Contact;
