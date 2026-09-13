import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  TextField,
  Typography,
  makeStyles,
} from "@material-ui/core";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import EditIcon from "@material-ui/icons/Edit";
import Autocomplete from "@material-ui/lab/Autocomplete";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    padding: theme.spacing(1.4),
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.45)"
        : "rgba(248, 250, 255, 0.95)",
  },
  card: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.62) 100%)"
        : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,248,255,0.96) 100%)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 16px 30px rgba(0, 0, 0, 0.25)"
        : "0 14px 28px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(1.6),
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.8),
  },
  title: {
    fontWeight: 700,
    fontSize: "0.94rem",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginBottom: theme.spacing(1.5),
  },
  field: {
    marginBottom: theme.spacing(1.3),
  },
  helperText: {
    color: theme.palette.text.secondary,
    fontSize: "0.74rem",
    marginTop: theme.spacing(0.8),
  },
  button: {
    marginTop: theme.spacing(1.4),
    borderRadius: 10,
    fontWeight: 700,
    textTransform: "none",
    padding: theme.spacing(1.1, 1.5),
  },
  secondaryButton: {
    marginTop: theme.spacing(1),
    borderRadius: 10,
    fontWeight: 700,
    textTransform: "none",
  },
  dangerButton: {
    marginTop: theme.spacing(1),
    borderRadius: 10,
    fontWeight: 700,
    textTransform: "none",
  },
  divider: {
    marginTop: theme.spacing(1.5),
  },
}));

export default function ChatGroupForm({
  users,
  loading,
  onSubmit,
  mode = "create",
  initialTitle = "",
  initialUsers = [],
  onCancel,
  onDelete,
}) {
  const classes = useStyles();
  const isEdit = mode === "edit";
  const [title, setTitle] = useState(isEdit ? initialTitle : "");
  const [selectedUsers, setSelectedUsers] = useState(isEdit ? initialUsers : []);

  useEffect(() => {
    if (isEdit) {
      setTitle(initialTitle);
    }
  }, [initialTitle, isEdit]);

  useEffect(() => {
    if (isEdit) {
      setSelectedUsers(initialUsers);
    }
  }, [initialUsers, isEdit]);

  const canSubmit = useMemo(
    () => String(title || "").trim().length > 0 && selectedUsers.length >= 1 && !loading,
    [title, selectedUsers, loading]
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      title: String(title || "").trim(),
      users: selectedUsers,
    });
    if (mode === "create") {
      setTitle("");
      setSelectedUsers([]);
    }
  };

  return (
    <div className={classes.mainContainer}>
      <Box className={classes.card}>
        <div className={classes.titleRow}>
          {isEdit ? <EditIcon color="primary" /> : <GroupAddIcon color="primary" />}
          <Typography className={classes.title}>{isEdit ? "Editar Grupo" : "Criar Grupo"}</Typography>
        </div>
        <Typography className={classes.subtitle}>
          {isEdit
            ? "Atualize nome e participantes do grupo. Somente o criador pode fazer alterações."
            : "Monte grupos internos por equipe, setor ou projeto sem afetar o chat direto entre usuários."}
        </Typography>

        <TextField
          className={classes.field}
          fullWidth
          variant="outlined"
          size="small"
          label="Nome do grupo"
          placeholder="Ex.: Suporte N1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Autocomplete
          className={classes.field}
          multiple
          size="small"
          options={Array.isArray(users) ? users : []}
          value={selectedUsers}
          onChange={(e, value) => setSelectedUsers(value)}
          getOptionLabel={(option) => option.name || ""}
          getOptionSelected={(option, value) => Number(option?.id) === Number(value?.id)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                label={option.name}
                {...getTagProps({ index })}
                size="small"
                style={{ fontWeight: 600 }}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              label="Participantes"
              placeholder="Selecione pelo menos 1 usuário"
            />
          )}
        />

        <Typography className={classes.helperText}>
          O criador entra automaticamente no grupo. Selecione ao menos 1 usuário adicional.
        </Typography>

        <Button
          className={classes.button}
          variant="contained"
          color="primary"
          disabled={!canSubmit}
          onClick={handleSubmit}
          fullWidth
        >
          {loading ? (isEdit ? "Salvando grupo..." : "Criando grupo...") : (isEdit ? "Salvar alterações" : "Criar grupo")}
        </Button>

        {isEdit && onCancel && (
          <Button
            className={classes.secondaryButton}
            variant="outlined"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar edição
          </Button>
        )}

        {isEdit && onDelete && (
          <>
            <Divider className={classes.divider} />
            <Button
              className={classes.dangerButton}
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={onDelete}
              disabled={loading}
            >
              Excluir grupo
            </Button>
          </>
        )}
      </Box>
    </div>
  );
}
