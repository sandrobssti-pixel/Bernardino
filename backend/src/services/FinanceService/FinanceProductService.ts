import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceSupplier from "../../models/FinanceSupplier";

// Embutido em list/show pra `mainSupplierId` (aba Fornecedor/Produção,
// v2.3.168) já vir com o nome do fornecedor pronto — mesmo motivo do
// `embeddedKey` novo no FinanceRecordModal.js (associação chama
// `mainSupplier`, não `supplier`).
// Sem `attributes` restrito (v2.3.211): o autofill de dados fiscais no
// cadastro de Produto (FinanceRecordModal.js, `autofillFields`) lê os
// 13 campos fiscais do fornecedor já vinculado direto deste objeto
// embutido — com `attributes: ["id", "name"]` como antes, reselecionar
// o mesmo fornecedor no formulário zerava os campos fiscais do produto
// (FinanceAsyncAutocomplete reaproveita esse objeto embutido como opção
// da lista, sobrepondo a versão completa vinda da busca).
const PRODUCT_INCLUDE = [{ model: FinanceSupplier, as: "mainSupplier" }];

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
  cartridgeCapacity?: number;
  operatingMode?: string;
  barrelCount?: number;
  barrelLength?: number;
  boreType?: string;
  kineticEnergyJ?: number;
  useClassification?: string;
  origin?: string;
  manufacturingLotNumber?: string;
  packageBarcode?: string;
  // Aba "Fornecedor/Produção" (v2.3.168) — FK pra FinanceSupplier,
  // opcional. Mesmo motivo do emptyStringToNull abaixo: formulário manda
  // "" quando nenhum fornecedor foi escolhido.
  mainSupplierId?: number | null;
}

// Número de série, registro SIGMA/SINARM e situação da arma migraram pra
// FinanceWeaponUnit — o Produto passou a representar o MODELO/SKU, não
// mais 1 arma física (v2.3.204, ver docs/MANUAL_TECNICO.md seção 183).
// Qualquer payload antigo que ainda mande esses 3 campos aqui é
// silenciosamente ignorado (nunca grava nem dá erro) em vez de validado —
// o cadastro da arma em si acontece em FinanceWeaponUnitService.
const DEPRECATED_WEAPON_FIELDS = ["serialNumber", "sigmaRegistrationNumber", "weaponStatus"] as const;
const stripDeprecatedWeaponFields = (data: ProductData): ProductData => {
  const cleaned = { ...data } as any;
  DEPRECATED_WEAPON_FIELDS.forEach(field => {
    delete cleaned[field];
  });
  return cleaned;
};

// Campos numéricos (INTEGER/FLOAT no Postgres, FK incluída) são
// opcionais, mas o formulário manda "" (nunca undefined) quando a pessoa
// deixa em branco/não escolhe nada, ou quando `stripHiddenFieldValues`
// (FinanceRecordModal/index.js) limpa um campo que ficou invisível pro
// tipo de produto atual (ex.: "Peso" escondido pra arma/munição,
// v2.3.205) — e "" num INTEGER/FLOAT do Postgres dá erro de sintaxe
// (22P02), que o usuário via como "erro interno" ao salvar. Relatado 3
// vezes com causas diferentes na mesma classe de bug: SKU 10034336
// (seção 183), SKU 75008418 (seção 185), e por último `mainSupplierId`
// (produtos #32/#33, v2.3.209) — esse último só apareceu porque é uma
// FK numérica opcional (aba Fornecedor/Produção), fácil de esquecer que
// é "numérica" já que o campo no formulário é um autocomplete, não um
// <input type="number">. Mesmo padrão de transform usado em
// UpdateUserService/CreateUserService/ContactController pra campo
// opcional vindo vazio do formulário. Listas = todas as colunas
// realmente numéricas de FinanceProduct (ver models/FinanceProduct.ts) —
// os demais campos "numéricos" do formulário (price, costPrice, taxRate,
// ICMS/IBPT, tabelas de preço...) são VARCHAR no banco e aceitam ""
// sem problema.
const emptyStringToNull = (value: any, originalValue: any) =>
  originalValue === "" ? null : value;

// Essas colunas são NOT NULL DEFAULT 0 no banco (migrations
// 20260914140200 e 20261019270000) — "" não pode virar null aqui
// (violaria a constraint), tem que cair no próprio default (0).
const emptyStringToZero = (value: any, originalValue: any) =>
  originalValue === "" ? 0 : value;

const NULLABLE_NUMERIC_FIELDS = [
  "weight",
  "minStockQuantity",
  "cartridgeCapacity",
  "barrelCount",
  "barrelLength",
  "kineticEnergyJ",
  "mainSupplierId"
] as const;

const NOT_NULL_NUMERIC_FIELDS = [
  "stockQuantity",
  "reservedStock",
  "idealStock",
  "stockByLot",
  "loyaltyPoints",
  "redemptionPoints"
] as const;

const productSchema = Yup.object().shape({
  name: Yup.string().required("ERR_FINANCE_PRODUCT_INVALID_NAME").min(2),
  ...NULLABLE_NUMERIC_FIELDS.reduce(
    (shape, field) => ({ ...shape, [field]: Yup.number().nullable().transform(emptyStringToNull) }),
    {} as Record<string, any>
  ),
  ...NOT_NULL_NUMERIC_FIELDS.reduce(
    (shape, field) => ({ ...shape, [field]: Yup.number().transform(emptyStringToZero) }),
    {} as Record<string, any>
  )
});

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
  companyId: number
): Promise<FinanceProduct> => {
  let validatedData: ProductData;
  try {
    validatedData = { ...data, ...(await productSchema.validate(data)) };
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await FinanceProduct.create({
    ...stripDeprecatedWeaponFields(validatedData),
    companyId
  } as any);
  return record;
};

export const update = async (
  id: string | number,
  data: ProductData,
  companyId: number
): Promise<FinanceProduct> => {
  const record = await show(id, companyId);

  let validatedData: ProductData;
  try {
    validatedData = { ...data, ...(await productSchema.validate(data)) };
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(stripDeprecatedWeaponFields(validatedData));
  return record;
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
