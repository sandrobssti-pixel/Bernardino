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

// Configuração fiscal da empresa-cliente (Fase 3 do roadmap — módulo fiscal,
// ver docs/MANUAL_TECNICO.md, seção 6.2). Um registro por empresa. As
// credenciais aqui são da PRÓPRIA empresa-cliente junto ao gateway de
// emissão (Focus NFe) — emite nota fiscal em nome dela (CNPJ dela), não da
// Confianza Technologies. Por isso isso é configurado pelo Admin da empresa,
// não pelo Master (diferente das credenciais de gateway de pagamento da
// assinatura do AtendeFlow, essas sim geridas pelo Master em Company).
@Table
class FiscalConfig extends Model<FiscalConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // "mei" | "simples" | "presumido" | "real"
  @Default("simples")
  @Column
  taxRegime: string;

  @Default("")
  @Column
  stateRegistration: string;

  @Default(false)
  @Column
  stateRegistrationExempt: boolean;

  @Default("")
  @Column
  municipalRegistration: string;

  // CNAE principal (Classificação Nacional de Atividades Econômicas).
  @Default("")
  @Column
  cnae: string;

  // Código IBGE do município — exigido pelo gateway pra NFS-e/NFC-e.
  @Default("")
  @Column
  cityCode: string;

  // Endereço do EMITENTE (a própria empresa-cliente) — obrigatório no XML
  // da NF-e/NFC-e (enderEmit), nunca existiu em lugar nenhum do sistema até
  // aqui (causa raiz do "Erro na validação do Schema XML" no primeiro
  // teste real, v2.3.119). Texto livre (não derivado do `cityCode` acima),
  // mesmo padrão já usado pro endereço do destinatário em
  // FocusNFeService.buildDestinatario / FinanceCustomer.
  @Default("")
  @Column
  emitterZipCode: string;

  @Default("")
  @Column
  emitterStreet: string;

  @Default("")
  @Column
  emitterNumber: string;

  @Default("")
  @Column
  emitterComplement: string;

  @Default("")
  @Column
  emitterNeighborhood: string;

  @Default("")
  @Column
  emitterCity: string;

  @Default("")
  @Column
  emitterState: string;

  @Default("")
  @Column
  emitterPhone: string;

  // Único provedor suportado por enquanto é "focusnfe" — campo já existe
  // pra permitir trocar/adicionar outro gateway no futuro sem migração nova.
  @Default("focusnfe")
  @Column
  gatewayProvider: string;

  // Substituído por `gatewayTokenSandbox`/`gatewayTokenProduction` na
  // v2.3.109 (Homologação e Produção viraram credenciais separadas, igual
  // ao próprio painel da Focus NFe) — não removido do banco pra não
  // perder token que já tinha sido salvo aqui (migration copia o valor
  // pra `gatewayTokenSandbox`), mas nenhum código novo lê/escreve este
  // campo. Ver docs/MANUAL_TECNICO.md.
  @Default("")
  @Column
  gatewayToken: string;

  @Default("")
  @Column
  gatewayTokenSandbox: string;

  @Default("")
  @Column
  gatewayTokenProduction: string;

  @Default(true)
  @Column
  sandboxEnabled: boolean;

  @Default(false)
  @Column
  productionEnabled: boolean;

  // Substituído na v2.3.112 — cliente pediu pra tirar esse seletor
  // separado, deixando só os dois cartões Homologação/Produção na tela
  // (`sandboxEnabled`/`productionEnabled` acima). Qual dos dois está
  // ativo agora é derivado direto do toggle "Produção habilitada" (ver
  // `FiscalConfigService.isProductionActive`), não lido mais daqui.
  // Coluna não removida do banco por segurança (mesmo motivo de
  // `gatewayToken` acima), só não é mais escrita/lida por código novo.
  @Default("sandbox")
  @Column
  gatewayEnvironment: string;

  @Default("1")
  @Column
  nfeSeries: string;

  @Default("1")
  @Column
  nfceSeries: string;

  @Default("1")
  @Column
  nfseSeries: string;

  // Tipo emitido automaticamente ao confirmar uma venda ("nfe"/"nfce"/
  // "nfse") — em branco significa não emitir automático, mantendo o fluxo
  // manual (botões em SaleDetailModal). Ver docs/MANUAL_TECNICO.md.
  @Default("")
  @Column
  defaultDocumentType: string;

  @Default("5102")
  @Column
  defaultCfop: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  // Chave global da Reforma Tributária 2027 (CBS/IBS) — enquanto `false`
  // (padrão), nenhum campo/regra novo da reforma tem efeito no faturamento
  // atual (NF-e/NFC-e/NFS-e continuam pelas regras de hoje). Ver
  // `Iva2027Service.ts` e docs/MANUAL_TECNICO.md.
  @Default(false)
  @Column
  reform2027Enabled: boolean;

  @AllowNull(false)
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

export default FiscalConfig;
