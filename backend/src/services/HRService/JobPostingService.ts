import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import JobPosting from "../../models/JobPosting";
import JobApplication from "../../models/JobApplication";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  status?: string;
}

interface ListResponse {
  records: JobPosting[];
  count: number;
  hasMore: boolean;
}

interface JobPostingData {
  title: string;
  department?: string;
  description?: string;
  requirements?: string;
  employmentType?: string;
  workMode?: string;
  salaryRange?: string;
  location?: string;
  status?: string;
}

const jobPostingSchema = Yup.object().shape({
  title: Yup.string().required("ERR_JOB_POSTING_INVALID_TITLE").min(2)
});

// Contagem de candidaturas por vaga — usada na listagem (admin) pra mostrar
// quantas candidaturas cada vaga já recebeu sem precisar de uma chamada
// separada por vaga.
const withApplicationCount = {
  attributes: {
    include: [
      [
        Sequelize.literal(
          '(SELECT COUNT(*) FROM "JobApplications" WHERE "JobApplications"."jobPostingId" = "JobPosting"."id")'
        ),
        "applicationCount"
      ]
    ]
  } as any
};

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  status
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("JobPosting.title")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { department: { [Op.iLike]: `%${searchParam.trim()}%` } }
    ];
  }

  if (status) {
    whereCondition.status = status;
  }

  const { count, rows: records } = await JobPosting.findAndCountAll({
    ...withApplicationCount,
    where: whereCondition,
    limit,
    offset,
    order: [["id", "DESC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<JobPosting> => {
  const record = await JobPosting.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_JOB_POSTING_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: JobPostingData,
  companyId: number
): Promise<JobPosting> => {
  try {
    await jobPostingSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await JobPosting.create({ ...data, companyId } as any);
  return record;
};

export const update = async (
  id: string | number,
  data: JobPostingData,
  companyId: number
): Promise<JobPosting> => {
  const record = await show(id, companyId);

  try {
    await jobPostingSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};

// ---------------------------------------------------------------------------
// Público (sem login) — página de vagas da empresa. Só mostra vagas "open".
// ---------------------------------------------------------------------------

const includeCompanyName = [{ association: "company", attributes: ["name"] }];

export const listPublicOpen = async (companyId: string | number): Promise<JobPosting[]> => {
  return JobPosting.findAll({
    where: { companyId, status: "open" },
    include: includeCompanyName,
    order: [["id", "DESC"]]
  });
};

export const showPublic = async (
  companyId: string | number,
  id: string | number
): Promise<JobPosting> => {
  const record = await JobPosting.findOne({
    where: { id, companyId, status: "open" },
    include: includeCompanyName
  });

  if (!record) {
    throw new AppError("ERR_JOB_POSTING_NOT_FOUND", 404);
  }

  return record;
};
