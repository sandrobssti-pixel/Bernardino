import Contact from "../../models/Contact";

// Cadastro obrigatório de cliente novo/número trocado antes de fechar o
// atendimento (ver docs/MANUAL_TECNICO.md, seção 14). Um contato é
// considerado "já cadastrado" quando todos esses campos já foram
// preenchidos alguma vez — não existe uma flag separada de "cliente novo":
// um número novo (contato recém-criado pelo WhatsApp) ou um cliente que
// trocou de número (novo Contact, já que `number` é único) começam com
// esses campos vazios, então caem automaticamente na mesma regra.
const isNonEmpty = (value?: string | null): boolean => !!value && value.trim().length > 0;

const IsContactFullyRegistered = (contact: Pick<Contact, "name" | "email" | "document" | "address" | "contact2">): boolean => {
  return (
    isNonEmpty(contact.name) &&
    isNonEmpty(contact.email) &&
    isNonEmpty(contact.document) &&
    isNonEmpty(contact.address) &&
    isNonEmpty(contact.contact2)
  );
};

export default IsContactFullyRegistered;
