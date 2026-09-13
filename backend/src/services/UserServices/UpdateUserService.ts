// ARQUIVO COMPLETO E CORRIGIDO: backend/src/services/UserServices/UpdateUserService.ts

import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  startWork?: string;
  endWork?: string;
  farewellMessage?: string;
  whatsappId?: number | null;
  allTicket?: string;
  defaultTheme?: string;
  defaultMenu?: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  canDeleteTickets?: string;
  showDashboard?: string;
  defaultTicketsManagerWidth?: number;
  allowRealTime?: string;
  allowConnections?: string;
  profileImage?: string;
  language?: string; // Adicionado para garantir que o idioma seja atualizado
  canViewAllContacts?: boolean;
  blockMultipleLogins?: boolean;
  birthDate?: Date | string | null;
  super?: boolean;
}

interface UpdateUserRequest {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const normalizeBirthDate = (value?: Date | string | null): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value.split("T")[0];
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: UpdateUserRequest): Promise<Response | undefined> => {
  const user = await ShowUserService(userId, companyId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
    birthDate: Yup.date()
      .nullable()
      .transform((curr, orig) => (orig === "" ? null : curr))
      .max(new Date(), "Data de nascimento não pode ser no futuro")
  });
  
  const { name, email, password, profile, queueIds } = userData;

  try {
    await schema.validate({ name, email, password, profile, birthDate: userData.birthDate });
  } catch (err: any) {
    throw new AppError(err.message);
  }
  
  // Cria um objeto para armazenar apenas os dados que serão atualizados.
  const dataToUpdate: UserData = {};

  // Preenche o objeto apenas com os campos que foram realmente fornecidos.
  if (userData.email) { dataToUpdate.email = userData.email; }
  if (userData.name) { dataToUpdate.name = userData.name; }
  if (userData.password) { dataToUpdate.password = userData.password; }
  if (userData.profile) { dataToUpdate.profile = userData.profile; }
  if (userData.startWork) { dataToUpdate.startWork = userData.startWork; }
  if (userData.endWork) { dataToUpdate.endWork = userData.endWork; }
  // Permite limpar a mensagem de despedida (string vazia).
  if (Object.prototype.hasOwnProperty.call(userData, "farewellMessage")) {
    dataToUpdate.farewellMessage = userData.farewellMessage || "";
  }
  if (userData.allTicket) { dataToUpdate.allTicket = userData.allTicket; }
  if (userData.defaultTheme) { dataToUpdate.defaultTheme = userData.defaultTheme; }
  if (userData.defaultMenu) { dataToUpdate.defaultMenu = userData.defaultMenu; }
  if (userData.allowGroup !== undefined) { dataToUpdate.allowGroup = userData.allowGroup; }
  if (userData.allHistoric) { dataToUpdate.allHistoric = userData.allHistoric; }
  if (userData.allUserChat) { dataToUpdate.allUserChat = userData.allUserChat; }
  if (userData.userClosePendingTicket) { dataToUpdate.userClosePendingTicket = userData.userClosePendingTicket; }
  if (userData.canDeleteTickets) { dataToUpdate.canDeleteTickets = userData.canDeleteTickets; }
  if (userData.showDashboard) { dataToUpdate.showDashboard = userData.showDashboard; }
  if (userData.defaultTicketsManagerWidth) { dataToUpdate.defaultTicketsManagerWidth = userData.defaultTicketsManagerWidth; }
  if (userData.allowRealTime) { dataToUpdate.allowRealTime = userData.allowRealTime; }
  if (userData.profileImage) { dataToUpdate.profileImage = userData.profileImage; }
  if (userData.allowConnections) { dataToUpdate.allowConnections = userData.allowConnections; }
  if (userData.language) { dataToUpdate.language = userData.language; }

  // Coerção booleana explícita
  if (userData.canViewAllContacts !== undefined) {
    dataToUpdate.canViewAllContacts = !!userData.canViewAllContacts;
  }

  if (userData.blockMultipleLogins !== undefined) {
    dataToUpdate.blockMultipleLogins = !!userData.blockMultipleLogins;
  }
  if (userData.super !== undefined) {
    dataToUpdate.super = !!userData.super;
  }
  if (Object.prototype.hasOwnProperty.call(userData, "birthDate")) {
    if (!userData.birthDate) {
      dataToUpdate.birthDate = null;
    } else {
      dataToUpdate.birthDate = normalizeBirthDate(userData.birthDate) as any;
    }
  }
  
  // Lógica especial para a conexão (whatsappId):
  // Só atualiza se o campo for enviado, permitindo que seja definido como nulo.
  if (userData.whatsappId !== undefined) {
    dataToUpdate.whatsappId = userData.whatsappId === 0 ? null : userData.whatsappId;
  }

  await user.update(dataToUpdate);

  // Lógica especial para as filas:
  // Só atualiza as filas se o campo queueIds for enviado.
  if (queueIds !== undefined) {
    await user.$set("queues", queueIds);
  }

  await user.reload();

  const company = await Company.findByPk(user.companyId);
  const oldUserEmail = user.email;

  if (company?.email === oldUserEmail) {
    await company.update({
      email,
      password
    })
  }
  
  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues,
    startWork: user.startWork,
    endWork: user.endWork,
    greetingMessage: user.farewellMessage,
    allTicket: user.allTicket,

    defaultMenu: user.defaultMenu,
    defaultTheme: user.defaultTheme,
    allowGroup: user.allowGroup,
    allHistoric: user.allHistoric,
    userClosePendingTicket: user.userClosePendingTicket,
    canDeleteTickets: user.canDeleteTickets,
    showDashboard: user.showDashboard,
    defaultTicketsManagerWidth: user.defaultTicketsManagerWidth,
    allowRealTime: user.allowRealTime,
    allowConnections: user.allowConnections,
    profileImage: user.profileImage,
    birthDate: user.birthDate,

    // >>> IMPORTANTE: devolver para o front persistir o estado do select
    canViewAllContacts: !!user.canViewAllContacts,
    blockMultipleLogins: !!user.blockMultipleLogins,
    super: !!user.super
  };

  return serializedUser;
};

export default UpdateUserService;
