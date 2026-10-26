import { QueryInterface, DataTypes } from "sequelize";

// Volumes pequenos de munição (v2.3.223, pedido do cliente) — mesmo
// padrão da migration que criou FinanceWeaponUnits (20261023170000),
// adaptado: lote + ID (código de barras) por caixinha pequena, em vez
// de só o número de série. Ver FinanceAmmoVolume.ts e
// docs/MANUAL_TECNICO.md. Puramente aditiva — tabela nova, sem tocar em
// nenhum dado já existente.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinanceAmmoVolumes";
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
        lotNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        barcodeId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        unitQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
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

    // Mesmo padrão do índice único de FinanceWeaponUnits.serialNumber —
    // o ID (código de barras) nunca pode se repetir dentro da mesma
    // empresa, pra garantir que o vendedor nunca venda a mesma caixinha
    // física duas vezes.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_ammo_volumes_company_barcode_unique
      ON "FinanceAmmoVolumes" ("companyId", "barcodeId")
      WHERE "barcodeId" IS NOT NULL AND "barcodeId" <> '';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "ammoVolumeId" INTEGER REFERENCES "FinanceAmmoVolumes"("id");
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "ammoVolumeId");
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_finance_ammo_volumes_company_barcode_unique;
    `);
    await queryInterface.dropTable("FinanceAmmoVolumes");
  }
};
