import crypto from "crypto";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import JobApplication from "../../models/JobApplication";
import JobPosting from "../../models/JobPosting";
import User from "../../models/User";
import CreateUserService from "../UserServices/CreateUserService";

interface ListRequest {
  companyId: number;
  jobPostingId?: string | number;
  status?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: JobApplication[];
  count: number;
  hasMore: boolean;
}

interface ApplicationData {
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  coverLetter?: string;
}

interface UpdateData {
  status?: string;
  notes?: string;
  rating?: number | null;
}

const includeJobPosting = [{ model: JobPosting, as: "jobPosting", attributes: ["id", "title"] }];

const applicationSchema = Yup.object().shape({
  candidateName: Yup.string().required("ERR_JOB_APPLICATION_INVALID_NAME").min(2),
  candidateEmail: Yup.string().email("ERR_JOB_APPLICATION_INVALID_EMAIL").required("ERR_JOB_APPLICATION_INVALID_EMAIL")
});

export const list = async ({
  companyId,
  jobPostingId,
  status,
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };
  if (jobPostingId) whereCondition.jobPostingId = jobPostingId;
  if (status) whereCondition.status = status;

  const { count, rows: records } = await JobApplication.findAndCountAll({
    where: whereCondition,
    include: includeJobPosting,
    limit,
    offset,
    order: [["id", "DESC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<JobApplication> => {
  const record = await JobApplication.findOne({
    where: { id, companyId },
    include: includeJobPosting
  });

  if (!record) {
    throw new AppError("ERR_JOB_APPLICATION_NOT_FOUND", 404);
  }

  return record;
};

export const update = async (
  id: string | number,
  data: UpdateData,
  companyId: number
): Promise<JobApplication> => {
  const record = await show(id, companyId);
  await record.update(data);
  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};

// Efetivação: transforma uma candidatura aprovada num User de verdade da
// empresa — reaproveita CreateUserService (mesma validação de limite de
// usuários do plano, mesmo fluxo de criação). Gera uma senha provisória
// aleatória — a equipe de RH repassa pro novo funcionário (não há envio de
// e-mail automático aqui ainda).
export const hire = async (
  id: string | number,
  companyId: number
): Promise<{ application: JobApplication; temporaryPassword: string }> => {
  const application = await show(id, companyId);

  if (application.hiredUserId) {
    throw new AppError("ERR_JOB_APPLICATION_ALREADY_HIRED");
  }

  const existingUser = await User.findOne({ where: { email: application.candidateEmail } });
  if (existingUser) {
    throw new AppError("ERR_JOB_APPLICATION_EMAIL_ALREADY_USER");
  }

  const temporaryPassword = crypto.randomBytes(6).toString("hex");

  const newUser = await CreateUserService({
    name: application.candidateName,
    email: application.candidateEmail,
    password: temporaryPassword,
    companyId,
    profile: "user"
  });

  await application.update({ hiredUserId: newUser.id, status: "approved" });

  return { application: await show(id, companyId), temporaryPassword };
};

// ---------------------------------------------------------------------------
// Público (sem login) — envio de candidatura pelo formulário da vaga.
// ---------------------------------------------------------------------------

export const createPublic = async (
  companyId: string | number,
  jobPostingId: string | number,
  data: ApplicationData,
  resumeUrl: string
): Promise<JobApplication> => {
  try {
    await applicationSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const jobPosting = await JobPosting.findOne({
    where: { id: jobPostingId, companyId, status: "open" }
  });

  if (!jobPosting) {
    throw new AppError("ERR_JOB_POSTING_NOT_FOUND", 404);
  }

  const record = await JobApplication.create({
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    candidatePhone: data.candidatePhone || "",
    coverLetter: data.coverLetter || "",
    resumeUrl,
    jobPostingId,
    companyId,
    status: "received"
  } as any);

  return record;
};
