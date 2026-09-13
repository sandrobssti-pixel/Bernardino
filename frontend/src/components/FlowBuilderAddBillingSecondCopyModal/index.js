import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => {
  const dark = theme.palette.type === "dark";

  return {
  root: { display: "flex", flexWrap: "wrap" },
  dialogPaper: {
    borderRadius: 14,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
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
  sectionTitle: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: 700,
    color: dark ? "#f1f5f9" : "#111827"
  },
  sectionHelper: {
    fontSize: 12,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280",
    marginBottom: 10
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
    textTransform: "none"
  },
  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  }
  };
});

const PROVIDERS = [
  { value: "asaas", label: "Asaas" },
  { value: "sgp", label: "SGP / TSMX" },
  { value: "atlaz", label: "Atlaz" },
  { value: "ixc", label: "IXC Soft" },
  { value: "hubsoft", label: "Hubsoft" }
];

const defaultBillingMessages = {
  success:
    "Encontramos sua cobrança em aberto.\nValor: ${billing_amount|currency}\nVencimento: ${billing_dueDate|date}\nLink: ${billing_invoiceUrl}\nLinha digitável: ${billing_digitableLine}\nPix: ${billing_pixCode}",
  customerNotFound:
    "Não localizamos cadastro para o identificador informado. Confira os dados e tente novamente.",
  noOpenBilling:
    "Localizamos seu cadastro, mas não encontramos cobrança em aberto no momento.",
  invalidDocument:
    "O documento informado é inválido. Verifique o CPF/CNPJ e tente novamente.",
  integrationError:
    "Não foi possível consultar sua cobrança agora. Tente novamente em instantes."
};

const defaultProviderConfig = {
  asaas: {
    apiKey: ""
  },
  sgp: {
    baseUrl: "",
    app: "",
    apiKey: ""
  },
  atlaz: {
    baseUrl: "",
    apiKey: ""
  },
  ixc: {
    baseUrl: "",
    apiKey: ""
  },
  hubsoft: {
    baseUrl: "",
    clientId: "",
    clientSecret: "",
    username: "",
    password: ""
  }
};

const isMaskedSecretValue = value =>
  typeof value === "string" && value.includes("*");

const buildInitialForm = (source = {}, integrationsByProvider = {}) => {
  const provider = String(source.provider || source.integration?.provider || "asaas");
  const providerConfig = PROVIDERS.reduce((acc, item) => {
    const existing = integrationsByProvider[item.value];
    let credentialsOverride;

    if (item.value === "asaas") {
      credentialsOverride = {
        apiKey: String(existing?.credentials?.apiKey || "")
      };
    } else if (item.value === "atlaz" || item.value === "ixc") {
      credentialsOverride = {
        baseUrl: String(existing?.credentials?.baseUrl || ""),
        apiKey: String(existing?.credentials?.apiKey || "")
      };
    } else if (item.value === "hubsoft") {
      credentialsOverride = {
        baseUrl: String(existing?.credentials?.baseUrl || ""),
        clientId: String(existing?.credentials?.clientId || ""),
        clientSecret: String(existing?.credentials?.clientSecret || ""),
        username: String(existing?.credentials?.username || ""),
        password: String(existing?.credentials?.password || "")
      };
    } else {
      credentialsOverride = {
        baseUrl: String(existing?.credentials?.baseUrl || ""),
        app: String(existing?.credentials?.app || ""),
        apiKey: String(existing?.credentials?.apiKey || "")
      };
    }

    acc[item.value] = {
      ...defaultProviderConfig[item.value],
      ...credentialsOverride
    };

    return acc;
  }, {});

  return {
    provider,
    identifierType: String(source.identifierType || "cpfCnpj"),
    identifierTemplate: String(
      source.identifierTemplate || source.identifierValue || "${numero}"
    ),
    variablePrefix: String(source.variablePrefix || "billing"),
    sendBilletPdf: Boolean(source.sendBilletPdf !== undefined ? source.sendBilletPdf : false),
    messages: {
      success: String(
        source.messages?.success ||
          source.successMessage ||
          defaultBillingMessages.success
      ),
      customerNotFound: String(
        source.messages?.customerNotFound ||
          source.customerNotFoundMessage ||
          defaultBillingMessages.customerNotFound
      ),
      noOpenBilling: String(
        source.messages?.noOpenBilling ||
          source.noOpenBillingMessage ||
          defaultBillingMessages.noOpenBilling
      ),
      invalidDocument: String(
        source.messages?.invalidDocument ||
          source.invalidDocumentMessage ||
          defaultBillingMessages.invalidDocument
      ),
      integrationError: String(
        source.messages?.integrationError ||
          source.integrationErrorMessage ||
          defaultBillingMessages.integrationError
      )
    },
    providerConfig
  };
};

const FlowBuilderAddBillingSecondCopyModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close
}) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [form, setForm] = useState(buildInitialForm());
  const [integrations, setIntegrations] = useState([]);
  const [saving, setSaving] = useState(false);

  const integrationsByProvider = useMemo(
    () =>
      (integrations || []).reduce((acc, item) => {
        acc[String(item.provider || "").toLowerCase()] = item;
        return acc;
      }, {}),
    [integrations]
  );

  const loadIntegrations = async () => {
    const { data: response } = await api.get("/billing-integrations");
    return Array.isArray(response?.billingIntegrations)
      ? response.billingIntegrations
      : [];
  };

  useEffect(() => {
    if (open !== "create" && open !== "edit") return;

    let isMounted = true;
    const bootstrap = async () => {
      try {
        const loadedIntegrations = await loadIntegrations();
        if (!isMounted) return;
        setIntegrations(loadedIntegrations);
        const map = loadedIntegrations.reduce((acc, item) => {
          acc[String(item.provider || "").toLowerCase()] = item;
          return acc;
        }, {});
        setForm(buildInitialForm(data?.data || {}, map));
        setActiveModal(true);
      } catch (error) {
        toast.error("Não foi possível carregar as integrações de cobrança");
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const selectedProviderConfig = form.providerConfig[form.provider] || {};
  const currentProviderIntegration = integrationsByProvider[form.provider];

  const updateProviderConfig = (field, value) => {
    setForm(old => ({
      ...old,
      providerConfig: {
        ...old.providerConfig,
        [old.provider]: {
          ...(old.providerConfig[old.provider] || {}),
          [field]: value
        }
      }
    }));
  };

  const persistProviderConfig = async () => {
    if (form.provider === "asaas") {
      if (!String(selectedProviderConfig.apiKey || "").trim()) {
        throw new Error("Informe a API Key do Asaas");
      }

      const payload = {
        name: "Asaas",
        provider: "asaas",
        isActive: true,
        credentials: {
          apiKey: isMaskedSecretValue(selectedProviderConfig.apiKey)
            ? ""
            : String(selectedProviderConfig.apiKey || "").trim()
        },
        settings: {}
      };

      const response = currentProviderIntegration
        ? await api.put(`/billing-integrations/${currentProviderIntegration.id}`, payload)
        : await api.post("/billing-integrations", payload);

      return response.data;
    }

    if (form.provider === "atlaz") {
      if (!String(selectedProviderConfig.apiKey || "").trim()) {
        throw new Error("Informe o token da integração Atlaz");
      }

      const payload = {
        name: "Atlaz",
        provider: "atlaz",
        isActive: true,
        credentials: {
          baseUrl: String(selectedProviderConfig.baseUrl || "").trim(),
          apiKey: isMaskedSecretValue(selectedProviderConfig.apiKey)
            ? ""
            : String(selectedProviderConfig.apiKey || "").trim()
        },
        settings: {}
      };

      const response = currentProviderIntegration
        ? await api.put(`/billing-integrations/${currentProviderIntegration.id}`, payload)
        : await api.post("/billing-integrations", payload);

      return response.data;
    }

    if (form.provider === "ixc") {
      if (!String(selectedProviderConfig.apiKey || "").trim()) {
        throw new Error("Informe o token da integração IXC Soft");
      }

      const payload = {
        name: "IXC Soft",
        provider: "ixc",
        isActive: true,
        credentials: {
          baseUrl: String(selectedProviderConfig.baseUrl || "").trim(),
          apiKey: isMaskedSecretValue(selectedProviderConfig.apiKey)
            ? ""
            : String(selectedProviderConfig.apiKey || "").trim()
        },
        settings: {}
      };

      const response = currentProviderIntegration
        ? await api.put(`/billing-integrations/${currentProviderIntegration.id}`, payload)
        : await api.post("/billing-integrations", payload);

      return response.data;
    }

    if (form.provider === "hubsoft") {
      if (!String(selectedProviderConfig.baseUrl || "").trim()) {
        throw new Error("Informe a URL da integração Hubsoft");
      }
      if (!String(selectedProviderConfig.clientId || "").trim()) {
        throw new Error("Informe o Client ID da integração Hubsoft");
      }
      if (!String(selectedProviderConfig.clientSecret || "").trim()) {
        throw new Error("Informe o Client Secret da integração Hubsoft");
      }
      if (!String(selectedProviderConfig.username || "").trim()) {
        throw new Error("Informe o usuário da integração Hubsoft");
      }
      if (!String(selectedProviderConfig.password || "").trim()) {
        throw new Error("Informe a senha da integração Hubsoft");
      }

      const payload = {
        name: "Hubsoft",
        provider: "hubsoft",
        isActive: true,
        credentials: {
          baseUrl: String(selectedProviderConfig.baseUrl || "").trim(),
          clientId: String(selectedProviderConfig.clientId || "").trim(),
          clientSecret: isMaskedSecretValue(selectedProviderConfig.clientSecret)
            ? ""
            : String(selectedProviderConfig.clientSecret || "").trim(),
          username: String(selectedProviderConfig.username || "").trim(),
          password: isMaskedSecretValue(selectedProviderConfig.password)
            ? ""
            : String(selectedProviderConfig.password || "").trim()
        },
        settings: {}
      };

      const response = currentProviderIntegration
        ? await api.put(`/billing-integrations/${currentProviderIntegration.id}`, payload)
        : await api.post("/billing-integrations", payload);

      return response.data;
    }

    if (!String(selectedProviderConfig.baseUrl || "").trim()) {
      throw new Error("Informe a URL da integração SGP / TSMX");
    }
    if (!String(selectedProviderConfig.app || "").trim()) {
      throw new Error("Informe o App da integração SGP / TSMX");
    }
    if (!String(selectedProviderConfig.apiKey || "").trim()) {
      throw new Error("Informe a API Key da integração SGP / TSMX");
    }

    const payload = {
      name: "SGP / TSMX",
      provider: "sgp",
      isActive: true,
      credentials: {
        baseUrl: String(selectedProviderConfig.baseUrl || "").trim(),
        app: String(selectedProviderConfig.app || "").trim(),
        apiKey: isMaskedSecretValue(selectedProviderConfig.apiKey)
          ? ""
          : String(selectedProviderConfig.apiKey || "").trim()
      },
      settings: {}
    };

    const response = currentProviderIntegration
      ? await api.put(`/billing-integrations/${currentProviderIntegration.id}`, payload)
      : await api.post("/billing-integrations", payload);

    return response.data;
  };

  const handleSave = async () => {
    if (!form.identifierTemplate.trim()) {
      return toast.error("Informe o valor ou variável de identificação");
    }

    setSaving(true);
    try {
      const savedIntegration = await persistProviderConfig();
      const payload = {
        provider: form.provider,
        integrationId: Number(savedIntegration.id),
        integration: {
          id: savedIntegration.id,
          name: savedIntegration.name,
          provider: savedIntegration.provider
        },
        identifierType: form.identifierType,
        identifierTemplate: form.identifierTemplate.trim(),
        variablePrefix: form.variablePrefix.trim() || "billing",
        sendBilletPdf: Boolean(form.sendBilletPdf),
        messages: form.messages
      };

      if (open === "edit") {
        onUpdate({
          ...data,
          data: payload
        });
      } else {
        onSave(payload);
      }

      toast.success("Bloco configurado com sucesso");
      handleClose();
    } catch (error) {
      toast.error(String(error?.message || "Não foi possível salvar a configuração"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>
              {open === "edit" ? "Editar 2a via Boleto" : "Adicionar 2a via Boleto"}
            </Typography>
            <Typography className={classes.subtitle}>
              Escolha o provider e configure os dados da integração da empresa.
            </Typography>
          </div>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent className={classes.dialogContent} dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Provider</InputLabel>
                <Select
                  value={form.provider}
                  onChange={e =>
                    setForm(old => ({
                      ...old,
                      provider: String(e.target.value)
                    }))
                  }
                  label="Provider"
                >
                  {PROVIDERS.map(item => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Identificar por</InputLabel>
                <Select
                  value={form.identifierType}
                  onChange={e =>
                    setForm(old => ({
                      ...old,
                      identifierType: String(e.target.value)
                    }))
                  }
                  label="Identificar por"
                >
                  <MenuItem value="cpfCnpj">CPF/CNPJ</MenuItem>
                  <MenuItem value="phone">Telefone</MenuItem>
                  <MenuItem value="email">E-mail</MenuItem>
                  <MenuItem value="externalCode">Código externo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Prefixo das variáveis"
                variant="outlined"
                value={form.variablePrefix}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    variablePrefix: e.target.value
                  }))
                }
                helperText="Ex.: billing"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.sendBilletPdf)}
                    onChange={e =>
                      setForm(old => ({
                        ...old,
                        sendBilletPdf: e.target.checked
                      }))
                    }
                    color="primary"
                  />
                }
                label="Enviar boleto em PDF"
                style={{ marginTop: 8 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Valor ou variável"
                variant="outlined"
                value={form.identifierTemplate}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    identifierTemplate: e.target.value
                  }))
                }
                helperText={
                  form.provider === "sgp"
                    ? "No SGP/TSMX, CPF/CNPJ, telefone e e-mail consultam o cliente. Código externo é tratado como ID do contrato."
                    : form.provider === "atlaz"
                    ? "Na Atlaz, use CPF/CNPJ, telefone ou código externo (ID do assinante). Consulta por e-mail não é suportada."
                    : form.provider === "ixc"
                    ? "No IXC Soft, use CPF/CNPJ, telefone ou e-mail para localizar o cliente. Código externo é tratado como ID do cliente."
                    : form.provider === "hubsoft"
                    ? "No Hubsoft, use CPF/CNPJ, e-mail ou código externo (código do cliente) para localizar o cliente. Consulta por telefone não é suportada."
                    : "Ex.: ${numero}, ${email}, ${cpf} ou valor fixo"
                }
              />
            </Grid>
          </Grid>

          <Typography className={classes.sectionTitle} style={{ marginTop: 20 }}>
            Configuração do provider
          </Typography>
          {form.provider === "asaas" && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="API Key"
                  variant="outlined"
                  value={selectedProviderConfig.apiKey || ""}
                  onChange={e => updateProviderConfig("apiKey", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, a chave atual será mantida."
                      : "Informe a API Key do Asaas."
                  }
                />
              </Grid>
            </Grid>
          )}
          {form.provider === "sgp" && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="URL integração"
                  variant="outlined"
                  value={selectedProviderConfig.baseUrl || ""}
                  onChange={e => updateProviderConfig("baseUrl", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="App"
                  variant="outlined"
                  value={selectedProviderConfig.app || ""}
                  onChange={e => updateProviderConfig("app", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="API Key / Token"
                  variant="outlined"
                  value={selectedProviderConfig.apiKey || ""}
                  onChange={e => updateProviderConfig("apiKey", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, o token atual será mantido."
                      : "Informe o token da integração SGP / TSMX."
                  }
                />
              </Grid>
            </Grid>
          )}
          {form.provider === "atlaz" && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="URL integração (opcional)"
                  variant="outlined"
                  value={selectedProviderConfig.baseUrl || ""}
                  onChange={e => updateProviderConfig("baseUrl", e.target.value)}
                  helperText="Deixe em branco para usar https://app.atlaz.com.br/api/v2"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Token"
                  variant="outlined"
                  value={selectedProviderConfig.apiKey || ""}
                  onChange={e => updateProviderConfig("apiKey", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, o token atual será mantido."
                      : "Informe o token da integração Atlaz."
                  }
                />
              </Grid>
            </Grid>
          )}
          {form.provider === "ixc" && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="URL integração"
                  variant="outlined"
                  value={selectedProviderConfig.baseUrl || ""}
                  onChange={e => updateProviderConfig("baseUrl", e.target.value)}
                  helperText="Ex.: https://seudominio.ixcsoft.com.br"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Token"
                  variant="outlined"
                  value={selectedProviderConfig.apiKey || ""}
                  onChange={e => updateProviderConfig("apiKey", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, o token atual será mantido."
                      : "Informe o token gerado no painel do IXC Soft (Cadastros > Auxiliares > Usuários > Token API)."
                  }
                />
              </Grid>
            </Grid>
          )}

          {form.provider === "hubsoft" && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="URL integração"
                  variant="outlined"
                  value={selectedProviderConfig.baseUrl || ""}
                  onChange={e => updateProviderConfig("baseUrl", e.target.value)}
                  helperText="Ex.: https://seudominio.hubsoft.com.br"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Client ID"
                  variant="outlined"
                  value={selectedProviderConfig.clientId || ""}
                  onChange={e => updateProviderConfig("clientId", e.target.value)}
                  helperText="Gerado no painel do Hubsoft para o usuário de integração."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Client Secret"
                  variant="outlined"
                  value={selectedProviderConfig.clientSecret || ""}
                  onChange={e => updateProviderConfig("clientSecret", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, o Client Secret atual será mantido."
                      : "Informe o Client Secret gerado no painel do Hubsoft."
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Usuário (e-mail)"
                  variant="outlined"
                  value={selectedProviderConfig.username || ""}
                  onChange={e => updateProviderConfig("username", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Senha"
                  variant="outlined"
                  value={selectedProviderConfig.password || ""}
                  onChange={e => updateProviderConfig("password", e.target.value)}
                  helperText={
                    currentProviderIntegration
                      ? "Se não alterar esse valor, a senha atual será mantida."
                      : "Informe a senha do usuário de integração do Hubsoft."
                  }
                />
              </Grid>
            </Grid>
          )}

          <Typography className={classes.sectionTitle} style={{ marginTop: 20 }}>
            Mensagens
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Mensagem de sucesso"
                variant="outlined"
                value={form.messages.success}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    messages: {
                      ...old.messages,
                      success: e.target.value
                    }
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Cliente não encontrado"
                variant="outlined"
                value={form.messages.customerNotFound}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    messages: {
                      ...old.messages,
                      customerNotFound: e.target.value
                    }
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Sem cobrança em aberto"
                variant="outlined"
                value={form.messages.noOpenBilling}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    messages: {
                      ...old.messages,
                      noOpenBilling: e.target.value
                    }
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Documento inválido"
                variant="outlined"
                value={form.messages.invalidDocument}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    messages: {
                      ...old.messages,
                      invalidDocument: e.target.value
                    }
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Erro na integração"
                variant="outlined"
                value={form.messages.integrationError}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    messages: {
                      ...old.messages,
                      integrationError: e.target.value
                    }
                  }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            variant="outlined"
            className={classes.secondaryButton}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            className={classes.primaryButton}
            disabled={saving}
          >
            {open === "edit" ? "Salvar" : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderAddBillingSecondCopyModal;
