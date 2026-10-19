import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
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
    maxWidth: 1200,
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
  gatewayColumn: {
    padding: theme.spacing(2),
    borderRadius: 12,
    height: "100%",
  },
  gatewayTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1.5),
    textAlign: "center",
  },
  // Pedido do cliente: texto dentro dos campos de credencial centralizado
  // (não alinhado à esquerda, padrão do MUI) — os rótulos (label) continuam
  // alinhados à esquerda normalmente, só o VALOR digitado centraliza.
  centeredInput: {
    textAlign: "center",
  },
}));

// Pra não repetir `InputProps`/`inputProps` em cada <Field>/<TextField> de
// credencial — centraliza o texto digitado, pedido do cliente ("para não
// ficar descentralizadas").
const centeredFieldProps = {
  inputProps: { style: { textAlign: "center" } },
};

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
                  SelectProps={{ MenuProps: { getContentAnchorEl: null } }}
                  inputProps={{ style: { textAlign: "center" } }}
                >
                  <MenuItem value="mercadopago">Mercado Pago</MenuItem>
                  <MenuItem value="asaas">Asaas</MenuItem>
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  name="pixExpirationMinutes"
                  label="Expiração do Pix (minutos, só Mercado Pago)"
                  helperText="O Asaas controla a expiração do próprio QR Code."
                  {...centeredFieldProps}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider className={classes.divider} />
              </Grid>

              {/* Os dois gateways lado a lado (pedido do cliente) — cada
                  coluna com os próprios cartões Homologação/Produção
                  empilhados, em vez de Mercado Pago e Asaas um embaixo do
                  outro ocupando a largura toda. */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" className={classes.gatewayColumn}>
                  <Typography variant="h6" className={classes.gatewayTitle}>
                    Mercado Pago
                  </Typography>

                  <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
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
                      {...centeredFieldProps}
                    />
                  </Paper>

                  <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 12 }} mb={1}>
                      <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                        Produção
                      </Typography>
                      <Switch
                        checked={!!values.productionEnabled}
                        onChange={(e) => setFieldValue("productionEnabled", e.target.checked)}
                        color="primary"
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
                      helperText="Sem prefixo TEST-. O mesmo liga/desliga vale pros dois gateways."
                      {...centeredFieldProps}
                    />
                  </Paper>

                  <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8, textAlign: "center" }}>
                    Cole esta URL no painel do Mercado Pago ("Suas
                    integrações" → Webhooks) e a "Assinatura secreta" de lá
                    no campo abaixo.
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
                    inputProps={{ style: { textAlign: "center" } }}
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
                    {...centeredFieldProps}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper variant="outlined" className={classes.gatewayColumn}>
                  <Typography variant="h6" className={classes.gatewayTitle}>
                    Asaas
                  </Typography>

                  <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
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
                      {...centeredFieldProps}
                    />
                  </Paper>

                  <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
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
                      helperText="Usa o mesmo liga/desliga de Produção do Mercado Pago, ao lado."
                      {...centeredFieldProps}
                    />
                  </Paper>

                  <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8, textAlign: "center" }}>
                    Cole esta URL no painel do Asaas ("Integrações" →
                    Webhooks) e o "Token de autenticação" de lá no campo
                    abaixo.
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
                    inputProps={{ style: { textAlign: "center" } }}
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
                    {...centeredFieldProps}
                  />
                </Paper>
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
