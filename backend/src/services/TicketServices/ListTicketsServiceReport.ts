/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable camelcase */
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export interface DashboardData {
  tickets: any[];
  totalTickets: any;
}

export interface Params {
  searchParam: string;
  contactId: string;
  whatsappId: string[];
  dateFrom: string;
  dateTo: string;
  status: string[];
  queueIds: number[];
  tags: number[];
  kanbanTags: number[];
  users: number[];
  userId: string;
  onlyRated: string;
  includeGroups?: string;
}

const sanitizeNumberList = (values: Array<string | number> = []): number[] =>
  values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0);

const sanitizeStatusList = (values: string[] = []): string[] => {
  const allowed = new Set(["open", "closed", "pending", "group", "nps", "lgpd"]);

  return values
    .map(value => String(value || "").trim().toLowerCase())
    .filter(value => allowed.has(value));
};

export default async function ListTicketsServiceReport(
  companyId: string | number,
  params: Params,
  page = 1,
  pageSize = 20
): Promise<DashboardData> {
  const offset = (page - 1) * pageSize;
  const onlyRated = params.onlyRated === "true";
  const includeGroups = params.includeGroups !== "false";

  const safeWhatsappIds = sanitizeNumberList(params.whatsappId as any);
  const safeQueueIds = sanitizeNumberList(params.queueIds as any);
  const safeUserIds = sanitizeNumberList(params.users as any);
  const safeTagIds = sanitizeNumberList(params.tags as any);
  const safeKanbanTagIds = sanitizeNumberList(params.kanbanTags as any);
  const safeStatuses = sanitizeStatusList(params.status || []);

  const query = `
    select
      t.id,
      w."name" as "whatsappName",
      c."name" as "contactName",
      c."number" as "contactNumber",
      u."name" as "userName",
      q."name" as "queueName",
      t."lastMessage",
      t.uuid,
      coalesce((
        select string_agg(distinct tg."name", ', ' order by tg."name")
        from "TicketTags" ttg
        inner join "Tags" tg on tg.id = ttg."tagId"
        where ttg."ticketId" = t.id and coalesce(tg.kanban, 0) = 0
      ), '') as "tags",
      coalesce((
        select string_agg(distinct tg."name", ', ' order by tg."name")
        from "TicketTags" ttg
        inner join "Tags" tg on tg.id = ttg."tagId"
        where ttg."ticketId" = t.id and coalesce(tg.kanban, 0) = 1
      ), '') as "kanban",
      case t.status
        when 'open' then 'ABERTO'
        when 'closed' then 'FECHADO'
        when 'pending' then 'PENDENTE'
        when 'group' then 'GRUPO'
        when 'nps' then 'NPS'
        when 'lgpd' then 'LGPD'
      end as "status",
      TO_CHAR(tt."createdAt", 'DD/MM/YYYY HH24:MI') as "createdAt",
      TO_CHAR(coalesce(tt."closedAt", tt."finishedAt"), 'DD/MM/YYYY HH24:MI') as "closedAt",
      coalesce((
        (date_part('day', age(coalesce(tt."closedAt", tt."finishedAt"), coalesce(tt."startedAt", tt."createdAt")))) || ' d, ' ||
        (date_part('hour', age(coalesce(tt."closedAt", tt."finishedAt"), coalesce(tt."startedAt", tt."createdAt")))) || ' hrs e ' ||
        (date_part('minutes', age(coalesce(tt."closedAt", tt."finishedAt"), coalesce(tt."startedAt", tt."createdAt")))) || ' m'
      ), '0') as "supportTime",
      coalesce(ur.rate, 0) as "NPS"
    from "Tickets" t
    left join (
      SELECT DISTINCT ON ("ticketId") *
      FROM "TicketTraking"
      WHERE "companyId" = ${companyId}
      ORDER BY "ticketId", "id" DESC
    ) tt ON t.id = tt."ticketId"
    left join "UserRatings" ur on t.id = ur."ticketId"
    left join "Contacts" c on t."contactId" = c.id
    left join "Whatsapps" w on t."whatsappId" = w.id
    left join "Users" u on t."userId" = u.id
    left join "Queues" q on t."queueId" = q.id
    -- filterPeriod
  `;

  let where = `where t."companyId" = ${companyId}`;

  if (params.dateFrom) {
    where += ` and t."createdAt" >= '${params.dateFrom} 00:00:00'`;
  }

  if (params.dateTo) {
    where += ` and t."createdAt" <= '${params.dateTo} 23:59:59'`;
  }

  if (safeWhatsappIds.length > 0) {
    where += ` and t."whatsappId" in (${safeWhatsappIds.join(",")})`;
  }

  if (safeUserIds.length > 0) {
    where += ` and t."userId" in (${safeUserIds.join(",")})`;
  }

  if (safeQueueIds.length > 0) {
    where += ` and COALESCE(t."queueId",0) in (${safeQueueIds.join(",")})`;
  }

  if (safeStatuses.length > 0) {
    where += ` and t."status" in ('${safeStatuses.join("','")}')`;
  }

  if (!includeGroups) {
    where += ` and coalesce(t."isGroup", c."isGroup", false) = false`;
  }

  if (params.contactId) {
    const safeContactId = Number(params.contactId);
    if (Number.isInteger(safeContactId) && safeContactId > 0) {
      where += ` and t."contactId" = ${safeContactId}`;
    }
  }

  if (safeTagIds.length > 0) {
    where += `
      and exists (
        select 1
        from "TicketTags" ttg
        inner join "Tags" tg on tg.id = ttg."tagId"
        where ttg."ticketId" = t.id
          and ttg."tagId" in (${safeTagIds.join(",")})
          and coalesce(tg.kanban, 0) = 0
      )`;
  }

  if (safeKanbanTagIds.length > 0) {
    where += `
      and exists (
        select 1
        from "TicketTags" ttg
        inner join "Tags" tg on tg.id = ttg."tagId"
        where ttg."ticketId" = t.id
          and ttg."tagId" in (${safeKanbanTagIds.join(",")})
          and coalesce(tg.kanban, 0) = 1
      )`;
  }

  if (onlyRated) {
    where += ` and coalesce(ur.rate, 0) > 0`;
  }

  const finalQuery = query.replace("-- filterPeriod", where);

  const totalTicketsQuery = `
    SELECT COUNT(*) as total
    FROM "Tickets" t
    LEFT JOIN "Contacts" c on t."contactId" = c.id
    LEFT JOIN "UserRatings" ur on t.id = ur."ticketId"
    ${where}`;

  const totalTicketsResult = await sequelize.query(totalTicketsQuery, {
    type: QueryTypes.SELECT
  });
  const totalTickets = totalTicketsResult[0];

  const paginatedQuery = `${finalQuery} ORDER BY t."createdAt" DESC LIMIT ${pageSize} OFFSET ${offset}`;

  const responseData: any[] = await sequelize.query(paginatedQuery, {
    type: QueryTypes.SELECT
  });

  return { tickets: responseData, totalTickets };
}
