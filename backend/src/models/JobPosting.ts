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
import JobApplication from "./JobApplication";

// Vaga de emprego (Fase 5 — módulo de RH, ver docs/MANUAL_TECNICO.md, seção
// 6.2). Só vagas com status "open" aparecem na página pública de vagas da
// empresa (sem login, ver JobPostingController.publicIndex/publicShow).
@Table
class JobPosting extends Model<JobPosting> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  title: string;

  @Default("")
  @Column
  department: string;

  @Default("")
  @Column(DataType.TEXT)
  description: string;

  @Default("")
  @Column(DataType.TEXT)
  requirements: string;

  // "clt" | "pj" | "estagio" | "temporario"
  @Default("clt")
  @Column
  employmentType: string;

  // "presencial" | "remoto" | "hibrido"
  @Default("presencial")
  @Column
  workMode: string;

  @Default("")
  @Column
  salaryRange: string;

  @Default("")
  @Column
  location: string;

  // "open" | "closed"
  @Default("open")
  @Column
  status: string;

  @HasMany(() => JobApplication)
  applications: JobApplication[];

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

export default JobPosting;
