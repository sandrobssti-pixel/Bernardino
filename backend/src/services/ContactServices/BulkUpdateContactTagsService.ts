import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";

const BulkUpdateContactTagsService = async (
  contactIds: number[],
  tagIds: number[],
  companyId: number,
  action: "replace" | "add" | "remove" = "replace"
): Promise<number[]> => {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("Nenhum ID de contato fornecido para edição em massa.", 400);
  }

  const uniqueContactIds = [...new Set(contactIds.map(Number).filter(Number.isFinite))];
  const uniqueTagIds = [...new Set((tagIds || []).map(Number).filter(Number.isFinite))];

  const contactsFound = await Contact.findAll({
    where: {
      id: { [Op.in]: uniqueContactIds },
      companyId
    },
    attributes: ["id"]
  });

  if (contactsFound.length !== uniqueContactIds.length) {
    const foundIds = new Set(contactsFound.map(c => Number(c.id)));
    const notFoundIds = uniqueContactIds.filter(id => !foundIds.has(id));
    throw new AppError(
      `Alguns contatos não foram encontrados ou não pertencem à sua empresa. IDs: ${notFoundIds.join(", ")}`,
      404
    );
  }

  if (uniqueTagIds.length > 0) {
    const tagsFound = await Tag.findAll({
      where: {
        id: { [Op.in]: uniqueTagIds },
        companyId
      },
      attributes: ["id"]
    });

    if (tagsFound.length !== uniqueTagIds.length) {
      const foundTagIds = new Set(tagsFound.map(t => Number(t.id)));
      const notFoundTagIds = uniqueTagIds.filter(id => !foundTagIds.has(id));
      throw new AppError(
        `Algumas tags não foram encontradas para esta empresa. IDs: ${notFoundTagIds.join(", ")}`,
        404
      );
    }
  }

  const transaction = await Contact.sequelize!.transaction();
  try {
    if (action === "replace") {
      await ContactTag.destroy({
        where: { contactId: { [Op.in]: uniqueContactIds } },
        transaction
      });

      if (uniqueTagIds.length > 0) {
        const bulkRows = uniqueContactIds.flatMap(contactId =>
          uniqueTagIds.map(tagId => ({ contactId, tagId }))
        );
        await ContactTag.bulkCreate(bulkRows, { transaction });
      }
    } else if (action === "add") {
      if (uniqueTagIds.length > 0) {
        const existingRows = await ContactTag.findAll({
          where: {
            contactId: { [Op.in]: uniqueContactIds },
            tagId: { [Op.in]: uniqueTagIds }
          },
          attributes: ["contactId", "tagId"],
          transaction
        });

        const existingSet = new Set(
          existingRows.map(row => `${row.contactId}:${row.tagId}`)
        );

        const rowsToCreate = uniqueContactIds.flatMap(contactId =>
          uniqueTagIds
            .filter(tagId => !existingSet.has(`${contactId}:${tagId}`))
            .map(tagId => ({ contactId, tagId }))
        );

        if (rowsToCreate.length > 0) {
          await ContactTag.bulkCreate(rowsToCreate, { transaction });
        }
      }
    } else if (action === "remove") {
      if (uniqueTagIds.length > 0) {
        await ContactTag.destroy({
          where: {
            contactId: { [Op.in]: uniqueContactIds },
            tagId: { [Op.in]: uniqueTagIds }
          },
          transaction
        });
      }
    } else {
      throw new AppError("Ação de tags em massa inválida.", 400);
    }

    await transaction.commit();
    return uniqueContactIds;
  } catch (error: any) {
    await transaction.rollback();
    throw new AppError(
      `Erro interno ao atualizar tags em massa: ${error?.message || "desconhecido"}`,
      500
    );
  }
};

export default BulkUpdateContactTagsService;
