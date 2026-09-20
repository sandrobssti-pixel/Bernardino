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
// como telefone: o ID de um grupo não é um número de WhatsApp de pessoa.
const AddGroupService = async (data: Request): Promise<ContactListItem> => {
  const digitsOnly = String(data.number || "").replace(/\D/g, "");

  const [record] = await ContactListItem.findOrCreate({
    where: {
      number: digitsOnly,
      contactListId: data.contactListId,
      companyId: data.companyId
    },
    defaults: {
      name: data.name || digitsOnly,
      number: digitsOnly,
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
