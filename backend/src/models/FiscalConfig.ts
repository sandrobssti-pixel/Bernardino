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

  // Razão social do EMITENTE pra nota fiscal (v2.3.193) — pedido do
  // cliente mais de 10 vezes sem resolver de verdade: o nome que ia na
  // nota (`nome_emitente`) sempre usou `Company.name` direto, que é o
  // nome OPERACIONAL usado em todo o resto do AtendeFlow (login,
  // cabeçalho, identificação da empresa no sistema — "CT Confiança/
  // Cactus clube de tiro", neste caso). Trocar `Company.name` pra razão
  // social legal bagunçaria a identificação da empresa no resto do
  // sistema; esse campo aqui é dedicado só pra nota, igual
  // `emitterPhone`/`emitterEmail` já são separados de `Company.phone`/
  // `Company.email`. Quando vazio, `FocusNFeService.buildEmitente` cai
  // de volta pra `Company.name` (comportamento de sempre, não quebra
  // empresa nenhuma que já estava funcionando certo).
  @Default("")
  @Column
  emitterLegalName: string;

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

  // E-mail de contato do emitente (v2.3.184, pedido do cliente) — usado no
  // rodapé dos relatórios INTERNOS do AtendeFlow (Serviços, Termo de
  // Cautela etc.) E, desde a v2.3.213, também no payload da Focus NFe
  // (`FocusNFeService.buildEmitente`, campo `email_emitente`) — o cliente
  // tinha pedido originalmente "isso é interno, não da nota", mas
  // confirmou depois que queria o e-mail no quadro do emitente da nota
  // também. Separado de `Company.email` (login da conta) de propósito —
  // o contato fiscal/processual pode ser um e-mail diferente.
  @Default("")
  @Column
  emitterEmail: string;

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

  // CNPJ/CPF do escritório de contabilidade — alguns estados (ex. BA)
  // exigem essa informação (grupo autXML da NF-e, rejeição Sefaz 487
  // "Escritório de Contabilidade não cadastrado" quando ausente). NÃO vai
  // no payload da nota: é configuração de nível EMPRESA na própria Focus
  // NFe, sincronizada por `FocusAccountService.updateAccountingOffice`
  // sempre que esse campo muda (v2.3.128).
  @Default("")
  @Column
  accountingOfficeDocument: string;

  // "Discriminar tributos" (v2.3.193) — confirmado com o suporte da
  // Focus NFe: com esse parâmetro ligado NA CONTA da empresa lá (não é
  // campo de cada nota), a própria Focus calcula e preenche sozinha o
  // campo "V. Aprox. Tributos" do DANFE (Lei da Transparência,
  // 12.741/2012), usando a base de dados de tributos deles — sem
  // precisar mandar nada a mais em cada emissão. Mesmo padrão de sync
  // de `accountingOfficeDocument` acima: NÃO vai no payload da nota,
  // sincronizado por `FocusAccountService.updateDiscriminaImpostos`
  // sempre que esse campo muda.
  @Default(false)
  @Column
  discriminaImpostos: boolean;

  // Token de CONTA/master da Focus NFe — diferente de
  // `gatewayTokenSandbox`/`gatewayTokenProduction` (que são por empresa,
  // usados só pra emitir documento). Esse token autentica a API
  // "Empresas" (gerenciar o cadastro da empresa em si), só existe no
  // painel deles em "Minha conta", não na tela de uma empresa específica.
  @Default("")
  @Column
  focusAccountToken: string;

  // Id interno da empresa NA FOCUS (não é o CNPJ) — necessário pra montar
  // a URL `PUT /v2/empresas/{id}`. Visível na URL do painel deles ao
  // editar a empresa (ex. .../minhas_empresas/empresas/273913).
  @Default("")
  @Column
  focusCompanyId: string;

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

  // --------------------------------------------------------------------
  // Envio de nota por e-mail via Resend (v2.3.173, pedido do cliente) —
  // alternativa ao envio por e-mail já existente ("Enviar por e-mail",
  // SaleDetailModal.js), que até aqui dependia só do relay da própria
  // Focus NFe (`FocusNFeService.sendByEmail`, nunca confirmado contra
  // conta de Homologação de verdade). Com Resend habilitado, o PRÓPRIO
  // AtendeFlow baixa o DANFE (pdfUrl já resolvido) e manda o e-mail
  // direto pela API da Resend, com o remetente configurado aqui. Chave
  // de API guardada em texto puro — mesmo padrão já usado pra
  // `gatewayTokenSandbox`/`gatewayTokenProduction` acima (chave de
  // integração de API, não senha/dado pessoal — não é o mesmo caso da
  // senha do gov.br do Despachante Bélico, que é cifrada).
  // --------------------------------------------------------------------

  @Default(false)
  @Column
  resendEnabled: boolean;

  @Default("")
  @Column
  resendApiKey: string;

  @Default("")
  @Column
  resendFromEmail: string;

  @Default("")
  @Column
  resendFromName: string;

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
