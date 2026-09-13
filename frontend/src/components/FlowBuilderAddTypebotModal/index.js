import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import { Grid, Paper } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

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
    }
  },

  dialogActions: {
    padding: "14px 20px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10,
    background: dark ? "rgba(15, 23, 42, 0.4)" : undefined
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

const DialogflowSchema = Yup.object().shape({
  name: Yup.string().min(2).max(50).required("Required")
});

const FlowBuilderTypebotModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const initialState = {
    type: "typebot",
    name: "",
    projectName: "",
    jsonContent: "",
    language: "",
    urlN8N: "",
    typebotDelayMessage: 1000,
    typebotExpires: 1,
    typebotKeywordFinish: "",
    typebotKeywordRestart: "",
    typebotRestartMessage: "",
    typebotSlug: "",
    typebotUnknownMessage: ""
  };

  const [activeModal, setActiveModal] = useState(false);
  const [integration, setIntegration] = useState();
  const [labels, setLabels] = useState({
    title: "Adicionar Typebot ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({ title: "Editar Typebot ao fluxo", btn: "Salvar" });
      setIntegration({ ...data.data.typebotIntegration });
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: "Adicionar Typebot ao fluxo", btn: "Adicionar" });
      setIntegration(initialState);
      setActiveModal(true);
    }

    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveDialogFlow = values => {
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { typebotIntegration: { ...values } }
      });
    } else if (open === "create") {
      values.projectName = values.name;
      handleClose();
      onSave({
        typebotIntegration: values
      });
    }
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
            <Typography className={classes.title}>{labels.title}</Typography>
            <Typography className={classes.subtitle}>
              Configure a integração com o Typebot
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

        <Formik
          initialValues={integration}
          enableReinitialize
          validationSchema={DialogflowSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveDialogFlow(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ isSubmitting }) => (
            <Form>
              <Paper square elevation={0}>
                <DialogContent className={classes.dialogContent} dividers>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.name")}
                        name="name"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.urlN8N")}
                        name="urlN8N"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotSlug")}
                        name="typebotSlug"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        required
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotExpires")}
                        name="typebotExpires"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotDelayMessage")}
                        name="typebotDelayMessage"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotKeywordFinish")}
                        name="typebotKeywordFinish"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotKeywordRestart")}
                        name="typebotKeywordRestart"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotUnknownMessage")}
                        name="typebotUnknownMessage"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueIntegrationModal.form.typebotRestartMessage")}
                        name="typebotRestartMessage"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </DialogContent>
              </Paper>

              <DialogActions className={classes.dialogActions}>
                <Button
                  onClick={handleClose}
                  variant="outlined"
                  className={classes.secondaryButton}
                >
                  {i18n.t("contactModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={isSubmitting}
                  className={classes.primaryButton}
                >
                  {labels.btn}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default FlowBuilderTypebotModal;
