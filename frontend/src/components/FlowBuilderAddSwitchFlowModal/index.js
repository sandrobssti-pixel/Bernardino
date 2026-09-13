import React, { useEffect, useRef, useState } from "react";

import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import { Stack } from "@mui/material";

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
    },
    "& .MuiInputLabel-root": {
      color: dark ? "rgba(226, 232, 240, 0.65)" : undefined
    }
  },
  dialogActions: {
    padding: "14px 20px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10
  },
  primaryButton: {
    borderRadius: 12,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },
  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  }
  };
});

const FlowBuilderAddSwitchFlowModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close,
  currentFlowId
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");

  useEffect(() => {
    if (open !== "create" && open !== "edit") {
      return undefined;
    }

    const loadFlows = async () => {
      try {
        setLoading(true);
        const { data: response } = await api.get("/flowbuilder");
        const flowList = Array.isArray(response?.flows) ? response.flows : [];
        const filteredFlows = flowList.filter(
          item => Number(item.id) !== Number(currentFlowId)
        );

        setFlows(filteredFlows);

        const existingId =
          data?.data?.flowSelected?.id || data?.data?.flowId || "";
        setSelectedFlowId(existingId ? String(existingId) : "");
        setActiveModal(true);
      } catch (error) {
        toast.error("Nao foi possivel carregar os fluxos");
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    loadFlows();

    return () => {
      isMounted.current = false;
    };
  }, [open, data, currentFlowId]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    const selected = flows.find(item => Number(item.id) === Number(selectedFlowId));

    if (!selected) {
      return toast.error("Selecione um fluxo valido");
    }

    const payload = {
      flowId: selected.id,
      flowSelected: {
        id: selected.id,
        name: selected.name
      }
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

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>
              {open === "create" ? "Adicionar troca de fluxo" : "Editar troca de fluxo"}
            </Typography>
            <Typography className={classes.subtitle}>
              Escolha o fluxo de destino que sera iniciado em seguida
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
          {loading ? (
            <Stack alignItems="center" padding={2}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <FormControl fullWidth variant="outlined">
              <InputLabel id="flow-switch-select-label">Fluxo de destino</InputLabel>
              <Select
                labelId="flow-switch-select-label"
                value={selectedFlowId}
                onChange={e => setSelectedFlowId(String(e.target.value))}
                label="Fluxo de destino"
              >
                {flows.map(flow => (
                  <MenuItem key={flow.id} value={String(flow.id)}>
                    {flow.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            onClick={handleSave}
            color="primary"
            variant="contained"
            className={classes.primaryButton}
            disabled={loading}
          >
            {open === "create" ? "Adicionar" : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderAddSwitchFlowModal;
