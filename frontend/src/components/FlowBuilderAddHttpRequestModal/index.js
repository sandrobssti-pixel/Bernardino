import React, { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import MenuItem from "@material-ui/core/MenuItem";
import Grid from "@material-ui/core/Grid";
import CircularProgress from "@material-ui/core/CircularProgress";
import Paper from "@material-ui/core/Paper";
import CloseIcon from "@material-ui/icons/Close";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";

import api from "../../services/api";

const useStyles = makeStyles(theme => {
  const dark = theme.palette.type === "dark";

  return {
  root: { display: "flex", flexWrap: "wrap" },
  dialogPaper: {
    borderRadius: 14,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    boxShadow: dark ? "0 18px 60px rgba(0, 0, 0, 0.5)" : "0 18px 60px rgba(16, 24, 40, 0.18)",
    overflow: "hidden",
    background: dark ? "#1e293b" : undefined
  },
  dialogTitle: {
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  titleWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: dark ? "#f1f5f9" : "#111827"
  },
  subtitle: {
    fontSize: 12.5,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280"
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: dark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(17, 24, 39, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.5)" : undefined,
    color: dark ? "#e5e7eb" : undefined
  },
  dialogContent: {
    padding: 20,
    background: dark
      ? "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(30,41,59,0.6) 55%)"
      : "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)",
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: dark ? "rgba(15, 23, 42, 0.4)" : "#fff",
      color: dark ? "#f1f5f9" : undefined
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.24)" : undefined
    }
  },
  dialogActions: {
    padding: "14px 20px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10,
    background: dark ? "rgba(15, 23, 42, 0.4)" : undefined
  },
  primaryButton: {
    borderRadius: 12,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },
  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: dark ? "#f1f5f9" : "#111827",
    marginBottom: 8
  },
  rowAction: {
    minWidth: 40,
    height: 40,
    borderRadius: 10
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.35)" : "#fff"
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: dark ? "#f1f5f9" : "#111827",
    marginBottom: 8
  },
  resultMeta: {
    fontSize: 12,
    color: dark ? "rgba(226, 232, 240, 0.75)" : "#374151",
    marginBottom: 6
  },
  resultPre: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    background: "#0f172a",
    color: "#e5eefb",
    fontSize: 12,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  }
  };
});

const defaultMapping = () => ({ path: "", variableName: "" });
const defaultQuery = () => ({ key: "", value: "" });
const defaultTestVariable = () => ({ key: "", value: "" });

const normalizeNodeData = (source = {}) => ({
  url: String(source.url || ""),
  method: String(source.method || "GET"),
  timeout: Number(source.timeout || 10000),
  headers: source.headers
    ? JSON.stringify(source.headers, null, 2)
    : String(source.headersString || "{}"),
  requestBody:
    typeof source.requestBody === "string"
      ? source.requestBody
      : source.requestBody
      ? JSON.stringify(source.requestBody, null, 2)
      : "",
  queryParams: Array.isArray(source.queryParams) && source.queryParams.length
    ? source.queryParams.map(item => ({
        key: String(item?.key || ""),
        value: String(item?.value || "")
      }))
    : [defaultQuery()],
  responseVariables:
    Array.isArray(source.responseVariables) && source.responseVariables.length
      ? source.responseVariables.map(item => ({
          path: String(item?.path || ""),
          variableName: String(item?.variableName || item?.variable || "")
        }))
      : [defaultMapping()],
  statusVariable: String(source.statusVariable || ""),
  successVariable: String(source.successVariable || "")
});

const FlowBuilderAddHttpRequestModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close
}) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [form, setForm] = useState(normalizeNodeData());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testVariablesOpen, setTestVariablesOpen] = useState(false);
  const [testVariables, setTestVariables] = useState([defaultTestVariable()]);

  useEffect(() => {
    if (open === "edit") {
      setForm(normalizeNodeData(data?.data || {}));
      setActiveModal(true);
    } else if (open === "create") {
      setForm(normalizeNodeData());
      setActiveModal(true);
    }
    setTestResult(null);
    setTesting(false);
    setTestVariablesOpen(false);
    setTestVariables([defaultTestVariable()]);
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const setField = (field, value) => {
    setForm(old => ({
      ...old,
      [field]: value
    }));
  };

  const updateListItem = (field, index, key, value) => {
    setForm(old => ({
      ...old,
      [field]: old[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const addListItem = (field, factory) => {
    setForm(old => ({
      ...old,
      [field]: [...old[field], factory()]
    }));
  };

  const removeListItem = (field, index, fallbackFactory) => {
    setForm(old => {
      const nextItems = old[field].filter((_, itemIndex) => itemIndex !== index);
      return {
        ...old,
        [field]: nextItems.length ? nextItems : [fallbackFactory()]
      };
    });
  };

  const updateTestVariableItem = (index, key, value) => {
    setTestVariables(current =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  };

  const addTestVariableItem = () => {
    setTestVariables(current => [...current, defaultTestVariable()]);
  };

  const removeTestVariableItem = index => {
    setTestVariables(current => {
      const nextItems = current.filter((_, itemIndex) => itemIndex !== index);
      return nextItems.length ? nextItems : [defaultTestVariable()];
    });
  };

  const handleSave = () => {
    if (!form.url.trim()) {
      return toast.error("Informe a URL da requisicao");
    }

    let parsedHeaders = {};
    if (form.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(form.headers);
      } catch (error) {
        return toast.error("Headers precisam estar em JSON valido");
      }
    }

    const payload = {
      url: form.url.trim(),
      method: form.method,
      timeout: Number(form.timeout) || 10000,
      headers: parsedHeaders,
      requestBody: form.requestBody,
      queryParams: form.queryParams.filter(
        item => String(item.key || "").trim() || String(item.value || "").trim()
      ),
      responseVariables: form.responseVariables.filter(
        item =>
          String(item.path || "").trim() && String(item.variableName || "").trim()
      ),
      statusVariable: form.statusVariable.trim(),
      successVariable: form.successVariable.trim()
    };

    if (open === "edit") {
      onUpdate({
        ...data,
        data: payload
      });
    } else {
      onSave(payload);
    }

    handleClose();
  };

  const handleTest = async () => {
    if (!testVariablesOpen) {
      setTestVariablesOpen(true);
      return;
    }

    if (!form.url.trim()) {
      return toast.error("Informe a URL da requisicao");
    }

    let parsedHeaders = {};
    if (form.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(form.headers);
      } catch (error) {
        return toast.error("Headers precisam estar em JSON valido");
      }
    }

    setTesting(true);
    setTestResult(null);

    try {
      const variablesPayload = testVariables.reduce((acc, item) => {
        const key = String(item.key || "").trim();
        if (!key) return acc;
        acc[key] = item.value;
        return acc;
      }, {});

      const payload = {
        url: form.url.trim(),
        method: form.method,
        timeout: Number(form.timeout) || 10000,
        headers: parsedHeaders,
        requestBody: form.requestBody,
        queryParams: form.queryParams.filter(
          item => String(item.key || "").trim() || String(item.value || "").trim()
        ),
        responseVariables: form.responseVariables.filter(
          item =>
            String(item.path || "").trim() && String(item.variableName || "").trim()
        ),
        statusVariable: form.statusVariable.trim(),
        successVariable: form.successVariable.trim()
      };

      const { data: response } = await api.post(
        "/flowbuilder/http-request/test",
        {
          nodeData: payload,
          variables: variablesPayload
        }
      );

      setTestResult(response);
      toast.success("Teste da API executado com sucesso.");
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Nao foi possivel testar a API.";

      setTestResult({
        response: {
          success: false,
          status: error?.response?.status || 500,
          data: { message: errorMessage },
          headers: {}
        },
        request: null,
        mappedVariables: {}
      });
      toast.error("Falha ao testar a API.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>
              {open === "create" ? "Adicionar HTTP Request" : "Editar HTTP Request"}
            </Typography>
            <Typography className={classes.subtitle}>
              Execute uma requisicao externa e salve campos da resposta em variaveis do fluxo
            </Typography>
          </div>

          <IconButton
            onClick={handleClose}
            className={classes.closeButton}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className={classes.dialogContent} dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Metodo"
                variant="outlined"
                value={form.method}
                onChange={e => setField("method", e.target.value)}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map(method => (
                  <MenuItem key={method} value={method}>
                    {method}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="URL"
                variant="outlined"
                value={form.url}
                onChange={e => setField("url", e.target.value)}
                helperText="Aceita variaveis no formato ${minhaVariavel}"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Timeout (ms)"
                variant="outlined"
                value={form.timeout}
                onChange={e => setField("timeout", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Headers (JSON)"
                variant="outlined"
                multiline
                rows={3}
                value={form.headers}
                onChange={e => setField("headers", e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography className={classes.sectionTitle}>
                Query Params
              </Typography>
            </Grid>
            {form.queryParams.map((item, index) => (
              <React.Fragment key={`query-${index}`}>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Chave"
                    variant="outlined"
                    value={item.key}
                    onChange={e =>
                      updateListItem("queryParams", index, "key", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Valor"
                    variant="outlined"
                    value={item.value}
                    onChange={e =>
                      updateListItem("queryParams", index, "value", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <IconButton
                    className={classes.rowAction}
                    onClick={() =>
                      removeListItem("queryParams", index, defaultQuery)
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </React.Fragment>
            ))}
            <Grid item xs={12}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => addListItem("queryParams", defaultQuery)}
              >
                Adicionar parametro
              </Button>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Body"
                variant="outlined"
                multiline
                rows={6}
                value={form.requestBody}
                onChange={e => setField("requestBody", e.target.value)}
                helperText="Para JSON, informe um objeto valido. Variaveis tambem aceitam ${minhaVariavel}"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography className={classes.sectionTitle}>
                Variaveis salvas da resposta
              </Typography>
            </Grid>
            {form.responseVariables.map((item, index) => (
              <React.Fragment key={`mapping-${index}`}>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Caminho JSON"
                    variant="outlined"
                    value={item.path}
                    onChange={e =>
                      updateListItem(
                        "responseVariables",
                        index,
                        "path",
                        e.target.value
                      )
                    }
                    helperText="Ex.: data.customer.id"
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Nome da variavel"
                    variant="outlined"
                    value={item.variableName}
                    onChange={e =>
                      updateListItem(
                        "responseVariables",
                        index,
                        "variableName",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <IconButton
                    className={classes.rowAction}
                    onClick={() =>
                      removeListItem("responseVariables", index, defaultMapping)
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </React.Fragment>
            ))}
            <Grid item xs={12}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => addListItem("responseVariables", defaultMapping)}
              >
                Adicionar variavel
              </Button>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Variavel para status HTTP"
                variant="outlined"
                value={form.statusVariable}
                onChange={e => setField("statusVariable", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Variavel para sucesso"
                variant="outlined"
                value={form.successVariable}
                onChange={e => setField("successVariable", e.target.value)}
                helperText="Salva true ou false"
              />
            </Grid>
          </Grid>

          {testVariablesOpen && (
            <>
              <Grid item xs={12}>
                <Typography className={classes.sectionTitle}>
                  Variaveis de teste
                </Typography>
                <Typography className={classes.resultMeta}>
                  Preencha abaixo como se fossem respostas vindas do cliente ou de blocos anteriores.
                </Typography>
              </Grid>

              {testVariables.map((item, index) => (
                <React.Fragment key={`test-variable-${index}`}>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="Nome da variavel"
                      variant="outlined"
                      value={item.key}
                      onChange={e =>
                        updateTestVariableItem(index, "key", e.target.value)
                      }
                      helperText="Ex.: cpf, telefone, nome"
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="Valor"
                      variant="outlined"
                      value={item.value}
                      onChange={e =>
                        updateTestVariableItem(index, "value", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <IconButton
                      className={classes.rowAction}
                      onClick={() => removeTestVariableItem(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </React.Fragment>
              ))}

              <Grid item xs={12}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addTestVariableItem}
                >
                  Adicionar variavel de teste
                </Button>
              </Grid>
            </>
          )}

          {testResult && (
            <Paper elevation={0} className={classes.resultCard}>
              <Typography className={classes.resultTitle}>
                Resultado do teste
              </Typography>
              <Typography className={classes.resultMeta}>
                Status: {testResult?.response?.status ?? "-"} | Sucesso: {testResult?.response?.success ? "Sim" : "Nao"}
              </Typography>
              {testResult?.request?.url && (
                <Typography className={classes.resultMeta}>
                  Requisicao: {testResult.request.method} {testResult.request.url}
                </Typography>
              )}
              <Typography className={classes.resultMeta}>
                Variaveis mapeadas: {Object.keys(testResult?.mappedVariables || {}).length}
              </Typography>

              <pre className={classes.resultPre}>
                {JSON.stringify(
                  {
                    request: testResult?.request,
                    response: testResult?.response,
                    mappedVariables: testResult?.mappedVariables
                  },
                  null,
                  2
                )}
              </pre>
            </Paper>
          )}
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            color="secondary"
            variant="outlined"
            className={classes.secondaryButton}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTest}
            color="default"
            variant="outlined"
            className={classes.secondaryButton}
            disabled={testing}
          >
            {testing
              ? <CircularProgress size={20} />
              : testVariablesOpen
              ? "Executar teste"
              : "Testar API"}
          </Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            className={classes.primaryButton}
            disabled={testing}
          >
            {open === "create" ? "Adicionar" : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderAddHttpRequestModal;
