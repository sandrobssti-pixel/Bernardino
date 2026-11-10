import { QueryInterface } from "sequelize";

// Entrada de habitualidade (foto do livro físico de registro + assinatura
// + geolocalização) — MESMO registro do check-in facial (MemberCheckIn),
// não uma tabela nova (decisão confirmada com o cliente). Associado
// (Portal, acesso próprio) só CRIA — nunca edita nem exclui; só o Admin,
// dentro do clube, pode mudar "validationStatus" (aprovar/rejeitar
// conferindo a geolocalização contra o endereço do clube — validação
// manual nesta fase, sem cálculo automático de raio). Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "MemberCheckIns" ADD COLUMN IF NOT EXISTS "logbookPhotoUrl" VARCHAR(255);'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "MemberCheckIns" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "MemberCheckIns" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;'
    );
    // "pending" | "valid" | "invalid" — só relevante pra check-in que TEM
    // logbookPhotoUrl (entrada de habitualidade); check-in simples do
    // kiosk (reconhecimento facial sem foto de livro) fica "pending" sem
    // nunca ser revisado, não aparece na fila do Admin (ver
    // MemberFaceService.listPendingHabitualidade, filtra por
    // logbookPhotoUrl IS NOT NULL).
    await queryInterface.sequelize.query(
      "ALTER TABLE \"MemberCheckIns\" ADD COLUMN IF NOT EXISTS \"validationStatus\" VARCHAR(255) NOT NULL DEFAULT 'pending';"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "MemberCheckIns" ADD COLUMN IF NOT EXISTS "validatedByUserId" INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "MemberCheckIns" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP WITH TIME ZONE;'
    );
    // "kiosk" (funcionário, tela de Controle de Acesso) | "portal"
    // (o próprio associado, pelo celular dele).
    await queryInterface.sequelize.query(
      "ALTER TABLE \"MemberCheckIns\" ADD COLUMN IF NOT EXISTS \"source\" VARCHAR(255) NOT NULL DEFAULT 'kiosk';"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("MemberCheckIns", "logbookPhotoUrl");
    await queryInterface.removeColumn("MemberCheckIns", "latitude");
    await queryInterface.removeColumn("MemberCheckIns", "longitude");
    await queryInterface.removeColumn("MemberCheckIns", "validationStatus");
    await queryInterface.removeColumn("MemberCheckIns", "validatedByUserId");
    await queryInterface.removeColumn("MemberCheckIns", "validatedAt");
    await queryInterface.removeColumn("MemberCheckIns", "source");
  }
};
