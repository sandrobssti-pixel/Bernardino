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
import JobPosting from "./JobPosting";
import User from "./User";

// Candidatura a uma vaga (Fase 5 — módulo de RH, ver docs/MANUAL_TECNICO.md,
// seção 6.2). Criada publicamente (sem login) via o formulário da página de
// vagas; a partir daí só a equipe de RH da empresa (autenticada) interage —
// triagem (muda status/notas/nota) e, no fim, efetivação (gera um User,
// preenche hiredUserId).
@Table
class JobApplication extends Model<JobApplication> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  candidateName: string;

  @AllowNull(false)
  @Column
  candidateEmail: string;

  @Default("")
  @Column
  candidatePhone: string;

  @Default("")
  @Column(DataType.TEXT)
  coverLetter: string;

  // Caminho público do currículo enviado (ex.: /public/company1/resumes/arquivo.pdf).
  @Default("")
  @Column(DataType.TEXT)
  resumeUrl: string;

  // "received" | "screening" | "interview" | "approved" | "rejected"
  @Default("received")
  @Column
  status: string;

  // Observações internas da equipe de RH — nunca visível pro candidato.
  @Default("")
  @Column(DataType.TEXT)
  notes: string;

  @Column
  rating: number;

  @AllowNull(false)
  @ForeignKey(() => JobPosting)
  @Column
  jobPostingId: number;

  @BelongsTo(() => JobPosting)
  jobPosting: JobPosting;

  @ForeignKey(() => User)
  @Column
  hiredUserId: number;

  @BelongsTo(() => User)
  hiredUser: User;

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

export default JobApplication;
