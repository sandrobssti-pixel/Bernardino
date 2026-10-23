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
  Default
} from "sequelize-typescript";
import Company from "./Company";

// Configuração do gateway de COBRANÇA (Pix/boleto) por empresa — Fase 1:
// Mercado Pago. Separado de FiscalConfig de propósito: FiscalConfig guarda
// credencial do gateway de EMISSÃO de nota fiscal (Focus NFe), isso aqui
// guarda credencial de quem RECEBE o pagamento — contratos diferentes, uma
// empresa pode trocar de um sem afetar o outro. Um registro por empresa,
// mesmo padrão de FiscalConfig (findOrCreate, não é CRUD de lista). Ver
// docs/MANUAL_TECNICO.md.
@Table
class FinancePaymentConfig extends Model<FinancePaymentConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default("")
  @Column
  mercadoPagoAccessTokenSandbox: string;

  @Default("")
  @Column
  mercadoPagoAccessTokenProduction: string;

  // Secret configurado no painel do Mercado Pago ("Suas integrações" >
  // aplicação > Webhooks > "Assinatura secreta") — usado pra validar a
  // assinatura HMAC do header `x-signature` em todo webhook recebido, pra
  // nunca confiar cegamente no corpo de uma notificação (ver
  // MercadoPagoGatewayService.verifyWebhookSignature). Sem isso configurado,
  // o webhook é aceito só pra buscar o status real na API (nunca lido do
  // corpo da notificação), mas sem a camada extra de validação de origem.
  @Default("")
  @Column
  mercadoPagoWebhookSecret: string;

  // Substituído por `mercadoPagoProductionEnabled`/`asaasProductionEnabled`
  // abaixo (v2.3.158) — mesmo motivo de `provider`: cada painel ficou
  // exclusivo pro próprio gateway ("separa eles como um todo"), então
  // Produção também deixou de ser uma chave só pros dois. Coluna mantida
  // sem uso novo, mesmo padrão de coluna descontinuada.
  @Default(false)
  @Column
  productionEnabled: boolean;

  @Default(60)
  @Column
  pixExpirationMinutes: number;

  // Produção ligada tem prioridade sobre Homologação quando ambas teriam
  // token preenchido — agora independente por gateway (cada painel tem o
  // próprio botão "Produção" em Configuração de Pagamento).
  @Default(false)
  @Column
  mercadoPagoProductionEnabled: boolean;

  @Default(false)
  @Column
  asaasProductionEnabled: boolean;

  // Substituído por `mercadoPagoEnabled`/`asaasEnabled` abaixo (v2.3.158) —
  // o cliente pediu pra cada gateway ligar/desligar sozinho, independente
  // (os dois podem ficar ativos ao mesmo tempo), em vez de um seletor só
  // decidindo qual é "o ativo" pro sistema inteiro. Coluna não removida do
  // banco por segurança (mesmo motivo de `FiscalConfig.gatewayToken`), mas
  // nenhum código novo lê/escreve este campo.
  @Default("mercadopago")
  @Column
  provider: string;

  // Liga/desliga independente por gateway — o operador decide na hora
  // (painel próprio de cada um em Configuração de Pagamento), sem
  // exclusividade entre eles. Quando os dois estão ligados, quem gera a
  // cobrança numa Conta a Receber escolhe qual usar na hora (ver
  // FinanceRecordModal.js); quando só um está ligado, usa esse direto sem
  // perguntar.
  @Default(true)
  @Column
  mercadoPagoEnabled: boolean;

  @Default(false)
  @Column
  asaasEnabled: boolean;

  @Default("")
  @Column
  asaasApiKeySandbox: string;

  @Default("")
  @Column
  asaasApiKeyProduction: string;

  // Asaas não assina o webhook como o Mercado Pago (HMAC) — a validação
  // deles é um token fixo configurado no painel ("Webhooks" > "Token de
  // autenticação"), reenviado em todo POST no header `asaas-access-token`.
  // Comparado por igualdade simples (ver AsaasGatewayService.verifyWebhookToken).
  @Default("")
  @Column
  asaasWebhookToken: string;

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

export default FinancePaymentConfig;
