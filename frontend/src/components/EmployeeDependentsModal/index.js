import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Grid,
  CircularProgress,
} from "@material-ui/core";
import { DeleteOutline, Add } from "@material-ui/icons";
import useEmployees from "../../hooks/useEmployees";
import toastError from "../../errors/toastError";

// Dependentes do Funcionário (RH — Fase 2, ver docs/MANUAL_TECNICO.md) —
// cadastro completo (nome, CPF, nascimento), usado pra dedução do IRRF
// na Folha Mensal. Modal pequeno e dedicado — não encaixa no
// FinanceRecordModal genérico (não suporta uma sublista dentro do
// formulário).
const emptyForm = { name: "", cpf: "", birthDate: "" };

const EmployeeDependentsModal = ({ open, onClose, employee }) => {
  const { dependents } = useEmployees();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const data = await dependents.list(employee.id);
      setList(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (dep) => {
    setEditingId(dep.id);
    setForm({ name: dep.name || "", cpf: dep.cpf || "", birthDate: dep.birthDate || "" });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.warn("Preencha o nome do dependente.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await dependents.update(employee.id, editingId, form);
      } else {
        await dependents.save(employee.id, form);
      }
      toast.success("Dependente salvo!");
      resetForm();
      fetchList();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await dependents.remove(employee.id, id);
      toast.success("Dependente removido!");
      if (editingId === id) resetForm();
      fetchList();
    } catch (err) {
      toastError(err);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dependentes — {employee?.name}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="textSecondary" paragraph>
          Usado pra calcular o desconto de IRRF na Folha Mensal (R$ por
          dependente, conforme a tabela vigente).
        </Typography>

        <Grid container spacing={1} alignItems="center" style={{ marginBottom: 16 }}>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="CPF"
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="Nascimento"
              type="date"
              value={form.birthDate ? String(form.birthDate).slice(0, 10) : ""}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              variant="outlined"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={1}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              fullWidth
              onClick={handleSave}
              disabled={saving}
              startIcon={!editingId ? <Add /> : undefined}
            >
              {saving ? <CircularProgress size={18} /> : editingId ? "Salvar" : "Add"}
            </Button>
          </Grid>
        </Grid>
        {editingId && (
          <Button size="small" onClick={resetForm} style={{ marginBottom: 8 }}>
            Cancelar edição
          </Button>
        )}

        {loading ? (
          <CircularProgress size={24} />
        ) : list.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhum dependente cadastrado.
          </Typography>
        ) : (
          <List dense>
            {list.map((dep) => (
              <ListItem key={dep.id} divider>
                <ListItemText
                  primary={dep.name}
                  secondary={[dep.cpf, dep.birthDate ? String(dep.birthDate).slice(0, 10) : null]
                    .filter(Boolean)
                    .join(" — ")}
                  onClick={() => handleEdit(dep)}
                  style={{ cursor: "pointer" }}
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => handleDelete(dep.id)}>
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeDependentsModal;
