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
import FinanceProduct from "./FinanceProduct";
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

  // Nome do serviço escolhido (snapshot do `name` do Produto, quando vem
  // de `productId` — ver abaixo) ou uma das chaves fixas do catálogo
  // (`WEAPON_DISPATCH_PROCESS_TYPES`), quando criado sem vínculo com
  // Produto. `getTrackForProcessType` aceita os dois formatos.
  @AllowNull(false)
  @Column
  type: string;

  // "cac" | "civil" | "military" — ver WeaponDispatchTrack em WeaponDispatchStageCatalog.ts
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

  // Valor do serviço — mesmo padrão de FinanceProduct.price (string, não
  // float, pra não arriscar erro de arredondamento vindo do frontend).
  // Snapshot no momento da escolha (igual SaleItem com Produto, ver skill
  // atendeflow-dev seção 11) — editar o preço do Produto depois não muda
  // processos já criados.
  @Default("0")
  @Column
  value: string;

  // "pix" | "card" | "boleto" | "cash" — como o cliente vai pagar esse
  // serviço específico. Só um registro informativo por enquanto, não
  // dispara cobrança de verdade (isso já existe em Contas a Receber via
  // Configuração de Pagamento — ver seção 134 do manual técnico).
  @Default("")
  @Column
  paymentMethod: string;

  // Vínculo opcional com o item de verdade cadastrado em Financeiro →
  // Produtos → Serviços — pedido do cliente: escolher o "Tipo de Serviço"
  // na ficha puxa nome/valor já cadastrados ali, em vez de digitar tudo de
  // novo ou manter uma lista separada. `type` (abaixo) grava o NOME do
  // produto escolhido no momento (snapshot, não o id) — é o que decide a
  // trilha/esteira (`getTrackForProcessType`, reconhece pelo prefixo
  // "CAC -"/"Civil -"/"Militar -" do nome, ver WeaponDispatchStageCatalog.ts).
  @ForeignKey(() => FinanceProduct)
  @Column
  productId: number;

  @BelongsTo(() => FinanceProduct)
  product: FinanceProduct;

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
