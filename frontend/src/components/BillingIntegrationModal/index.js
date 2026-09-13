import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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

const useStyles = makeStyles(() => ({
  dialogPaper: {
    borderRadius: 14,
    border: "1px solid rgba(17, 24, 39, 0.08)"
  },
  dialogTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px"
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827"
  },
  subtitle: {
    fontSize: 12.5,
    color: "#6B7280"
  },
  dialogContent: {
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)",
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#fff"
    }
  },
  dialogActions: {
    padding: "14px 20px",
    borderTop: "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10
  },
  primaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },
  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10
  }
}));

const defaultSgpSettings = {
  authType: "bearer",
  customerLookupPath: "/customers",
  billingLookupPath: "/billings",
  customerListPath: "customers",
  billingListPath: "billings",
  customerIdField: "id",
  customerNameField: "full_name",
  customerDocumentField: "cpf_cnpj",
  customerEmailField: "email",
  customerPhoneField: "cellphone",
  billingIdField: "id",
  amountField: "value",
  dueDateField: "due_day",
  invoiceUrlField: "integration_link",
  billetUrlField: "integration_link",
  digitableLineField: "digitable_line",
  pixCodeField: "pix_code",
  pixQrCodeUrlField: "pix_qr_code_url",
  openStatusField: "situation_id",
  openStatusValues: "1,2,4"
};

const buildInitialState = (integration) => {
  const provider = String(integration?.provider || "asaas").toLowerCase();
  const credentials = integration?.credentials || {};
  const settings = integration?.settings || {};

  return {
    name: String(integration?.name || ""),
    provider,
    isActive: integration?.isActive !== false,
    credentials: {
      apiKey:
        provider === "asaas" || provider === "atlaz"
          ? String(credentials?.apiKey || "")
          : "",
      baseUrl: String(credentials?.baseUrl || ""),
      token: provider === "sgp" ? "" : "",
      username: provider === "sgp" ? String(credentials?.username || "") : "",
      password: provider === "sgp" ? "" : ""
    },
    settings: {
      ...defaultSgpSettings,
      ...(provider === "sgp" ? settings : {})
    }
  };
};

const BillingIntegrationModal = ({
  open,
  onClose,
  onSaved,
  integration
}) => {
  const classes = useStyles();
  const [form, setForm] = useState(buildInitialState(integration));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(integration));
    }
  }, [open, integration]);

  const isEdit = Boolean(integration?.id);

  const providerFields = useMemo(() => {
    if (form.provider === "asaas") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="API Key"
              variant="outlined"
              value={form.credentials.apiKey}
              onChange={e =>
                setForm(old => ({
                  ...old,
                  credentials: {
                    ...old.credentials,
                    apiKey: e.target.value
                  }
                }))
              }
              helperText={isEdit ? "Preencha apenas para substituir a chave atual." : ""}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Base URL"
              variant="outlined"
              value={form.credentials.baseUrl}
              onChange={e =>
                setForm(old => ({
                  ...old,
                  credentials: {
                    ...old.credentials,
                    baseUrl: e.target.value
                  }
                }))
              }
              helperText="Opcional. Ex.: https://api.asaas.com/v3"
            />
          </Grid>
        </Grid>
      );
    }

    if (form.provider === "atlaz") {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Token"
              variant="outlined"
              value={form.credentials.apiKey}
              onChange={e =>
                setForm(old => ({
                  ...old,
                  credentials: {
                    ...old.credentials,
                    apiKey: e.target.value
                  }
                }))
              }
              helperText={isEdit ? "Preencha apenas para substituir o token atual." : ""}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Base URL"
              variant="outlined"
              value={form.credentials.baseUrl}
              onChange={e =>
                setForm(old => ({
                  ...old,
                  credentials: {
                    ...old.credentials,
                    baseUrl: e.target.value
                  }
                }))
              }
              helperText="Opcional. Padrão: https://app.atlaz.com.br/api/v2"
            />
          </Grid>
        </Grid>
      );
    }

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Base URL"
            variant="outlined"
            value={form.credentials.baseUrl}
            onChange={e =>
              setForm(old => ({
                ...old,
                credentials: {
                  ...old.credentials,
                  baseUrl: e.target.value
                }
              }))
            }
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Autenticação</InputLabel>
            <Select
              value={form.settings.authType}
              onChange={e =>
                setForm(old => ({
                  ...old,
                  settings: {
                    ...old.settings,
                    authType: String(e.target.value)
                  }
                }))
              }
              label="Autenticação"
            >
              <MenuItem value="bearer">Bearer Token</MenuItem>
              <MenuItem value="basic">Basic</MenuItem>
              <MenuItem value="none">Nenhuma</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Token"
            variant="outlined"
            value={form.credentials.token}
            onChange={e =>
              setForm(old => ({
                ...old,
                credentials: {
                  ...old.credentials,
                  token: e.target.value
                }
              }))
            }
            helperText={isEdit ? "Deixe vazio para manter." : ""}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Usuário"
            variant="outlined"
            value={form.credentials.username}
            onChange={e =>
              setForm(old => ({
                ...old,
                credentials: {
                  ...old.credentials,
                  username: e.target.value
                }
              }))
            }
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            type="password"
            label="Senha"
            variant="outlined"
            value={form.credentials.password}
            onChange={e =>
              setForm(old => ({
                ...old,
                credentials: {
                  ...old.credentials,
                  password: e.target.value
                }
              }))
            }
            helperText={isEdit ? "Deixe vazio para manter." : ""}
          />
        </Grid>
        {Object.entries(defaultSgpSettings).map(([key]) => (
          key === "authType" ? null : (
            <Grid item xs={12} md={6} key={key}>
              <TextField
                fullWidth
                label={key}
                variant="outlined"
                value={form.settings[key] || ""}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    settings: {
                      ...old.settings,
                      [key]: e.target.value
                    }
                  }))
                }
              />
            </Grid>
          )
        ))}
      </Grid>
    );
  }, [form, isEdit]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      return toast.error("Informe o nome da integração");
    }

    if (form.provider === "asaas" && !isEdit && !form.credentials.apiKey.trim()) {
      return toast.error("Informe a API Key do Asaas");
    }

    if (form.provider === "atlaz" && !isEdit && !form.credentials.apiKey.trim()) {
      return toast.error("Informe o token da integração Atlaz");
    }

    if (form.provider === "sgp" && !form.credentials.baseUrl.trim()) {
      return toast.error("Informe a Base URL da integração SGP");
    }

    setSaving(true);
    try {
      let credentials;

      if (form.provider === "asaas") {
        credentials = {
          apiKey: form.credentials.apiKey,
          baseUrl: form.credentials.baseUrl
        };
      } else if (form.provider === "atlaz") {
        credentials = {
          apiKey: form.credentials.apiKey,
          baseUrl: form.credentials.baseUrl
        };
      } else {
        credentials = {
          baseUrl: form.credentials.baseUrl,
          token: form.credentials.token,
          username: form.credentials.username,
          password: form.credentials.password
        };
      }

      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        isActive: Boolean(form.isActive),
        credentials,
        settings: form.provider === "sgp" ? form.settings : {}
      };

      const { data } = isEdit
        ? await api.put(`/billing-integrations/${integration.id}`, payload)
        : await api.post("/billing-integrations", payload);

      toast.success(isEdit ? "Integração atualizada" : "Integração criada");
      if (onSaved) onSaved(data);
      onClose();
    } catch (error) {
      toast.error("Não foi possível salvar a integração");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      classes={{ paper: classes.dialogPaper }}
    >
      <DialogTitle className={classes.dialogTitle}>
        <div className={classes.titleBlock}>
          <Typography className={classes.title}>
            {isEdit ? "Editar integração de cobrança" : "Nova integração de cobrança"}
          </Typography>
          <Typography className={classes.subtitle}>
            As credenciais ficam salvas por empresa, fora do JSON do fluxo.
          </Typography>
        </div>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.dialogContent} dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Nome"
              variant="outlined"
              value={form.name}
              onChange={e => setForm(old => ({ ...old, name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Provider</InputLabel>
              <Select
                value={form.provider}
                onChange={e =>
                  setForm(old => {
                    const nextProvider = String(e.target.value);
                    const nextBase = buildInitialState({ provider: nextProvider });
                    return {
                      ...nextBase,
                      name: old.name,
                      isActive: old.isActive,
                      provider: nextProvider
                    };
                  })
                }
                label="Provider"
                disabled={isEdit}
              >
                <MenuItem value="asaas">Asaas</MenuItem>
                <MenuItem value="sgp">SGP / TSMX</MenuItem>
                <MenuItem value="atlaz">Atlaz</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <div className={classes.switchRow}>
              <Switch
                checked={Boolean(form.isActive)}
                onChange={e =>
                  setForm(old => ({
                    ...old,
                    isActive: e.target.checked
                  }))
                }
                color="primary"
              />
              <Typography variant="body2">Ativa</Typography>
            </div>
          </Grid>
        </Grid>

        <div style={{ marginTop: 20 }}>{providerFields}</div>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button
          onClick={onClose}
          variant="outlined"
          className={classes.secondaryButton}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          className={classes.primaryButton}
          disabled={saving}
        >
          {isEdit ? "Salvar" : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingIntegrationModal;
