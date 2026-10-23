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

// Serviço Armaria (v2.3.178) — recebimento de UMA arma específica de um
// cliente pra manutenção/conserto. Add-on separado do Despachante Bélico
// (esse acompanha documentação de CR/Posse; aqui é o serviço técnico físico
// na arma em si — "Termo de Cautela, Recebimento e Depósito de Arma de
// Fogo", modelo real de referência confirmado com o cliente). Campos
// mapeados 1:1 nas seções desse termo. Ver docs/MANUAL_TECNICO.md.
@Table
class WeaponArmoryService extends Model<WeaponArmoryService> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // --- Seção 1: Qualificação do proprietário/detentor ---
  // Pode ser preenchido buscando um Contato/Cliente Financeiro já existente
  // (mesma busca combinada já usada no Despachante Bélico, ver
  // WeaponDispatchClientService.lookupPerson) — snapshot, editável depois.
  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @AllowNull(false)
  @Column
  clientName: string;

  @Default("")
  @Column
  clientCpf: string;

  @Default("")
  @Column
  clientRg: string;

  @Default("")
  @Column
  clientProfession: string;

  @Default("")
  @Column(DataType.TEXT)
  clientAddress: string;

  @Default("")
  @Column
  clientPhone: string;

  @Default("")
  @Column
  clientEmail: string;

  // --- Seção 2: Especificação técnica do armamento e acessórios ---
  // "pistol" | "revolver" | "rifle" | "shotgun" | "other"
  @Default("")
  @Column
  weaponType: string;

  @Default("")
  @Column
  weaponBrand: string;

  @Default("")
  @Column
  weaponModel: string;

  @Default("")
  @Column
  weaponCaliber: string;

  @Default("")
  @Column
  weaponSerialNumber: string;

  @Default("")
  @Column
  weaponCapacity: string;

  @Default("")
  @Column
  weaponFinish: string;

  @Default("")
  @Column
  weaponCountryOfOrigin: string;

  @Default("0")
  @Column
  accessoriesMagazineQty: string;

  @Default(false)
  @Column
  accessoriesCase: boolean;

  @Default(false)
  @Column
  accessoriesHolster: boolean;

  @Default("")
  @Column
  accessoriesOther: string;

  // --- Seção 3: Controle documental mandatório ---
  @Default("")
  @Column
  crafNumber: string;

  @Column
  crafExpiry: Date;

  @Default("")
  @Column
  trafficGuideNumber: string;

  @Column
  trafficGuideExpiry: Date;

  // "pf_sinarm" | "eb_sigma" | "other"
  @Default("")
  @Column
  trafficGuideIssuer: string;

  // "porte" | "posse"
  @Default("")
  @Column
  authorizationType: string;

  @Default("")
  @Column
  authorizationNumber: string;

  @Column
  authorizationExpiry: Date;

  // --- Seção 4: Objeto da manutenção e estado de conservação ---
  @Default("")
  @Column(DataType.TEXT)
  serviceRequested: string;

  @Default("")
  @Column(DataType.TEXT)
  defectReported: string;

  // "excellent" | "good" | "regular" | "worn"
  @Default("")
  @Column
  conservationState: string;

  // Preenchido na conclusão — o que foi de fato executado (distinto do
  // "serviceRequested", que é o pedido inicial).
  @Default("")
  @Column(DataType.TEXT)
  workPerformedDescription: string;

  // --- Fotos antes/depois ---
  // Array de URLs em JSON (TEXT) — vários arquivos por estágio, diferente
  // do `photoUrl` único usado em Produto/Cliente/Serviço. Ver
  // WeaponArmoryServiceController.uploadPhotos/removePhoto.
  @Default("[]")
  @Column(DataType.TEXT)
  photosBefore: string;

  @Default("[]")
  @Column(DataType.TEXT)
  photosAfter: string;

  // "received" | "in_service" | "completed" | "returned"
  @Default("received")
  @Column
  status: string;

  @Column
  receivedAt: Date;

  @Column
  returnedAt: Date;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WeaponArmoryService;
