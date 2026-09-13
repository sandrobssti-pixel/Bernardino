import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.query(`
      UPDATE "Tickets" t
      SET "closedAt" = COALESCE(
        (
          SELECT tt."closedAt"
          FROM "TicketTraking" tt
          WHERE tt."ticketId" = t.id
            AND tt."closedAt" IS NOT NULL
          ORDER BY tt."closedAt" DESC
          LIMIT 1
        ),
        t."updatedAt"
      )
      WHERE t.status = 'closed'
        AND t."closedAt" IS NULL;
    `);
  },
  down: (queryInterface: QueryInterface) => {
    return Promise.resolve();
  }
};
