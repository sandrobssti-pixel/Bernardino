import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { RegisterWhatsAppOficialNumber } from "../../libs/whatsAppOficial/whatsAppOficial.service";

interface Request {
  whatsappId: number;
  companyId: number;
}

interface Response {
  success: boolean;
  pin: string;
  message: string;
  howToFix?: string;
}

const requiredFields: { field: "phone_number_id" | "waba_id" | "send_token" | "business_id"; label: string }[] = [
  { field: "phone_number_id", label: "Phone Number ID" },
  { field: "waba_id", label: "WABA ID" },
  { field: "send_token", label: "Send Token" },
  { field: "business_id", label: "Business ID" }
];

const generatePin = (): string => {
  const weakPins = new Set([
    "000000", "111111", "222222", "333333", "444444",
    "555555", "666666", "777777", "888888", "999999",
    "123456", "654321"
  ]);

  let pin = "";
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (weakPins.has(pin));

  return pin;
};

const RegisterWhatsAppOficialNumberService = async ({
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

  for (const { field, label } of requiredFields) {
    if (!String((whatsapp as any)[field] || "").trim()) {
      throw new AppError(
        `O campo "${label}" não está preenchido. Salve a conexão com os dados do Meta Business Manager antes de registrar o número.`,
        400
      );
    }
  }

  if (!whatsapp.waba_webhook_id) {
    throw new AppError(
      "Esta conexão ainda não foi registrada na API Oficial. Salve a conexão novamente antes de registrar o número.",
      400
    );
  }

  const pin = whatsapp.waba_pin || generatePin();

  if (!whatsapp.waba_pin) {
    await whatsapp.update({ waba_pin: pin });
  }

  try {
    await RegisterWhatsAppOficialNumber(whatsapp.waba_webhook_id, pin);

    return {
      success: true,
      pin,
      message: "Número registrado com sucesso na Meta."
    };
  } catch (error: any) {
    const apiMessage: string | null =
      error?.response?.data?.message || error?.response?.data?.error || null;

    let message = "Não foi possível registrar o número na Meta.";
    let howToFix =
      "Verifique se o Send Token não expirou e se o Phone Number ID informado é o correto no Meta Business Manager.";

    if (apiMessage && /pin/i.test(apiMessage)) {
      message = "A Meta recusou o PIN informado (PIN de verificação em duas etapas já configurado é diferente).";
      howToFix =
        "Esse número já possui um PIN de 2FA diferente configurado na Meta. Será necessário resetar a verificação em duas etapas com o suporte da Meta Business Help Center para poder registrar com um novo PIN.";
    }

    return {
      success: false,
      pin,
      message: apiMessage ? `${message} (${apiMessage})` : message,
      howToFix
    };
  }
};

export default RegisterWhatsAppOficialNumberService;
