import { Request, Response } from "express";
import * as Yup from "yup";
import fs from "fs";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import SendWhatsAppMedia, { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { getWbot } from "../libs/wbot";
import SendWhatsAppMessageLink from "../services/WbotServices/SendWhatsAppMessageLink";
import SendWhatsAppMessageAPI from "../services/WbotServices/SendWhatsAppMessageAPI";
import SendWhatsAppMediaImage from "../services/WbotServices/SendWhatsappMediaImage";
import SendWhatsAppOficialMessage from "../services/WhatsAppOficial/SendWhatsAppOficialMessage";
import ApiUsages from "../models/ApiUsages";
import { useDate } from "../utils/useDate";
import moment from "moment";
import CompaniesSettings from "../models/CompaniesSettings";
import ShowUserService from "../services/UserServices/ShowUserService";
import { isNil } from "lodash";
import { verifyMediaMessage, verifyMessage } from "../services/WbotServices/wbotMessageListener";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import path from "path";
import Contact from "../models/Contact";
import FindOrCreateATicketTrakingService from "../services/TicketServices/FindOrCreateATicketTrakingService";
import { Mutex } from "async-mutex";
import { dynamicImport } from "../utils/dynamicImport";
import { sendWuzapiInteractiveMessage } from "../services/WuzapiServices/wuzapiClient";

type WhatsappData = {
  whatsappId: number;
};

export class OnWhatsAppDto {
  constructor(public readonly jid: string, public readonly exists: boolean) { }
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  queueId?: number;
  userId?: number;
  sendSignature?: boolean;
  closeTicket?: boolean;
  ignoreTicket?: boolean;
  noRegister?: boolean;
};

interface ContactData {
  number: string;
  isGroup: boolean;
}

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

const createContact = async (
  whatsappId: number | undefined,
  companyId: number | undefined,
  newContact: string,
  userId?: number | 0,
  queueId?: number | 0,
  wbot?: any
) => {
  try {
    // await CheckIsValidContact(newContact, companyId);
    const validNumber: any = await CheckContactNumber(
      newContact,
      companyId,
      newContact.length > 17,
      whatsappId
    );

    const contactData = {
      name: `${validNumber}`,
      number: validNumber,
      profilePicUrl: "",
      isGroup: false,
      companyId,
      whatsappId,
      remoteJid: validNumber.length > 17 ? `${validNumber}@g.us` : `${validNumber}@s.whatsapp.net`,
      wbot
    };

    const contact = await CreateOrUpdateContactService(contactData);

    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    }
    )    // return contact;

    let whatsapp: Whatsapp | null;

    if (whatsappId === undefined) {
      whatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    } else {
      whatsapp = await Whatsapp.findByPk(whatsappId);

      if (whatsapp === null) {
        throw new AppError(`whatsapp #${whatsappId} not found`);
      }
    }

    const mutex = new Mutex();
    // Inclui a busca de ticket aqui, se realmente não achar um ticket, então vai para o findorcreate
    const createTicket = await mutex.runExclusive(async () => {
      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        companyId,
        queueId,
        userId,
        null,
        whatsapp.channel,
        null,
        false,
        settings,
        false,
        false
      );
      return ticket;
    });

    if (createTicket && createTicket.channel === "whatsapp") {
      SetTicketMessagesAsRead(createTicket);

      await FindOrCreateATicketTrakingService({ ticketId: createTicket.id, companyId, whatsappId: whatsapp.id, userId });

    }

    return createTicket;
  } catch (error) {
    throw new AppError(error.message);
  }
};

// Espelha a criação de contato usada em ReceivedWhatsApp.ts (webhook da API
// Oficial): CreateOrUpdateContactService não tem branch de criação para o
// channel "whatsapp_oficial", então contato novo precisa ser criado direto.
const findOrCreateOficialContact = async (
  companyId: number,
  whatsappId: number,
  number: string
): Promise<Contact> => {
  let contact = await Contact.findOne({ where: { number, companyId } });

  if (!contact) {
    contact = await Contact.create({
      name: number,
      number,
      companyId,
      whatsappId
    } as any);
  }

  return contact;
};

const sendOficialApiMessage = async ({
  whatsapp,
  companyId,
  number,
  userId,
  queueId,
  bodyMessage,
  medias,
  closeTicket
}: {
  whatsapp: Whatsapp;
  companyId: number;
  number: string;
  userId?: number;
  queueId?: number;
  bodyMessage: string;
  medias?: Express.Multer.File[];
  closeTicket: boolean;
}): Promise<void> => {
  const contact = await findOrCreateOficialContact(companyId, whatsapp.id, number);
  const settings = await CompaniesSettings.findOne({ where: { companyId } });

  const mutex = new Mutex();
  const ticket = await mutex.runExclusive(async () =>
    FindOrCreateTicketService(
      contact,
      whatsapp,
      0,
      companyId,
      queueId,
      userId,
      null,
      whatsapp.channel,
      null,
      false,
      settings,
      false,
      false
    )
  );

  if (!ticket) {
    throw new AppError("Cliente em outro atendimento");
  }

  if (medias && medias.length) {
    for (const media of medias) {
      await SendWhatsAppOficialMessage({
        body: bodyMessage,
        ticket,
        media,
        type: null as any
      });

      const publicFolder = path.resolve(__dirname, "..", "..", "public");
      const filePath = path.join(publicFolder, `company${companyId}`, media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } else {
    await SendWhatsAppOficialMessage({
      body: bodyMessage,
      ticket,
      type: "text"
    });
  }

  if (closeTicket) {
    setTimeout(async () => {
      await UpdateTicketService({
        ticketId: ticket.id,
        ticketData: { status: "closed", sendFarewellMessage: false, amountUsedBotQueues: 0, lastMessage: bodyMessage },
        companyId
      });
    }, 100);
  } else if (userId?.toString() !== "" && !isNaN(userId)) {
    setTimeout(async () => {
      await UpdateTicketService({
        ticketId: ticket.id,
        ticketData: { status: "open", amountUsedBotQueues: 0, lastMessage: bodyMessage, userId, queueId },
        companyId
      });
    }, 100);
  }
};

function formatBRNumber(jid: string) {
  const regexp = new RegExp(/^(\d{2})(\d{2})\d{1}(\d{8})$/);
  if (regexp.test(jid)) {
    const match = regexp.exec(jid);
    if (match && match[1] === '55' && Number.isInteger(Number.parseInt(match[2]))) {
      const ddd = Number.parseInt(match[2]);
      if (ddd < 31) {
        return match[0];
      } else if (ddd >= 31) {
        return match[1] + match[2] + match[3];
      }
    }
  } else {
    return jid;
  }
}

function createJid(number: string) {
  if (number.includes('@g.us') || number.includes('@s.whatsapp.net')) {
    return formatBRNumber(number) as string;
  }
  return number.includes('-')
    ? `${number}@g.us`
    : `${formatBRNumber(number)}@s.whatsapp.net`;
}

const generateRandomCode = (length: number = 10): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

const parseJsonField = (value: any, fieldName: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    throw new AppError(`Campo ${fieldName} deve conter um JSON válido`, 400);
  }
};

const incrementApiTextUsage = async (companyId: number) => {
  const { dateToClient } = useDate();
  const hoje: string = dateToClient(new Date());
  const timestamp = moment().format();

  let exist = await ApiUsages.findOne({
    where: {
      dateUsed: hoje,
      companyId
    }
  });

  if (!exist) {
    exist = await ApiUsages.create({
      companyId,
      dateUsed: hoje
    });
  }

  await exist.update({
    usedText: exist.dataValues["usedText"] + 1,
    UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
    updatedAt: timestamp
  });
};

// export const indexLink = async (req: Request, res: Response): Promise<Response> => {
//   const newContact: ContactData = req.body;
//   const { whatsappId }: WhatsappData = req.body;
//   const { msdelay }: any = req.body;
//   const url = req.body.url;
//   const caption = req.body.caption;

//   const authHeader = req.headers.authorization;
//   const [, token] = authHeader.split(" ");
//   const whatsapp = await Whatsapp.findOne({ where: { token } });
//   const companyId = whatsapp.companyId;

//   newContact.number = newContact.number.replace("-", "").replace(" ", "");

//   const schema = Yup.object().shape({
//     number: Yup.string()
//       .required()
//       .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
//   });

//   try {
//     await schema.validate(newContact);
//   } catch (err: any) {
//     throw new AppError(err.message);
//   }

//   const contactAndTicket = await createContact(whatsappId, companyId, newContact.number);

//   if (!contactAndTicket) {
//     throw new AppError("Cliente em outro atendimento")
//   }
//   await SendWhatsAppMessageLink({ whatsappId, contact: contactAndTicket.contact, url, caption, msdelay });

//   setTimeout(async () => {
//     const { dateToClient } = useDate();

//     const hoje: string = dateToClient(new Date())
//     const timestamp = moment().format();

//     const exist = await ApiUsages.findOne({
//       where: {
//         dateUsed: hoje,
//         companyId: companyId
//       }
//     });

//     if (exist) {
//       await exist.update({
//         usedPDF: exist.dataValues["usedPDF"] + 1,
//         UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
//         updatedAt: timestamp
//       });
//     } else {
//       const usage = await ApiUsages.create({
//         companyId: companyId,
//         dateUsed: hoje,
//       });

//       await usage.update({
//         usedPDF: usage.dataValues["usedPDF"] + 1,
//         UsedOnDay: usage.dataValues["UsedOnDay"] + 1,
//         updatedAt: timestamp
//       });
//     }

//   }, 100);

//   return res.send({ status: "SUCCESS" });
// };

export const index = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;

  const { whatsappId }: WhatsappData = req.body;
  const { msdelay }: any = req.body;
  const {
    number,
    body,
    quotedMsg,
    userId,
    queueId,
    sendSignature = false,
    closeTicket = false,
    noRegister = false
  }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  const companyId = whatsapp.companyId;

  newContact.number = newContact.number.replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let user
  if (userId?.toString() !== "" && !isNaN(userId)) {
    user = await ShowUserService(userId, companyId);
  }

  let queue
  if (queueId?.toString() !== "" && !isNaN(queueId)) {
    queue = await ShowQueueService(queueId, companyId);
  }

  let bodyMessage;

  // @ts-ignore: Unreachable code error
  if (sendSignature && !isNil(user)) {
    bodyMessage = `*${user.name}:*\n${body.trim()}`
  } else {
    bodyMessage = body.trim();
  }

  if (whatsapp.channel === "whatsapp_oficial") {
    if (noRegister) {
      throw new AppError(
        "O parâmetro noRegister não é suportado para conexões da API Oficial",
        400
      );
    }

    await sendOficialApiMessage({
      whatsapp,
      companyId,
      number: newContact.number,
      userId,
      queueId,
      bodyMessage,
      medias,
      closeTicket
    });
  } else {

  const wbot = await getWbot(whatsapp.id);

  if (noRegister) {
    const validatedNoRegisterNumber = await CheckContactNumber(
      newContact.number,
      companyId,
      newContact.number.length > 17,
      whatsapp.id
    );

    if (medias) {
      try {
        // console.log(medias)
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            const publicFolder = path.resolve(__dirname, "..", "..", "public");
            const filePath = path.join(publicFolder, `company${companyId}`, media.filename);

            const options = await getMessageOptions(media.filename, filePath, companyId.toString(), `\u200e${bodyMessage}`);
            await wbot.sendMessage(
              `${validatedNoRegisterNumber}@${validatedNoRegisterNumber.length > 17 ? "g.us" : "s.whatsapp.net"}`,
              options);

            const fileExists = fs.existsSync(filePath);

            if (fileExists) {
              fs.unlinkSync(filePath);
            }
          })
        )
      } catch (error) {
        console.log(medias)
        throw new AppError("Error sending API media: " + error.message);
      }
    } else {
      await wbot.sendMessage(
        `${validatedNoRegisterNumber}@${validatedNoRegisterNumber.length > 17 ? "g.us" : "s.whatsapp.net"}`,
        {
          text: `\u200e${bodyMessage}`
        })
    }
  } else {
    const contactAndTicket = await createContact(whatsapp.id, companyId, newContact.number, userId, queueId, wbot);

    let sentMessage

    if (medias) {
      try {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            sentMessage = await SendWhatsAppMedia({ body: `\u200e${bodyMessage}`, media, ticket: contactAndTicket, isForwarded: false });

            const publicFolder = path.resolve(__dirname, "..", "..", "public");
            const filePath = path.join(publicFolder, `company${companyId}`, media.filename);
            const fileExists = fs.existsSync(filePath);

            if (fileExists) {
              fs.unlinkSync(filePath);
            }
          })
        );
        await verifyMediaMessage(sentMessage, contactAndTicket, contactAndTicket.contact, null, false, false, wbot);
      } catch (error) {
        throw new AppError("Error sending API media: " + error.message);
      }
    } else {
      sentMessage = await SendWhatsAppMessageAPI({ body: `\u200e${bodyMessage}`, whatsappId: whatsapp.id, contact: contactAndTicket.contact, quotedMsg, msdelay });

      await verifyMessage(sentMessage, contactAndTicket, contactAndTicket.contact)
    }
    // @ts-ignore: Unreachable code error
    if (closeTicket) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: { status: "closed", sendFarewellMessage: false, amountUsedBotQueues: 0, lastMessage: body },
          companyId,
        });
      }, 100);
    } else if (userId?.toString() !== "" && !isNaN(userId)) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: { status: "open", amountUsedBotQueues: 0, lastMessage: body, userId, queueId },
          companyId,
        });
      }, 100);
    }
  }

  }

  setTimeout(async () => {
    const { dateToClient } = useDate();

    const hoje: string = dateToClient(new Date())
    const timestamp = moment().format();

    let exist = await ApiUsages.findOne({
      where: {
        dateUsed: hoje,
        companyId: companyId
      }
    });

    if (exist) {
      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            // const type = path.extname(media.originalname.replace('/','-'))

            if (media.mimetype.includes("pdf")) {
              await exist.update({
                usedPDF: exist.dataValues["usedPDF"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("image")) {
              await exist.update({
                usedImage: exist.dataValues["usedImage"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("video")) {
              await exist.update({
                usedVideo: exist.dataValues["usedVideo"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else {
              await exist.update({
                usedOther: exist.dataValues["usedOther"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            }

          })
        )
      } else {
        await exist.update({
          usedText: exist.dataValues["usedText"] + 1,
          UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
          updatedAt: timestamp
        });
      }
    } else {
      exist = await ApiUsages.create({
        companyId: companyId,
        dateUsed: hoje,
      });

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            // const type = path.extname(media.originalname.replace('/','-'))

            if (media.mimetype.includes("pdf")) {
              await exist.update({
                usedPDF: exist.dataValues["usedPDF"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("image")) {
              await exist.update({
                usedImage: exist.dataValues["usedImage"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("video")) {
              await exist.update({
                usedVideo: exist.dataValues["usedVideo"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else {
              await exist.update({
                usedOther: exist.dataValues["usedOther"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            }

          })
        )
      } else {
        await exist.update({
          usedText: exist.dataValues["usedText"] + 1,
          UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
          updatedAt: timestamp
        });
      }
    }

  }, 100);

  return res.send({ status: "SUCCESS" });
};

export const indexImage = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { msdelay }: any = req.body;
  const url = req.body.url;
  const caption = req.body.caption;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  const companyId = whatsapp.companyId;

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contactAndTicket = await createContact(whatsapp.id, companyId, newContact.number);

  if (url) {
    await SendWhatsAppMediaImage({ ticket: contactAndTicket, url, caption, msdelay });
  }

  setTimeout(async () => {
    await UpdateTicketService({
      ticketId: contactAndTicket.id,
      ticketData: { status: "closed", sendFarewellMessage: false, amountUsedBotQueues: 0 },
      companyId
    });
  }, 100);

  setTimeout(async () => {
    const { dateToClient } = useDate();

    const hoje: string = dateToClient(new Date())
    const timestamp = moment().format();

    const exist = await ApiUsages.findOne({
      where: {
        dateUsed: hoje,
        companyId: companyId
      }
    });

    if (exist) {
      await exist.update({
        usedImage: exist.dataValues["usedImage"] + 1,
        UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
        updatedAt: timestamp
      });
    } else {
      const usage = await ApiUsages.create({
        companyId: companyId,
        dateUsed: hoje,
      });

      await usage.update({
        usedImage: usage.dataValues["usedImage"] + 1,
        UsedOnDay: usage.dataValues["UsedOnDay"] + 1,
        updatedAt: timestamp
      });
    }

  }, 100);

  return res.send({ status: "SUCCESS" });
};

export const indexInteractive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const newContact: ContactData = req.body;
  const {
    number,
    type,
    title,
    body,
    footer,
    buttonText,
    buttonUrl,
    buttons,
    sections,
    userId,
    queueId,
    sendSignature = false,
    closeTicket = false,
    noRegister = false
  } = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada para o token informado", 404);
  }

  const isWuzapi = String((whatsapp as any)?.provider || "").toLowerCase() === "wuzapi";

  if (isWuzapi && type !== "url") {
    throw new AppError(
      "Para conexões WuzAPI, o teste interativo disponível nesta tela é Botão URL.",
      400
    );
  }

  if (!isWuzapi && type === "url") {
    throw new AppError(
      "O teste de Botão URL nesta tela está disponível apenas para conexões WuzAPI.",
      400
    );
  }

  const companyId = whatsapp.companyId;
  newContact.number = String(newContact.number || "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),
    type: Yup.string().oneOf(["buttons", "list", "url"]).required(),
    buttonUrl: Yup.string().when("type", {
      is: "url",
      then: schema => schema.required("A URL do botão é obrigatória").url("URL do botão inválida")
    }),
    buttonText: Yup.string().when("type", {
      is: "url",
      then: schema => schema.required("O texto do botão é obrigatório")
    })
  });

  try {
    await schema.validate({ number, type, buttonUrl, buttonText });
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }

  let user;
  if (userId?.toString() !== "" && !isNaN(userId)) {
    user = await ShowUserService(userId, companyId);
  }

  let queue;
  if (queueId?.toString() !== "" && !isNaN(queueId)) {
    queue = await ShowQueueService(queueId, companyId);
  }

  const parsedButtons = parseJsonField(buttons, "buttons");
  const parsedSections = parseJsonField(sections, "sections");

  const displayBodyBase = String(body || "").trim() || String(title || "").trim();
  const displayFooter = String(footer || "").trim();
  const displayTitle = String(title || "").trim();
  const displayButtonText = String(buttonText || "").trim();
  const bodyMessage =
    sendSignature && !isNil(user)
      ? `*${user.name}:*\n${displayBodyBase || "Mensagem interativa"}`
      : displayBodyBase || "Mensagem interativa";

  const wbot = await getWbot(whatsapp.id);
  const { generateWAMessageFromContent } = await getBaileys();

  let jid: string;
  let contactAndTicket: any = null;

  if (noRegister) {
    const validatedNoRegisterNumber = await CheckContactNumber(
      newContact.number,
      companyId,
      newContact.number.length > 17,
      whatsapp.id
    );
    jid = createJid(String(validatedNoRegisterNumber));
  } else {
    contactAndTicket = await createContact(
      whatsapp.id,
      companyId,
      newContact.number,
      userId,
      queueId,
      wbot
    );
    jid = createJid(String(contactAndTicket.contact.number));
  }

  let interactiveMessage: any;

  if (type === "url") {
    interactiveMessage = {
      header: displayTitle ? { title: displayTitle } : undefined,
      body: { text: bodyMessage },
      footer: displayFooter ? { text: displayFooter } : undefined,
      nativeFlowMessage: {
        buttons: [
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: String(buttonText).trim(),
              url: String(buttonUrl).trim()
            })
          }
        ]
      }
    };
  } else if (type === "buttons") {
    if (!Array.isArray(parsedButtons) || parsedButtons.length === 0) {
      throw new AppError("O campo buttons deve conter pelo menos um botão", 400);
    }

    interactiveMessage = {
      buttonsMessage: {
        contentText: bodyMessage,
        footerText: displayFooter || "",
        buttons: parsedButtons.slice(0, 3).map((button: any, index: number) => ({
          buttonId: String(button?.id || generateRandomCode(10)),
          buttonText: {
            displayText: String(button?.text || button?.displayText || `Botão ${index + 1}`).trim()
          },
          type: 1
        })),
        headerType: 1
      }
    };
  } else {
    if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
      throw new AppError("O campo sections deve conter pelo menos uma seção", 400);
    }

    interactiveMessage = {
      listMessage: {
        title: displayTitle || "Lista de Opções",
        description: bodyMessage,
        buttonText: displayButtonText || "Selecionar",
        footerText: displayFooter || "",
        sections: parsedSections.map((section: any, sectionIndex: number) => ({
          title: String(section?.title || `Seção ${sectionIndex + 1}`).trim(),
          rows: Array.isArray(section?.rows)
            ? section.rows.map((row: any, rowIndex: number) => ({
                rowId: String(row?.id || row?.rowId || generateRandomCode(10)),
                title: String(row?.title || `Opção ${rowIndex + 1}`).trim(),
                description: String(row?.description || "").trim()
              }))
            : []
        })),
        listType: 1
      }
    };

    const hasEmptyRows = interactiveMessage.listMessage.sections.some(
      (section: any) => !Array.isArray(section.rows) || section.rows.length === 0
    );

    if (hasEmptyRows) {
      throw new AppError("Cada seção da lista deve conter pelo menos uma opção", 400);
    }
  }

  const newMsg = isWuzapi
    ? await sendWuzapiInteractiveMessage({
        whatsapp,
        jidOrPhone: newContact.number,
        interactiveMessage
      })
    : generateWAMessageFromContent(jid, interactiveMessage, {
        userJid: whatsapp.number
      });

  if (!isWuzapi) {
    await wbot.relayMessage(jid, newMsg.message, {
      messageId: newMsg.key.id!
    });
  }

  if (!noRegister && contactAndTicket) {
    await verifyMessage(newMsg as any, contactAndTicket, contactAndTicket.contact);

    if (closeTicket) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: {
            status: "closed",
            sendFarewellMessage: false,
            amountUsedBotQueues: 0,
            lastMessage: displayBodyBase || displayTitle || bodyMessage
          },
          companyId
        });
      }, 100);
    } else if (userId?.toString() !== "" && !isNaN(userId)) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: {
            status: "open",
            amountUsedBotQueues: 0,
            lastMessage: displayBodyBase || displayTitle || bodyMessage,
            userId,
            queueId
          },
          companyId
        });
      }, 100);
    }
  }

  setTimeout(async () => {
    await incrementApiTextUsage(companyId);
  }, 100);

  return res.send({
    status: "SUCCESS",
    type,
    jid,
    messageId: newMsg.key.id
  });
};

export const checkNumber = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  const companyId = whatsapp.companyId;

  const number = newContact.number.replace("-", "").replace(" ", "");

  const whatsappDefault = await GetDefaultWhatsApp(companyId, whatsapp.id);
  const wbot = getWbot(whatsappDefault.id);
  const jid = createJid(number);

  try {
    const [result] = (await wbot.onWhatsApp(jid)) as {
      exists: boolean;
      jid: string;
    }[];

    if (result.exists) {

      setTimeout(async () => {
        const { dateToClient } = useDate();

        const hoje: string = dateToClient(new Date())
        const timestamp = moment().format();

        const exist = await ApiUsages.findOne({
          where: {
            dateUsed: hoje,
            companyId: companyId
          }
        });

        if (exist) {
          await exist.update({
            usedCheckNumber: exist.dataValues["usedCheckNumber"] + 1,
            UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
            updatedAt: timestamp
          });
        } else {
          const usage = await ApiUsages.create({
            companyId: companyId,
            dateUsed: hoje,
          });

          await usage.update({
            usedCheckNumber: usage.dataValues["usedCheckNumber"] + 1,
            UsedOnDay: usage.dataValues["UsedOnDay"] + 1,
            updatedAt: timestamp
          });
        }

      }, 100);

      return res.status(200).json({ existsInWhatsapp: true, number: number, numberFormatted: result.jid });
    }

  } catch (error) {
    return res.status(400).json({ existsInWhatsapp: false, number: jid, error: "Not exists on Whatsapp" });
  }

};

export const indexWhatsappsId = async (req: Request, res: Response): Promise<Response> => {

  return res.status(200).json('oi');

  // const { companyId } = req.user;
  // const whatsapps = await ListWhatsAppsService({ companyId });

  // let wpp = [];

  // if (whatsapps.length > 0) {
  //     whatsapps.forEach(whatsapp => {

  //         let wppString;
  //         wppString = {
  //             id: whatsapp.id,
  //             name: whatsapp.name,
  //             status: whatsapp.status,
  //             isDefault: whatsapp.isDefault,
  //             number: whatsapp.number
  //         }

  //         wpp.push(wppString)

  //     });
  // }

  // return res.status(200).json(wpp);
};
