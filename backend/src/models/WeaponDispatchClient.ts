import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";

// Cliente do Despachante Bélico (CAC/Sigma e Posse/Porte/Sinarm) — módulo
// add-on separado (Plan.useWeaponDispatch), independente do cadastro de
// `FinanceCustomer` (esse é do módulo Financeiro — venda/conta a receber;
// este aqui é quem está TRAMITANDO um processo, pode nem ter comprado nada
// ainda). Pode opcionalmente ser vinculado a um `Contact` já existente,
// mesmo padrão de vínculo já usado em `FinanceCustomer.contactId`. Ver
// docs/MANUAL_TECNICO.md.
@Table
class WeaponDispatchClient extends Model<WeaponDispatchClient> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("")
  @Column
  cpf: string;

  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  whatsapp: string;

  // Senha do gov.br do cliente, CRIPTOGRAFADA (AES-256-GCM, ver
  // ../utils/weaponDispatchCrypto.ts) — NUNCA em texto puro (era assim no
  // Notion antes, campo "SENHA GOV"; corrigido a pedido explícito do
  // cliente). Só grava/lê através de
  // WeaponDispatchClientService.setGovPassword/getGovPassword — nunca
  // direto no model, porque toda LEITURA do valor decifrado precisa gerar
  // uma linha em WeaponDispatchGovPasswordAccessLog (auditoria).
  @Column(DataType.TEXT)
  govBrPasswordEncrypted: string;

  @Column
  govBrPasswordUpdatedAt: Date;

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WeaponDispatchClient;
