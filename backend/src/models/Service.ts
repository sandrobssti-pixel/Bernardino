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

// Cadastro de Serviço (v2.3.175, pedido do cliente) — mudança de rumo:
// "Serviços" NÃO vira um módulo separado com plano/liberação própria
// (diferente do Despachante Bélico) — é só um cadastro de referência,
// bem mais simples que o Produto: código, nome, valor, condições de
// pagamento, descrição, foto. De propósito SEM nada de fiscal/tributário
// (ICMS/CSOSN/CFOP/NCM) nem SKU — o cliente foi explícito: "nao cai nada
// com relação a questoes tributaria fiscal e numero de sku". Isso é
// diferente de Financeiro → Produtos → Tipo=Serviço, que continua
// existindo pra quem precisa vender um serviço com nota fiscal de
// verdade (ISS, CFOP de serviço etc.) — os dois coexistem, não um
// substitui o outro.
//
// Criado pra ser a base de referência de "Tipo de serviço" na ficha do
// Despachante Bélico (WeaponDispatchProcess.serviceId) — escolher um
// serviço aqui já traz nome/valor prontos, sem precisar digitar de novo.
// Ver docs/MANUAL_TECNICO.md.
@Table
class Service extends Model<Service> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // Código do serviço — texto livre, opcional (o cliente pode não usar
  // nenhuma convenção de código, ou usar algo tipo "CAC01"). Nunca
  // obrigatório, diferente do SKU de Produto.
  @Default("")
  @Column
  code: string;

  @AllowNull(false)
  @Column
  name: string;

  // String (não float), mesmo padrão de FinanceProduct.price — evita
  // erro de arredondamento vindo do frontend.
  @Default("0")
  @Column
  value: string;

  // "Condições de pagamento" — texto livre, descritivo (ex.: "À vista ou
  // parcelado em até 3x") — informativo, não dispara nenhuma cobrança
  // nem é a mesma coisa que a Forma de Pagamento escolhida por processo
  // na ficha do Despachante Bélico.
  @Default("")
  @Column
  paymentTerms: string;

  @Default("")
  @Column(DataType.TEXT)
  description: string;

  // Mesmo padrão de FinanceProduct.photoUrl/WeaponDispatchClient.photoUrl
  // — upload via rota dedicada depois do serviço já existir.
  @Default("")
  @Column
  photoUrl: string;

  @Default(true)
  @Column
  active: boolean;

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

export default Service;
