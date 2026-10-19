import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
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

// Configuração do gateway de COBRANÇA (Pix/boleto) — Mercado Pago (Fase 1)
// e Asaas (Fase 2), decidido pelo campo `provider`. Separado da
// Configuração Fiscal de propósito: credencial de quem RECEBE o pagamento,
// diferente da credencial do gateway de EMISSÃO de nota fiscal (Focus
// NFe). Um registro só por empresa, mesmo padrão de get/upsert do
// FiscalConfigPanel. Ver docs/MANUAL_TECNICO.md.
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
        Credenciais do Mercado Pago e do Asaas pra gerar cobrança Pix/boleto
        em Contas a Receber. Diferente da Configuração Fiscal (essa é do
        gateway de emissão de nota, Focus NFe) — são contratos separados.
      </Typography>

      <Formik initialValues={config} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => (
          <Form>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  select
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="provider"
                  label="Gateway ativo (gera a próxima cobrança)"
                  helperText="Trocar aqui não muda cobranças já geradas — cada uma guarda o gateway usado na hora."
                >
                  <MenuItem value="mercadopago">Mercado Pago</MenuItem>
                  <MenuItem value="asaas">Asaas</MenuItem>
                </Field>
              </Grid>

              <Grid item xs={12}>
                <Divider className={classes.divider} />
                <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 4 }}>
                  Mercado Pago
                </Typography>
              </Grid>

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
                    helperText="Credenciais de produção (sem prefixo TEST-). Vale pros dois gateways — o mesmo liga/desliga de Produção serve tanto pro Mercado Pago quanto pro Asaas."
                  />
                </Paper>
              </Grid>

              <Grid item xs={12}>
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
                  label="URL do webhook (Mercado Pago)"
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
                  label="Expiração do Pix (minutos, só Mercado Pago)"
                  helperText="O Asaas controla a expiração do próprio QR Code — esse campo não se aplica a ele."
                />
              </Grid>

              <Grid item xs={12}>
                <Divider className={classes.divider} />
                <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 4 }}>
                  Asaas
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" style={{ padding: 16, height: "100%" }}>
                  <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Homologação (sandbox)
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="asaasApiKeySandbox"
                    label="API Key de sandbox"
                    helperText='Painel do Asaas (sandbox.asaas.com) → "Integrações" → chave de API'
                  />
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" style={{ padding: 16, height: "100%" }}>
                  <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Produção
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="asaasApiKeyProduction"
                    label="API Key de produção"
                    disabled={!values.productionEnabled}
                    helperText="Usa o mesmo liga/desliga de Produção configurado acima pro Mercado Pago"
                  />
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                  Cadastre esta URL no painel do Asaas ("Integrações" →
                  Webhooks), e cole aqui o mesmo "Token de autenticação" que
                  você configurar lá (o Asaas reenvia esse token em todo
                  aviso, pra confirmar que é de verdade).
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="URL do webhook (Asaas)"
                  value={`${process.env.REACT_APP_BACKEND_URL || ""}/webhook/asaas/${
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
                  name="asaasWebhookToken"
                  label="Token de autenticação do webhook"
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
