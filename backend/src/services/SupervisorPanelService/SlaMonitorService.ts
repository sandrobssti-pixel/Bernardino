import { Op } from "sequelize";
import logger from "../../utils/logger";
import Notification from "../../models/Notification";
import { getIO } from "../../libs/socket";
import { listLiveTickets } from "./SupervisorPanelService";

const OVERDUE_REPEAT_MINUTES = 5;

// Roda periodicamente (ver queues.ts) e cria uma notificação quando o tempo
// de atendimento cruza o limiar de risco (15 min padrão) ou de fora do
// prazo (20 min padrão) — ver docs/MANUAL_TECNICO.md. "Risco de atraso"
// avisa só uma vez por atendimento (atendente responsável + supervisores).
// "Fora do prazo" é mais urgente: repete a cada 5 minutos enquanto continuar
// fora do prazo, e avisa TODOS os atendentes conectados da empresa, não só
// o responsável — o cliente pediu que vire um alerta geral, já que pode
// precisar de outro atendente pra assumir.
export const runSlaMonitor = async (companyId: number): Promise<void> => {
  const rows = await listLiveTickets(companyId);

  for (const row of rows) {
    if (row.status === "onTime") continue;
    if (!row.startedAt) continue;

    const type = row.status === "overdue" ? "sla_overdue" : "sla_risk";
    const dedupeSince =
      type === "sla_overdue"
        ? new Date(Date.now() - OVERDUE_REPEAT_MINUTES * 60000)
        : row.startedAt;

    const alreadyNotified = await Notification.findOne({
      where: {
        companyId,
        ticketId: row.ticketId,
        type,
        createdAt: { [Op.gte]: dedupeSince }
      }
    });

    if (alreadyNotified) continue;

    try {
      const situacao = row.ticketStatus === "pending" ? "aguardando" : "em atendimento";

      const title =
        type === "sla_overdue"
          ? `Atendimento fora do prazo (${row.elapsedMinutes} min, ${situacao})`
          : `Risco de atraso no atendimento (${row.elapsedMinutes} min, ${situacao})`;

      const message = `${row.contactName || row.contactNumber} — ${row.elapsedMinutes} min ${situacao}${
        row.queueName ? ` na fila ${row.queueName}` : ""
      }${row.ticketStatus === "pending" ? " (sem atendente ainda)" : ""}.`;

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

      if (type === "sla_overdue") {
        // Alerta geral: todo mundo conectado na empresa (todos os
        // atendentes online), não só o responsável pelo ticket.
        io.of(String(companyId)).emit(`company-${companyId}-notification`, payload);
      } else {
        if (row.userId) {
          io.of(String(companyId))
            .to(`user-${row.userId}`)
            .emit(`company-${companyId}-notification`, payload);
        }
        io.of(String(companyId))
          .to("supervisors")
          .emit(`company-${companyId}-notification`, payload);
      }
    } catch (err: any) {
      logger.error(`SlaMonitorService -> erro ao notificar ticket ${row.ticketId}: ${err.message}`);
    }
  }
};
