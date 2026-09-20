import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import ContactList from "./ContactList";

@Table({ tableName: "ContactListItems" })
class ContactListItem extends Model<ContactListItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  number: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Column
  isWhatsappValid: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

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

  @Column
  isGroup: boolean;

  // Colunas extras de uma planilha importada (ex.: cpf, vigência, mês,
  // status) que não são nome/número/e-mail — uso só interno (visualização/
  // organização da lista). Nunca é usado pela campanha, que só envia pro
  // número de WhatsApp normalizado.
  @AllowNull(true)
  @Column(DataType.JSON)
  extraData?: Record<string, any> | null;

  /* ====== ADIÇÕES PARA SUPORTE A LID/JID (não quebram nada existente) ====== */
  @AllowNull(true)
  @Column
  lid?: string | null;

  @AllowNull(true)
  @Column
  jid?: string | null;

  get chatKey(): string | null {
    return this.lid ?? this.jid ?? null;
  }
  /* ======================================================================== */
}

export default ContactListItem;
