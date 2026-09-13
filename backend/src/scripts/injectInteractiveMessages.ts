import sequelize from "../database";
import Ticket from "../models/Ticket";
import Message from "../models/Message";

const ticketUuid = process.argv[2];

if (!ticketUuid) {
  console.error("Uso: ts-node src/scripts/injectInteractiveMessages.ts <ticket-uuid>");
  process.exit(1);
}

(async () => {
  try {
    const ticket = await Ticket.findOne({ where: { uuid: ticketUuid } });

    if (!ticket) {
      console.error(`Ticket não encontrado para uuid=${ticketUuid}`);
      process.exit(2);
    }

    const now = new Date();
    const baseWid = `sim-${Date.now()}`;

    const common = {
      ticketId: ticket.id,
      companyId: ticket.companyId,
      contactId: ticket.contactId,
      fromMe: false,
      read: false,
      ack: 0,
      mediaUrl: null,
      isDeleted: false,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      remoteJid: null,
      participant: null,
      dataJson: JSON.stringify({ __simulated: true, source: "internal-test" }),
      createdAt: now,
      updatedAt: now
    } as any;

    await Message.create({
      ...common,
      id: undefined,
      wid: `${baseWid}-btn`,
      mediaType: "buttonsResponseMessage",
      body: "Falar com suporte"
    });

    await Message.create({
      ...common,
      id: undefined,
      wid: `${baseWid}-list`,
      mediaType: "listMessage",
      body: "[LIST]\n\n*Menu Principal*\n*Escolha uma opção*\n\nAtendimento 24h\n\n*Setor*\nVendas - Comprar\nSuporte - Ajuda técnica"
    });

    await ticket.update({
      lastMessage: "[Teste interno] Mensagens interativas simuladas",
      unreadMessages: Number(ticket.unreadMessages || 0) + 2
    });

    console.log(`OK: mensagens simuladas inseridas no ticket id=${ticket.id} uuid=${ticket.uuid}`);
    process.exit(0);
  } catch (error: any) {
    console.error("Erro ao injetar mensagens simuladas:", error?.message || error);
    process.exit(3);
  } finally {
    await sequelize.close();
  }
})();
