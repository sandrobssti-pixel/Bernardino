import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  Tooltip,
  CircularProgress,
} from "@material-ui/core";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import {
  Cake as CakeIcon,
  NotificationsActive as NotificationsActiveIcon,
  WhatsApp as WhatsAppIcon,
  Save as SaveIcon,
  AccessTime as AccessTimeIcon,
  Timer as TimerIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

const useStyles = makeStyles((theme) => ({
  // ── Page wrapper ─────────────────────────────────────────────────────────
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing(3),
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.45rem",
    letterSpacing: "-0.3px",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontWeight: 400,
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
  },

  // ── Save button ───────────────────────────────────────────────────────────
  btnPrimary: {
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.78rem",
    padding: theme.spacing(0.7, 1.5),
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    textTransform: "none",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  // ── Section card ─────────────────────────────────────────────────────────
  sectionCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    marginBottom: theme.spacing(2),
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  sectionSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
  },
  sectionBody: {
    padding: theme.spacing(2, 2.5),
    backgroundColor: theme.palette.background.paper,
  },

  // ── Toggle row ────────────────────────────────────────────────────────────
  toggleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.06)"
    }`,
    "&:last-of-type": {
      borderBottom: "none",
    },
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.3,
  },
  toggleHint: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 3,
    lineHeight: 1.4,
  },

  // ── Fields area ───────────────────────────────────────────────────────────
  fieldsCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
  },
  fieldsHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
  },
  fieldsBody: {
    padding: theme.spacing(2.5),
    backgroundColor: theme.palette.background.paper,
  },
  helperText: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
    marginTop: 4,
    display: "block",
  },

  // ── Field styles ──────────────────────────────────────────────────────────
  outlinedField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      fontSize: "0.82rem",
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.82rem",
    },
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: theme.spacing(2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(2),
  },

  // ── Loading ───────────────────────────────────────────────────────────────
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    gap: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
}));

const IOSSwitch = withStyles((theme) => ({
  root: { width: 42, height: 26, padding: 0 },
  switchBase: {
    padding: 1,
    "&$checked": {
      transform: "translateX(16px)",
      color: theme.palette.common.white,
      "& + $track": {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
        border: "none",
      },
    },
  },
  thumb: { width: 24, height: 24 },
  track: {
    borderRadius: 13,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "light" ? "#d1d5db" : "#4b5563",
    opacity: 1,
    transition: theme.transitions.create(["background-color", "border"]),
  },
  checked: {},
}))(Switch);

const BirthdaySettings = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    userBirthdayEnabled: true,
    contactBirthdayEnabled: true,
    contactBirthdayMessage: "",
    sendBirthdayTime: "09:00:00",
    sendIntervalSeconds: 0,
    whatsappId: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/birthdays/settings");
        const s = data?.data || {};
        setSettings({
          userBirthdayEnabled: !!s.userBirthdayEnabled,
          contactBirthdayEnabled: !!s.contactBirthdayEnabled,
          contactBirthdayMessage: s.contactBirthdayMessage || "",
          sendBirthdayTime: s.sendBirthdayTime || "09:00:00",
          sendIntervalSeconds: Number.isFinite(Number(s.sendIntervalSeconds))
            ? Number(s.sendIntervalSeconds)
            : 0,
          whatsappId: s.whatsappId || "",
        });
      } catch (err) {
        toast.error("Erro ao carregar configurações de aniversário");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = (field, value) =>
    setSettings((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/birthdays/settings", {
        ...settings,
        whatsappId: settings.whatsappId || null,
      });
      toast.success("Configurações salvas com sucesso");
    } catch (err) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={classes.pageRoot}>
        <div className={classes.loadingWrap}>
          <CircularProgress size={20} />
          <span>Carregando configurações…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.pageRoot}>
      {/* ── Header ── */}
      <div className={classes.header}>
        <div>
          <Typography className={classes.headerTitle}>
            Configurações de Aniversário
          </Typography>
          <Typography className={classes.headerSubtitle}>
            Defina como o sistema trata aniversários de usuários e contatos
          </Typography>
        </div>
        <div className={classes.headerActions}>
          <Button
            className={classes.btnPrimary}
            variant="contained"
            color="primary"
            startIcon={
              saving ? (
                <CircularProgress size={14} style={{ color: "#fff" }} />
              ) : (
                <SaveIcon style={{ fontSize: 16 }} />
              )
            }
            disabled={saving}
            onClick={save}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* ── Preferences card ── */}
      <Paper className={classes.sectionCard} elevation={0}>
        <div className={classes.sectionHeader}>
          <div
            className={classes.sectionIconWrap}
            style={{ backgroundColor: "rgba(99,102,241,0.1)" }}
          >
            <CakeIcon style={{ fontSize: 18, color: "#6366f1" }} />
          </div>
          <div>
            <Typography className={classes.sectionTitle}>
              Preferências
            </Typography>
            <Typography className={classes.sectionSubtitle}>
              Ative apenas o que fizer sentido para sua operação
            </Typography>
          </div>
        </div>

        <div className={classes.sectionBody}>
          {/* Toggle: user birthday */}
          <div className={classes.toggleRow}>
            <div className={classes.toggleInfo}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
              >
                <NotificationsActiveIcon
                  style={{ fontSize: 15, color: "#6366f1" }}
                />
                <Typography className={classes.toggleTitle}>
                  Avisos de aniversário de usuários
                </Typography>
              </div>
              <Typography className={classes.toggleHint}>
                Mostra no sistema quando alguém da equipe fizer aniversário no
                dia.
              </Typography>
            </div>
            <Tooltip
              title={
                settings.userBirthdayEnabled ? "Clique para desativar" : "Clique para ativar"
              }
              arrow
            >
              <IOSSwitch
                checked={settings.userBirthdayEnabled}
                onChange={(e) =>
                  update("userBirthdayEnabled", e.target.checked)
                }
              />
            </Tooltip>
          </div>

          {/* Toggle: contact birthday */}
          <div className={classes.toggleRow}>
            <div className={classes.toggleInfo}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
              >
                <WhatsAppIcon
                  style={{ fontSize: 15, color: "#22c55e" }}
                />
                <Typography className={classes.toggleTitle}>
                  Envio automático para contatos
                </Typography>
              </div>
              <Typography className={classes.toggleHint}>
                Envia mensagem de parabéns no WhatsApp para contatos
                aniversariantes.
              </Typography>
            </div>
            <Tooltip
              title={
                settings.contactBirthdayEnabled
                  ? "Clique para desativar"
                  : "Clique para ativar"
              }
              arrow
            >
              <IOSSwitch
                checked={settings.contactBirthdayEnabled}
                onChange={(e) =>
                  update("contactBirthdayEnabled", e.target.checked)
                }
              />
            </Tooltip>
          </div>
        </div>
      </Paper>

      {/* ── Message & schedule card ── */}
      <Paper className={classes.fieldsCard} elevation={0}>
        <div className={classes.fieldsHeader}>
          <div
            className={classes.sectionIconWrap}
            style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
          >
            <WhatsAppIcon style={{ fontSize: 18, color: "#22c55e" }} />
          </div>
          <div>
            <Typography className={classes.sectionTitle}>
              Mensagem e agendamento
            </Typography>
            <Typography className={classes.sectionSubtitle}>
              Configure o texto enviado e o horário do disparo automático
            </Typography>
          </div>
        </div>

        <div className={classes.fieldsBody}>
          <Grid container spacing={2}>
            {/* Message */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Mensagem para contatos"
                value={settings.contactBirthdayMessage}
                onChange={(e) =>
                  update("contactBirthdayMessage", e.target.value)
                }
                variant="outlined"
                className={classes.outlinedField}
              />
              <span className={classes.helperText}>
                Use {"{nome}"} para incluir o nome do contato na mensagem
              </span>
            </Grid>

            {/* Time */}
            <Grid item xs={12} md={4}>
              <TextField
                type="time"
                label="Horário do envio"
                value={String(settings.sendBirthdayTime || "09:00:00").slice(0, 5)}
                onChange={(e) =>
                  update("sendBirthdayTime", `${e.target.value}:00`)
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
                variant="outlined"
                className={classes.outlinedField}
                InputProps={{
                  startAdornment: (
                    <AccessTimeIcon
                      style={{ fontSize: 16, color: "#94a3b8", marginRight: 6 }}
                    />
                  ),
                }}
              />
            </Grid>

            {/* Interval */}
            <Grid item xs={12} md={4}>
              <TextField
                type="number"
                label="Intervalo entre envios (seg)"
                value={settings.sendIntervalSeconds}
                onChange={(e) =>
                  update(
                    "sendIntervalSeconds",
                    Math.max(0, Number(e.target.value || 0))
                  )
                }
                inputProps={{ min: 0, max: 3600 }}
                fullWidth
                variant="outlined"
                className={classes.outlinedField}
                InputProps={{
                  startAdornment: (
                    <TimerIcon
                      style={{ fontSize: 16, color: "#94a3b8", marginRight: 6 }}
                    />
                  ),
                }}
              />
              <span className={classes.helperText}>0 = envia sem intervalo</span>
            </Grid>

            {/* WhatsApp connection */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined">
                <InputLabel style={{ fontSize: "0.82rem" }}>
                  Conexão WhatsApp
                </InputLabel>
                <Select
                  value={settings.whatsappId}
                  onChange={(e) => update("whatsappId", e.target.value)}
                  label="Conexão WhatsApp"
                  style={{ fontSize: "0.82rem", borderRadius: 8 }}
                >
                  <MenuItem value="">
                    <em>Padrão da empresa</em>
                  </MenuItem>
                  {whatsApps?.map((w) => (
                    <MenuItem value={w.id} key={w.id}>
                      {w.name} ({w.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box className={classes.footer}>
            <Button
              className={classes.btnPrimary}
              variant="contained"
              color="primary"
              startIcon={
                saving ? (
                  <CircularProgress size={14} style={{ color: "#fff" }} />
                ) : (
                  <SaveIcon style={{ fontSize: 16 }} />
                )
              }
              disabled={saving}
              onClick={save}
            >
              {saving ? "Salvando…" : "Salvar configurações"}
            </Button>
          </Box>
        </div>
      </Paper>
    </div>
  );
};

export default BirthdaySettings;
