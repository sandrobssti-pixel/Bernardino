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

const TAX_REGIME_OPTIONS = [
  { value: "mei", label: "MEI — Microempreendedor Individual" },
  { value: "simples", label: "Simples Nacional (ME/EPP)" },
  { value: "presumido", label: "Lucro Presumido" },
  { value: "real", label: "Lucro Real" },
];

const ENVIRONMENT_OPTIONS = [
  { value: "sandbox", label: "Homologação (testes)" },
  { value: "production", label: "Produção" },
];

// Configuração fiscal da empresa (Fase 3 — módulo fiscal, ver
// docs/MANUAL_TECNICO.md, seção 6.2). Um registro só por empresa — dados
// necessários pra emitir NF-e/NFC-e/NFS-e em nome dela via o gateway Focus
// NFe. O token de gateway aqui é da PRÓPRIA empresa-cliente junto à Focus
// NFe (não é o mesmo tipo de credencial de pagamento da assinatura do
// AtendeFlow, que fica só com o Master).
const FiscalConfigPanel = ({ fiscal }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fiscal.config.show();
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
      const updated = await fiscal.config.update(values);
      setConfig(updated);
      toast.success("Configuração fiscal salva com sucesso.");
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
        Configuração Fiscal
      </Typography>
      <Typography variant="body2" className={classes.sectionSubtitle}>
        Dados usados pra emitir notas fiscais (NF-e/NFC-e/NFS-e) em nome da sua
        empresa, através do gateway Focus NFe. Comece pelo ambiente de
        Homologação (testes) — só mude pra Produção quando as primeiras notas
        de teste saírem certas.
      </Typography>

      <Formik initialValues={config} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue }) => (
          <Form>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  select
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="taxRegime"
                  label="Regime tributário"
                >
                  {TAX_REGIME_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="cnae"
                  label="CNAE principal"
                  placeholder="Ex.: 6201-5/01"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="stateRegistration"
                  label="Inscrição estadual"
                  disabled={values.stateRegistrationExempt}
                />
              </Grid>
              <Grid item xs={12} sm={4} style={{ display: "flex", alignItems: "center" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!values.stateRegistrationExempt}
                      onChange={(e) => setFieldValue("stateRegistrationExempt", e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Isento de IE"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="municipalRegistration"
                  label="Inscrição municipal"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="cityCode"
                  label="Código IBGE do município"
                  placeholder="Ex.: 3550308 (São Paulo)"
                  helperText="Necessário para NFC-e e NFS-e"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="defaultCfop"
                  label="CFOP padrão"
                  helperText="Usado como sugestão ao adicionar itens numa venda"
                />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Gateway de emissão (Focus NFe)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  select
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="gatewayEnvironment"
                  label="Ambiente"
                >
                  {ENVIRONMENT_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="gatewayToken"
                  label="Token de acesso"
                  helperText="Gerado no painel da Focus NFe (homologação ou produção, conforme o ambiente acima)"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="nfeSeries"
                  label="Série NF-e"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="nfceSeries"
                  label="Série NFC-e"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="nfseSeries"
                  label="Série NFS-e"
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline
                  minRows={2}
                  name="notes"
                  label="Observações"
                />
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
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

export default FiscalConfigPanel;
