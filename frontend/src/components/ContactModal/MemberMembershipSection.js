import React, { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import AddIcon from "@material-ui/icons/Add";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";

const formatDate = (value) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const RECEIVABLE_STATUS_LABELS = {
  pending: "Pendente",
  received: "Paga",
};

const RECEIVABLE_STATUS_COLORS = {
  pending: "default",
  received: "primary",
};

// Aba "Financeiro" do Gerenciador CAC — reaproveita o módulo Financeiro
// que já existe (Conta a Receber), confirmado com o cliente, em vez de
// um controle de pagamento separado. "Declaração de Filiação" é
// calculada no backend (Member.filiationValidUntil, estendido
// automaticamente quando a cobrança é paga — hook em
// FinanceReceivable.ts) — esta tela só EXIBE, nunca edita esse campo
// direto. Ver docs/MANUAL_TECNICO.md.
const MemberMembershipSection = ({ member, onMemberUpdate }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.listMembershipCharges(member.id);
      if (isMounted.current) setCharges(data);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  useEffect(() => {
    fetchCharges();
  }, [fetchCharges]);

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const data = await members.generateMembershipCharge(member.id, {
        periodMonths: Number(values.periodMonths) || 12,
        value: values.value,
        dueDate: values.dueDate || undefined,
        description: values.description || undefined,
      });
      setCharges((prev) => [data, ...prev]);
      toast.success("Cobrança de filiação gerada. Confirme o pagamento normalmente no módulo Financeiro.");
      setDialogOpen(false);
      if (onMemberUpdate) onMemberUpdate();
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const valid = member.filiationValidUntil && new Date(`${member.filiationValidUntil}T00:00:00`) >= new Date();

  return (
    <Box>
      <Paper
        variant="outlined"
        style={{
          padding: 16,
          marginBottom: 16,
          backgroundColor: valid ? "rgba(14, 164, 115, 0.06)" : "rgba(0,0,0,0.035)",
          borderColor: valid ? "#0ea473" : undefined,
        }}
      >
        <Box display="flex" alignItems="center" gridGap={8}>
          {valid && <CheckCircleIcon style={{ color: "#0ea473" }} />}
          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
            Declaração de Filiação:{" "}
            {member.filiationValidUntil ? `válida até ${formatDate(member.filiationValidUntil)}` : "sem filiação paga ainda"}
          </Typography>
        </Box>
        <Typography variant="caption" color="textSecondary">
          Calculada pelas cobranças de filiação pagas abaixo — vale até o fim do período coberto pela última paga.
        </Typography>
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
          Cobranças de filiação
        </Typography>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Gerar cobrança de filiação
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={22} />
        </Box>
      ) : charges.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          Nenhuma cobrança de filiação gerada ainda.
        </Typography>
      ) : (
        <List dense>
          {charges.map((charge) => (
            <ListItem key={charge.id} divider>
              <ListItemText
                primary={charge.receivable?.description}
                secondary={
                  `Cobre o período de ${formatDate(charge.coverageStart)} até ${formatDate(charge.coverageEnd)}` +
                  (charge.receivable?.dueDate ? ` — vencimento ${formatDate(charge.receivable.dueDate)}` : "")
                }
              />
              <Chip
                size="small"
                label={RECEIVABLE_STATUS_LABELS[charge.receivable?.status] || charge.receivable?.status}
                color={RECEIVABLE_STATUS_COLORS[charge.receivable?.status] || "default"}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Gerar cobrança de filiação</DialogTitle>
        <Formik
          initialValues={{ periodMonths: 12, value: "", dueDate: "", description: "" }}
          onSubmit={handleSubmit}
        >
          <Form>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="number"
                    name="periodMonths"
                    label="Período (meses)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="value" label="Valor (R$)" />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="date"
                    name="dueDate"
                    label="Vencimento"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="description"
                    label="Descrição (opcional)"
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" color="primary" disabled={saving}>
                {saving ? "Gerando..." : "Gerar cobrança"}
              </Button>
            </DialogActions>
          </Form>
        </Formik>
      </Dialog>
    </Box>
  );
};

export default MemberMembershipSection;
