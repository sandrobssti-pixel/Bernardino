import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Cadastro de Funcionários (RH — Fase 1 de 3, ver docs/MANUAL_TECNICO.md).
// Funcionário NÃO é um User — não tem login nem acesso ao sistema, é só um
// registro de dados de RH. Tabela larga: os campos específicos de cada
// regime de trabalho (CLT/PJ/Estagiário/Menor Aprendiz) ficam todos na
// mesma tabela, `allowNull: true`, e o formulário decide quais mostrar
// conforme `workRegime` — mesmo padrão já usado em Produto/Serviço
// (ver frontend/src/pages/Services/servicesConfig.js).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Employees";
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
      // "Gestor/Supervisor responsável" — um usuário do AtendeFlow (não
      // outro funcionário). Usado também pelo "Supervisor de Estágio" do
      // regime Estagiário, e na Fase 3 (painel de desempenho) pra
      // restringir quem vê a avaliação de quem.
      managerId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },

      // --- Comum a todo regime ---
      name: { type: DataTypes.STRING, allowNull: false },
      photoUrl: { type: DataTypes.STRING, allowNull: true },
      cpf: { type: DataTypes.STRING, allowNull: true },
      rg: { type: DataTypes.STRING, allowNull: true },
      pisPasep: { type: DataTypes.STRING, allowNull: true },
      voterTitle: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },

      // Endereço — mesma nomenclatura já usada no resto do sistema
      // (ver Customer/SaleModal: zipCode/street/number/complement/
      // neighborhood/city/state).
      zipCode: { type: DataTypes.STRING, allowNull: true },
      street: { type: DataTypes.STRING, allowNull: true },
      number: { type: DataTypes.STRING, allowNull: true },
      complement: { type: DataTypes.STRING, allowNull: true },
      neighborhood: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },

      // Dados bancários
      bankName: { type: DataTypes.STRING, allowNull: true },
      bankAgency: { type: DataTypes.STRING, allowNull: true },
      bankAccount: { type: DataTypes.STRING, allowNull: true },
      bankAccountType: { type: DataTypes.STRING, allowNull: true },
      pixKey: { type: DataTypes.STRING, allowNull: true },

      // "clt" | "pj" | "intern" | "young_apprentice"
      workRegime: { type: DataTypes.STRING, allowNull: false, defaultValue: "clt" },
      // "active" | "leave" | "terminated"
      contractStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },

      // --- CLT / Menor Aprendiz ---
      ctps: { type: DataTypes.STRING, allowNull: true },
      ctpsSeries: { type: DataTypes.STRING, allowNull: true },
      admissionDate: { type: DataTypes.DATEONLY, allowNull: true },
      terminationDate: { type: DataTypes.DATEONLY, allowNull: true },
      grossSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      role: { type: DataTypes.STRING, allowNull: true },
      weeklyHours: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      transportVoucher: { type: DataTypes.BOOLEAN, allowNull: true },
      mealVoucher: { type: DataTypes.BOOLEAN, allowNull: true },

      // --- PJ ---
      companyName: { type: DataTypes.STRING, allowNull: true },
      cnpj: { type: DataTypes.STRING, allowNull: true },
      municipalRegistration: { type: DataTypes.STRING, allowNull: true },
      monthlyContractValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      contractStartDate: { type: DataTypes.DATEONLY, allowNull: true },
      contractEndDate: { type: DataTypes.DATEONLY, allowNull: true },
      contractScope: { type: DataTypes.TEXT, allowNull: true },

      // --- Estagiário ---
      school: { type: DataTypes.STRING, allowNull: true },
      course: { type: DataTypes.STRING, allowNull: true },
      stipendValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      transportAidValue: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      internshipStartDate: { type: DataTypes.DATEONLY, allowNull: true },
      internshipEndDate: { type: DataTypes.DATEONLY, allowNull: true },
      lifeInsurancePolicy: { type: DataTypes.STRING, allowNull: true },

      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Employees");
  }
};
