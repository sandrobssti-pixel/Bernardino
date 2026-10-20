import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Avatar from "@material-ui/core/Avatar";
import PrintIcon from "@material-ui/icons/Print";
import PhotoCameraIcon from "@material-ui/icons/PhotoCamera";
import ImageIcon from "@material-ui/icons/Image";

import toastError from "../../errors/toastError";
import FinanceAsyncAutocomplete from "../FinanceAsyncAutocomplete";
import { fetchAddressByCep } from "../../utils/cep";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 12,
    [theme.breakpoints.down("xs")]: {
      margin: theme.spacing(2),
      width: "calc(100% - 32px)",
    },
  },
  dialogTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    padding: theme.spacing(1.75, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  dialogContent: {
    padding: theme.spacing(2.5),
  },
  dialogActions: {
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  printArea: {
    display: "none",
  },
  photoBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  photoAvatar: {
    width: 64,
    height: 64,
    cursor: "pointer",
  },
  // Impressão de UM registro (dentro do formulário de editar) — mesma
  // técnica do FinanceRecordList (window.print() + @media print), com um
  // id próprio pra não colidir com a área de impressão em massa da lista.
  "@global": {
    "@media print": {
      "body *": {
        visibility: "hidden",
      },
      "#finance-record-modal-print-area, #finance-record-modal-print-area *": {
        visibility: "visible",
      },
      "#finance-record-modal-print-area": {
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
      },
    },
  },
}));

const buildInitialValues = (fields, record) => {
  const values = {};
  fields.forEach((field) => {
    if (field.type === "sectionTitle" || field.type === "photo" || field.type === "serviceSelect") return;
    if (field.type === "switch") {
      values[field.name] = record?.[field.name] ?? field.defaultValue ?? false;
    } else {
      values[field.name] = record?.[field.name] ?? field.defaultValue ?? "";
    }
  });
  return values;
};

// Texto pra exibir um campo na impressão de um registro — mesma ideia do
// `col.render`/`record[col.field]` já usado na impressão em lista
// (FinanceRecordList.js), só que lendo os valores ATUAIS do formulário
// (`values`), não o registro salvo — assim reflete o que está na tela, até
// antes de salvar.
const formatFieldValueForPrint = (field, values, record) => {
  const raw = values[field.name];
  if (field.type === "switch") return raw ? "Sim" : "Não";
  if (field.type === "select") {
    const opt = field.options?.find((o) => String(o.value) === String(raw));
    return opt ? opt.label : raw || "—";
  }
  if (field.type === "asyncSelect") {
    const singularKey = field.embeddedKey || field.optionsResource?.replace(/s$/, "");
    const embedded = record?.[singularKey];
    if (embedded && embedded.id === raw) return embedded.name;
    return raw || "—";
  }
  return raw === "" || raw === null || raw === undefined ? "—" : String(raw);
};

// Modal genérico de cadastro do módulo Financeiro (Fase 1 — clientes,
// fornecedores, produtos; Fase 2 — contas a pagar/receber). Recebe um schema
// de campos declarativo em vez de triplicar o mesmo formulário várias vezes
// — ver docs/MANUAL_TECNICO.md, seção 6.2.
//
// Campo tipo "asyncSelect" (Fase 2 — ex.: fornecedor/cliente de uma conta):
// em vez de opções estáticas, aponta pra um recurso do hook `useFinance`
// (`field.optionsResource`, ex.: "suppliers"/"customers") — a lista é
// buscada uma vez quando o modal abre, via a prop `finance` (o próprio hook,
// repassado por quem monta o formulário).
const FinanceRecordModal = ({
  open,
  onClose,
  onSave,
  title,
  fields,
  record,
  finance,
  services,
  context = {},
  canExport = false,
  enablePayments = false,
  enablePhotoUpload = false,
  onUploadPhoto,
}) => {
  const classes = useStyles();
  const fileInputRef = useRef(null);
  const [initialValues, setInitialValues] = useState(buildInitialValues(fields, null));
  // Foto (v2.3.167, só quando `enablePhotoUpload` — hoje só o cadastro de
  // Produto usa) — fica FORA do Formik de propósito: não é um campo do
  // payload JSON do registro, é um arquivo enviado numa chamada separada
  // (`onUploadPhoto`) depois que o registro já tem um id. Mesmo padrão do
  // WeaponDispatchClientModal.
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  // Snapshot dos valores no momento de imprimir (não o form inteiro) — só
  // pra montar a área de impressão escondida fora do <Dialog>, mesma lógica
  // de `printRows` em FinanceRecordList.js.
  const [printSnapshot, setPrintSnapshot] = useState(null);
  // Cobrança (Pix/boleto) gerada nesta sessão do modal — sobrescreve o que
  // já veio salvo no `record` (ver `paymentInfo` abaixo) assim que o botão
  // "Gerar Pix"/"Gerar boleto" é clicado, sem precisar fechar/reabrir o
  // modal pra ver o resultado novo.
  const [paymentResult, setPaymentResult] = useState(null);
  const [generatingPayment, setGeneratingPayment] = useState(null);
  // Quais gateways estão ligados nesta empresa (Configuração de Pagamento,
  // v2.3.158 — Mercado Pago e Asaas ligam independente, os dois podem estar
  // ativos ao mesmo tempo) — decide se mostra o seletor de gateway abaixo
  // dos botões "Gerar Pix"/"Gerar boleto" ou se manda sem perguntar (só um
  // ligado, backend resolve sozinho).
  const [paymentGateways, setPaymentGateways] = useState({
    mercadoPagoEnabled: false,
    asaasEnabled: false,
  });
  const [selectedProvider, setSelectedProvider] = useState("mercadopago");
  // Serviço escolhido no campo "serviceSelect" — só pra manter o nome
  // visível na caixa depois de escolher (o campo em si não é salvo, ver
  // comentário no branch `field.type === "serviceSelect"` abaixo).
  const [servicePickerValue, setServicePickerValue] = useState(null);

  useEffect(() => {
    setInitialValues(buildInitialValues(fields, record));
    setPaymentResult(null);
    setPhotoFile(null);
    setPhotoPreview(record?.photoUrl || null);
    setServicePickerValue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, open]);

  useEffect(() => {
    if (!open || !enablePayments) return;
    (async () => {
      try {
        const config = await finance.paymentConfig.show();
        setPaymentGateways({
          mercadoPagoEnabled: !!config?.mercadoPagoEnabled,
          asaasEnabled: !!config?.asaasEnabled,
        });
        setSelectedProvider(config?.mercadoPagoEnabled ? "mercadopago" : "asaas");
      } catch (err) {
        toastError(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enablePayments]);

  const bothGatewaysEnabled =
    paymentGateways.mercadoPagoEnabled && paymentGateways.asaasEnabled;

  // O campo "principal" (obrigatório, mín. 2 caracteres) varia por cadastro:
  // clientes/fornecedores/produtos usam "name", contas a pagar/receber (Fase
  // 2) usam "description" — sem isso, um schema fixo em "name" bloqueava o
  // submit de contas (o Yup exigia um campo que nem existe no formulário).
  const primaryFieldName = fields.some((f) => f.name === "name")
    ? "name"
    : fields.some((f) => f.name === "description")
    ? "description"
    : null;

  // `requiredWhen` (opcional, ex.: número de série só obrigatório quando
  // Tipo = Arma): recebe os valores atuais do form e devolve se o campo é
  // obrigatório nesse momento — mesma lógica de `visibleWhen`, mas pra
  // validação em vez de exibição.
  const schemaShape = primaryFieldName
    ? { [primaryFieldName]: Yup.string().min(2, "Muito curto").required("Obrigatório") }
    : {};

  fields.forEach((field) => {
    if (!field.requiredWhen) return;
    schemaShape[field.name] = Yup.string().test({
      name: `${field.name}-required-when`,
      message: "Obrigatório",
      test: (value, context) => {
        if (!field.requiredWhen(context.parent)) return true;
        return !!value && String(value).trim().length > 0;
      },
    });
  });

  const validationSchema = Yup.object().shape(schemaShape);

  // Campo some da tela (ex.: Tipo deixou de ser "Arma") mas o valor
  // continua no estado do Formik — sem isso, trocar o Tipo e salvar
  // mandaria dados de arma escondidos num produto comum. Limpa pro
  // defaultValue (ou "/false") qualquer campo que ficou invisível antes
  // de submeter.
  const stripHiddenFieldValues = (values) => {
    const cleaned = { ...values };
    fields.forEach((field) => {
      if (!field.visibleWhen || field.visibleWhen(values)) return;
      cleaned[field.name] = field.type === "switch" ? false : field.defaultValue ?? "";
    });
    return cleaned;
  };

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const saved = await onSave(stripHiddenFieldValues(values));
      const savedId = saved?.id || record?.id;
      if (enablePhotoUpload && photoFile && savedId) {
        await onUploadPhoto(savedId, photoFile);
      }
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Autopreenchimento de endereço por CEP (ViaCEP) — pedido do cliente,
  // vale pra qualquer cadastro que tenha os campos padrão de endereço
  // (`street`/`neighborhood`/`city`/`state`, mesmos nomes em
  // ADDRESS_FIELDS, financeConfig.js). Só preenche os campos que o
  // formulário atual realmente tem (`fields.some`) — nunca sobrescreve o
  // que a pessoa já digitou manualmente se o CEP não for encontrado.
  const handleCepBlur = async (e, setFieldValue) => {
    const address = await fetchAddressByCep(e.target.value);
    if (!address) return;
    [
      ["street", address.street],
      ["neighborhood", address.neighborhood],
      ["city", address.city],
      ["state", address.state],
    ].forEach(([name, value]) => {
      if (value && fields.some((f) => f.name === name)) {
        setFieldValue(name, value);
      }
    });
  };

  // Gerar cobrança (Pix/boleto) — Fase 1, só Mercado Pago, só em Contas a
  // Receber (`enablePayments`, repassado por FinanceRecordList.js só na aba
  // de Contas a Receber). Usa o registro já SALVO (`record.id`) — não dá
  // pra gerar cobrança de um cadastro novo ainda não existente no banco.
  const handleGeneratePix = async () => {
    setGeneratingPayment("pix");
    try {
      const updated = await finance.receivables.generatePix(record.id, selectedProvider);
      setPaymentResult(updated);
      toast.success("Cobrança Pix gerada.");
    } catch (err) {
      toastError(err);
    } finally {
      setGeneratingPayment(null);
    }
  };

  const handleGenerateBoleto = async () => {
    setGeneratingPayment("boleto");
    try {
      const updated = await finance.receivables.generateBoleto(record.id, selectedProvider);
      setPaymentResult(updated);
      toast.success("Boleto gerado.");
    } catch (err) {
      toastError(err);
    } finally {
      setGeneratingPayment(null);
    }
  };

  const copyPixCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success("Código Pix copiado.");
  };

  // `paymentResult` (gerado nesta sessão do modal) tem prioridade sobre o
  // que já veio salvo em `record` (cobrança gerada numa sessão anterior).
  const paymentInfo = paymentResult || record;
  const hasPixCharge = enablePayments && !!paymentInfo?.pixQrCode;
  const hasBoletoCharge = enablePayments && !!paymentInfo?.boletoUrl;

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
      scroll="paper"
    >
      <DialogTitle className={classes.dialogTitle}>
        {record?.id ? `Editar ${title}` : `Novo(a) ${title}`}
      </DialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ values, touched, errors, isSubmitting, setFieldValue, handleBlur }) => {
          // Só existe o que imprimir depois de salvo (editando um registro
          // já existente) — num cadastro novo ainda não tem nada no banco.
          // Delay igual ao de FinanceRecordList.js: dá tempo do React
          // desenhar a área escondida antes do `window.print()`.
          const handlePrintRecord = () => {
            setPrintSnapshot({ values, record });
            setTimeout(() => {
              window.print();
              setPrintSnapshot(null);
            }, 150);
          };

          return (
          <Form>
            <DialogContent dividers={false} className={classes.dialogContent}>
              <Grid container spacing={2}>
                {fields.map((field) => {
                  if (field.visibleWhen && !field.visibleWhen(values)) {
                    return null;
                  }

                  const gridSize = field.gridSize || 6;
                  // `disabledWhen` recebe (values, context) — diferente de
                  // `visibleWhen`/`requiredWhen` (só `values`), porque o
                  // motivo de desabilitar costuma ser um estado de FORA do
                  // formulário (ex.: a Reforma 2027 não ter sido ativada na
                  // Configuração Fiscal), não algo digitado neste form.
                  const isDisabled = field.disabledWhen ? field.disabledWhen(values, context) : false;

                  if (field.type === "sectionTitle") {
                    return (
                      <Grid item xs={12} key={field.key || field.label}>
                        <Divider style={{ margin: "8px 0 12px" }} />
                        <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                          {field.label}
                        </Typography>
                        {field.helperText && (
                          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                            {field.helperText}
                          </Typography>
                        )}
                      </Grid>
                    );
                  }

                  if (field.type === "photo") {
                    return (
                      <Grid item xs={12} key={field.name}>
                        <div className={classes.photoBox}>
                          <Avatar
                            src={photoPreview || undefined}
                            className={classes.photoAvatar}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {!photoPreview && <ImageIcon />}
                          </Avatar>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={handlePhotoChange}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PhotoCameraIcon />}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {photoPreview ? "Trocar foto" : "Anexar foto"}
                          </Button>
                        </div>
                      </Grid>
                    );
                  }

                  if (field.type === "switch") {
                    return (
                      <Grid item xs={12} sm={gridSize} key={field.name}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!values[field.name]}
                              onChange={(e) =>
                                setFieldValue(field.name, e.target.checked)
                              }
                              color="primary"
                              disabled={isDisabled}
                            />
                          }
                          label={field.label}
                        />
                      </Grid>
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <Grid item xs={12} sm={gridSize} key={field.name}>
                        <Field
                          as={TextField}
                          select
                          fullWidth
                          variant="outlined"
                          size="small"
                          name={field.name}
                          label={field.label}
                          disabled={isDisabled}
                        >
                          {field.options.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Field>
                      </Grid>
                    );
                  }

                  if (field.type === "asyncSelect") {
                    const resource = finance?.[field.optionsResource];
                    // Associação já vem embutida no registro quando edita
                    // (ex.: `record.supplier`, usado pela própria tabela do
                    // FinanceRecordList) — garante que o selecionado apareça
                    // mesmo que não esteja entre os primeiros resultados de
                    // uma busca em branco.
                    // `field.embeddedKey` (opcional) sobrepõe o
                    // singular-automático do `optionsResource` — usado
                    // quando o nome da associação no model não bate com
                    // isso (ex.: `mainSupplierId`/`optionsResource:
                    // "suppliers"` usa a associação `mainSupplier`, não
                    // `supplier`, pra deixar claro no model que não é
                    // qualquer fornecedor).
                    const singularKey = field.embeddedKey || field.optionsResource.replace(/s$/, "");
                    const embedded = record?.[singularKey];
                    const currentId = values[field.name];
                    const selected = embedded && embedded.id === currentId ? embedded : null;

                    return (
                      <Grid item xs={12} sm={gridSize} key={field.name}>
                        <FinanceAsyncAutocomplete
                          label={field.label}
                          value={selected}
                          initialOptions={embedded ? [embedded] : []}
                          getOptionLabel={(opt) => opt?.name || ""}
                          fetchOptions={async (searchParam) => {
                            if (!resource) return [];
                            const { records } = await resource.list({ searchParam });
                            return records || [];
                          }}
                          onChange={(e, newValue) =>
                            setFieldValue(field.name, newValue?.id || "")
                          }
                        />
                      </Grid>
                    );
                  }

                  // Campo tipo "serviceSelect" (v2.3.175 — ex.: Contas a
                  // Receber) — busca no cadastro de Serviço (prop `services`,
                  // o hook `useServices`), mas NÃO é ele mesmo uma coluna do
                  // registro: ao escolher um serviço, só preenche os campos
                  // mapeados em `field.fillFields` (ex.: `{ description:
                  // "name", value: "value" }`), igual ao autopreenchimento já
                  // usado no Despachante Bélico e no SKU/nome da Venda — o
                  // vínculo não fica salvo, é só um atalho de preenchimento.
                  // Por isso fica fora de `buildInitialValues`/do payload.
                  if (field.type === "serviceSelect") {
                    return (
                      <Grid item xs={12} sm={gridSize} key={field.name}>
                        <FinanceAsyncAutocomplete
                          label={field.label}
                          value={servicePickerValue}
                          initialOptions={servicePickerValue ? [servicePickerValue] : []}
                          getOptionLabel={(opt) => opt?.name || ""}
                          fetchOptions={async (searchParam) => {
                            if (!services) return [];
                            const { records } = await services.list({ searchParam });
                            return records || [];
                          }}
                          onChange={(e, newValue) => {
                            setServicePickerValue(newValue || null);
                            if (!newValue) return;
                            Object.entries(field.fillFields || {}).forEach(
                              ([targetField, sourceKey]) => {
                                setFieldValue(targetField, newValue[sourceKey] ?? "");
                              }
                            );
                          }}
                        />
                      </Grid>
                    );
                  }

                  if (field.type === "date") {
                    return (
                      <Grid item xs={12} sm={gridSize} key={field.name}>
                        <Field
                          as={TextField}
                          fullWidth
                          variant="outlined"
                          size="small"
                          type="date"
                          name={field.name}
                          label={field.label}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    );
                  }

                  return (
                    <Grid item xs={12} sm={gridSize} key={field.name}>
                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        size="small"
                        name={field.name}
                        label={field.label}
                        multiline={field.type === "textarea"}
                        minRows={field.type === "textarea" ? 3 : undefined}
                        type={field.type === "number" ? "number" : "text"}
                        inputProps={field.type === "number" && field.step ? { step: field.step } : undefined}
                        disabled={isDisabled}
                        {...(field.name === "zipCode"
                          ? {
                              onBlur: (e) => {
                                handleBlur(e);
                                handleCepBlur(e, setFieldValue);
                              },
                            }
                          : {})}
                        error={touched[field.name] && Boolean(errors[field.name])}
                        helperText={
                          (touched[field.name] && errors[field.name]) ||
                          (isDisabled ? field.disabledHelperText : undefined)
                        }
                      />
                    </Grid>
                  );
                })}
              </Grid>

              {enablePayments && record?.id && (
                <>
                  <Divider style={{ margin: "16px 0 12px" }} />
                  <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Cobrança
                  </Typography>
                  <Grid container spacing={1} alignItems="center">
                    {bothGatewaysEnabled && (
                      <Grid item>
                        <TextField
                          select
                          variant="outlined"
                          size="small"
                          label="Gateway"
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          style={{ minWidth: 150 }}
                        >
                          <MenuItem value="mercadopago">Mercado Pago</MenuItem>
                          <MenuItem value="asaas">Asaas</MenuItem>
                        </TextField>
                      </Grid>
                    )}
                    <Grid item>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={handleGeneratePix}
                        disabled={!!generatingPayment}
                      >
                        {generatingPayment === "pix" ? "Gerando..." : "Gerar Pix"}
                      </Button>
                    </Grid>
                    <Grid item>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={handleGenerateBoleto}
                        disabled={!!generatingPayment}
                      >
                        {generatingPayment === "boleto" ? "Gerando..." : "Gerar boleto"}
                      </Button>
                    </Grid>
                  </Grid>

                  {hasPixCharge && (
                    <Grid container spacing={1} style={{ marginTop: 8 }} alignItems="center">
                      {paymentInfo.pixQrCodeBase64 && (
                        <Grid item>
                          <img
                            src={`data:image/png;base64,${paymentInfo.pixQrCodeBase64}`}
                            alt="QR Code Pix"
                            width={140}
                            height={140}
                          />
                        </Grid>
                      )}
                      <Grid item xs>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          variant="outlined"
                          size="small"
                          label="Código Pix copia e cola"
                          value={paymentInfo.pixQrCode}
                          InputProps={{ readOnly: true }}
                        />
                        <Button
                          size="small"
                          color="primary"
                          style={{ marginTop: 4 }}
                          onClick={() => copyPixCode(paymentInfo.pixQrCode)}
                        >
                          Copiar código
                        </Button>
                      </Grid>
                    </Grid>
                  )}

                  {hasBoletoCharge && (
                    <Grid container style={{ marginTop: 8 }}>
                      <Grid item>
                        <Button
                          size="small"
                          color="primary"
                          variant="outlined"
                          href={paymentInfo.boletoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir boleto (PDF)
                        </Button>
                      </Grid>
                    </Grid>
                  )}

                  {(hasPixCharge || hasBoletoCharge) && paymentInfo.paymentStatus && (
                    <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 6 }}>
                      Status no gateway: {paymentInfo.paymentStatus}
                    </Typography>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions className={classes.dialogActions}>
              {record?.id && canExport && (
                <Button
                  onClick={handlePrintRecord}
                  color="primary"
                  startIcon={<PrintIcon />}
                  style={{ marginRight: "auto" }}
                >
                  Imprimir / PDF
                </Button>
              )}
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>
                Cancelar
              </Button>
              <div className={classes.btnWrapper}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={isSubmitting}
                >
                  {record?.id ? "Salvar" : "Adicionar"}
                </Button>
                {isSubmitting && (
                  <CircularProgress size={22} className={classes.buttonProgress} />
                )}
              </div>
            </DialogActions>
          </Form>
          );
        }}
      </Formik>
    </Dialog>
    {printSnapshot && (
      <div id="finance-record-modal-print-area" className={classes.printArea}>
        <h2>{title}</h2>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            {fields
              .filter((field) => field.type !== "sectionTitle" && field.type !== "serviceSelect")
              .filter((field) => !field.visibleWhen || field.visibleWhen(printSnapshot.values))
              .map((field) => (
                <tr key={field.name}>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", width: "40%" }}>
                    {field.label}
                  </th>
                  <td style={{ borderBottom: "1px solid #ddd" }}>
                    {formatFieldValueForPrint(field, printSnapshot.values, printSnapshot.record)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    )}
    </>
  );
};

export default FinanceRecordModal;
