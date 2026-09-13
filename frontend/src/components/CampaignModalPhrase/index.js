import React, { useState, useEffect, useContext } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import Switch from "@material-ui/core/Switch";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  ListItemText,
  MenuItem,
  Select,
  Typography
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Autocomplete, Chip, Stack } from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },

  dialogPaper: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 18px 60px rgba(0, 0, 0, 0.5)"
        : "0 18px 60px rgba(16, 24, 40, 0.18)",
    height: "calc(100vh - 48px)",
    maxHeight: "calc(100vh - 48px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },

  dialogTitle: {
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${theme.palette.divider}`
  },

  titleWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },

  title: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#111827"
  },

  subtitle: {
    fontSize: 12.5,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#6B7280"
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`
  },

  dialogContent: {
    padding: 20,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    ...theme.scrollbarStyles,

    "& .MuiOutlinedInput-root": {
      borderRadius: 10
    }
  },

  dialogActions: {
    padding: "14px 20px",
    borderTop: `1px solid ${theme.palette.divider}`,
    gap: 10,
    flexShrink: 0
  },

  fieldLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    marginBottom: 4
  },

  primaryButton: {
    borderRadius: 10,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },

  secondaryButton: {
    borderRadius: 10,
    textTransform: "none"
  },

  buttonProgress: {
    color: green[500],
    marginLeft: 8
  },

  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.015)"
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap"
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0
  },

  iosSwitch: {
    width: 44,
    height: 26,
    padding: 0,
    margin: 0,
    "& .MuiSwitch-switchBase": {
      padding: 2,
      transition: theme.transitions.create("transform", { duration: 200 }),
      "&.Mui-checked": {
        transform: "translateX(18px)",
        color: "#fff",
        "& + .MuiSwitch-track": {
          backgroundColor: "#22c55e",
          opacity: 1,
          border: "none"
        }
      }
    },
    "& .MuiSwitch-thumb": {
      width: 22,
      height: 22,
      backgroundColor: "#fff",
      boxShadow: "0 1px 4px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)",
      transition: theme.transitions.create(["width"], { duration: 200 })
    },
    "& .MuiSwitch-track": {
      borderRadius: 13,
      backgroundColor: theme.palette.type === "dark" ? "#52525b" : "#d4d4d8",
      opacity: 1,
      transition: theme.transitions.create("background-color", {
        duration: 300
      })
    }
  },

  connectionStatusText: {
    fontSize: 12,
    fontWeight: 600,
    marginLeft: 6
  },
  connectionOnline: {
    color: "#16a34a"
  },
  connectionOffline: {
    color: "#dc2626"
  }
}));

const CampaignModalPhrase = ({ open, onClose, FlowCampaignId, onSave }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { companyId } = user;

  const [dataItem, setDataItem] = useState({
    name: "",
    phrase: ""
  });

  const [dataItemError, setDataItemError] = useState({
    name: false,
    flowId: false,
    whatsappId: false,
    phrase: false
  });

  const [flowSelected, setFlowSelected] = useState();
  const [flowsData, setFlowsData] = useState([]);
  const [flowsDataComplete, setFlowsDataComplete] = useState([]);

  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");

  // Aplica valor inicial da conexão (última usada) apenas ao criar uma nova campanha
  useEffect(() => {
    if (!FlowCampaignId) {
      const stored = localStorage.getItem("selectedWhatsappId");
      if (stored) {
        setSelectedWhatsapp(parseInt(stored, 10));
      }
    }
  }, [FlowCampaignId]);

  const [whatsApps, setWhatsApps] = useState([]);

  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getFlows = async () => {
    const flows = await api.get("/flowbuilder");
    setFlowsDataComplete(flows.data.flows);
    setFlowsData(flows.data.flows.map(flow => flow.name));
    return flows.data.flows;
  };

  const detailsPhrase = async flows => {
    setLoading(true);
    try {
      const res = await api.get(`/flowcampaign/${FlowCampaignId}`);
      setDataItem({
        name: res.data.details.name,
        phrase: res.data.details.phrase
      });
      setActive(!!res.data.details.status);
      const nameFlow = flows.filter(
        itemFlows => itemFlows.id === res.data.details.flowId
      );
      if (nameFlow.length > 0) {
        setFlowSelected(nameFlow[0].name);
      }
      if (res.data.details.whatsappId) {
        setSelectedWhatsapp(res.data.details.whatsappId);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const openModal = async () => {
    const flows = await getFlows();
    if (FlowCampaignId) {
      await detailsPhrase(flows);
    } else {
      clearData();
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      api
        .get(`/whatsapp`, { params: { companyId, session: 0 } })
        .then(({ data }) => {
          setWhatsApps(data);
        })
        .catch(err => toastError(err));
      setLoading(false);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [companyId]);

  useEffect(() => {
    if (open === true) {
      setLoading(true);
      openModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearErrors = () => {
    setDataItemError({
      name: false,
      flowId: false,
      whatsappId: false,
      phrase: false
    });
  };

  const clearData = () => {
    setFlowSelected();
    setActive(true);
    setDataItem({
      name: "",
      phrase: ""
    });
  };

  const applicationSaveAndEdit = async () => {
    let error = 0;
    if (dataItem.name === "" || dataItem.name.length === 0) {
      setDataItemError(old => ({ ...old, name: true }));
      error++;
    }
    if (!flowSelected) {
      setDataItemError(old => ({ ...old, flowId: true }));
      error++;
    }
    if (dataItem.phrase === "" || dataItem.phrase.length === 0) {
      setDataItemError(old => ({ ...old, phrase: true }));
      error++;
    }
    if (!selectedWhatsapp) {
      setDataItemError(old => ({ ...old, whatsappId: true }));
      error++;
    }

    if (error !== 0) {
      return;
    }

    const idFlow = flowsDataComplete.find(item => item.name === flowSelected)
      ?.id;

    const whatsappId = selectedWhatsapp !== "" ? Number(selectedWhatsapp) : null;

    setSubmitting(true);
    try {
      if (FlowCampaignId) {
        await api.put("/flowcampaign", {
          id: FlowCampaignId,
          name: dataItem.name,
          flowId: idFlow,
          whatsappId: whatsappId,
          phrase: dataItem.phrase,
          status: active
        });
        onClose();
        onSave("ok");
        toast.success("Frase alterada com sucesso!");
        clearData();
      } else {
        await api.post("/flowcampaign", {
          name: dataItem.name,
          flowId: idFlow,
          whatsappId: whatsappId,
          phrase: dataItem.phrase
        });
        onClose();
        onSave("ok");
        toast.success("Frase criada com sucesso!");
        clearData();
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWhatsappData = whatsApps.find(w => w.id === selectedWhatsapp);

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>
              {FlowCampaignId
                ? "Editar campanha com fluxo por frase"
                : "Nova campanha com fluxo por frase"}
            </Typography>
            <Typography className={classes.subtitle}>
              Configure o disparo automático quando a frase for recebida
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

        {!loading && (
          <>
            <DialogContent className={classes.dialogContent} dividers>
              <Stack sx={{ gap: "18px" }}>
                <Stack gap={0.5}>
                  <Typography className={classes.fieldLabel}>
                    Nome do disparo por frase
                  </Typography>
                  <TextField
                    name="name"
                    variant="outlined"
                    error={dataItemError.name}
                    helperText={dataItemError.name ? "Informe um nome" : ""}
                    value={dataItem.name}
                    margin="dense"
                    onChange={e => {
                      const { value } = e.target;
                      setDataItem(old => ({ ...old, name: value }));
                      setDataItemError(old => ({ ...old, name: false }));
                    }}
                    fullWidth
                  />
                </Stack>

                <Stack gap={0.5}>
                  <Typography className={classes.fieldLabel}>
                    Escolha um fluxo
                  </Typography>
                  <Autocomplete
                    disablePortal
                    id="combo-box-demo"
                    value={flowSelected ?? null}
                    options={flowsData}
                    onChange={(event, newValue) => {
                      setFlowSelected(newValue);
                      setDataItemError(old => ({ ...old, flowId: false }));
                    }}
                    sx={{ width: "100%" }}
                    renderInput={params => (
                      <TextField
                        {...params}
                        error={dataItemError.flowId}
                        helperText={
                          dataItemError.flowId ? "Escolha um fluxo" : ""
                        }
                        variant="outlined"
                        placeholder="Escolha um fluxo"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option}
                          {...getTagProps({ index })}
                          style={{ borderRadius: "8px" }}
                        />
                      ))
                    }
                  />
                </Stack>

                <Stack gap={0.5}>
                  <Typography className={classes.fieldLabel}>
                    Conexão
                  </Typography>
                  <Select
                    required
                    fullWidth
                    displayEmpty
                    variant="outlined"
                    error={dataItemError.whatsappId}
                    value={selectedWhatsapp}
                    onChange={e => {
                      setSelectedWhatsapp(e.target.value);
                      setDataItemError(old => ({ ...old, whatsappId: false }));
                    }}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left"
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left"
                      },
                      getContentAnchorEl: null
                    }}
                    renderValue={() => {
                      if (selectedWhatsapp === "") {
                        return "Selecione uma Conexão";
                      }
                      if (!selectedWhatsappData) {
                        return "Conexão não encontrada";
                      }
                      return selectedWhatsappData.name;
                    }}
                  >
                    {whatsApps?.length > 0 &&
                      whatsApps.map(whatsapp => (
                        <MenuItem dense key={whatsapp.id} value={whatsapp.id}>
                          <ListItemText
                            primary={
                              <Stack direction="row" alignItems="center">
                                <Typography
                                  component="span"
                                  style={{ fontSize: 14 }}
                                >
                                  {whatsapp.name}
                                </Typography>
                                <span
                                  className={`${classes.connectionStatusText} ${
                                    whatsapp.status === "CONNECTED"
                                      ? classes.connectionOnline
                                      : classes.connectionOffline
                                  }`}
                                >
                                  ({whatsapp.status})
                                </span>
                              </Stack>
                            }
                          />
                        </MenuItem>
                      ))}
                  </Select>
                  {dataItemError.whatsappId && (
                    <Typography
                      variant="caption"
                      style={{ color: "#dc2626", marginLeft: 4 }}
                    >
                      Selecione uma conexão
                    </Typography>
                  )}
                </Stack>

                <Stack gap={0.5}>
                  <Typography className={classes.fieldLabel}>
                    Qual frase dispara o fluxo?
                  </Typography>
                  <TextField
                    name="phrase"
                    variant="outlined"
                    error={dataItemError.phrase}
                    helperText={
                      dataItemError.phrase ? "Informe a frase gatilho" : ""
                    }
                    value={dataItem.phrase}
                    margin="dense"
                    onChange={e => {
                      const { value } = e.target;
                      setDataItem(old => ({ ...old, phrase: value }));
                      setDataItemError(old => ({ ...old, phrase: false }));
                    }}
                    fullWidth
                  />
                </Stack>

                <Stack gap={0.5}>
                  <Typography className={classes.fieldLabel}>
                    Status
                  </Typography>
                  <div className={classes.statusRow}>
                    <span
                      className={classes.statusBadge}
                      style={{
                        backgroundColor: active
                          ? "rgba(34,197,94,0.10)"
                          : "rgba(148,163,184,0.12)",
                        color: active ? "#16a34a" : "#64748b",
                        border: `1px solid ${
                          active
                            ? "rgba(34,197,94,0.25)"
                            : "rgba(148,163,184,0.25)"
                        }`
                      }}
                    >
                      <span
                        className={classes.statusDot}
                        style={{
                          backgroundColor: active ? "#22c55e" : "#94a3b8"
                        }}
                      />
                      {active ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      className={classes.iosSwitch}
                      checked={active}
                      onChange={() => setActive(old => !old)}
                    />
                  </div>
                </Stack>
              </Stack>
            </DialogContent>

            <DialogActions className={classes.dialogActions}>
              <Button
                variant="outlined"
                className={classes.secondaryButton}
                disabled={submitting}
                onClick={() => {
                  onClose();
                  clearErrors();
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="primary"
                className={classes.primaryButton}
                disabled={submitting}
                onClick={() => applicationSaveAndEdit()}
              >
                {FlowCampaignId ? "Salvar campanha" : "Criar campanha"}
                {submitting && (
                  <CircularProgress size={16} className={classes.buttonProgress} />
                )}
              </Button>
            </DialogActions>
          </>
        )}
        {loading && (
          <Stack
            justifyContent={"center"}
            alignItems={"center"}
            minHeight={"10vh"}
            sx={{ padding: "52px" }}
          >
            <CircularProgress />
          </Stack>
        )}
      </Dialog>
    </div>
  );
};

export default CampaignModalPhrase;
