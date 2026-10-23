import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  TextField,
  Typography
} from "@material-ui/core";
import { DeleteOutline, PhoneDisabled } from "@material-ui/icons";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === "dark";

  return {
    helpText: {
      fontSize: "0.78rem",
      color: isDark ? "#94a3b8" : "#64748b",
      lineHeight: 1.5,
      marginBottom: 14
    },
    addBox: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 14,
      borderRadius: 12,
      border: `1px dashed ${isDark ? "rgba(255,255,255,0.18)" : "rgba(15, 23, 42, 0.2)"}`,
      backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.015)",
      marginBottom: 16
    },
    fieldsRow: {
      display: "flex",
      gap: 8
    },
    emptyState: {
      fontSize: "0.8rem",
      color: isDark ? "#64748b" : "#94a3b8",
      padding: "16px 0",
      textAlign: "center"
    },
    numberText: {
      fontWeight: 600,
      fontSize: "0.82rem",
      color: isDark ? "#f1f5f9" : "#0f172a",
      lineHeight: 1.2
    },
    labelText: {
      fontSize: "0.72rem",
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 1
    }
  };
});

const BlockedNumbersTab = () => {
  const classes = useStyles();

  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/prompt-blocked-numbers");
      setNumbers(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  const handleAdd = async () => {
    if (!number.trim()) {
      toast.warn("Preencha o número.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/prompt-blocked-numbers", {
        number: number.trim(),
        label: label.trim()
      });
      toast.success("Número adicionado à lista!");
      setNumber("");
      setLabel("");
      fetchNumbers();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/prompt-blocked-numbers/${id}`);
      toast.success("Número removido da lista!");
      fetchNumbers();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Box>
      <div className={classes.helpText}>
        Números cadastrados aqui nunca recebem resposta automática da IA —
        nem pela conexão, nem por nó de IA do Flowbuilder. O atendimento
        continua normal, só a resposta automática não dispara pra eles.
      </div>

      <div className={classes.addBox}>
        <div className={classes.fieldsRow}>
          <TextField
            label="Número (com DDI e DDD)"
            placeholder="5511999998888"
            value={number}
            onChange={e => setNumber(e.target.value)}
            variant="outlined"
            margin="dense"
            size="small"
            fullWidth
          />
          <TextField
            label="Etiqueta (opcional)"
            placeholder="Ex.: Dono do negócio"
            value={label}
            onChange={e => setLabel(e.target.value)}
            variant="outlined"
            margin="dense"
            size="small"
            fullWidth
          />
        </div>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleAdd}
          disabled={saving}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? <CircularProgress size={18} /> : "Adicionar"}
        </Button>
      </div>

      {loading ? (
        <Box display="flex" justifyContent="center" padding={2}>
          <CircularProgress size={24} />
        </Box>
      ) : numbers.length === 0 ? (
        <Typography className={classes.emptyState}>
          Nenhum número bloqueado ainda.
        </Typography>
      ) : (
        <List dense>
          {numbers.map(item => (
            <ListItem key={item.id} divider>
              <PhoneDisabled
                fontSize="small"
                style={{ marginRight: 10, color: "#64748b" }}
              />
              <ListItemText
                primary={item.number}
                secondary={item.label || null}
                primaryTypographyProps={{ className: classes.numberText }}
                secondaryTypographyProps={{ className: classes.labelText }}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleDelete(item.id)}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default BlockedNumbersTab;
