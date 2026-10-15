import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Company from "./Company";
import Queue from "./Queue";
import TicketTraking from "./TicketTraking";

const buildBackendBaseUrl = (): string => {
  const rawBackendUrl = (process.env.BACKEND_URL || "").trim();
  const proxyPort = (process.env.PROXY_PORT || "").trim();

  if (!rawBackendUrl) {
    return "";
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawBackendUrl)) {
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

@Table
class Message extends Model<Message> {
  @PrimaryKey
  @Column
  id: number;

  @Column(DataType.STRING)
  remoteJid: string;

  @Column(DataType.STRING)
  participant: string;

  @Column(DataType.STRING)
  dataJson: string;

  @Default(0)
  @Column
  ack: number;

  @Default(false)
  @Column
  read: boolean;

  @Default(false)
  @Column
  fromMe: boolean;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    const storedMediaUrl = this.getDataValue("mediaUrl");
    if (!storedMediaUrl) return null;

    if (/^(https?:)?\/\//i.test(storedMediaUrl) || /^data:/i.test(storedMediaUrl)) {
      return storedMediaUrl;
    }

    if (storedMediaUrl.startsWith("/")) {
      return storedMediaUrl;
    }

    // O nome salvo em disco às vezes carrega caractere fora do padrão ASCII
    // (ex.: "º", "ç") ou até "%" literal (ex.: arquivo baixado do gov.br com
    // o nome já veio com sequência tipo "%C2%BA" dentro do próprio nome,
    // não é um escape de URL de verdade). Sem encodeURIComponent aqui, a
    // URL final não bate byte a byte com o arquivo real no disco e o
    // download/visualização dá "Cannot GET". Codificando aqui, de forma
    // centralizada, qualquer nome de arquivo (de onde quer que tenha vindo)
    // sempre gera um link que funciona.
    const encodedFileName = encodeURIComponent(storedMediaUrl);

    const baseUrl = buildBackendBaseUrl();
    if (!baseUrl) {
      return `/public/company${this.companyId}/${encodedFileName}`;
    }

    return `${baseUrl}/public/company${this.companyId}/${encodedFileName}`;

  }

  @Column
  mediaType: string;

  @Default(false)
  @Column
  isDeleted: boolean;

  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Message)
  @Column
  quotedMsgId: string;

  @BelongsTo(() => Message, "quotedMsgId")
  quotedMsg: Message;

  @Column(DataType.STRING)
  messageId?: string | null;  //adicionada

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => TicketTraking)
  @Column
  ticketTrakingId: number;

  @BelongsTo(() => TicketTraking, "ticketTrakingId")
  ticketTraking: TicketTraking;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;
  
  @Column
  wid: string;

  @Default(false)
  @Column
  isPrivate: boolean;

  @Default(false)
  @Column
  isEdited: boolean;

  @Default(false)
  @Column
  isForwarded: boolean;
}

export default Message;
