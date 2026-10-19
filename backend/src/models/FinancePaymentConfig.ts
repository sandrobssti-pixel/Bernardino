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
