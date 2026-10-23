import { QueryInterface, DataTypes } from "sequelize";

// Unidade física de arma, uma linha por número de série (v2.3.204) — ver
// docs/MANUAL_TECNICO.md, seção 183, e FinanceWeaponUnit.ts.
//
// Até aqui, cada arma física era um FinanceProduct inteiro (SKU repetido
// entre as armas do mesmo modelo, serialNumber/sigmaRegistrationNumber/
// weaponStatus gravados direto no produto). Esta migration:
//
//   1. Cria a tabela nova FinanceWeaponUnits.
//   2. Copia pra lá o número de série/registro SIGMA/situação de cada
//      produto-arma existente (1 unidade por produto).
//   3. Consolida duplicatas: produtos-arma da MESMA empresa com o MESMO
//      SKU (não vazio) são o mesmo modelo cadastrado várias vezes — fica
//      só 1 Produto por grupo (o de menor id), as unidades dos outros são
//      reatribuídas pra ele, `SaleItems.productId` de venda antiga é
//      reapontado pro mesmo id (não perde histórico), e os produtos
//      duplicados são removidos.
//
// NÃO remove as colunas antigas (serialNumber/sigmaRegistrationNumber/
// weaponStatus) de FinanceProducts — ficam ali sem uso pelo app a partir
// desta versão, por segurança (reverter/auditar sem precisar restaurar
// backup). Tudo dentro de uma transação, e os três passos de dados usam
// `WHERE` que já exclui o que uma execução anterior tiver deixado pronto
// — se a migration for interrompida no meio e rodada de novo, não duplica
// unidade nem tenta apagar produto que já não existe mais.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceWeaponUnits";
    const existingTables = await queryInterface.showAllTables();

    await queryInterface.sequelize.transaction(async transaction => {
      if (!existingTables.includes(table)) {
        await queryInterface.createTable(
          table,
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              allowNull: false
            },
            productId: {
              type: DataTypes.INTEGER,
              references: { model: "FinanceProducts", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
              allowNull: false
            },
            serialNumber: {
              type: DataTypes.STRING,
              allowNull: false
            },
            sigmaRegistrationNumber: {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: ""
            },
            status: {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: "in_stock"
            },
            saleItemId: {
              type: DataTypes.INTEGER,
              allowNull: true
            },
            soldAt: {
              type: DataTypes.DATE(6),
              allowNull: true
            },
            companyId: {
              type: DataTypes.INTEGER,
              references: { model: "Companies", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
              allowNull: false
            },
            createdAt: {
              type: DataTypes.DATE(6),
              allowNull: false
            },
            updatedAt: {
              type: DataTypes.DATE(6),
              allowNull: false
            }
          },
          { transaction }
        );

        await queryInterface.addIndex(table, ["companyId", "serialNumber"], {
          unique: true,
          name: "idx_finance_weapon_units_company_serial_unique",
          transaction
        });
      }

      // 1 unidade por produto-arma com número de série preenchido — só
      // insere pra produto que ainda não tem unidade (idempotente).
      await queryInterface.sequelize.query(
        `
        INSERT INTO "FinanceWeaponUnits"
          ("productId", "serialNumber", "sigmaRegistrationNumber", "status", "companyId", "createdAt", "updatedAt")
        SELECT
          fp."id",
          fp."serialNumber",
          COALESCE(fp."sigmaRegistrationNumber", ''),
          CASE WHEN fp."weaponStatus" IN ('in_stock', 'sold', 'maintenance', 'decommissioned')
               THEN fp."weaponStatus" ELSE 'in_stock' END,
          fp."companyId",
          NOW(),
          NOW()
        FROM "FinanceProducts" fp
        WHERE fp."type" = 'weapon'
          AND fp."serialNumber" IS NOT NULL AND fp."serialNumber" <> ''
          AND NOT EXISTS (
            SELECT 1 FROM "FinanceWeaponUnits" fwu WHERE fwu."productId" = fp."id"
          );
        `,
        { transaction }
      );

      // Grupos (companyId, sku) de produto-arma com SKU preenchido e mais
      // de uma linha = mesmo modelo cadastrado várias vezes. Reaponta as
      // unidades e os itens de venda histórica pro id mais antigo do
      // grupo (o "mantido"), depois apaga os outros.
      const [groups]: any = await queryInterface.sequelize.query(
        `
        SELECT "companyId", "sku", MIN("id") AS "keeperId", ARRAY_AGG("id") AS "ids"
        FROM "FinanceProducts"
        WHERE "type" = 'weapon' AND "sku" IS NOT NULL AND "sku" <> ''
        GROUP BY "companyId", "sku"
        HAVING COUNT(*) > 1;
        `,
        { transaction }
      );

      for (const group of groups) {
        const { keeperId, ids } = group as { keeperId: number; ids: number[] };
        const duplicateIds = ids.filter((id: number) => id !== keeperId);
        if (duplicateIds.length === 0) continue;

        await queryInterface.sequelize.query(
          `UPDATE "FinanceWeaponUnits" SET "productId" = :keeperId WHERE "productId" IN (:duplicateIds);`,
          { replacements: { keeperId, duplicateIds }, transaction }
        );
        await queryInterface.sequelize.query(
          `UPDATE "SaleItems" SET "productId" = :keeperId WHERE "productId" IN (:duplicateIds);`,
          { replacements: { keeperId, duplicateIds }, transaction }
        );
        await queryInterface.sequelize.query(
          `DELETE FROM "FinanceProducts" WHERE "id" IN (:duplicateIds);`,
          { replacements: { duplicateIds }, transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Não desfaz a consolidação de duplicatas (produto apagado não volta
    // sozinho) — reversão real exigiria restaurar backup de antes do
    // deploy. Só remove a tabela nova.
    await queryInterface.dropTable("FinanceWeaponUnits");
  }
};
