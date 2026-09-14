import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import CircularProgress from "@material-ui/core/CircularProgress";

import toastError from "../../errors/toastError";

const buildInitialValues = (jobPosting) => ({
  title: jobPosting?.title || "",
  department: jobPosting?.department || "",
  description: jobPosting?.description || "",
  requirements: jobPosting?.requirements || "",
  employmentType: jobPosting?.employmentType || "clt",
  workMode: jobPosting?.workMode || "presencial",
  salaryRange: jobPosting?.salaryRange || "",
  location: jobPosting?.location || "",
  status: jobPosting?.status || "open",
});

// Modal de criação/edição de vaga (Fase 5 — módulo de RH, ver
// docs/MANUAL_TECNICO.md, seção 6.2).
const JobPostingModal = ({ open, onClose, onSave, jobPosting }) => {
  const [initialValues, setInitialValues] = useState(buildInitialValues(null));

  useEffect(() => {
    setInitialValues(buildInitialValues(jobPosting));
  }, [jobPosting, open]);

  const handleClose = () => onClose();

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      await onSave(values);
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{jobPosting?.id ? "Editar vaga" : "Nova vaga"}</DialogTitle>
      <Formik initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <DialogContent dividers={false}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Título da vaga"
                    name="title"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Departamento"
                    name="department"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Field
                    as={TextField}
                    select
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Contrato"
                    name="employmentType"
                  >
                    <MenuItem value="clt">CLT</MenuItem>
                    <MenuItem value="pj">PJ</MenuItem>
                    <MenuItem value="estagio">Estágio</MenuItem>
                    <MenuItem value="temporario">Temporário</MenuItem>
                    <MenuItem value="freelancer">Freelancer</MenuItem>
                  </Field>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Field
                    as={TextField}
                    select
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Modalidade"
                    name="workMode"
                  >
                    <MenuItem value="presencial">Presencial</MenuItem>
                    <MenuItem value="hibrido">Híbrido</MenuItem>
                    <MenuItem value="remoto">Remoto</MenuItem>
                  </Field>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    select
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Status"
                    name="status"
                  >
                    <MenuItem value="open">Aberta</MenuItem>
                    <MenuItem value="paused">Pausada</MenuItem>
                    <MenuItem value="closed">Encerrada</MenuItem>
                  </Field>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Faixa salarial"
                    name="salaryRange"
                    placeholder="Ex: A combinar"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Localização"
                    name="location"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    multiline
                    minRows={3}
                    label="Descrição da vaga"
                    name="description"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    multiline
                    minRows={3}
                    label="Requisitos"
                    name="requirements"
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="primary" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} /> : "Salvar"}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default JobPostingModal;
