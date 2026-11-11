import React, { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";
import MemberEditForm from "../../components/ContactModal/MemberEditForm";

// Modal de edição da tela cheia "Gerenciador CAC" (pages/Members) —
// reaproveita o MESMO conteúdo (Dados/Endereço/Financeiro/Documentos/
// Controle de Acesso) da aba do Contato, via MemberEditForm.js. Antes
// desta tela usava o modal genérico de campo-config (FinanceRecordModal),
// que não tinha nenhuma dessas seções — bug real reportado pelo cliente
// (v2.3.275). Criação de um associado NOVO é em duas etapas: primeiro um
// mini-formulário só com Nome/CPF (as outras seções precisam de um
// member.id já existente pra funcionar), depois o modal vira o
// MemberEditForm completo assim que o registro existe. Ver
// docs/MANUAL_TECNICO.md.
const MemberEditDialog = ({ open, memberId, onClose, onSaved }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMember = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const data = await members.show(memberId);
      if (isMounted.current) setMember(data);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    if (open) {
      if (memberId) {
        fetchMember();
      } else {
        setMember(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  const handleCreateBasic = async (values) => {
    setCreating(true);
    try {
      const data = await members.save(values);
      setMember(data);
      toast.success("Associado cadastrado — complete os dados nas abas abaixo.");
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    }
    setCreating(false);
  };

  const handleMemberChange = (updated) => {
    setMember(updated);
    if (onSaved) onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ style: { height: "85vh" } }}>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
          <CircularProgress />
        </Box>
      ) : member ? (
        <>
          <DialogTitle>{member.name}</DialogTitle>
          <MemberEditForm
            member={member}
            onMemberChange={handleMemberChange}
            showIdentityFields
          />
          <DialogActions>
            <Button onClick={onClose}>Fechar</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>Novo associado</DialogTitle>
          <Formik initialValues={{ name: "", document: "" }} onSubmit={handleCreateBasic}>
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Field as={TextField} fullWidth required variant="outlined" size="small" name="name" label="Nome completo" autoFocus />
                  </Grid>
                  <Grid item xs={12}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="document" label="CPF" />
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button type="submit" variant="contained" color="primary" disabled={creating}>
                  {creating ? "Criando..." : "Criar e continuar"}
                </Button>
              </DialogActions>
            </Form>
          </Formik>
        </>
      )}
    </Dialog>
  );
};

export default MemberEditDialog;
