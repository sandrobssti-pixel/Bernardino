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
  HasMany,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import FinanceCustomer from "./FinanceCustomer";
import FinanceReceivable from "./FinanceReceivable";
import SaleItem from "./SaleItem";
import FiscalDocument from "./FiscalDocument";

// Venda (Fase 3 do roadmap — módulo fiscal, ver docs/MANUAL_TECNICO.md,
// seção 6.2). Existe porque NF-e/NFC-e exigem itens discriminados (produto,
// quantidade, NCM, CFOP) — uma Conta a Receber (Fase 2) é só um valor total,
// sem itens, então não dá pra virar nota fiscal sozinha. Uma venda
// confirmada gera automaticamente uma FinanceReceivable (o valor a cobrar do
// cliente) e pode, a partir daí, emitir um FiscalDocument (nota fiscal).
@Table
class Sale extends Model<Sale> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.DATEONLY)
  saleDate: Date;

  // "draft" (rascunho, ainda editável) | "confirmed" (fechada, gerou conta a
  // receber) | "cancelled"
  @Default("draft")
  @Column
  status: string;

  // Soma dos itens — mantido como coluna (não só calculado) pra não precisar
  // recalcular toda vez que lista vendas; recalculado a cada save de item.
  @Default("0")
  @Column
  totalValue: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  // Campos fiscais pedidos pelo contador do cliente (v2.3.166) — cada um
  // mapeia pra um indicador real do schema da NF-e/NFC-e, ver comentário
  // detalhado + tabela de códigos em FocusNFeService.ts (`buildIndicadores`).
  // "internal" | "interstate" | "foreign" — idDest.
  @Default("internal")
  @Column
  operationType: string;

  // Texto livre (natureza_operacao) — antes vinha sempre fixo "Venda"/"Venda
  // ao consumidor" no FocusNFeService, agora editável por venda.
  @Default("Venda")
  @Column
  operationNature: string;

  // indPres — "0","1","2","3","5","9" (códigos oficiais da Sefaz, sem
  // tradução: ver WEAPON_DISPATCH... não, ver FocusNFeService.ts).
  @Default("1")
  @Column
  consumerPresence: string;

  // "none" | "own_site" | "marketplace" — indIntermed.
  @Default("none")
  @Column
  intermediaryType: string;

  // "normal" | "final" — indFinal.
  @Default("final")
  @Column
  finalConsumerType: string;

  // "customer" | "supplier" — classificação informativa de quem é o
  // destinatário desta venda. NÃO troca de cadastro (o destinatário
  // continua vindo sempre de FinanceCustomer, `customerId` abaixo) — é só
  // uma marcação visível na tela/impressão, pedida pelo cliente junto com
  // os outros campos fiscais. Ver seção 144 do manual técnico sobre essa
  // decisão.
  @Default("customer")
  @Column
  recipientType: string;

  // "contributor" | "exempt" | "non_contributor" — indIEDest.
  @Default("non_contributor")
  @Column
  ieIndicator: string;

  // "cash_upfront" | "credit_card" | "debit_card" | "money" |
  // "imported_xml" | "pix" | "no_payment" — forma_pagamento (tPag).
  @Default("")
  @Column
  paymentMethod: string;

  // --------------------------------------------------------------------
  // "Finalidade da Emissão" (v2.3.168, tela de emissão de NF-e do sistema
  // de referência do cliente) — finNFe (Sefaz): "normal" (1) é o que já
  // era hardcoded no FocusNFeService antes desta entrega; os outros 5
  // valores (Complementar/Ajuste/Devolução/NF Crédito/NF Débito) nunca
  // tinham sido usados ainda neste sistema.
  // --------------------------------------------------------------------

  @Default("normal")
  @Column
  issuancePurpose: string;

  // --------------------------------------------------------------------
  // "Dados de Transporte" (v2.3.168, mesma tela) — grupo `transp` (NF-e):
  // volumes transportados, transportadora e, quando o local de entrega é
  // diferente do destinatário, o grupo `entrega`. Tudo opcional — venda
  // de balcão (a maioria) não preenche nada disso, o payload da Focus NFe
  // já manda "modalidade_frete": "9" (sem frete) como hoje quando vazio.
  // --------------------------------------------------------------------

  @Default(0)
  @Column
  volumeQuantity: number;

  @Default("")
  @Column
  volumeSpecies: string;

  @Default("")
  @Column
  volumeBrand: string;

  @Default("")
  @Column
  volumeNumber: string;

  @Default("0")
  @Column
  volumeGrossWeight: string;

  @Default("0")
  @Column
  volumeNetWeight: string;

  @Default("")
  @Column
  carrierName: string;

  @Default("")
  @Column
  carrierAddress: string;

  @Default("")
  @Column
  carrierCity: string;

  @Default("")
  @Column
  carrierState: string;

  @Default("")
  @Column
  carrierCnpj: string;

  @Default("")
  @Column
  carrierIe: string;

  @Default("")
  @Column
  deliveryName: string;

  @Default("")
  @Column
  deliveryAddress: string;

  @Default("")
  @Column
  deliveryNumber: string;

  @Default("")
  @Column
  deliveryComplement: string;

  @Default("")
  @Column
  deliveryNeighborhood: string;

  @Default("")
  @Column
  deliveryCity: string;

  @Default("")
  @Column
  deliveryState: string;

  @Default("")
  @Column
  deliveryZipCode: string;

  @Default("")
  @Column
  deliveryPhone: string;

  // "0" a "4" e "9" (Sefaz, modFrete) — já existia hardcoded "9" (sem
  // frete) no FocusNFeService; agora vira campo de verdade, mas mantém
  // "9" como default pra não mudar o comportamento de venda sem
  // transporte configurado.
  @Default("9")
  @Column
  freightResponsibility: string;

  @Default("")
  @Column
  boardingLocation: string;

  @Default("")
  @Column
  boardingState: string;

  @Default("")
  @Column
  vehiclePlate: string;

  @Default("")
  @Column
  vehicleState: string;

  @ForeignKey(() => FinanceCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => FinanceCustomer)
  customer: FinanceCustomer;

  // Conta a receber gerada ao confirmar a venda — null enquanto "draft".
  @ForeignKey(() => FinanceReceivable)
  @Column
  receivableId: number;

  @BelongsTo(() => FinanceReceivable)
  receivable: FinanceReceivable;

  @HasMany(() => SaleItem)
  items: SaleItem[];

  // Usado pra saber se a venda já teve alguma nota de Produção (nota
  // real) — decide se ela pode ser excluída de verdade como venda de
  // teste de Homologação (ver `SaleService.remove`).
  @HasMany(() => FiscalDocument)
  fiscalDocuments: FiscalDocument[];

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

export default Sale;
