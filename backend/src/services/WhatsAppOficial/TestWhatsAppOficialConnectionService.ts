import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import {
  checkAPIOficial,
  getTemplatesWhatsAppOficial
} from "../../libs/whatsAppOficial/whatsAppOficial.service";

interface Request {
  whatsappId: number;
  companyId: number;
}

interface CheckResult {
  check: string;
  status: "ok" | "error";
  message: string;
  howToFix?: string;
}

interface Response {
  success: boolean;
  checks: CheckResult[];
}

const requiredFields: { field: "phone_number_id" | "waba_id" | "send_token" | "business_id" | "phone_number"; label: string }[] = [
  { field: "phone_number_id", label: "Phone Number ID" },
  { field: "waba_id", label: "WABA ID" },
  { field: "send_token", label: "Send Token" },
  { field: "business_id", label: "Business ID" },
  { field: "phone_number", label: "Phone Number" }
];

const TestWhatsAppOficialConnectionService = async ({
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada", 404);
  }

  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("A conexão informada não é WhatsApp API Oficial", 400);
  }

  const checks: CheckResult[] = [];
  let missingRequired = false;

  for (const { field, label } of requiredFields) {
    const value = (whatsapp as any)[field];
    if (!String(value || "").trim()) {
      missingRequired = true;
      checks.push({
        check: label,
        status: "error",
        message: `O campo "${label}" não está preenchido.`,
        howToFix: `Preencha o campo "${label}" com o valor correspondente do seu WhatsApp Business Account no Meta Business Manager, salve a conexão e teste novamente.`
      });
    }
  }

  if (!String(whatsapp.token || "").trim()) {
    missingRequired = true;
    checks.push({
      check: "Token da conexão",
      status: "error",
      message: "O token interno da conexão não foi gerado.",
      howToFix: "Salve a conexão novamente para que o sistema gere o token automaticamente."
    });
  }

  if (missingRequired) {
    return { success: false, checks };
  }

  checks.push({
    check: "Campos obrigatórios",
    status: "ok",
    message: "Todos os campos obrigatórios estão preenchidos."
  });

  try {
    await checkAPIOficial();
    checks.push({
      check: "Serviço da API Oficial",
      status: "ok",
      message: "O serviço de integração com a Meta está disponível."
    });
  } catch (error: any) {
    checks.push({
      check: "Serviço da API Oficial",
      status: "error",
      message: "Não foi possível validar a integração com a Meta no momento.",
      howToFix: "Confira se Phone Number ID, WABA ID, Business ID e Send Token desta conexão estão exatamente iguais aos exibidos no seu app da Meta (Meta for Developers/Business Manager > WhatsApp > Configuração da API) e tente novamente em alguns instantes. Se o erro continuar mesmo com os dados corretos, entre em contato com o suporte."
    });
    return { success: false, checks };
  }

  if (!whatsapp.waba_webhook_id) {
    checks.push({
      check: "Cadastro da conexão",
      status: "error",
      message: "Esta conexão ainda não foi registrada na API Oficial (nenhum webhook vinculado).",
      howToFix: "Edite e salve a conexão novamente para que o sistema tente registrá-la na API Oficial. Se o erro persistir, confira se Phone Number ID, WABA ID, Business ID e Send Token estão corretos."
    });
    return { success: false, checks };
  }

  checks.push({
    check: "Cadastro da conexão",
    status: "ok",
    message: "Conexão registrada corretamente na API Oficial."
  });

  try {
    const result = await getTemplatesWhatsAppOficial(whatsapp.token);
    const total = Array.isArray(result?.data) ? result.data.length : 0;

    checks.push({
      check: "Comunicação com a Meta",
      status: "ok",
      message: `Conexão validada com sucesso. ${total} template(s) encontrado(s) na sua conta da Meta.`
    });
  } catch (error: any) {
    const status = error?.response?.status;
    const apiMessage: string | null =
      error?.response?.data?.message || error?.response?.data?.error || null;

    let message = "Não foi possível confirmar a comunicação com a Meta.";
    let howToFix =
      "Verifique se o Send Token não expirou e se o Phone Number ID/WABA ID informados são os corretos no Meta Business Manager.";

    if (status === 401 || status === 403) {
      message = "A Meta recusou o token de envio (Send Token) informado.";
      howToFix =
        "Gere um novo token permanente (System User Token) no Meta Business Manager com acesso a este WhatsApp Business Account e atualize o campo \"Send Token\" nesta conexão.";
    } else if (status === 404) {
      message = "Phone Number ID, WABA ID ou Business ID não foram encontrados na Meta.";
      howToFix =
        "Confira se os valores de Phone Number ID, WABA ID e Business ID foram copiados corretamente do Meta Business Manager (WhatsApp > Configuração da API).";
    } else if (!status) {
      message = "Não foi possível concluir o teste no momento.";
      howToFix = "Tente novamente em alguns instantes. Se o erro continuar, confira se os dados desta conexão (Phone Number ID, WABA ID, Business ID e Send Token) conferem com o seu app da Meta e, persistindo, entre em contato com o suporte.";
    }

    checks.push({
      check: "Comunicação com a Meta",
      status: "error",
      message: apiMessage ? `${message} (${apiMessage})` : message,
      howToFix
    });
  }

  const success = checks.every(c => c.status !== "error");

  return { success, checks };
};

export default TestWhatsAppOficialConnectionService;
