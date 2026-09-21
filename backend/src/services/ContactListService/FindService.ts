import { Sequelize } from "sequelize";
import ContactList from "../../models/ContactList";
import Company from "../../models/Company";

type Params = {
  companyId: string;
};

// A quantidade de contatos vai junto (contactsCount) pra alimentar o
// resumo de confirmação antes de enviar a campanha ("Vai enviar para:
// <lista> (X contatos)") — evita repetir o erro de mandar campanha pra
// lista/tag errada sem perceber. `otherCountryCount` também vai junto,
// pra avisar quando a lista mistura número de mais de um país (número
// BR: "55" + 11 dígitos = 13 no total) — sinal forte de contato sem
// relação com a lista, como já aconteceu (ver docs/MANUAL_TECNICO.md).
const FindService = async ({ companyId }: Params): Promise<ContactList[]> => {
  const notes: ContactList[] = await ContactList.findAll({
    where: {
      companyId
    },
    include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
    attributes: {
      include: [
        [
          Sequelize.literal(
            '(SELECT COUNT(*) FROM "ContactListItems" WHERE "ContactListItems"."contactListId" = "ContactList"."id")'
          ),
          "contactsCount"
        ],
        [
          Sequelize.literal(
            `(SELECT COUNT(*) FROM "ContactListItems" WHERE "ContactListItems"."contactListId" = "ContactList"."id" AND "ContactListItems"."isGroup" = false AND "ContactListItems".number !~ '^55[0-9]{11}$')`
          ),
          "otherCountryCount"
        ]
      ]
    },
    order: [["name", "ASC"]]
  });

  return notes;
};

export default FindService;
