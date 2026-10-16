import React, { useState, useEffect } from "react";
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

import toastError from "../../errors/toastError";
import FinanceAsyncAutocomplete from "../FinanceAsyncAutocomplete";

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
}));

const buildInitialValues = (fields, record) => {
  const values = {};
  fields.forEach((field) => {
    if (field.type === "switch") {
      values[field.name] = record?.[field.name] ?? field.defaultValue ?? false;
    } else {
      values[field.name] = record?.[field.name] ?? field.defaultValue ?? "";
    }
  });
  return values;
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
const FinanceRecordModal = ({ open, onClose, onSave, title, fields, record, finance }) => {
  const classes = useStyles();
  const [initialValues, setInitialValues] = useState(buildInitialValues(fields, null));

  useEffect(() => {
    setInitialValues(buildInitialValues(fields, record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, open]);

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
      await onSave(stripHiddenFieldValues(values));
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  return (
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
        {({ values, touched, errors, isSubmitting, setFieldValue }) => (
          <Form>
            <DialogContent dividers={false} className={classes.dialogContent}>
              <Grid container spacing={2}>
                {fields.map((field) => {
                  if (field.visibleWhen && !field.visibleWhen(values)) {
                    return null;
                  }

                  const gridSize = field.gridSize || 6;

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
                    const singularKey = field.optionsResource.replace(/s$/, "");
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
                        error={touched[field.name] && Boolean(errors[field.name])}
                        helperText={touched[field.name] && errors[field.name]}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </DialogContent>
            <DialogActions className={classes.dialogActions}>
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
        )}
      </Formik>
    </Dialog>
  );
};

export default FinanceRecordModal;
