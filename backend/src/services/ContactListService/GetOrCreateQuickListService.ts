import ContactList from "../../models/ContactList";

// Lista "guarda-chuva" usada quando a campanha manda pra um grupo do
// WhatsApp ou pra um número avulso, em vez de uma lista de contatos pronta
// — reaproveita 100% do motor de disparo já existente (ContactList +
// ContactListItem + CampaignShipping), sem precisar de nenhuma mudança no
// Campaign nem na fila de envio (ver docs/MANUAL_TECNICO.md).
const QUICK_LIST_NAME = "Envios avulsos (grupos e contatos individuais)";

const GetOrCreateQuickListService = async (
  companyId: number
): Promise<ContactList> => {
  const [list] = await ContactList.findOrCreate({
    where: { name: QUICK_LIST_NAME, companyId },
    defaults: { name: QUICK_LIST_NAME, companyId }
  });

  return list;
};

export default GetOrCreateQuickListService;
