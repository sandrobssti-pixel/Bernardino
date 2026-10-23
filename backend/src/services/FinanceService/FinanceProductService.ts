import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceSupplier from "../../models/FinanceSupplier";

// Embutido em list/show pra `mainSupplierId` (aba Fornecedor/Produção,
// v2.3.168) já vir com o nome do fornecedor pronto — mesmo motivo do
// `embeddedKey` novo no FinanceRecordModal.js (associação chama
// `mainSupplier`, não `supplier`).
const PRODUCT_INCLUDE = [{ model: FinanceSupplier, as: "mainSupplier", attributes: ["id", "name"] }];

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  type?: string;
}

interface ListResponse {
  records: FinanceProduct[];
  count: number;
  hasMore: boolean;
}

interface ProductData {
  name: string;
  type?: string;
  sku?: string;
  ncm?: string;
  unit?: string;
  price?: string;
  costPrice?: string;
  controlStock?: boolean;
  stockQuantity?: number;
  minStockQuantity?: number;
  notes?: string;
  active?: boolean;
  // Cadastro de armas/munições/insumos (clube de tiro, loja de armas,
  // armaria) — type "weapon"/"ammunition". Ver docs/MANUAL_TECNICO.md.
  weaponType?: string;
  brand?: string;
  model?: string;
  caliber?: string;
  serialNumber?: string;
  cartridgeCapacity?: number;
  operatingMode?: string;
  barrelCount?: number;
  barrelLength?: number;
  boreType?: string;
  kineticEnergyJ?: number;
  useClassification?: string;
  sigmaRegistrationNumber?: string;
  origin?: string;
  weaponStatus?: string;
  manufacturingLotNumber?: string;
  packageBarcode?: string;
}

// Tipos de produto que exigem número de série (arma física, único por
// empresa). Munição/insumo não tem número de série individual.
const SERIAL_NUMBER_REQUIRED_TYPES = ["weapon"];

// `$skipSerialRequired` (contexto do Yup, não campo do produto) — usado só
// pela importação em massa do relatório de estoque da loja anterior
// (FinanceImportService.ts, `parseGunStoreReport`), que não tem coluna de
// número de série nenhuma (é um catálogo por MODELO com quantidade em
// estoque, não uma lista de unidades individuais serializadas). Sem essa
// válvula, TODA linha de arma dessa planilha falhava a validação e nunca
// chegava a ser criada — o cliente confirmou que quer importar mesmo assim
// e completar o número de série manual depois; o campo continua obrigatório
// em qualquer outro caminho (cadastro manual pela tela, planilha-modelo
// oficial que tem coluna própria de número de série). Ver
// docs/MANUAL_TECNICO.md.
// Campos numéricos de arma são opcionais no banco (colunas sem NOT NULL,
// ver migration 20261015120000), mas o formulário manda "" (nunca
// undefined) quando a pessoa deixa em branco — e "" num INTEGER/FLOAT do
// Postgres dá erro de sintaxe (22P02), que o usuário via como "erro
// interno" ao salvar arma (relatado no SKU 10034336). Mesmo padrão de
// transform usado em UpdateUserService/CreateUserService/ContactController
// pra campo opcional vindo vazio do formulário.
const emptyStringToNull = (value: any, originalValue: any) =>
  originalValue === "" ? null : value;

const productSchema = Yup.object().shape({
  name: Yup.string().required("ERR_FINANCE_PRODUCT_INVALID_NAME").min(2),
  serialNumber: Yup.string().when(["type", "$skipSerialRequired"], {
    is: (type: string, skipSerialRequired: boolean) =>
      SERIAL_NUMBER_REQUIRED_TYPES.includes(type) && !skipSerialRequired,
    then: Yup.string()
      .required("ERR_FINANCE_PRODUCT_SERIAL_REQUIRED")
      .min(1, "ERR_FINANCE_PRODUCT_SERIAL_REQUIRED"),
    otherwise: Yup.string().nullable()
  }),
  cartridgeCapacity: Yup.number().nullable().transform(emptyStringToNull),
  barrelCount: Yup.number().nullable().transform(emptyStringToNull),
  barrelLength: Yup.number().nullable().transform(emptyStringToNull),
  kineticEnergyJ: Yup.number().nullable().transform(emptyStringToNull)
});

// Índice único parcial (companyId, serialNumber) cobre a corrida entre duas
// requisições simultâneas; esse checque prévio só existe pra devolver um
// erro amigável (em vez do SequelizeUniqueConstraintError genérico) no
// caminho normal (sem corrida).
const ensureSerialNumberIsUnique = async (
  serialNumber: string | undefined,
  companyId: number,
  ignoreId?: number
): Promise<void> => {
  if (!serialNumber) return;

  const where: any = { companyId, serialNumber };
  if (ignoreId) {
    where.id = { [Op.ne]: ignoreId };
  }

  const existing = await FinanceProduct.findOne({ where });
  if (existing) {
    throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
  }
};

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  type
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  // Segmentação por tipo (produto/serviço/arma/munição) — pedido do
  // cliente ao importar uma planilha de armas separada, pra não misturar
  // na mesma lista com os produtos/munições já cadastrados (v2.3.133). O
  // dado já vinha segmentado desde a importação (`type` no
  // FinanceProduct, FinanceImportService.parseGunStoreReport) — só
  // faltava o filtro na listagem pra visualizar separado.
  //
  // "Armas nacionais"/"Armas importadas" (v2.3.134) não são um `type`
  // próprio — são `type="weapon"` cruzado com `origin` ("national"/
  // "imported", mesmo campo "Procedência" já usado no cadastro). Pra não
  // criar um filtro de dois selects (Tipo + Procedência) só pra esse caso,
  // o valor do filtro único de "Tipo" pode vir como "weapon:national" —
  // dois pontos separam tipo e procedência, resolvido aqui.
  if (type) {
    if (type.includes(":")) {
      const [realType, origin] = type.split(":");
      whereCondition.type = realType;
      whereCondition.origin = origin;
    } else {
      whereCondition.type = type;
    }
  }

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("FinanceProduct.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { sku: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await FinanceProduct.findAndCountAll({
    where: whereCondition,
    include: PRODUCT_INCLUDE,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<FinanceProduct> => {
  const record = await FinanceProduct.findOne({ where: { id, companyId }, include: PRODUCT_INCLUDE });

  if (!record) {
    throw new AppError("ERR_FINANCE_PRODUCT_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ProductData,
  companyId: number,
  options: { skipSerialRequired?: boolean } = {}
): Promise<FinanceProduct> => {
  let validatedData: ProductData;
  try {
    validatedData = await productSchema.validate(data, {
      context: { skipSerialRequired: !!options.skipSerialRequired }
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await ensureSerialNumberIsUnique(validatedData.serialNumber, companyId);

  try {
    const record = await FinanceProduct.create({ ...validatedData, companyId } as any);
    return record;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

export const update = async (
  id: string | number,
  data: ProductData,
  companyId: number,
  options: { skipSerialRequired?: boolean } = {}
): Promise<FinanceProduct> => {
  const record = await show(id, companyId);

  let validatedData: ProductData;
  try {
    validatedData = await productSchema.validate(data, {
      context: { skipSerialRequired: !!options.skipSerialRequired }
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await ensureSerialNumberIsUnique(validatedData.serialNumber, companyId, record.id);

  try {
    await record.update(validatedData);
    return record;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("ERR_FINANCE_PRODUCT_DUPLICATE_SERIAL");
    }
    throw err;
  }
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
