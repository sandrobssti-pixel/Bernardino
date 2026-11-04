import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Cadastro de Sócios da empresa-cliente (RH — ver docs/MANUAL_TECNICO.md).
// Chamado de "CompanyPartner" (não "Partner") porque já existe um model
// `Partner`/tabela `Partners` no projeto pra outra coisa — um parceiro de
// indicação/comissão (campos `commission`/`walletId`, ver
// 20232010133900-create-Partners-table.ts) — sem nenhuma relação com
// sócio de empresa. Mesma estrutura de identificação/contato/endereço/
// dados bancários do Funcionário (ver 20261103100000-create-employees.ts),
// mas sócio NÃO é funcionário — não tem regime CLT/PJ/Estagiário/Menor
// Aprendiz, não é um registro de vínculo empregatício. Campos próprios:
// participação societária, data de entrada/saída da sociedade, e o valor
// do pró-labore (a retribuição mensal do sócio pelo trabalho/
// administração — distinta de distribuição de lucro).
//
// O valor do pró-labore é só CADASTRO nesta entrega — NÃO entra ainda
// na Folha Mensal/motor de cálculo (PayrollEntryService). Pró-labore
// tem tributação de INSS diferente da CLT (alíquota de "contribuinte
// individual", não a tabela progressiva), e essa regra ainda não foi
// pesquisada/confirmada — ver comentário em CompanyPartnerService.ts.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "CompanyPartners";
    const existingTables: ExistingTables = await queryInterface.showAllTables();
    if (existingTables.includes(table)) return;

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },

      // --- Identificação/contato (mesmo padrão de Employees) ---
      name: { type: DataTypes.STRING, allowNull: false },
      photoUrl: { type: DataTypes.STRING, allowNull: true },
      cpf: { type: DataTypes.STRING, allowNull: true },
      rg: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },

      // --- Endereço ---
      zipCode: { type: DataTypes.STRING, allowNull: true },
      street: { type: DataTypes.STRING, allowNull: true },
      number: { type: DataTypes.STRING, allowNull: true },
      complement: { type: DataTypes.STRING, allowNull: true },
      neighborhood: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },

      // --- Dados bancários ---
      bankName: { type: DataTypes.STRING, allowNull: true },
      bankAgency: { type: DataTypes.STRING, allowNull: true },
      bankAccount: { type: DataTypes.STRING, allowNull: true },
      bankAccountType: { type: DataTypes.STRING, allowNull: true },
      pixKey: { type: DataTypes.STRING, allowNull: true },

      // --- Sociedade ---
      partnershipStartDate: { type: DataTypes.DATEONLY, allowNull: true },
      // Preenchido quando o sócio sai da sociedade (partnerStatus vira "withdrawn").
      partnershipEndDate: { type: DataTypes.DATEONLY, allowNull: true },
      // Percentual de participação societária (0-100).
      ownershipPercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      // Sócio-administrador (tem poder de gestão) vs. sócio só-capital.
      isAdministrator: { type: DataTypes.BOOLEAN, allowNull: true },
      // Valor mensal do pró-labore — só cadastro por enquanto, ver
      // comentário no topo do arquivo.
      prolaboreValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      // "active" | "withdrawn"
      partnerStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },

      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CompanyPartners");
  }
};
