import { Op } from "sequelize";
import logger from "../../utils/logger";
import Notification from "../../models/Notification";
import { getIO } from "../../libs/socket";
import { listLiveTickets } from "./SupervisorPanelService";

// Roda periodicamente (ver queues.ts) e cria, no máximo uma vez por
// ticket/tipo desde o início do atendimento atual, uma notificação quando o
// tempo de atendimento em aberto cruza o limiar de risco (15 min padrão) ou
// de fora do prazo (20 min padrão) — ver docs/MANUAL_TECNICO.md. Emite em
// tempo real pro atendente responsável e pra sala "supervisors" da empresa.
export const runSlaMonitor = async (companyId: number): Promise<void> => {
  const rows = await listLiveTickets(companyId);

  for (const row of rows) {
    if (row.status === "onTime") continue;
    if (!row.startedAt) continue;

    const type = row.status === "overdue" ? "sla_overdue" : "sla_risk";

    const alreadyNotified = await Notification.findOne({
      where: {
        companyId,
        ticketId: row.ticketId,
        type,
        createdAt: { [Op.gte]: row.startedAt }
      }
    });

    if (alreadyNotified) continue;

    try {
      const title =
        type === "sla_overdue"
          ? `Atendimento fora do prazo (${row.elapsedMinutes} min)`
          : `Risco de atraso no atendimento (${row.elapsedMinutes} min)`;

      const message = `${row.contactName || row.contactNumber} — ${row.elapsedMinutes} min em atendimento${
        row.queueName ? ` na fila ${row.queueName}` : ""
      }.`;

      const notification = await Notification.create({
        type,
        title,
        message,
        userId: row.userId,
        ticketId: row.ticketId,
        companyId
      } as any);

      const io = getIO();
      const payload = notification.toJSON();

      if (row.userId) {
        io.of(String(companyId))
          .to(`user-${row.userId}`)
          .emit(`company-${companyId}-notification`, payload);
      }
      io.of(String(companyId))
        .to("supervisors")
        .emit(`company-${companyId}-notification`, payload);
    } catch (err: any) {
      logger.error(`SlaMonitorService -> erro ao notificar ticket ${row.ticketId}: ${err.message}`);
    }
  }
};
