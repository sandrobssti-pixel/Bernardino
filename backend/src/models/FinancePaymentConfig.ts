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

  // Mesmo padrão de FiscalConfig.productionEnabled — Produção ligada tem
  // prioridade sobre Homologação quando ambas teriam token preenchido.
  @Default(false)
  @Column
  productionEnabled: boolean;

  @Default(60)
  @Column
  pixExpirationMinutes: number;

  // Qual gateway gera a PRÓXIMA cobrança quando o Admin clica "Gerar Pix"/
  // "Gerar boleto" numa Conta a Receber — "mercadopago" (Fase 1) ou "asaas"
  // (Fase 2). Mesmo padrão de FiscalConfig.gatewayProvider. Trocar de
  // gateway não afeta cobranças já geradas (ficam com o `paymentProvider`
  // gravado na hora, em FinanceReceivable).
  @Default("mercadopago")
  @Column
  provider: string;

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
