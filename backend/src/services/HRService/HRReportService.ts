import { Sequelize, Op } from "sequelize";
import JobPosting from "../../models/JobPosting";
import JobApplication from "../../models/JobApplication";

interface SummaryResponse {
  openJobPostings: number;
  totalJobPostings: number;
  totalApplications: number;
  hiredCount: number;
  applicationsByStatus: { status: string; total: number }[];
  applicationsByJobPosting: { title: string; total: number }[];
}

const STATUS_ORDER = ["received", "screening", "interview", "approved", "rejected"];

// Painel de RH (Fase 5, ver docs/MANUAL_TECNICO.md, seção 6.2) — mesmo
// espírito do FinanceReportService: números agregados pro dashboard, sem
// expor lista de candidatos aqui (isso já existe em /job-applications).
export const summary = async (companyId: number): Promise<SummaryResponse> => {
  const [openJobPostings, totalJobPostings, totalApplications, hiredCount] =
    await Promise.all([
      JobPosting.count({ where: { companyId, status: "open" } }),
      JobPosting.count({ where: { companyId } }),
      JobApplication.count({ where: { companyId } }),
      JobApplication.count({ where: { companyId, hiredUserId: { [Op.ne]: null } } })
    ]);

  const statusRows = (await JobApplication.findAll({
    where: { companyId },
    attributes: ["status", [Sequelize.fn("COUNT", Sequelize.col("id")), "total"]],
    group: ["status"],
    raw: true
  })) as unknown as { status: string; total: string }[];

  const statusMap = new Map(statusRows.map((row) => [row.status, Number(row.total)]));
  const applicationsByStatus = STATUS_ORDER.map((status) => ({
    status,
    total: statusMap.get(status) || 0
  }));

  const jobPostingRows = (await JobApplication.findAll({
    where: { companyId },
    include: [{ model: JobPosting, as: "jobPosting", attributes: [] }],
    attributes: [
      [Sequelize.col("jobPosting.title"), "title"],
      [Sequelize.fn("COUNT", Sequelize.col("JobApplication.id")), "total"]
    ] as any,
    group: ["jobPosting.id", "jobPosting.title"],
    order: [[Sequelize.fn("COUNT", Sequelize.col("JobApplication.id")), "DESC"]],
    raw: true
  })) as unknown as { title: string; total: string }[];

  const applicationsByJobPosting = jobPostingRows.map((row) => ({
    title: row.title,
    total: Number(row.total)
  }));

  return {
    openJobPostings,
    totalJobPostings,
    totalApplications,
    hiredCount,
    applicationsByStatus,
    applicationsByJobPosting
  };
};
