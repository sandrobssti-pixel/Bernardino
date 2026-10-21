import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import Autocomplete from "@material-ui/lab/Autocomplete";

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
import SendIcon from "@material-ui/icons/Send";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Link from "@material-ui/core/Link";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

import toastError from "../../errors/toastError";
import CfopAutocomplete from "../CfopAutocomplete";
import { UF_LIST, MUNICIPIOS_BY_UF, UF_BY_CODE_PREFIX } from "../../data/municipiosBrasil";
import { fetchAddressByCep } from "../../utils/cep";

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

// Só NF-e/NFC-e por pedido do cliente ("só vou trabalhar com esses dois
// tipos de notas fiscais") — NFS-e continua funcionando por baixo
// (FocusNFeService, emissão manual em SaleDetailModal), só não aparece
// mais aqui como opção de emissão automática.
const DEFAULT_DOCUMENT_TYPE_OPTIONS = [
  { value: "", label: "Nenhum — emitir manualmente" },
  { value: "nfe", label: "NF-e" },
  { value: "nfce", label: "NFC-e" },
];

// Estado (UF) -> Município -> preenche sozinho o "Código IBGE do
// município" (pedido do cliente — antes era campo de texto livre, tinha
// que saber/procurar o código de cabeça). O valor salvo continua sendo só
// o código IBGE (`cityCode`); a UF escolhida é só um filtro local, não um
// campo do model — por isso, ao reabrir um registro já salvo, a UF inicial
// é inferida dos 2 primeiros dígitos do próprio código (`UF_BY_CODE_PREFIX`).
const ufFromCityCode = (code) => UF_BY_CODE_PREFIX[String(code || "").slice(0, 2)] || "";

const CityCodeSelector = ({ value, onChange }) => {
  const [uf, setUf] = useState(() => ufFromCityCode(value));

  useEffect(() => {
    setUf((prev) => prev || ufFromCityCode(value));
  }, [value]);

  const municipios = MUNICIPIOS_BY_UF[uf] || [];
  const selectedMunicipio = municipios.find((m) => m.code === value) || null;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={4}>
        <TextField
          select
          fullWidth
          variant="outlined"
          size="small"
          label="Estado (UF)"
          value={uf}
          onChange={(e) => {
            setUf(e.target.value);
            onChange("");
          }}
        >
          <MenuItem value="">Selecione...</MenuItem>
          {UF_LIST.map((sigla) => (
            <MenuItem key={sigla} value={sigla}>
              {sigla}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={8}>
        <Autocomplete
          size="small"
          disabled={!uf}
          options={municipios}
          value={selectedMunicipio}
          onChange={(e, newValue) => onChange(newValue ? newValue.code : "")}
          getOptionLabel={(opt) => opt?.name || ""}
          noOptionsText="Nenhum município encontrado"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Município"
              placeholder={uf ? "Digite pra buscar" : "Escolha o estado primeiro"}
              variant="outlined"
              size="small"
              helperText={value ? `Código IBGE: ${value}` : "Necessário para NFC-e e NFS-e"}
            />
          )}
        />
      </Grid>
    </Grid>
  );
};

// Inutilização de numeração de NF-e — recurso separado da config principal
// (não é um campo salvo em FiscalConfig, é uma ação pontual contra o
// gateway). Formulário próprio, sem Formik, porque não tem "valor salvo"
// pra reinicializar — cada envio é uma inutilização nova.
const NumberingInvalidationPanel = ({ fiscal }) => {
  const classes = useStyles();
  const [series, setSeries] = useState("1");
  const [numberStart, setNumberStart] = useState("");
  const [numberEnd, setNumberEnd] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchList = async () => {
    setLoadingList(true);
    try {
      const data = await fiscal.numbering.list();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (justification.trim().length < 15) {
      toast.error("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await fiscal.numbering.invalidate({
        series,
        numberStart: Number(numberStart),
        numberEnd: Number(numberEnd),
        justification,
      });
      // Bug real (v2.3.119): o retorno do gateway nunca era conferido aqui —
      // a tela mostrava "sucesso" mesmo quando a inutilização falhava de
      // verdade (ex.: erro de validação), e por isso nunca aparecia na lista.
      if (!result?.ok) {
        toast.error(result?.errorMessage || "Falha ao inutilizar numeração no gateway fiscal.");
        setSubmitting(false);
        return;
      }
      toast.success("Numeração inutilizada junto à Sefaz.");
      setNumberStart("");
      setNumberEnd("");
      setJustification("");
      fetchList();
    } catch (err) {
      toastError(err);
    }
    setSubmitting(false);
  };

  return (
    <Paper className={classes.root} variant="outlined" style={{ marginTop: 24 }}>
      <Typography variant="h6" className={classes.sectionTitle}>
        Inutilizar numeração de NF-e
      </Typography>
      <Typography variant="body2" className={classes.sectionSubtitle}>
        Use quando um número de nota "quebrou" (erro de sistema, número pulado sem nota
        correspondente) — formaliza junto à Sefaz que essa faixa nunca vai ser usada. Só
        existe para NF-e.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={2}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Série"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            type="number"
            label="Nº inicial"
            value={numberStart}
            onChange={(e) => setNumberStart(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            type="number"
            label="Nº final"
            value={numberEnd}
            onChange={(e) => setNumberEnd(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Justificativa (mín. 15 caracteres)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </Grid>
      </Grid>

      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          onClick={handleSubmit}
        >
          {submitting ? "Enviando..." : "Inutilizar"}
        </Button>
      </Box>

      <Divider className={classes.divider} />

      <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
        Inutilizações já registradas
      </Typography>
      {loadingList ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : list.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          Nenhuma inutilização registrada ainda.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Série</TableCell>
              <TableCell>Faixa</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Protocolo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((row, idx) => (
              <TableRow key={row.id || idx}>
                <TableCell>{row.series || "—"}</TableCell>
                <TableCell>
                  {row.numberStart || "—"} – {row.numberEnd || "—"}
                </TableCell>
                <TableCell>{row.status || "—"}</TableCell>
                <TableCell>{row.protocol || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
};

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
  const [gatewayOptions, setGatewayOptions] = useState([]);
  // Envio de teste da Resend (v2.3.174) — formulário próprio, fora do
  // Formik principal (não é campo salvo na configuração).
  const [showResendKey, setShowResendKey] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testSubject, setTestSubject] = useState("Teste de integração Resend — AtendeFlow");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [data, gateways] = await Promise.all([fiscal.config.show(), fiscal.config.gateways()]);
        setConfig(data);
        setGatewayOptions(gateways || []);
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
      const { accountingOfficeSync, ...updated } = await fiscal.config.update(values);
      setConfig(updated);
      toast.success("Configuração fiscal salva com sucesso.");
      if (accountingOfficeSync && !accountingOfficeSync.ok) {
        toast.warn(`Salvou aqui, mas não sincronizou com a Focus NFe: ${accountingOfficeSync.errorMessage}`);
      } else if (accountingOfficeSync && accountingOfficeSync.ok) {
        toast.success("Escritório de contabilidade sincronizado com a Focus NFe.");
      }
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
    setSubmitting(false);
  };

  // Autopreenchimento do endereço do emitente por CEP (ViaCEP) — mesma
  // lógica do FinanceRecordModal.js, aplicada aqui porque esta tela não
  // usa o modal genérico.
  const handleEmitterCepBlur = async (e, setFieldValue) => {
    const address = await fetchAddressByCep(e.target.value);
    if (!address) return;
    if (address.street) setFieldValue("emitterStreet", address.street);
    if (address.neighborhood) setFieldValue("emitterNeighborhood", address.neighborhood);
    if (address.city) setFieldValue("emitterCity", address.city);
    if (address.state) setFieldValue("emitterState", address.state);
  };

  // "Enviar para um destinatário" (v2.3.174) — usa a chave JÁ SALVA no
  // banco (nunca a digitada no campo ainda não salvo), então pede pra
  // salvar a configuração antes de testar.
  const handleSendTestEmail = async () => {
    if (!testRecipient.trim()) {
      toast.error("Informe o destinatário do teste.");
      return;
    }
    setSendingTest(true);
    try {
      const result = await fiscal.config.testResendEmail({
        to: testRecipient,
        subject: testSubject,
        message: testMessage,
      });
      if (result.ok) {
        toast.success("E-mail de teste enviado — confira a caixa de entrada do destinatário.");
      } else {
        toast.error(result.errorMessage || "Falha ao enviar o e-mail de teste.");
      }
    } catch (err) {
      toastError(err);
    }
    setSendingTest(false);
  };

  if (loading || !config) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
    <Paper className={classes.root} variant="outlined">
      <Typography variant="h6" className={classes.sectionTitle}>
        Configuração Fiscal
      </Typography>
      <Typography variant="body2" className={classes.sectionSubtitle}>
        Dados usados pra emitir notas fiscais (NF-e/NFC-e/NFS-e) em nome da sua
        empresa, através do gateway escolhido abaixo. Comece pelo ambiente de
        Homologação (testes) — só mude pra Produção quando as primeiras notas
        de teste saírem certas.
      </Typography>

      <Formik initialValues={config} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, handleBlur }) => (
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

              <Grid item xs={12}>
                <CityCodeSelector value={values.cityCode} onChange={(code) => setFieldValue("cityCode", code)} />
              </Grid>
              <Grid item xs={12}>
                <CfopAutocomplete
                  label="CFOP padrão"
                  helperText="Usado como sugestão ao adicionar itens numa venda"
                  value={values.defaultCfop}
                  onChange={(code) => setFieldValue("defaultCfop", code)}
                />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Endereço do emitente
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Obrigatório pra emitir NF-e/NFC-e — sem isso a Sefaz rejeita a nota por
              validação de schema. É o endereço da sua empresa, não o do cliente.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterStreet"
                  label="Logradouro"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterNumber"
                  label="Número"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterComplement"
                  label="Complemento"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterNeighborhood"
                  label="Bairro"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterZipCode"
                  label="CEP"
                  onBlur={(e) => {
                    handleBlur(e);
                    handleEmitterCepBlur(e, setFieldValue);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterCity"
                  label="Município"
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterState"
                  label="UF"
                  inputProps={{ maxLength: 2, style: { textTransform: "uppercase" } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="emitterPhone"
                  label="Telefone"
                />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Gateway de emissão
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  select
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="gatewayProvider"
                  label="Gateway"
                  helperText="Quem efetivamente emite e transmite a nota pra Sefaz/Prefeitura"
                >
                  {gatewayOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  select
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="defaultDocumentType"
                  label="Tipo de documento padrão"
                  helperText="Se definido, emite automaticamente logo após confirmar a venda"
                >
                  {DEFAULT_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value || "none"} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>

              {/* Linha própria (sozinha, sm=12 acima) de propósito — assim
                  Homologação/Produção sempre começam numa linha nova e
                  limpa (6+6=12), sem "sobrar" espaço que um campo menor
                  (ex.: Série NF-e) acabasse preenchendo do lado errado. */}
              {/* Homologação e Produção são credenciais separadas (igual ao
                  próprio painel da Focus NFe) — cada uma com seu token e um
                  liga/desliga próprio, em vez de um token único alternando
                  por ambiente. */}
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" style={{ padding: 16, height: "100%" }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                      Homologação
                    </Typography>
                    <FormControlLabel
                      labelPlacement="start"
                      control={
                        <Switch
                          checked={!!values.sandboxEnabled}
                          onChange={(e) => setFieldValue("sandboxEnabled", e.target.checked)}
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
                    name="gatewayTokenSandbox"
                    label="Token de acesso (Homologação)"
                    disabled={!values.sandboxEnabled}
                    helperText="Gerado no painel do gateway, aba de Homologação"
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
                    name="gatewayTokenProduction"
                    label="Token de acesso (Produção)"
                    disabled={!values.productionEnabled}
                    helperText="Gerado no painel do gateway, aba de Produção. Se habilitada, a venda emite por aqui (tem prioridade sobre Homologação)"
                  />
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" style={{ fontWeight: 700, marginTop: 8 }}>
                  Escritório de contabilidade
                </Typography>
                <Typography variant="caption" color="textSecondary" style={{ display: "block", marginBottom: 8 }}>
                  Alguns estados (ex. BA) exigem o CNPJ/CPF do escritório de contabilidade cadastrado na nota —
                  preencha aqui pra o AtendeFlow sincronizar automaticamente com a Focus NFe ao salvar, sem precisar
                  entrar no painel deles. Token de conta e ID da empresa só precisam ser preenchidos uma vez (ficam
                  no painel da Focus, em "Minha conta" e na URL de edição da empresa).
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="accountingOfficeDocument"
                  label="CNPJ/CPF da contabilidade"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="focusCompanyId"
                  label="ID da empresa na Focus"
                  helperText="Número na URL do painel ao editar a empresa"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="password"
                  name="focusAccountToken"
                  label="Token de conta (master) da Focus"
                  helperText="Painel da Focus → Minha conta — diferente dos tokens de Homologação/Produção acima"
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

            <Divider className={classes.divider} />

            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Envio de nota por e-mail (Resend)
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Por padrão, "Enviar por e-mail" (tela da venda) pede pra própria
              Focus NFe mandar o e-mail. Conectando a Resend aqui, o AtendeFlow
              passa a mandar ele mesmo, com o remetente configurado abaixo.
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle} component="div">
              1. Crie sua conta em{" "}
              <Link href="https://resend.com" target="_blank" rel="noopener noreferrer">
                resend.com
              </Link>
              . 2. Abra API Keys → Add API Key. 3. Verifique o domínio do
              remetente (não dá pra usar @gmail.com ou outro domínio que você
              não controla), salve a chave aqui e envie um teste.
              {" "}
              <Link href="https://resend.com/pricing" target="_blank" rel="noopener noreferrer">
                Confira os limites atuais da Resend.
              </Link>{" "}
              O remetente de teste da própria Resend restringe os destinatários.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!values.resendEnabled}
                      onChange={(e) => setFieldValue("resendEnabled", e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Usar Resend pra enviar a nota por e-mail"
                />
                {values.resendApiKeyConfigured && (
                  <Box display="flex" alignItems="center" style={{ gap: 4, marginTop: -4, marginBottom: 8 }}>
                    <CheckCircleIcon fontSize="small" style={{ color: "#2e7d32" }} />
                    <Typography variant="caption" style={{ color: "#2e7d32" }}>
                      Envio validado — chave já cadastrada
                    </Typography>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="resendApiKey"
                  label="Chave API da Resend"
                  type={showResendKey ? "text" : "password"}
                  disabled={!values.resendEnabled}
                  placeholder={values.resendApiKeyConfigured ? "••••••••••••••••" : ""}
                  helperText={
                    values.resendApiKeyConfigured
                      ? "✓ Chave cadastrada. Deixe vazio para manter."
                      : undefined
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowResendKey((prev) => !prev)}
                          disabled={!values.resendEnabled}
                        >
                          {showResendKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="resendFromEmail"
                  label="E-mail remetente"
                  placeholder="notas@seudominio.com.br"
                  helperText="Use um endereço de domínio verificado na Resend."
                  disabled={!values.resendEnabled}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="resendFromName"
                  label="Nome remetente (opcional)"
                  disabled={!values.resendEnabled}
                />
              </Grid>
            </Grid>

            {values.resendEnabled && values.resendApiKeyConfigured && (
              <Box mt={2} p={2} border="1px solid #e0e0e0" borderRadius={8}>
                <Typography variant="subtitle2" gutterBottom>
                  Enviar para um destinatário
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Revise o destinatário e a mensagem antes de confirmar.
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Destinatário"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Assunto"
                      value={testSubject}
                      onChange={(e) => setTestSubject(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      multiline
                      minRows={2}
                      label="Mensagem"
                      placeholder="Olá! O e-mail da integração Resend está conectado ao AtendeFlow."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={sendingTest ? <CircularProgress size={14} /> : <SendIcon />}
                      onClick={handleSendTestEmail}
                      disabled={sendingTest}
                    >
                      Confirmar e enviar e-mail
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}

            <Divider className={classes.divider} />

            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Reforma Tributária 2027 (IVA)
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Prepara o sistema pra transição CBS/IBS de janeiro de 2027. Enquanto
              desativado, nenhum campo novo (cliente, produto, venda) tem efeito — o
              faturamento continua pelas regras de hoje (Simples Nacional, PIS/Cofins,
              ICMS/ISS tradicionais).
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!values.reform2027Enabled}
                      onChange={(e) => setFieldValue("reform2027Enabled", e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Ativar Regras de Faturamento IVA (Reforma Tributária 2027)"
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

      <NumberingInvalidationPanel fiscal={fiscal} />
    </>
  );
};

export default FiscalConfigPanel;
