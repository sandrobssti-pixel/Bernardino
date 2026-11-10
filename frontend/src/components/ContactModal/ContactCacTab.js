import React, { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Avatar from "@material-ui/core/Avatar";
import PersonIcon from "@material-ui/icons/Person";

import toastError from "../../errors/toastError";
import useMembers from "../../hooks/useMembers";
import {
  CAC_CATEGORY_OPTIONS,
  CAC_CATEGORY_INFO,
  STATUS_OPTIONS,
} from "../../pages/Members/membersConfig";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2, 2.5),
    flex: "1 1 auto",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  photoRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

// Aba "Gerenciador CAC" dentro do ContactModal — pedido explícito do
// cliente (v2.3.269): em vez de uma tela separada pra editar o Associado
// vinculado a este Contato, tudo acontece aqui, sem navegar pra outro
// lugar. Completamente independente do Formik do Contato (próprio estado,
// próprio botão de salvar, nunca dá submit no formulário do Contato por
// engano — botão abaixo é type="button").
const ContactCacTab = ({ contactId }) => {
  const classes = useStyles();
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMember = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.getByContact(contactId);
      if (isMounted.current) setMember(data);
    } catch (err) {
      if (isMounted.current) setMember(null);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  useEffect(() => {
    if (contactId) fetchMember();
  }, [contactId, fetchMember]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await members.linkFromContact(contactId);
      setMember(data);
      toast.success("Perfil CAC criado para este contato.");
    } catch (err) {
      toastError(err);
    }
    setCreating(false);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      // "name" não é editável nesta aba (é o nome do Contato, editado em
      // "Dados principais") — mas MemberService.update valida o objeto
      // inteiro que recebe (name obrigatório), mesmo padrão usado pelo
      // formulário completo do Gerenciador CAC. Sem reenviar o que já
      // existe, a validação rejeitaria um payload parcial.
      const data = await members.update(member.id, {
        ...values,
        name: member.name,
        phone: member.phone,
        email: member.email,
        whatsapp: member.whatsapp,
      });
      setMember(data);
      toast.success("Dados do CAC salvos.");
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { photoUrl, status } = await members.uploadPhoto(member.id, file);
      setMember((prev) => ({ ...prev, photoUrl, status }));
    } catch (err) {
      toastError(err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" className={classes.root}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!member) {
    return (
      <Box className={classes.root} textAlign="center" py={4}>
        <Typography variant="body1" gutterBottom>
          Este contato ainda não tem um perfil no Gerenciador CAC.
        </Typography>
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={creating}
          onClick={handleCreate}
        >
          {creating ? "Criando..." : "Criar perfil CAC pra este contato"}
        </Button>
      </Box>
    );
  }

  return (
    <Formik
      initialValues={{
        document: member.document || "",
        rg: member.rg || "",
        birthDate: member.birthDate || "",
        category: member.category || "",
        cacCategory: member.cacCategory || "none",
        status: member.status || "pending",
        notes: member.notes || "",
      }}
      enableReinitialize
      onSubmit={handleSave}
    >
      {({ values }) => (
        <Form style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
          <div className={classes.root}>
            <div className={classes.photoRow}>
              <Avatar src={member.photoUrl || undefined} style={{ width: 56, height: 56 }}>
                {!member.photoUrl && <PersonIcon />}
              </Avatar>
              <Button type="button" variant="outlined" size="small" component="label">
                Anexar foto
                <input type="file" accept="image/*" hidden onChange={handleUploadPhoto} />
              </Button>
            </div>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Field as={TextField} fullWidth variant="outlined" size="small" name="document" label="CPF" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field as={TextField} fullWidth variant="outlined" size="small" name="rg" label="RG" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="date"
                  name="birthDate"
                  label="Data de nascimento"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  name="category"
                  label="Categoria (ex.: atirador, sócio, aluno)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field as={TextField} select fullWidth variant="outlined" size="small" name="cacCategory" label="Classe CAC (se for clube de tiro)">
                  {CAC_CATEGORY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              {values.cacCategory === "atirador_alto_rendimento" && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    {CAC_CATEGORY_INFO.atirador_alto_rendimento}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Field as={TextField} select fullWidth variant="outlined" size="small" name="status" label="Status">
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Field>
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  fullWidth
                  multiline
                  minRows={3}
                  variant="outlined"
                  size="small"
                  name="notes"
                  label="Observações"
                />
              </Grid>
            </Grid>
          </div>
          <div className={classes.footer}>
            <Button type="submit" variant="contained" color="primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar dados do CAC"}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default ContactCacTab;
