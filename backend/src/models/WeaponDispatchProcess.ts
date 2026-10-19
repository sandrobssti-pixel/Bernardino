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
import User from "./User";
import WeaponDispatchClient from "./WeaponDispatchClient";

// Um processo (card da esteira) do Despachante Bélico — 1 Cliente pode ter
// N Processos ao longo do tempo (CR novo, depois Autorização de Compra,
// depois Guia de Tráfego, anos depois uma Renovação...), confirmado com o
// cliente batendo com o uso real da base PROCESSOS do Notion dele (campo
// "Tipo de processo" é multi-seleção lá — aqui cada combinação
// tipo+momento vira um Processo próprio, não um valor dentro do mesmo
// registro). `track` decide qual esteira de `stage` é válida pra este
// processo (ver WeaponDispatchStageCatalog.ts) — derivado de `type` na
// criação, mas gravado aqui pra não precisar olhar a tabela de catálogo
// pra saber que esteira mostrar. Ver docs/MANUAL_TECNICO.md.
@Table
class WeaponDispatchProcess extends Model<WeaponDispatchProcess> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  type: string;

  // "cac" | "civil" — ver WeaponDispatchTrack em WeaponDispatchStageCatalog.ts
  @AllowNull(false)
  @Column
  track: string;

  // Chave da etapa atual dentro da trilha (`track`) — ver
  // WeaponDispatchStageCatalog.ts (`getStagesForTrack`/`isValidStage`).
  @AllowNull(false)
  @Column
  stage: string;

  @Column
  priority: number;

  // Checklist operacional (Pré-análise) — mesmo texto do pedido original.
  @Default(false)
  @Column
  isAffiliatedClub: boolean;

  @Default(false)
  @Column
  hasPsychTest: boolean;

  @Default(false)
  @Column
  hasShootingCert: boolean;

  @Default(false)
  @Column
  documentsComplete: boolean;

  @Default("")
  @Column
  protocolNumber: string;

  @Column
  protocolDate: Date;

  @Column(DataType.TEXT)
  productOrService: string;

  @Column(DataType.TEXT)
  pendingReason: string;

  @Column(DataType.TEXT)
  observations: string;

  @Default("")
  @Column
  driveUrl: string;

  @Column
  startedAt: Date;

  @ForeignKey(() => WeaponDispatchClient)
  @AllowNull(false)
  @Column
  clientId: number;

  @BelongsTo(() => WeaponDispatchClient)
  client: WeaponDispatchClient;

  // Analista responsável — mesmo campo "Responsável" do Notion, agora como
  // vínculo de verdade com User em vez de texto livre.
  @ForeignKey(() => User)
  @Column
  assignedUserId: number;

  @BelongsTo(() => User)
  assignedUser: User;

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

export default WeaponDispatchProcess;
