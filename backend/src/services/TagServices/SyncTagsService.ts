import { Op } from "sequelize";
import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";

interface Request {
  tags: Tag[];
  contactId: number;
}

// Esse serviço atende o widget de tags do cabeçalho do ticket
// (TagsContainer), que só busca e só mostra tags "normais" (kanban=0) —
// ele nunca sabe da existência das tags usadas como coluna do Kanban.
// Por isso o sync tem que mexer só nas tags kanban=0: sincronizar TUDO
// (como era antes) apagava também a tag-coluna do Kanban do contato
// sempre que o atendente editava qualquer tag no ticket, fazendo a tag
// sumir da segmentação de campanha sem ninguém ter tirado ela do Kanban
// (ver docs/MANUAL_TECNICO.md).
const SyncTags = async ({
  tags,
  contactId
}: Request): Promise<Contact | null> => {
  const contact = await Contact.findByPk(contactId, { include: [Tag] });
  if (!contact) return null;

  const kanbanTagIds = (
    await Tag.findAll({
      where: { companyId: contact.companyId, kanban: 1 },
      attributes: ["id"]
    })
  ).map(t => t.id);

  await ContactTag.destroy({
    where: {
      contactId,
      ...(kanbanTagIds.length ? { tagId: { [Op.notIn]: kanbanTagIds } } : {})
    }
  });

  const tagList = (tags || [])
    .filter(t => !kanbanTagIds.includes(t.id))
    .map(t => ({ tagId: t.id, contactId }));

  if (tagList.length) {
    await ContactTag.bulkCreate(tagList);
  }

  await contact.reload();

  return contact;
};

export default SyncTags;
