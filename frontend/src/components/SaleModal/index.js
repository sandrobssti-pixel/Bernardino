import React, { useState, useEffect } from "react";
import { Formik, Form, FieldArray, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Box from "@material-ui/core/Box";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import toastError from "../../errors/toastError";
import { money } from "../../utils/financeFormat";
import MenuItem from "@material-ui/core/MenuItem";
import CfopAutocomplete from "../CfopAutocomplete";
import FinanceAsyncAutocomplete from "../FinanceAsyncAutocomplete";
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_OPTIONS,
  SALE_OPERATION_TYPE_OPTIONS,
  SALE_CONSUMER_PRESENCE_OPTIONS,
  SALE_INTERMEDIARY_TYPE_OPTIONS,
  SALE_FINAL_CONSUMER_TYPE_OPTIONS,
  SALE_RECIPIENT_TYPE_OPTIONS,
  SALE_IE_INDICATOR_OPTIONS,
  SALE_PAYMENT_METHOD_OPTIONS,
  SALE_ISSUANCE_PURPOSE_OPTIONS,
  SALE_FREIGHT_RESPONSIBILITY_OPTIONS,
} from "../../pages/Financeiro/financeConfig";

// Mostra o Tipo junto do nome NA LISTA de resultados da busca de item da
// venda (não no campo já preenchido, que fica compacto só com o nome) —
// sem isso, Produto/Serviço/Arma/Munição apareciam todos misturados sem
// nenhuma pista visual de qual é qual (pedido do cliente, depois que o
// catálogo de Serviços do Despachante Bélico cresceu e passou a dividir
// espaço com arma/munição na mesma busca).
const renderProductOption = (opt) =>
  opt?.type ? `${opt.name} — ${PRODUCT_TYPE_LABELS[opt.type] || opt.type}` : opt?.name || "";

// Filtro de Tipo por item da venda — não é um dado que a venda guarda (o
// que fica salvo é só o `productId` escolhido), por isso vive em estado
// local do componente (por índice da linha), não no Formik/`emptyItem`.
// Pedido explícito do cliente: a busca de "Produto/serviço" misturava
// tudo (arma, munição, serviço...) na mesma lista, e mostrar o Tipo no
// texto do resultado (acima) não bastou — ele queria conseguir RESTRINGIR
// a busca de verdade, não só identificar visualmente o que já apareceu.
const PRODUCT_TYPE_FILTER_OPTIONS = [{ value: "", label: "Todos os tipos" }, ...PRODUCT_TYPE_OPTIONS];

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 12,
  },
  itemRow: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
  },
  totalBox: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
  },
  totalValue: {
    fontWeight: 700,
    fontSize: "1.1rem",
  },
}));

const emptyItem = {
  productId: "",
  description: "",
  sku: "",
  ncm: "",
  cfop: "5102",
  unit: "UN",
  quantity: 1,
  unitPrice: 0,
  sigmaSinarm: "",
  ammoLot: "",
  packageId: "",
};

const buildInitialValues = (sale, defaultCfop) => ({
  customerId: sale?.customerId || "",
  saleDate: sale?.saleDate || new Date().toISOString().slice(0, 10),
  notes: sale?.notes || "",
  // Campos fiscais pedidos pelo contador do cliente (v2.3.166) — defaults
  // iguais aos do backend (Sale.ts), pra uma venda nova já nascer com o
  // valor mais comum pré-selecionado em vez de vazio.
  operationType: sale?.operationType || "internal",
  operationNature: sale?.operationNature || "Venda",
  consumerPresence: sale?.consumerPresence || "1",
  intermediaryType: sale?.intermediaryType || "none",
  finalConsumerType: sale?.finalConsumerType || "final",
  recipientType: sale?.recipientType || "customer",
  ieIndicator: sale?.ieIndicator || "non_contributor",
  paymentMethod: sale?.paymentMethod || "",
  // "Finalidade da Emissão" + "Dados de Transporte" (v2.3.168).
  issuancePurpose: sale?.issuancePurpose || "normal",
  volumeQuantity: sale?.volumeQuantity || 0,
  volumeSpecies: sale?.volumeSpecies || "",
  volumeBrand: sale?.volumeBrand || "",
  volumeNumber: sale?.volumeNumber || "",
  volumeGrossWeight: sale?.volumeGrossWeight || "0",
  volumeNetWeight: sale?.volumeNetWeight || "0",
  carrierName: sale?.carrierName || "",
  carrierAddress: sale?.carrierAddress || "",
  carrierCity: sale?.carrierCity || "",
  carrierState: sale?.carrierState || "",
  carrierCnpj: sale?.carrierCnpj || "",
  carrierIe: sale?.carrierIe || "",
  deliveryName: sale?.deliveryName || "",
  deliveryAddress: sale?.deliveryAddress || "",
  deliveryNumber: sale?.deliveryNumber || "",
  deliveryComplement: sale?.deliveryComplement || "",
  deliveryNeighborhood: sale?.deliveryNeighborhood || "",
  deliveryCity: sale?.deliveryCity || "",
  deliveryState: sale?.deliveryState || "",
  deliveryZipCode: sale?.deliveryZipCode || "",
  deliveryPhone: sale?.deliveryPhone || "",
  freightResponsibility: sale?.freightResponsibility || "9",
  boardingLocation: sale?.boardingLocation || "",
  boardingState: sale?.boardingState || "",
  vehiclePlate: sale?.vehiclePlate || "",
  vehicleState: sale?.vehicleState || "",
  items:
    sale?.items?.length > 0
      ? sale.items.map((item) => ({
          productId: item.productId || "",
          description: item.description,
          sku: item.sku || item.product?.sku || "",
          ncm: item.ncm || "",
          cfop: item.cfop || defaultCfop || "5102",
          unit: item.unit || "UN",
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          sigmaSinarm: item.sigmaSinarm || "",
          ammoLot: item.ammoLot || "",
          packageId: item.packageId || "",
        }))
      : [{ ...emptyItem, cfop: defaultCfop || "5102" }],
});

// Modal de criação/edição de venda (Fase 3 — módulo fiscal, ver
// docs/MANUAL_TECNICO.md, seção 6.2). Só permite editar vendas em rascunho —
// depois de confirmada, os itens ficam travados (viram base pra nota fiscal
// e conta a receber, não podem mudar retroativamente).
// Reforma Tributária 2027 (IVA) — espelho simplificado do cálculo real
// (`Iva2027Service.ts`, backend), só pra pré-visualização enquanto a venda
// ainda está sendo montada. O valor gravado de verdade é recalculado no
// servidor ao salvar (`SaleService.buildItemRows`) — esta função nunca é a
// fonte de verdade, só evita que o vendedor precise salvar pra ver uma
// estimativa. Mesma lógica de B2C/B2B/B2G do motor real.
const calculateIvaPreview = (items, product, customer) => {
  const customerProfile = customer?.ivaTaxpayerProfile || "B2C";
  const customerGovExempt = !!customer?.ivaGovExempt;

  return items.reduce(
    (acc, item) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const base = qty * unitPrice;
      acc.netValue += base;

      if (customerProfile === "B2C" || (customerProfile === "B2G" && customerGovExempt)) {
        return acc;
      }

      const prod = product(item.productId);
      const reduction = prod?.ivaEducationReduction ? 0.4 : 1;
      const cbsRate = (Number(prod?.ivaCbsRate) || 0) * reduction;
      const ibsRate = (Number(prod?.ivaIbsRate) || 0) * reduction;
      acc.cbsValue += base * (cbsRate / 100);
      acc.ibsValue += base * (ibsRate / 100);
      return acc;
    },
    { netValue: 0, cbsValue: 0, ibsValue: 0 }
  );
};

const SaleModal = ({ open, onClose, onSave, sale, customers, products, defaultCfop, finance, reform2027Enabled }) => {
  const classes = useStyles();
  const [initialValues, setInitialValues] = useState(buildInitialValues(null, defaultCfop));
  // Filtro de Tipo por linha de item (ver comentário de
  // PRODUCT_TYPE_FILTER_OPTIONS acima) — chave é o índice da linha.
  const [itemTypeFilters, setItemTypeFilters] = useState({});

  useEffect(() => {
    setInitialValues(buildInitialValues(sale, defaultCfop));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale, open]);

  const handleClose = () => onClose();

  const handleSubmit = async (values, { setSubmitting }) => {
    if (values.items.length === 0) {
      toast.error("Adicione pelo menos um item à venda.");
      setSubmitting(false);
      return;
    }
    try {
      await onSave(values);
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  // Ao escolher o Cliente, pré-preenche os campos fiscais que dependem de
  // quem é o destinatário (v2.3.167, pedido do cliente: "digita o nome do
  // cliente e preenche automaticamente os campos relacionados") — CPF
  // nunca é Contribuinte do ICMS nem tem Inscrição Estadual (regra geral,
  // pessoa física não é contribuinte), então é um default seguro; CNPJ
  // fica como "Contribuinte"/"Normal" por padrão, mas ambos continuam
  // campos de select completos, editáveis se o caso real for diferente
  // (ex.: produtor rural pessoa física com IE, ou CNPJ isento).
  const handleCustomerChange = (customer, setFieldValue) => {
    setFieldValue("customerId", customer?.id || "");
    if (!customer) return;
    if (customer.documentType === "cpf") {
      setFieldValue("ieIndicator", "non_contributor");
      setFieldValue("finalConsumerType", "final");
    } else {
      setFieldValue("ieIndicator", "contributor");
      setFieldValue("finalConsumerType", "normal");
    }
  };

  const handleProductChange = (index, product, setFieldValue, operationType) => {
    setFieldValue(`items.${index}.productId`, product?.id || "");
    if (product) {
      setFieldValue(`items.${index}.description`, product.name);
      setFieldValue(`items.${index}.sku`, product.sku || "");
      setFieldValue(`items.${index}.ncm`, product.ncm || "");
      setFieldValue(`items.${index}.unit`, product.unit || "UN");
      setFieldValue(`items.${index}.unitPrice`, Number(product.price) || 0);
      // CFOP padrão do produto (aba Dados Fiscais, v2.3.167) — interno ou
      // fora da BA conforme o "Tipo de operação" já escolhido na venda.
      // Continua editável por item (CfopAutocomplete logo abaixo).
      const defaultProductCfop =
        operationType === "interstate" ? product.cfopOutState : product.cfopPrincipal;
      setFieldValue(`items.${index}.cfop`, defaultProductCfop || "5102");
    }
  };

  const fetchCustomerOptions = async (searchParam) => {
    if (!finance) return customers;
    const { records } = await finance.customers.list({ searchParam });
    return records || [];
  };

  const fetchProductOptions = async (index, searchParam) => {
    if (!finance) return products;
    const type = itemTypeFilters[index] || undefined;
    const { records } = await finance.products.list({ searchParam, type });
    return records || [];
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
      scroll="paper"
    >
      <DialogTitle>{sale?.id ? `Editar venda #${sale.id}` : "Nova venda"}</DialogTitle>
      <Formik initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => {
          const total = values.items.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
            0
          );

          const selectedCustomer =
            customers.find((c) => c.id === values.customerId) ||
            (sale?.customer?.id === values.customerId ? sale.customer : null);
          const ivaPreview = calculateIvaPreview(
            values.items,
            (productId) => products.find((p) => p.id === productId),
            selectedCustomer
          );

          return (
            <Form>
              <DialogContent dividers={false}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <FinanceAsyncAutocomplete
                      label="Cliente"
                      placeholder="Nome, CPF/CNPJ ou e-mail"
                      value={
                        customers.find((c) => c.id === values.customerId) ||
                        (sale?.customer?.id === values.customerId ? sale.customer : null)
                      }
                      initialOptions={sale?.customer ? [sale.customer, ...customers] : customers}
                      getOptionLabel={(opt) => opt?.name || ""}
                      fetchOptions={fetchCustomerOptions}
                      onChange={(e, newValue) => handleCustomerChange(newValue, setFieldValue)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      type="date"
                      name="saleDate"
                      label="Data da venda"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />

                <Typography variant="subtitle2" gutterBottom>
                  Itens
                </Typography>

                <FieldArray name="items">
                  {({ push, remove }) => (
                    <>
                      {values.items.map((item, index) => {
                        const selectedProduct = products.find((p) => p.id === item.productId);
                        const isWeaponOrAmmo =
                          selectedProduct?.type === "weapon" || selectedProduct?.type === "ammunition";

                        return (
                        <Grid container spacing={1} key={index} className={classes.itemRow}>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              select
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Tipo"
                              value={itemTypeFilters[index] || ""}
                              onChange={(e) =>
                                setItemTypeFilters((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              style={{ marginBottom: 4 }}
                            >
                              {PRODUCT_TYPE_FILTER_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <FinanceAsyncAutocomplete
                              key={`product-${index}-${itemTypeFilters[index] || ""}`}
                              label="Produto/serviço"
                              placeholder="Nome ou SKU (vazio = item avulso)"
                              value={products.find((p) => p.id === item.productId) || null}
                              initialOptions={products}
                              getOptionLabel={(opt) => opt?.name || ""}
                              renderOption={renderProductOption}
                              fetchOptions={(searchParam) => fetchProductOptions(index, searchParam)}
                              onChange={(e, newValue) =>
                                handleProductChange(index, newValue, setFieldValue, values.operationType)
                              }
                            />
                          </Grid>
                          <Grid item xs={6} sm={2}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Código (SKU)"
                              name={`items.${index}.sku`}
                            />
                          </Grid>
                          <Grid item xs={6} sm={2}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Descrição"
                              name={`items.${index}.description`}
                            />
                          </Grid>
                          <Grid item xs={4} sm={2}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              type="number"
                              label="Qtd."
                              name={`items.${index}.quantity`}
                            />
                          </Grid>
                          <Grid item xs={4} sm={2}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              type="number"
                              label="Valor unit. (R$)"
                              name={`items.${index}.unitPrice`}
                            />
                          </Grid>
                          <Grid item xs={4} sm={1} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <IconButton
                              size="small"
                              onClick={() => remove(index)}
                              disabled={values.items.length === 1}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="NCM"
                              name={`items.${index}.ncm`}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <CfopAutocomplete
                              value={item.cfop}
                              onChange={(code) => setFieldValue(`items.${index}.cfop`, code)}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Unidade"
                              name={`items.${index}.unit`}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                            <Typography variant="body2" color="textSecondary">
                              {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                            </Typography>
                          </Grid>

                          {/* SIGMA/SINARM, lote de munição e ID de embalagem
                              (v2.3.166) — só aparecem quando o item é Arma ou
                              Munição (controle exigido por lei pra esses dois
                              tipos, pedido do contador do cliente). */}
                          {isWeaponOrAmmo && (
                            <>
                              <Grid item xs={12} sm={4}>
                                <Field
                                  as={TextField}
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  label="SIGMA/SINARM"
                                  name={`items.${index}.sigmaSinarm`}
                                />
                              </Grid>
                              <Grid item xs={6} sm={4}>
                                <Field
                                  as={TextField}
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  label="Lote munição"
                                  name={`items.${index}.ammoLot`}
                                />
                              </Grid>
                              <Grid item xs={6} sm={4}>
                                <Field
                                  as={TextField}
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  label="ID embalagem"
                                  name={`items.${index}.packageId`}
                                />
                              </Grid>
                            </>
                          )}
                        </Grid>
                        );
                      })}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => push({ ...emptyItem, cfop: defaultCfop || "5102" })}
                      >
                        Adicionar item
                      </Button>
                    </>
                  )}
                </FieldArray>

                <Divider style={{ margin: "16px 0" }} />

                <Typography variant="subtitle2" gutterBottom>
                  Dados fiscais da nota
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Tipo de operação"
                      name="operationType"
                    >
                      {SALE_OPERATION_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Natureza da operação"
                      name="operationNature"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Presença do consumidor"
                      name="consumerPresence"
                    >
                      {SALE_CONSUMER_PRESENCE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Tipo de intermediador"
                      name="intermediaryType"
                    >
                      {SALE_INTERMEDIARY_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Tipo consumidor"
                      name="finalConsumerType"
                    >
                      {SALE_FINAL_CONSUMER_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Destinatário: Tipo"
                      name="recipientType"
                    >
                      {SALE_RECIPIENT_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Indicador IE"
                      name="ieIndicator"
                    >
                      {SALE_IE_INDICATOR_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Forma de pagamento"
                      name="paymentMethod"
                    >
                      {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />

                <Typography variant="subtitle2" gutterBottom>
                  Finalidade da Emissão / Dados de Transporte
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Finalidade da Emissão"
                      name="issuancePurpose"
                    >
                      {SALE_ISSUANCE_PURPOSE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Frete por Conta"
                      name="freightResponsibility"
                    >
                      {SALE_FREIGHT_RESPONSIBILITY_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>

                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="number" label="Volumes" name="volumeQuantity" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Espécie" name="volumeSpecies" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Marca (volumes)" name="volumeBrand" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Número" name="volumeNumber" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="number" label="Peso Bruto (kg)" name="volumeGrossWeight" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="number" label="Peso Líquido (kg)" name="volumeNetWeight" />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Transportadora — Nome/Razão Social" name="carrierName" />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Transportadora — Endereço" name="carrierAddress" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Cidade" name="carrierCity" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="UF" name="carrierState" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="CNPJ Transportadora" name="carrierCnpj" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Inscrição Estadual Transportadora" name="carrierIe" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Placa do Veículo" name="vehiclePlate" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="UF da Placa" name="vehicleState" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Local de Embarque" name="boardingLocation" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="UF de Embarque" name="boardingState" />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">
                      Local de entrega (só se for diferente do endereço do cliente)
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Nome" name="deliveryName" />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Endereço" name="deliveryAddress" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Número" name="deliveryNumber" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Complemento" name="deliveryComplement" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Bairro" name="deliveryNeighborhood" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Cidade" name="deliveryCity" />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="UF" name="deliveryState" />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="CEP" name="deliveryZipCode" />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" label="Telefone" name="deliveryPhone" />
                  </Grid>
                </Grid>

                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline
                  minRows={2}
                  label="Observações"
                  name="notes"
                  style={{ marginTop: 16 }}
                />

                <Box className={classes.totalBox}>
                  <Typography className={classes.totalValue}>
                    Total: {money(total)}
                  </Typography>
                </Box>

                {/* Reforma Tributária 2027 (IVA) — aparece sempre, mas só
                    com números de verdade (e sem o aspecto acinzentado)
                    quando a chave global estiver ativada em Configuração
                    Fiscal; até lá serve só de visualização técnica, sem
                    nenhum efeito no total/faturamento desta venda. */}
                <Box
                  mt={1}
                  p={1.5}
                  display="flex"
                  justifyContent="flex-end"
                  style={{ gap: 24, opacity: reform2027Enabled ? 1 : 0.5 }}
                >
                  <Typography variant="body2" color="textSecondary">
                    Subtotal líquido (IVA 2027): {money(ivaPreview.netValue)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Previsão CBS por fora: {money(ivaPreview.cbsValue)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Previsão IBS por fora: {money(ivaPreview.ibsValue)}
                  </Typography>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" color="primary" variant="contained" disabled={isSubmitting}>
                  {isSubmitting ? <CircularProgress size={20} /> : "Salvar"}
                </Button>
              </DialogActions>
            </Form>
          );
        }}
      </Formik>
    </Dialog>
  );
};

export default SaleModal;
