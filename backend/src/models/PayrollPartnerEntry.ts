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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import CompanyPartner from "./CompanyPartner";
import PayrollInssTable from "./PayrollInssTable";
import PayrollIrrfTable from "./PayrollIrrfTable";

// Folha de pró-labore dos Sócios (RH) — um registro persistido por
// sócio/competência (mês/ano), resultado do cálculo de INSS/IRRF sobre
// o pró-labore (ver PayrollCalculationService.calculatePartnerPayroll).
// Tabela PRÓPRIA, separada de `PayrollEntries` (ver comentário na
// migration de criação). Guarda SNAPSHOT do pró-labore usado no
// cálculo — o cadastro do sócio pode mudar depois sem afetar folhas já
// calculadas. Recalcular a mesma competência faz UPSERT (índice único
// partnerId+competencyMonth+competencyYear), não duplica.
@Table
class PayrollPartnerEntry extends Model<PayrollPartnerEntry> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @ForeignKey(() => CompanyPartner)
  @Column
  partnerId: number;

  @BelongsTo(() => CompanyPartner)
  partner: CompanyPartner;

  @AllowNull(false)
  @Column
  competencyMonth: number;

  @AllowNull(false)
  @Column
  competencyYear: number;

  @Column(DataType.DECIMAL(12, 2))
  prolaboreSnapshot: number;

  @Column(DataType.DECIMAL(12, 2))
  inssBase: number;

  @Column(DataType.DECIMAL(12, 2))
  inssValue: number;

  @ForeignKey(() => PayrollInssTable)
  @Column
  inssTableId: number;

  @BelongsTo(() => PayrollInssTable)
  inssTable: PayrollInssTable;

  @Column(DataType.DECIMAL(12, 2))
  irrfBase: number;

  @Column(DataType.DECIMAL(12, 2))
  irrfValue: number;

  // Quanto do IRRF "cheio" foi abatido pelo redutor da Lei 15.270/2025
  // — mesma transparência/auditoria já usada em `PayrollEntry`.
  @Column(DataType.DECIMAL(12, 2))
  irrfReductionValue: number;

  @ForeignKey(() => PayrollIrrfTable)
  @Column
  irrfTableId: number;

  @BelongsTo(() => PayrollIrrfTable)
  irrfTable: PayrollIrrfTable;

  @Column(DataType.DECIMAL(12, 2))
  netValue: number;

  @AllowNull(false)
  @Column
  calculatedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PayrollPartnerEntry;
