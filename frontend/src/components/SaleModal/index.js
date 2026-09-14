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
import MenuItem from "@material-ui/core/MenuItem";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Box from "@material-ui/core/Box";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import toastError from "../../errors/toastError";
import { money } from "../../utils/financeFormat";

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
  ncm: "",
  cfop: "5102",
  unit: "UN",
  quantity: 1,
  unitPrice: 0,
};

const buildInitialValues = (sale, defaultCfop) => ({
  customerId: sale?.customerId || "",
  saleDate: sale?.saleDate || new Date().toISOString().slice(0, 10),
  notes: sale?.notes || "",
  items:
    sale?.items?.length > 0
      ? sale.items.map((item) => ({
          productId: item.productId || "",
          description: item.description,
          ncm: item.ncm || "",
          cfop: item.cfop || defaultCfop || "5102",
          unit: item.unit || "UN",
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
      : [{ ...emptyItem, cfop: defaultCfop || "5102" }],
});

// Modal de criação/edição de venda (Fase 3 — módulo fiscal, ver
// docs/MANUAL_TECNICO.md, seção 6.2). Só permite editar vendas em rascunho —
// depois de confirmada, os itens ficam travados (viram base pra nota fiscal
// e conta a receber, não podem mudar retroativamente).
const SaleModal = ({ open, onClose, onSave, sale, customers, products, defaultCfop }) => {
  const classes = useStyles();
  const [initialValues, setInitialValues] = useState(buildInitialValues(null, defaultCfop));

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

  const handleProductChange = (index, productId, setFieldValue) => {
    const product = products.find((p) => p.id === productId);
    setFieldValue(`items.${index}.productId`, productId);
    if (product) {
      setFieldValue(`items.${index}.description`, product.name);
      setFieldValue(`items.${index}.ncm`, product.ncm || "");
      setFieldValue(`items.${index}.unit`, product.unit || "UN");
      setFieldValue(`items.${index}.unitPrice`, Number(product.price) || 0);
    }
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

          return (
            <Form>
              <DialogContent dividers={false}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <Field
                      as={TextField}
                      select
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="customerId"
                      label="Cliente"
                    >
                      <MenuItem value="">
                        <em>Nenhum (consumidor não identificado)</em>
                      </MenuItem>
                      {customers.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Field>
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
                      {values.items.map((item, index) => (
                        <Grid container spacing={1} key={index} className={classes.itemRow}>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              select
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Produto/serviço"
                              value={item.productId}
                              onChange={(e) =>
                                handleProductChange(index, e.target.value, setFieldValue)
                              }
                            >
                              <MenuItem value="">
                                <em>Item avulso</em>
                              </MenuItem>
                              {products.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid item xs={12} sm={3}>
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
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="CFOP"
                              name={`items.${index}.cfop`}
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
                        </Grid>
                      ))}
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
