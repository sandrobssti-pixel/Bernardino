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
import Employee from "./Employee";
import User from "./User";

// Painel de Desempenho (RH — Fase 3 de 3) — ver a migration de criação
// pro raciocínio completo (tabela única pros 4 tipos de registro, igual
// `Employees` é uma tabela larga por regime de trabalho). Acesso
// restrito a Admin/Master e ao gestor do funcionário — ver
// PerformanceAccessService.ts, aplicado em todo método do
// PerformanceRecordService.ts.
@Table
class PerformanceRecord extends Model<PerformanceRecord> {
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
  @ForeignKey(() => Employee)
  @Column
  employeeId: number;

  @BelongsTo(() => Employee)
  employee: Employee;

  // "evaluation" | "okr" | "feedback_1_1" | "promotion_readiness"
  @AllowNull(false)
  @Column
  recordType: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  recordDate: string;

  @ForeignKey(() => User)
  @Column
  createdByUserId: number;

  @BelongsTo(() => User)
  createdByUser: User;

  @Column(DataType.TEXT)
  notes: string;

  // Avaliação do gestor.
  @Column
  overallRating: number;

  @Column(DataType.TEXT)
  strengths: string;

  @Column(DataType.TEXT)
  improvementAreas: string;

  @Column(DataType.TEXT)
  goals: string;

  // OKR.
  @Column(DataType.TEXT)
  objective: string;

  @Column(DataType.TEXT)
  keyResult1: string;

  @Column
  kr1Progress: number;

  @Column(DataType.TEXT)
  keyResult2: string;

  @Column
  kr2Progress: number;

  @Column(DataType.TEXT)
  keyResult3: string;

  @Column
  kr3Progress: number;

  @Column
  overallProgress: number;

  // Feedback 1:1.
  @Column(DataType.TEXT)
  topics: string;

  @Column(DataType.TEXT)
  actionItems: string;

  @Column(DataType.DATEONLY)
  nextMeetingDate: string;

  // Matriz de prontidão pra promoção.
  @Column
  targetRole: string;

  @Column
  technicalSkillScore: number;

  @Column
  leadershipScore: number;

  @Column
  communicationScore: number;

  @Column
  resultsScore: number;

  // "not_ready" | "developing" | "ready_soon" | "ready_now"
  @Column
  readinessLevel: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PerformanceRecord;
