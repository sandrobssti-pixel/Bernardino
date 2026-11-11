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
import Contact from "./Contact";

// Cadastro de Associados — módulo add-on genérico (Plan.useMembers), não
// específico de clube de tiro: qualquer empresa com sócios/alunos/
// associados pode usar. Independente de `Contact` (atendimento via
// WhatsApp) e de `FinanceCustomer` (venda/conta a receber do Financeiro) —
// pode opcionalmente ser vinculado a um Contact já existente, mesmo padrão
// de FinanceCustomer.contactId/WeaponDispatchClient.contactId. Ver
// docs/MANUAL_TECNICO.md.
@Table
class Member extends Model<Member> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // Código sequencial "00001", "00002"... por empresa (mesmo padrão de
  // FinanceCustomer.code/Sale.code) — também serve de número da carteirinha
  // digital (fase futura).
  @Default("")
  @Column
  code: string;

  @AllowNull(false)
  @Column
  name: string;

  @Default("")
  @Column
  document: string;

  @Default("")
  @Column
  rg: string;

  @Column(DataType.DATEONLY)
  birthDate: Date;

  @Default("")
  @Column
  email: string;

  @Default("")
  @Column
  phone: string;

  @Default("")
  @Column
  whatsapp: string;

  // Texto livre ("atirador", "sócio", "aluno"...) — não é enum fixo de
  // propósito, cada empresa define suas próprias categorias.
  @Default("")
  @Column
  category: string;

  // Classificação legal CAC — SEPARADA de "category" (que continua livre
  // e genérica, pra qualquer tipo de clube). "none" = não aplicável/não é
  // CAC (default; nunca "" vazio — ver comentário na migration). Valores
  // reconhecidos (Decreto 11.615/2023, art. 2º, XVII-XIX e XXV; Decreto
  // 12.345/2024, art. 2º, XXXVI): "atirador_desportivo",
  // "atirador_alto_rendimento", "cacador_excepcional",
  // "cacador_subsistencia", "colecionador".
  @Default("none")
  @Column
  cacCategory: string;

  // "pending" (cadastro incompleto — falta documento/foto/etc.) | "active"
  // | "inactive". Novo cadastro sempre nasce "pending".
  @Default("pending")
  @Column
  status: string;

  // CR (Certificado de Registro) do PRÓPRIO associado — número, órgão
  // emissor (Exército/Polícia Federal) e validade. SEPARADO de arma
  // individual (cadastro de arma pessoal do associado fica pra uma
  // entrega futura). Ver docs/MANUAL_TECNICO.md.
  @Default("")
  @Column
  crNumber: string;

  // "none" (não informado) | "EB" (Exército Brasileiro) | "PF" (Polícia
  // Federal) | "outro" — ver CR_ISSUING_AUTHORITY_OPTIONS
  // (frontend/membersConfig.js). "none", nunca "" vazio (mesmo motivo
  // de cacCategory acima).
  @Default("none")
  @Column
  crIssuingAuthority: string;

  @Column(DataType.DATEONLY)
  crValidUntil: Date;

  // Tipo/descrição do endereço PRINCIPAL (os campos de endereço em si —
  // abaixo — já existiam desde a Fase 1). "residencial" default, nunca
  // "" vazio (mesmo motivo de cacCategory/crIssuingAuthority acima).
  @Default("residencial")
  @Column
  addressType: string;

  @Default("")
  @Column
  addressDescription: string;

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

  // Caminho da foto (upload), servido estaticamente igual a qualquer outro
  // arquivo em public/company{id}/... — ver MemberController.uploadPhoto.
  @Default("")
  @Column
  photoUrl: string;

  @Column(DataType.TEXT)
  notes: string;

  // Descritor facial (128 números, JSON-stringificado) — calculado 100%
  // no NAVEGADOR (face-api.js, backend WebGL, sem nenhuma dependência
  // nativa pesada no servidor), a partir da foto já cadastrada. O
  // backend nunca processa imagem nenhuma pra isso, só guarda/compara os
  // números. Dado biométrico sensível (LGPD) — SEMPRE excluído de
  // list/show/showByContact (ver MemberService.PUBLIC_ATTRIBUTES), nunca
  // volta pro frontend; só `faceEnrolled` (abaixo) é exposto. Null =
  // reconhecimento facial não cadastrado ainda. Ver MemberFaceService.ts
  // e docs/MANUAL_TECNICO.md.
  @Column(DataType.TEXT)
  faceDescriptor: string;

  // Espelha "faceDescriptor preenchido ou não", mas como boolean simples
  // exposto normalmente — assim a tela sabe se mostra "cadastrar" ou
  // "recadastrar" reconhecimento facial sem nunca precisar expor o
  // descritor em si.
  @Default(false)
  @Column
  faceEnrolled: boolean;

  // PIN de acesso ao Portal do Associado (hash bcrypt, nunca texto puro —
  // mesmo padrão de User.passwordHash) — gerado pelo Admin
  // (MemberPortalPinService.generate), mostrado em texto puro só UMA VEZ
  // na hora da geração, pro Admin repassar ao associado. Null = portal
  // ainda não liberado pra esse associado. Ver docs/MANUAL_TECNICO.md.
  @Column(DataType.TEXT)
  portalPinHash: string;

  @Column
  portalPinSetAt: Date;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

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

export default Member;
