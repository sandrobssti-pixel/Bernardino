import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  BeforeCreate,
  BeforeUpdate,
  PrimaryKey,
  AutoIncrement,
  Default,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  BeforeDestroy
  ,
  AllowNull
} from "sequelize-typescript";
import { hash, compare } from "bcryptjs";
import Ticket from "./Ticket";
import Queue from "./Queue";
import UserQueue from "./UserQueue";
import Company from "./Company";
import QuickMessage from "./QuickMessage";
import Whatsapp from "./Whatsapp";
import Chatbot from "./Chatbot";

@Table
class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column({
    set(value: string | null | undefined) {
      this.setDataValue(
        "email" as any,
        (value == null ? value : String(value).trim().toLowerCase()) as any
      );
    }
  })
  email: string;

  @Column(DataType.VIRTUAL)
  password: string;

  @Column
  passwordHash: string;

  @Default(0)
  @Column
  tokenVersion: number;

  @Default("admin")
  @Column
  profile: string;

  @Default(null)
  @Column
  profileImage: string;

  @ForeignKey(() => Whatsapp)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
    set(value: number | string | null) {
      if (value === "" || value === 0) {
        // Correção Final: Use a asserção 'as any'
        this.setDataValue('whatsappId' as any, null);
      } else {
        // Correção Final: Use a asserção 'as any'
        this.setDataValue('whatsappId' as any, value);
      }
    }
  })
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column
  super: boolean;

  @Column
  online: boolean;

  @Default("00:00")
  @Column
  startWork: string;

  @Default("23:59")
  @Column
  endWork: string;

  @Default("")
  @Column
  color: string;

  @Default("enable")
  @Column
  allTicket: string;

  @Default(false)
  @Column
  allowGroup: boolean;

  @Default("light")
  @Column
  defaultTheme: string;

  @Default("open")
  @Column
  defaultMenu: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  lastLogin: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => UserQueue)
  queues: Queue[];

  @HasMany(() => QuickMessage, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  quickMessages: QuickMessage[];

  @BeforeUpdate
  @BeforeCreate
  static hashPassword = async (instance: User): Promise<void> => {
    if (instance.password) {
      instance.passwordHash = await hash(instance.password, 8);
    }
  };

  public checkPassword = async (password: string): Promise<boolean> => {
    return compare(password, this.getDataValue("passwordHash"));
  };

  @Default("disabled")
  @Column
  allHistoric: string;

  @HasMany(() => Chatbot, {
    onUpdate: "SET NULL",
    onDelete: "SET NULL",
    hooks: true
  })
  chatbot: Chatbot[];

  @Default("disabled")
  @Column
  allUserChat: string;

  @Default("enabled")
  @Column
  userClosePendingTicket: string;

  @Default("disabled")
  @Column
  canDeleteTickets: string;

  @Default("disabled")
  @Column
  showDashboard: string;

  // === NOVO CAMPO (alinhado com a migration 20250814171423-add-canViewAllContacts-to-users.js) ===
  @Default(false)
  @Column(DataType.BOOLEAN)
  canViewAllContacts: boolean;
  // ===============================================================================================

  @Default(550)
  @Column
  defaultTicketsManagerWidth: number;

  @Default("disable")
  @Column
  allowRealTime: string;

  @Default("disable")
  @Column
  allowConnections: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  blockMultipleLogins: boolean;

  // Acesso ao módulo Financeiro (cadastro de clientes/fornecedores/produtos etc.).
  // Só tem efeito se a empresa (via Plan) tiver o módulo contratado — ver
  // Plan.useFinancial. Concedido pelo Admin da empresa a usuários específicos
  // (funcionários); Admin e Master sempre têm acesso quando o módulo está ativo,
  // independente deste campo.
  @Default(false)
  @Column(DataType.BOOLEAN)
  financialAccess: boolean;

  // Acesso ao módulo de RH/recrutamento (vagas, candidaturas) — Fase 5, ver
  // docs/MANUAL_TECNICO.md, seção 6.2. Mesmo padrão do financialAccess:
  // só tem efeito se o plano incluir (Plan.useHR); Admin e Master sempre
  // têm acesso quando o módulo está ativo, independente deste campo.
  @Default(false)
  @Column(DataType.BOOLEAN)
  hrAccess: boolean;

  @Default("pt-BR")
  @Column(DataType.STRING)
  language: string;

  @Column(DataType.STRING(64)) // Added for password reset token
  passwordResetToken: string | null;

  @Column(DataType.DATE) // Added for password reset expiration
  passwordResetExpires: Date | null;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  birthDate?: Date | null;

  @BeforeDestroy
  static async updateChatbotsUsersReferences(user: User) {
    await Chatbot.update({ optUserId: null }, { where: { optUserId: user.id } });
  }
}

export default User;
