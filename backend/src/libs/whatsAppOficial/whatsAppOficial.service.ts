import axios from "axios";
import fs from "fs";
import {
  ICreateConnectionWhatsAppOficial,
  ICreateConnectionWhatsAppOficialWhatsApp,
  IRegisterWhatsAppOficialResult,
  IResultTemplates,
  IReturnMessageMeta,
  ISendMessageOficial,
  IUpdateonnectionWhatsAppOficialWhatsApp
} from "./IWhatsAppOficial.interfaces";

const useOficial = process.env.USE_WHATSAPP_OFICIAL;
const urlApi = process.env.URL_API_OFICIAL;
const token = process.env.TOKEN_API_OFICIAL;

const getAuthHeader = () => ({
  Authorization: `Bearer ${token || ""}`
});

export const checkAPIOficial = async () => {
  if (!useOficial || !urlApi || !token) {
    throw new Error("API oficial não configurada");
  }

  const res = await axios.get(`${urlApi}`);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error("API Oficial indisponível");
  }
};

export const sendMessageWhatsAppOficial = async (
  filePath: string | null,
  multi100Token: string,
  data: ISendMessageOficial
): Promise<IReturnMessageMeta> => {
  await checkAPIOficial();

  const FormDataCtor: any = require("form-data");
  const formData = new FormDataCtor();

  if (filePath) {
    formData.append("file", fs.createReadStream(filePath));
  }

  formData.append("data", JSON.stringify(data));

  const res = await axios.post(
    `${urlApi}/v1/send-message-whatsapp/${multi100Token}`,
    formData,
    {
      headers: {
        ...formData.getHeaders()
      }
    }
  );

  if (res.status === 200 || res.status === 201) {
    return res.data as IReturnMessageMeta;
  }

  throw new Error("Falha ao enviar mensagem para API Oficial");
};

export const CreateCompanyWhatsAppOficial = async (
  companyId: string,
  companyName: string
) => {
  const resCompanies = await axios.get(`${urlApi}/v1/companies`, {
    headers: getAuthHeader()
  });

  const companies = Array.isArray(resCompanies.data) ? resCompanies.data : [];
  const found = companies.find((c: any) => String(c.idEmpresaMult100) === String(companyId));

  if (found) return found;

  const res = await axios.post(
    `${urlApi}/v1/companies`,
    {
      idEmpresaMult100: +companyId,
      name: companyName
    },
    { headers: getAuthHeader() }
  );

  if (res.status === 200 || res.status === 201) {
    return res.data;
  }

  throw new Error("Falha ao criar empresa na API Oficial");
};

export const CreateConnectionWhatsAppOficial = async (
  data: ICreateConnectionWhatsAppOficialWhatsApp
) => {
  const res = await axios.post(`${urlApi}/v1/whatsapp-oficial`, data, {
    headers: getAuthHeader()
  });

  if (res.status === 200 || res.status === 201) {
    return res.data;
  }

  throw new Error("Falha ao criar conexão na API Oficial");
};

export const CreateCompanyConnectionOficial = async (
  data: ICreateConnectionWhatsAppOficial
): Promise<{ webhookLink: string; connectionId: number }> => {
  await checkAPIOficial();

  const companySaved = await CreateCompanyWhatsAppOficial(
    data.company.companyId,
    data.company.companyName
  );

  const connection = await CreateConnectionWhatsAppOficial(data.whatsApp);

  return {
    webhookLink: `${urlApi}/v1/webhook/${companySaved.id}/${connection.id}`,
    connectionId: connection.id
  };
};

export const UpdateConnectionWhatsAppOficial = async (
  idWhatsApp: number,
  data: IUpdateonnectionWhatsAppOficialWhatsApp
) => {
  const res = await axios.put(`${urlApi}/v1/whatsapp-oficial/${idWhatsApp}`, data, {
    headers: getAuthHeader()
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error("Falha ao atualizar conexão na API Oficial");
  }

  return res.data;
};

export const RegisterWhatsAppOficialNumber = async (
  idWhatsApp: number,
  pin: string
): Promise<IRegisterWhatsAppOficialResult> => {
  const res = await axios.post(
    `${urlApi}/v1/whatsapp-oficial/${idWhatsApp}/register`,
    { pin },
    { headers: getAuthHeader() }
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error("Falha ao registrar número na API Oficial");
  }

  return res.data;
};

export const DeleteConnectionWhatsAppOficial = async (idWhatsApp: number) => {
  const res = await axios.delete(`${urlApi}/v1/whatsapp-oficial/${idWhatsApp}`, {
    headers: getAuthHeader()
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error("Falha ao remover conexão na API Oficial");
  }

  return res.data;
};

export const getTemplatesWhatsAppOficial = async (multi100Token: string): Promise<IResultTemplates> => {
  const res = await axios.get(`${urlApi}/v1/templates-whatsapp/${multi100Token}`, {
    headers: getAuthHeader()
  });

  if (res.status === 200 || res.status === 201) {
    return res.data as IResultTemplates;
  }

  throw new Error("Falha em listar templates da API Oficial");
};

export const setReadMessageWhatsAppOficial = async (
  multi100Token: string,
  messageId: string
) => {
  const res = await axios.post(
    `${urlApi}/v1/send-message-whatsapp/read-message/${multi100Token}/${messageId}`
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error("Falha em marcar mensagem como lida na API Oficial");
  }

  return res.data;
};
