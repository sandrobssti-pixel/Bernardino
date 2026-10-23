import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
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
  // Selo com o nome de cada gateway na cor característica da marca — não é
  // o logo oficial em si (sem acesso ao arquivo de imagem, ver comentário
  // acima de `BrandBadge`), só uma referência visual rápida.
  brandBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(0.75, 2.5),
    borderRadius: 8,
    width: "fit-content",
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: "0.03em",
  },
  brandBadgeMercadoPago: {
    background: "#fff",
    border: "2px solid #009ee3",
    color: "#2d3277",
  },
  brandBadgeAsaas: {
    background: "#0b2eff",
    color: "#fff",
  },
}));

// Pra não repetir `InputProps`/`inputProps`/`InputLabelProps` em cada
// <Field>/<TextField> de credencial — centraliza o VALOR digitado e
// também o RÓTULO (só aparece centralizado enquanto o campo está vazio e
// sem foco; ao digitar/focar, o Material-UI sempre encolhe e desloca o
// rótulo pro canto superior esquerdo, isso não dá pra mudar sem quebrar o
// próprio efeito de "rótulo flutuante" — comportamento esperado, não bug).
// `width: "100%", left: 0` no InputLabelProps é o truque padrão do MUI v4
// pra permitir texto centralizado num <label> que por padrão só alinha à
// esquerda.
const centeredFieldProps = {
  inputProps: { style: { textAlign: "center" } },
  InputLabelProps: { style: { width: "100%", textAlign: "center", left: 0 } },
};

// Configuração do gateway de COBRANÇA (Pix/boleto) — Mercado Pago (Fase 1)
// e Asaas (Fase 2), cada um com o próprio painel 100% independente
// (liga/desliga, Produção, credenciais — v2.3.158, "separa eles como um
// todo"): os dois podem estar ativos ao mesmo tempo. Separado da
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
        Gera cobrança Pix/boleto em Contas a Receber. Diferente da
        Configuração Fiscal (essa é do gateway de emissão de nota, Focus
        NFe) — são contratos separados.
      </Typography>

      <Formik initialValues={config} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => (
          <Form>
            <Grid container spacing={2}>
              {/* Os dois gateways lado a lado (pedido do cliente) — cada
                  painel 100% independente/exclusivo do outro (v2.3.158:
                  "separa eles como um todo"): liga/desliga próprio, Produção
                  próprio, até a Expiração do Pix (só faz sentido pro
                  Mercado Pago) mora dentro do painel dele. Sem campo
                  compartilhado entre os dois — só o título/intro da página
                  acima é comum. */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" className={classes.gatewayColumn}>
                  <Box className={`${classes.brandBadge} ${classes.brandBadgeMercadoPago}`}>
                    <span>mercado</span>
                    <span style={{ color: "#009ee3", marginLeft: 4 }}>pago</span>
                  </Box>
                  <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 8 }} mb={1}>
                    <Switch
                      checked={!!values.mercadoPagoEnabled}
                      onChange={(e) => setFieldValue("mercadoPagoEnabled", e.target.checked)}
                      color="primary"
                    />
                    <Typography variant="body2" style={{ fontWeight: 700 }}>
                      {values.mercadoPagoEnabled ? "Ativo" : "Inativo"}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" style={{ textAlign: "center", marginBottom: 16 }}>
                    Liga/desliga só este gateway — não afeta o Asaas. Com os
                    dois ativos ao mesmo tempo, quem gera a cobrança em
                    Contas a Receber escolhe qual usar na hora.
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
                        checked={!!values.mercadoPagoProductionEnabled}
                        onChange={(e) =>
                          setFieldValue("mercadoPagoProductionEnabled", e.target.checked)
                        }
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
                      disabled={!values.mercadoPagoProductionEnabled}
                      helperText="Sem prefixo TEST-. Só vale pro Mercado Pago."
                      {...centeredFieldProps}
                    />
                  </Paper>

                  <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      type="number"
                      name="pixExpirationMinutes"
                      label="Expiração do Pix (minutos)"
                      helperText="Só vale pro Mercado Pago — o Asaas controla a expiração do próprio QR Code."
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
                    InputLabelProps={{ style: { width: "100%", textAlign: "center", left: 0 } }}
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
                  <Box className={`${classes.brandBadge} ${classes.brandBadgeAsaas}`}>
                    ASAAS
                  </Box>
                  <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 8 }} mb={1}>
                    <Switch
                      checked={!!values.asaasEnabled}
                      onChange={(e) => setFieldValue("asaasEnabled", e.target.checked)}
                      color="primary"
                    />
                    <Typography variant="body2" style={{ fontWeight: 700 }}>
                      {values.asaasEnabled ? "Ativo" : "Inativo"}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" style={{ textAlign: "center", marginBottom: 16 }}>
                    Liga/desliga só este gateway — não afeta o Mercado Pago.
                    Com os dois ativos ao mesmo tempo, quem gera a cobrança em
                    Contas a Receber escolhe qual usar na hora.
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
                    <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 12 }} mb={1}>
                      <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                        Produção
                      </Typography>
                      <Switch
                        checked={!!values.asaasProductionEnabled}
                        onChange={(e) =>
                          setFieldValue("asaasProductionEnabled", e.target.checked)
                        }
                        color="primary"
                      />
                    </Box>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="asaasApiKeyProduction"
                      label="API Key de produção"
                      disabled={!values.asaasProductionEnabled}
                      helperText="Só vale pro Asaas."
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
                    InputLabelProps={{ style: { width: "100%", textAlign: "center", left: 0 } }}
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
