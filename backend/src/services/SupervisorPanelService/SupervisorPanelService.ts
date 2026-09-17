import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import TicketTraking from "../../models/TicketTraking";
import SlaRule from "../../models/SlaRule";

const DEFAULT_RISK_MINUTES = 15;
const DEFAULT_OVERDUE_MINUTES = 20;

export interface LiveTicketRow {
  ticketId: number;
  ticketUuid: string;
  contactName: string;
  contactNumber: string;
  userId: number | null;
  userName: string | null;
  userOnline: boolean;
  queueId: number | null;
  queueName: string | null;
  queueColor: string | null;
  startedAt: Date | null;
  elapsedMinutes: number;
  riskMinutes: number;
  overdueMinutes: number;
  status: "onTime" | "risk" | "overdue";
}

const resolveSlaRule = (
  queueId: number | null,
  rules: SlaRule[]
): { riskMinutes: number; overdueMinutes: number } => {
  const specific = rules.find(rule => rule.queueId === queueId);
  if (specific) {
    return { riskMinutes: specific.riskMinutes, overdueMinutes: specific.overdueMinutes };
  }

  const companyDefault = rules.find(rule => rule.queueId === null);
  if (companyDefault) {
    return {
      riskMinutes: companyDefault.riskMinutes,
      overdueMinutes: companyDefault.overdueMinutes
    };
  }

  return { riskMinutes: DEFAULT_RISK_MINUTES, overdueMinutes: DEFAULT_OVERDUE_MINUTES };
};

export const listLiveTickets = async (
  companyId: number
): Promise<LiveTicketRow[]> => {
  const [tickets, rules] = await Promise.all([
    Ticket.findAll({
      where: { companyId, status: "open" },
      include: [
        { model: Contact, as: "contact", attributes: ["id", "name", "number"] },
        { model: User, as: "user", attributes: ["id", "name", "online"] },
        { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
      ]
    }),
    SlaRule.findAll({ where: { companyId } })
  ]);

  const now = Date.now();

  const rows: LiveTicketRow[] = await Promise.all(
    tickets.map(async ticket => {
      const traking = await TicketTraking.findOne({
        where: { ticketId: ticket.id, finishedAt: null },
        order: [["createdAt", "DESC"]]
      });

      const startedAt = traking?.startedAt || ticket.createdAt;
      const elapsedMinutes = startedAt
        ? Math.max(0, (now - new Date(startedAt).getTime()) / 60000)
        : 0;

      const { riskMinutes, overdueMinutes } = resolveSlaRule(
        ticket.queueId || null,
        rules
      );

      let status: LiveTicketRow["status"] = "onTime";
      if (elapsedMinutes >= overdueMinutes) status = "overdue";
      else if (elapsedMinutes >= riskMinutes) status = "risk";

      return {
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
        contactName: ticket.contact?.name || "",
        contactNumber: ticket.contact?.number || "",
        userId: ticket.user?.id || null,
        userName: ticket.user?.name || null,
        userOnline: !!ticket.user?.online,
        queueId: ticket.queue?.id || null,
        queueName: ticket.queue?.name || null,
        queueColor: ticket.queue?.color || null,
        startedAt: startedAt || null,
        elapsedMinutes: Math.round(elapsedMinutes),
        riskMinutes,
        overdueMinutes,
        status
      };
    })
  );

  return rows.sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);
};

export interface SupervisorSummary {
  totalActive: number;
  totalOnTime: number;
  totalRisk: number;
  totalOverdue: number;
  avgElapsedMinutes: number;
  byQueue: {
    queueName: string;
    onTime: number;
    risk: number;
    overdue: number;
  }[];
}

export const getSummary = async (
  companyId: number
): Promise<SupervisorSummary> => {
  const rows = await listLiveTickets(companyId);

  const totalOnTime = rows.filter(r => r.status === "onTime").length;
  const totalRisk = rows.filter(r => r.status === "risk").length;
  const totalOverdue = rows.filter(r => r.status === "overdue").length;

  const avgElapsedMinutes = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.elapsedMinutes, 0) / rows.length)
    : 0;

  const byQueueMap = new Map<
    string,
    { queueName: string; onTime: number; risk: number; overdue: number }
  >();

  rows.forEach(row => {
    const key = row.queueName || "Sem fila";
    if (!byQueueMap.has(key)) {
      byQueueMap.set(key, { queueName: key, onTime: 0, risk: 0, overdue: 0 });
    }
    const bucket = byQueueMap.get(key);
    if (row.status === "onTime") bucket.onTime += 1;
    else if (row.status === "risk") bucket.risk += 1;
    else bucket.overdue += 1;
  });

  return {
    totalActive: rows.length,
    totalOnTime,
    totalRisk,
    totalOverdue,
    avgElapsedMinutes,
    byQueue: Array.from(byQueueMap.values())
  };
};
