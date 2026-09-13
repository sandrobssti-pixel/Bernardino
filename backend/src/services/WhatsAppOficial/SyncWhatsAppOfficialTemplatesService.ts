import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import WhatsAppOfficialTemplate from "../../models/WhatsAppOfficialTemplate";
import { getTemplatesWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import AppError from "../../errors/AppError";

interface Request {
  whatsappId: number;
  companyId: number;
}

const SyncWhatsAppOfficialTemplatesService = async ({
  whatsappId,
  companyId
}: Request): Promise<{ synced: number; templates: WhatsAppOfficialTemplate[] }> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada", 404);
  }

  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("A conexão informada não é WhatsApp API Oficial", 400);
  }

  if (!String(whatsapp.token || "").trim()) {
    throw new AppError("Token da conexão oficial não configurado", 400);
  }

  const result = await getTemplatesWhatsAppOficial(whatsapp.token);
  const list = Array.isArray(result?.data) ? result.data : [];
  const lastSyncedAt = new Date();

  const saved: WhatsAppOfficialTemplate[] = [];
  const templateIdsMeta: string[] = [];

  for (const item of list) {
    const templateIdMeta = String(item?.id || "").trim();
    const name = String(item?.name || "").trim();
    const language = String(item?.language || "").trim();

    if (!templateIdMeta || !name || !language) {
      continue;
    }

    templateIdsMeta.push(templateIdMeta);

    const where = { whatsappId: whatsapp.id, templateIdMeta };
    const found = await WhatsAppOfficialTemplate.findOne({ where });

    if (found) {
      await found.update({
        name,
        language,
        status: item?.status || null,
        category: item?.category || null,
        components: item?.components || null,
        lastSyncedAt
      });
      saved.push(found);
      continue;
    }

    const created = await WhatsAppOfficialTemplate.create({
      whatsappId: whatsapp.id,
      templateIdMeta,
      name,
      language,
      status: item?.status || null,
      category: item?.category || null,
      components: item?.components || null,
      lastSyncedAt
    });
    saved.push(created);
  }

  // Remove da base local os templates que não vieram mais na resposta da Meta
  // (foram excluídos/renomeados por lá), evitando exibir templates obsoletos.
  await WhatsAppOfficialTemplate.destroy({
    where: {
      whatsappId: whatsapp.id,
      templateIdMeta: { [Op.notIn]: templateIdsMeta.length ? templateIdsMeta : [""] }
    }
  });

  return { synced: saved.length, templates: saved };
};

export default SyncWhatsAppOfficialTemplatesService;
