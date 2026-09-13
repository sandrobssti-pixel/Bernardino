import React, { useState, useEffect, useRef } from "react";

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

import { i18n } from "../../translate/i18n";
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
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont",
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

const FlowBuilderKanbanModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [action, setAction] = useState("enter");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open === "edit" || open === "create") {
      (async () => {
        try {
          setLoading(true);
          const { data: response } = await api.get("/tags/list", {
            params: { kanban: 1 }
          });

          const tagsList = Array.isArray(response) ? response : [];
          setTags(tagsList);

          if (open === "edit") {
            const currentAction = String(data?.data?.action || "enter");
            setAction(currentAction);

            const currentTagId =
              data?.data?.id || data?.data?.tagId || data?.data?.data?.id;

            if (currentTagId) {
              const tag = tagsList.find(item => Number(item.id) === Number(currentTagId));
              if (tag) {
                setSelectedTag(String(tag.id));
              }
            }
          } else {
            setAction("enter");
            setSelectedTag("");
          }

          setActiveModal(true);
        } catch (error) {
          console.log(error);
        } finally {
          setLoading(false);
        }
      })();
    }

    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveKanban = () => {
    if (action === "enter" && !selectedTag) {
      return toast.error("Selecione uma etapa do Kanban");
    }

    let payload = {
      action: action
    };

    if (action === "enter") {
      const tag = tags.find(item => Number(item.id) === Number(selectedTag));

      if (!tag) {
        return toast.error("Etapa do Kanban inválida");
      }

      payload = {
        ...payload,
        id: tag.id,
        tagId: tag.id,
        name: tag.name,
        color: tag.color
      };
    }

    if (open === "edit") {
      onUpdate({
        ...data,
        data: payload
      });
    } else if (open === "create") {
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
        maxWidth="md"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>
              {open === "create" ? "Adicionar Kanban ao fluxo" : "Editar Kanban do fluxo"}
            </Typography>
            <Typography className={classes.subtitle}>
              Defina se o ticket entra em uma etapa do kanban ou sai do kanban
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
            <Stack spacing={2}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="flow-kanban-action-label">Ação</InputLabel>
                <Select
                  labelId="flow-kanban-action-label"
                  value={action}
                  onChange={e => setAction(String(e.target.value))}
                  label="Ação"
                >
                  <MenuItem value="enter">Entrar no Kanban</MenuItem>
                  <MenuItem value="remove">Remover do Kanban</MenuItem>
                </Select>
              </FormControl>

              {action === "enter" && (
                <Select
                  value={selectedTag}
                  onChange={e => setSelectedTag(String(e.target.value))}
                  fullWidth
                  variant="outlined"
                  displayEmpty
                  renderValue={value => {
                    if (!value) return "Selecione uma etapa do Kanban";
                    const tag = tags.find(q => Number(q.id) === Number(value));
                    return tag ? tag.name : "";
                  }}
                >
                  {tags.map(tag => (
                    <MenuItem key={tag.id} value={String(tag.id)}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: tag.color || "#64748b",
                            display: "inline-block"
                          }}
                        />
                        <span>{tag.name}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            variant="outlined"
            className={classes.secondaryButton}
          >
            {i18n.t("contactModal.buttons.cancel")}
          </Button>
          <Button
            onClick={handleSaveKanban}
            color="primary"
            variant="contained"
            className={classes.primaryButton}
          >
            {open === "create" ? "Adicionar" : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderKanbanModal;
