import ContactListItem from "../../models/ContactListItem";

interface Request {
  name: string;
  number: string; // ID numérico do grupo (sem "@g.us")
  contactListId: number;
  companyId: number;
}

// Adiciona um grupo do WhatsApp como item de uma lista de contatos, pra
// campanha poder mandar mensagem pra ele (a fila de envio já sabe montar
// "<number>@g.us" quando ContactListItem.isGroup é true — ver queues.ts).
// Diferente de ContactListItemService/CreateService, NÃO valida o "number"
// como telefone: o ID de um grupo não é um número de WhatsApp de pessoa e
// PODE ter hífen (grupos mais antigos usam "NNNNNNNNNN-NNNNNNNNNN@g.us") —
// nunca usar um replace(/\D/g, "") aqui, ou o hífen some e o id vira outro
// grupo (inexistente), fazendo a campanha "aceitar" o envio mas nunca
// entregar (bug real, ver docs/MANUAL_TECNICO.md).
const AddGroupService = async (data: Request): Promise<ContactListItem> => {
  const groupId = String(data.number || "")
    .split("@")[0]
    .trim()
    .replace(/[^0-9-]/g, "");

  const [record] = await ContactListItem.findOrCreate({
    where: {
      number: groupId,
      contactListId: data.contactListId,
      companyId: data.companyId
    },
    defaults: {
      name: data.name || groupId,
      number: groupId,
      email: "",
      isGroup: true,
      isWhatsappValid: true,
      contactListId: data.contactListId,
      companyId: data.companyId
    }
  });

  return record;
};

export default AddGroupService;
