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
import Member from "./Member";

// Arma PESSOAL de um associado (CAC) — diferente de FinanceWeaponUnit
// (armaria/estoque do CLUBE, módulo Financeiro). Campos espelham a
// referência real do clube-atirador.techsofttecnologia.com.br (tela
// "Editar Arma"). Ver docs/MANUAL_TECNICO.md.
@Table
class MemberWeapon extends Model<MemberWeapon> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Member)
  @AllowNull(false)
  @Column
  memberId: number;

  @BelongsTo(() => Member)
  member: Member;

  // Texto livre de propósito (mesmo motivo de Member.category) — não dá
  // pra saber, só pela tela de referência, quais eram as opções reais
  // do <select> original.
  @Default("")
  @Column
  usageType: string;

  @Default("")
  @Column
  storageLocation: string;

  @Default("")
  @Column
  brand: string;

  @AllowNull(false)
  @Column
  model: string;

  @Default("")
  @Column
  weaponType: string;

  @Default("")
  @Column
  caliber: string;

  @Default("")
  @Column
  serialNumber: string;

  // Mesmo nome de campo de FinanceWeaponUnit.sigmaRegistrationNumber,
  // por consistência (registro SIGMA/SINARM no Exército).
  @Default("")
  @Column
  sigmaRegistrationNumber: string;

  // Validade do CRAF (Certificado de Registro de Arma de Fogo) desta
  // arma específica — diferente do CR do associado (Member.crValidUntil,
  // que é do PRÓPRIO associado, não de uma arma individual).
  @Column(DataType.DATEONLY)
  crafValidUntil: Date;

  @Default(true)
  @Column
  active: boolean;

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default MemberWeapon;
