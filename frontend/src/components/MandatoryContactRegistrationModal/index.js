import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const RegistrationSchema = Yup.object().shape({
  name: Yup.string().required("Obrigatório"),
  email: Yup.string().email("E-mail inválido").required("Obrigatório"),
  document: Yup.string().required("Obrigatório"),
  address: Yup.string().required("Obrigatório"),
  contact2: Yup.string().required("Obrigatório"),
  kanbanTagId: Yup.string().required("Obrigatório"),
});

// Cadastro obrigatório de cliente novo/número trocado antes de fechar o
// atendimento (ver docs/MANUAL_TECNICO.md, seção 14). Aberto
// automaticamente quando o backend recusa o fechamento com
// ERR_CONTACT_REGISTRATION_REQUIRED — preenche os campos que faltam e
// escolhe a coluna do Kanban (tag) pra onde esse cliente deve ir; ao
// salvar, tenta fechar o atendimento de novo.
const MandatoryContactRegistrationModal = ({ open, ticket, onSaved }) => {
  const [kanbanTags, setKanbanTags] = useState([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await api.get("/tag/kanban/");
        setKanbanTags(data?.lista || data || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [open]);

  if (!ticket?.contact) return null;

  const contact = ticket.contact;

  const initialValues = {
    name: contact.name || "",
    email: contact.email || "",
    document: contact.document || "",
    address: contact.address || "",
    contact2: contact.contact2 || "",
    kanbanTagId: "",
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await api.put(`/contacts/${contact.id}`, {
        name: values.name,
        email: values.email,
        document: values.document,
        address: values.address,
        contact2: values.contact2,
      });

      // Mesmo padrão usado no drag-and-drop do Kanban (pages/Kanban/index.js):
      // remove qualquer tag de kanban anterior antes de aplicar a nova.
      try {
        await api.delete(`/ticket-tags/${ticket.id}`);
      } catch (err) {
        // Sem problema se o ticket ainda não tinha nenhuma tag de kanban.
      }
      await api.put(`/ticket-tags/${ticket.id}/${values.kanbanTagId}`);

      toast.success("Cadastro concluído — encaminhado para o Kanban.");
      setSubmitting(false);
      onSaved();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  // Mandatório de verdade: não fecha clicando fora nem apertando Esc — só
  // sai depois de salvar (ou se algum código externo desmontar o modal).
  return (
    <Dialog
      open={open}
      onClose={() => {}}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>Cadastro obrigatório do cliente</DialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={RegistrationSchema}
        onSubmit={handleSubmit}
      >
        {({ touched, errors, isSubmitting }) => (
          <Form>
            <DialogContent dividers={false}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Este é um cliente novo (ou que trocou de número) — complete o cadastro
                e escolha a coluna do Kanban para onde ele deve ir antes de fechar o
                atendimento.
              </Typography>
              <Grid container spacing={2} style={{ marginTop: 8 }}>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Nome completo"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="E-mail"
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="CPF ou Identidade"
                    name="document"
                    error={touched.document && Boolean(errors.document)}
                    helperText={touched.document && errors.document}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Contato de WhatsApp"
                    value={contact.number || ""}
                    disabled
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    multiline
                    minRows={2}
                    label="Endereço completo"
                    name="address"
                    error={touched.address && Boolean(errors.address)}
                    helperText={touched.address && errors.address}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Contato 2"
                    name="contact2"
                    error={touched.contact2 && Boolean(errors.contact2)}
                    helperText={touched.contact2 && errors.contact2}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    select
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Coluna do Kanban"
                    name="kanbanTagId"
                    error={touched.kanbanTagId && Boolean(errors.kanbanTagId)}
                    helperText={touched.kanbanTagId && errors.kanbanTagId}
                  >
                    {kanbanTags.map((tag) => (
                      <MenuItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button type="submit" color="primary" variant="contained" disabled={isSubmitting} fullWidth>
                {isSubmitting ? <CircularProgress size={20} /> : "Salvar e fechar atendimento"}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default MandatoryContactRegistrationModal;
