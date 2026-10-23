import { QueryInterface, DataTypes } from "sequelize";

// Unidade física de arma, uma linha por número de série (v2.3.205) — ver
// docs/MANUAL_TECNICO.md, seção 184, e FinanceWeaponUnit.ts. Etapa 1
// autorizada (sub-cadastro por unidade) — só aditiva, nada destrutivo:
// produto-arma já cadastrado FICA COMO ESTÁ, só cria a unidade
// correspondente quando já tiver número de série preenchido (idempotente
// — produto que já ganhou unidade numa execução anterior não ganha outra).
// Índice único parcial igual ao que já existia em
// `idx_finance_products_company_serial_unique` (FinanceProducts) — não
// trava a coluna porque, mesmo a série sendo obrigatória pra CRIAR uma
// unidade pela tela, a própria estrutura não impede um valor vazio aqui.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceWeaponUnits";
    const existingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      await queryInterface.createTable(table, {
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
        notes: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: ""
        },
        // Reservadas pra Etapa 2 (integração com a Venda) — nenhum
        // código desta etapa lê ou escreve aqui ainda.
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
      });
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_weapon_units_company_serial_unique
      ON "FinanceWeaponUnits" ("companyId", "serialNumber")
      WHERE "serialNumber" IS NOT NULL AND "serialNumber" <> '';
    `);

    const eventsTable = "FinanceWeaponUnitEvents";
    if (!existingTables.includes(eventsTable)) {
      await queryInterface.createTable(eventsTable, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        weaponUnitId: {
          type: DataTypes.INTEGER,
          references: { model: "FinanceWeaponUnits", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false
        },
        note: {
          type: DataTypes.STRING,
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
      });
    }

    // 1 unidade por produto-arma que já tem número de série preenchido —
    // só insere pra produto que ainda não tem unidade (idempotente). NÃO
    // toca em nenhum FinanceProduct (nem apaga, nem reagrupa por SKU) —
    // produto já cadastrado fica exatamente como está.
    await queryInterface.sequelize.query(`
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
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("FinanceWeaponUnitEvents");
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_finance_weapon_units_company_serial_unique;
    `);
    await queryInterface.dropTable("FinanceWeaponUnits");
  }
};
