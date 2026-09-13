import nodemailer from "nodemailer";
import GetGlobalConfig from "./GetGlobalConfig";

interface WelcomeEmailData {
  to: string;
  name?: string;
  email?: string;
  password?: string;
  companyName?: string;
  dueDate?: string;
  loginUrl?: string;
  companyId?: number;
  force?: boolean;
  configOverride?: Partial<{
    smtpHost: string;
    smtpPort: string;
    smtpSecure: string;
    smtpUser: string;
    smtpPass: string;
    smtpFrom: string;
    welcomeEmailEnabled: string;
    welcomeEmailSubject: string;
    welcomeEmailTemplate: string;
  }>;
  extraVariables?: Record<string, string>;
}

const replaceVariables = (template: string, data: Record<string, string>): string => {
  let output = template;
  Object.keys(data).forEach((key) => {
    const value = data[key] || "";
    const pattern = new RegExp(`\\{${key}\\}`, "g");
    output = output.replace(pattern, value);
  });
  return output;
};

export const SendWelcomeEmail = async (data: WelcomeEmailData): Promise<boolean> => {
  const baseConfig = await GetGlobalConfig(data.companyId || 1);
  const config = {
    ...baseConfig,
    ...(data.configOverride || {})
  };

  const enabled = ["enabled", "true", "1"].includes(
    String(config.welcomeEmailEnabled || "").toLowerCase()
  );

  if (!enabled && !data.force) {
    return false;
  }

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    console.warn("[SendWelcomeEmail] SMTP incompleto. Envio ignorado.");
    return false;
  }

  const variables = {
    name: data.name || "",
    email: data.email || data.to || "",
    password: data.password || "",
    companyName: data.companyName || "",
    dueDate: data.dueDate || "",
    loginUrl: data.loginUrl || process.env.FRONTEND_URL || "",
    ...(data.extraVariables || {})
  };

  const subject = replaceVariables(
    config.welcomeEmailSubject || "Bem-vindo(a) | Seu acesso foi liberado",
    variables
  );

  const html = replaceVariables(
    config.welcomeEmailTemplate ||
      "<h2>Bem-vindo(a), {name}!</h2><p>Seu acesso foi criado com sucesso.</p>",
    variables
  );

  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort) || 587,
    secure: String(config.smtpSecure) === "true",
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  await transporter.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to: data.to,
    subject,
    text,
    html
  });

  return true;
};

export default SendWelcomeEmail;
