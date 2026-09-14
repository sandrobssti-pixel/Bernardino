import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Default
} from "sequelize-typescript";

@Table
class Plan extends Model<Plan> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @Column
  name: string;

  @Column
  users: number;

  @Column
  connections: number;

  @Column
  queues: number;

  @Column
  amount: string;   

  @Column
  useWhatsapp: boolean;   

  @Default(true)
  @Column
  useWhatsappBaileys: boolean;

  @Default(true)
  @Column
  useWhatsappWuzapi: boolean;

  @Default(true)
  @Column
  useWhatsappOficial: boolean;

  @Default(true)
  @Column
  useWebchat: boolean;

  @Column
  useFacebook: boolean;

  @Column
  useInstagram: boolean;   
  
  @Column
  useCampaigns: boolean;   

  @Column
  useSchedules: boolean;   

  @Column
  useInternalChat: boolean;   
  
  @Column
  useExternalApi: boolean;   

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  useKanban: boolean;

  @Column
  trial: boolean;

  @Column
  trialDays: number;

  @Column
  recurrence: string;

  @Column
  useOpenAi: boolean;

  @Column
  useIntegrations: boolean;

  @Default(true)
  @Column
  isPublic: boolean;

  // Módulo Financeiro completo (cadastro de clientes/fornecedores/produtos,
  // custos, relatórios, contábil, RH) — add-on pago, à parte do plano-base.
  // Ver docs/MANUAL_TECNICO.md, seção 6.2.
  @Default(false)
  @Column
  useFinancial: boolean;

  // Módulo fiscal (Vendas com itens, emissão de NF-e/NFC-e/NFS-e — Fase 3) —
  // add-on separado do Financeiro (v2.3.22): o Master pode vender um plano
  // com Financeiro mas sem Fiscal. Sempre exige `useFinancial` também
  // ativo (checado em EnsureFiscalAccess), já que Vendas usa os cadastros
  // de cliente/produto do próprio Financeiro.
  @Default(false)
  @Column
  useFiscal: boolean;
}

export default Plan;
