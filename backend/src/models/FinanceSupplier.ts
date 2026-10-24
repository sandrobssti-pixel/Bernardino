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

// Cadastro de fornecedores do módulo Financeiro (Fase 1 do roadmap — ver
// docs/MANUAL_TECNICO.md, seção 6.2).
@Table
class FinanceSupplier extends Model<FinanceSupplier> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  // "cpf" ou "cnpj"
  @Default("cnpj")
  @Column
  documentType: string;

  @Default("")
  @Column
  document: string;

  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  phone: string;

  @Default("")
  @Column
  zipCode: string;

  @Default("")
  @Column
  street: string;

  @Default("")
  @Column
  number: string;

  @Default("")
  @Column
  complement: string;

  @Default("")
  @Column
  neighborhood: string;

  @Default("")
  @Column
  city: string;

  @Default("")
  @Column
  state: string;

  @Default("")
  @Column
  contactName: string;

  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Default(true)
  @Column
  active: boolean;

  // --------------------------------------------------------------------
  // "Dados Fiscais" do Fornecedor (v2.3.211, pedido do cliente) — os
  // mesmos 13 campos de ICMS/CSOSN/IBPT que já existem no cadastro de
  // Produto (ver FinanceProduct.ts), preenchidos aqui UMA VEZ por
  // fornecedor (baseado numa nota real dele) pra servir de valor
  // padrão: ao escolher esse fornecedor no cadastro de Produto, esses
  // valores auto-preenchem os campos correspondentes do Produto
  // (continuam editáveis por produto — "não ter trabalho de preencher
  // tudo [de novo]" foi o pedido exato do cliente). Mesmos nomes de
  // campo que FinanceProduct, de propósito, pra reaproveitar o
  // mecanismo genérico de autofill em FinanceRecordModal.js.
  // --------------------------------------------------------------------

  @Default(false)
  @Column
  icmsExempt: boolean;

  @Default(false)
  @Column
  icmsSubstitution: boolean;

  @Default("0")
  @Column
  icmsOrigin: string;

  @Default("101")
  @Column
  csosnContribuinte: string;

  @Default("102")
  @Column
  csosnNaoContribuinte: string;

  @Default("3")
  @Column
  icmsBcModality: string;

  @Default("")
  @Column
  icmsStBcModality: string;

  @Default("0")
  @Column
  icmsRate: string;

  @Default("0")
  @Column
  icmsStRate: string;

  @Default("0")
  @Column
  icmsStMva: string;

  @Default("0")
  @Column
  icmsDesoneration: string;

  @Default("0")
  @Column
  ibptRate: string;

  @Default("")
  @Column
  ibptSource: string;

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

export default FinanceSupplier;
