import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import CircularProgress from "@material-ui/core/CircularProgress";
import Box from "@material-ui/core/Box";
import SaveIcon from "@material-ui/icons/Save";

import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
    borderRadius: 12,
    maxWidth: 900,
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
  },
  sectionSubtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  divider: {
    margin: theme.spacing(3, 0),
  },
  loadingBox: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
}));

// Configuração do gateway de COBRANÇA (Pix/boleto) — Fase 1, só Mercado
// Pago. Separado da Configuração Fiscal de propósito: credencial de quem
// RECEBE o pagamento, diferente da credencial do gateway de EMISSÃO de nota
// fiscal (Focus NFe). Um registro só por empresa, mesmo padrão de
// get/upsert do FiscalConfigPanel. Ver docs/MANUAL_TECNICO.md.
const FinancePaymentConfigPanel = ({ finance }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await finance.paymentConfig.show();
        setConfig(data);
      } catch (err) {
        toastError(err);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values, { setSubmitting }) => {
    setSaving(true);
    try {
      const updated = await finance.paymentConfig.update(values);
      setConfig(updated);
      toast.success("Configuração de pagamento salva com sucesso.");
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
    setSubmitting(false);
  };

  if (loading || !config) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper className={classes.root} variant="outlined">
      <Typography variant="h6" className={classes.sectionTitle}>
        Configuração de Pagamento
      </Typography>
      <Typography variant="body2" className={classes.sectionSubtitle}>
        Credenciais do Mercado Pago pra gerar cobrança Pix/boleto em Contas a
        Receber. Diferente da Configuração Fiscal (essa é do gateway de
        emissão de nota, Focus NFe) — são contratos separados.
      </Typography>

      <Formik initialValues={config} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => (
          <Form>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" style={{ padding: 16, height: "100%" }}>
                  <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Homologação (testes)
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="mercadoPagoAccessTokenSandbox"
                    label="Access Token de teste"
                    helperText='Painel do Mercado Pago → "Suas integrações" → credenciais de teste (começa com "TEST-")'
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" style={{ padding: 16, height: "100%" }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                      Produção
                    </Typography>
                    <FormControlLabel
                      labelPlacement="start"
                      control={
                        <Switch
                          checked={!!values.productionEnabled}
                          onChange={(e) => setFieldValue("productionEnabled", e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Habilitada"
                    />
                  </Box>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="mercadoPagoAccessTokenProduction"
                    label="Access Token de produção"
                    disabled={!values.productionEnabled}
                    helperText="Credenciais de produção (sem prefixo TEST-). Se habilitado, a cobrança sai por aqui (tem prioridade sobre Homologação)"
                  />
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                  Webhook (confirmação automática de pagamento)
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                  Cadastre esta URL no painel do Mercado Pago ("Suas
                  integrações" → sua aplicação → Webhooks), e cole aqui a
                  "Assinatura secreta" mostrada lá, pra validar que a
                  notificação é de verdade antes de marcar como pago.
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="URL do webhook"
                  value={`${process.env.REACT_APP_BACKEND_URL || ""}/webhook/mercadopago/${
                    config.companyId
                  }`}
                  InputProps={{ readOnly: true }}
                  style={{ marginBottom: 12 }}
                  onFocus={(e) => e.target.select()}
                />
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="mercadoPagoWebhookSecret"
                  label="Assinatura secreta do webhook"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  name="pixExpirationMinutes"
                  label="Expiração do Pix (minutos)"
                />
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                disabled={isSubmitting || saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </Box>
          </Form>
        )}
      </Formik>
    </Paper>
  );
};

export default FinancePaymentConfigPanel;
