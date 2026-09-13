import React, { useContext, useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import IconButton from "@material-ui/core/IconButton";
import { i18n } from "../../translate/i18n";
import { head } from "lodash";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessageVariablesPicker from "../MessageVariablesPicker";
import ButtonWithSpinner from "../ButtonWithSpinner";

import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";


const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  dialogPaper: {
    borderRadius: 12,
    [theme.breakpoints.down("xs")]: {
      margin: theme.spacing(2),
      width: "calc(100% - 32px)",
      maxHeight: "88vh",
      borderRadius: 10,
    },
  },
  dialogTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    padding: theme.spacing(1.75, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  dialogContent: {
    padding: theme.spacing(2.5),
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.5),
    },
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    minWidth: 120,
  },
  attachRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  fileNameButton: {
    textTransform: "none",
    fontSize: "0.84rem",
    fontWeight: 500,
  },
  dialogActions: {
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1, 1.5, 1.5),
      flexDirection: "column",
      alignItems: "stretch",
      "& > *": {
        marginLeft: "0 !important",
        width: "100%",
      },
      "& > *:not(:first-child)": {
        marginTop: theme.spacing(0.75),
      },
    },
  },
  readOnlyWarning: {
    fontSize: "0.8rem",
    color: theme.palette.warning.dark || "#b45309",
    backgroundColor: theme.mode === "light" ? "#fef3c7" : "rgba(217,119,6,0.15)",
    borderRadius: 8,
    padding: theme.spacing(1, 1.5),
    marginBottom: theme.spacing(1.5),
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.9rem",
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.88rem",
    },
    "& .MuiFormHelperText-root": {
      fontSize: "0.75rem",
    },
  },
}));

const QuickeMessageSchema = Yup.object().shape({
  shortcode: Yup.string().required("Obrigatório"),
});

const QuickMessageDialog = ({ open, onClose, quickemessageId, reload }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const messageInputRef = useRef();

  const initialState = {
    shortcode: "",
    message: "",
    geral: false,
    status: true,
  };

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [quickemessage, setQuickemessage] = useState(initialState);
  const [attachment, setAttachment] = useState(null);
  const attachmentFile = useRef(null);

  useEffect(() => {
    try {
      (async () => {
        if (!quickemessageId) return;

        const { data } = await api.get(`/quick-messages/${quickemessageId}`);

        setQuickemessage((prevState) => {
          return { ...prevState, ...data };
        });
      })();
    } catch (err) {
      toastError(err);
    }
  }, [quickemessageId, open]);

  const handleClose = () => {
    setQuickemessage(initialState);
    setAttachment(null);
    onClose();
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveQuickeMessage = async (values) => {
    const quickemessageData = {
      ...values,
      isMedia: true,
      mediaPath: attachment
        ? String(attachment.name).replace(/ /g, "_")
        : values.mediaPath
        ? values.mediaPath.split("/").pop().replace(/ /g, "_")
        : null,
    };

    try {
      if (quickemessageId) {
        await api.put(`/quick-messages/${quickemessageId}`, quickemessageData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("typeArch", "quickMessage");
          formData.append("file", attachment);
          await api.post(
            `/quick-messages/${quickemessageId}/media-upload`,
            formData
          );
        }
      } else {
        const { data } = await api.post("/quick-messages", quickemessageData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("typeArch", "quickMessage");
          formData.append("file", attachment);
          await api.post(`/quick-messages/${data.id}/media-upload`, formData);
        }
      }
      toast.success(i18n.t("quickMessages.toasts.success"));
      if (typeof reload == "function") {
        reload();
      }
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (quickemessage.mediaPath) {
      await api.delete(`/quick-messages/${quickemessage.id}/media-upload`);
      setQuickemessage((prev) => ({
        ...prev,
        mediaPath: null,
      }));
      toast.success(i18n.t("quickMessages.toasts.deleted"));
      if (typeof reload == "function") {
        reload();
      }
    }
  };

  const handleClickMsgVar = async (msgVar, setValueFunc) => {
    const el = messageInputRef.current;
    const firstHalfText = el.value.substring(0, el.selectionStart);
    const secondHalfText = el.value.substring(el.selectionEnd);
    const newCursorPos = el.selectionStart + msgVar.length;

    setValueFunc("message", `${firstHalfText}${msgVar}${secondHalfText}`);

    await new Promise((r) => setTimeout(r, 100));
    messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("quickMessages.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
          {quickemessageId
            ? i18n.t("quickMessages.dialog.edit")
            : i18n.t("quickMessages.dialog.add")}
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        <Formik
          initialValues={quickemessage}
          enableReinitialize={true}
          validationSchema={QuickeMessageSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveQuickeMessage(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, setFieldValue, values }) => {
            const isReadOnly =
              quickemessageId &&
              values.visao &&
              !values.geral &&
              values.userId !== user.id &&
              user.profile !== "admin";

            return (
              <Form>
                <DialogContent dividers className={classes.dialogContent}>
                  {isReadOnly && (
                    <Typography
                      variant="body2"
                      className={classes.readOnlyWarning}
                    >
                      {i18n.t("quickMessages.dialog.readOnlyWarning")}
                    </Typography>
                  )}
                  <Grid spacing={2} container>
                    <Grid xs={12} item>
                      <Field
                        as={TextField}
                        autoFocus
                        label={i18n.t("quickMessages.dialog.shortcode")}
                        name="shortcode"
                        disabled={isReadOnly}
                        error={touched.shortcode && Boolean(errors.shortcode)}
                        helperText={touched.shortcode && errors.shortcode}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        className={classes.field}
                      />
                    </Grid>
                    <Grid xs={12} item>
                      <Field
                        as={TextField}
                        label={i18n.t("quickMessages.dialog.message")}
                        name="message"
                        inputRef={messageInputRef}
                        error={touched.message && Boolean(errors.message)}
                        helperText={touched.message && errors.message}
                        variant="outlined"
                        margin="dense"
                        disabled={isReadOnly}
                        multiline={true}
                        minRows={7}
                        fullWidth
                        className={classes.field}
                      />
                    </Grid>
                    <Grid item>
                      <MessageVariablesPicker
                        disabled={isSubmitting || isReadOnly}
                        onClick={(value) => handleClickMsgVar(value, setFieldValue)}
                      />
                    </Grid>
                    <Grid xs={12} item>
                      <FormControl variant="outlined" margin="dense" fullWidth className={classes.field}>
                        <InputLabel id="visao-selection-label">
                          {i18n.t("quickMessages.dialog.visao")}
                        </InputLabel>
                        <Field
                          as={Select}
                          label={i18n.t("quickMessages.dialog.visao")}
                          labelId="visao-selection-label"
                          id="visao"
                          disabled={isReadOnly}
                          name="visao"
                          onChange={(e) => {
                            setFieldValue("visao", e.target.value === "true");
                          }}
                          error={touched.visao && Boolean(errors.visao)}
                          value={values.visao ? "true" : "false"}
                        >
                          <MenuItem value="true">{i18n.t("announcements.active")}</MenuItem>
                          <MenuItem value="false">{i18n.t("announcements.inactive")}</MenuItem>
                        </Field>
                      </FormControl>
                      {values.visao === true && (
                        <FormControl variant="outlined" margin="dense" fullWidth className={classes.field}>
                          <InputLabel id="geral-selection-label">
                            {i18n.t("quickMessages.dialog.geral")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("quickMessages.dialog.geral")}
                            labelId="geral-selection-label"
                            id="geral"
                            name="geral"
                            disabled={isReadOnly}
                            value={values.geral ? "true" : "false"}
                            error={touched.geral && Boolean(errors.geral)}
                          >
                            <MenuItem value="true">{i18n.t("announcements.active")}</MenuItem>
                            <MenuItem value="false">{i18n.t("announcements.inactive")}</MenuItem>
                          </Field>
                        </FormControl>
                      )}
                    </Grid>
                    {(quickemessage.mediaPath || attachment) && (
                      <Grid xs={12} item>
                        <div className={classes.attachRow}>
                          <Button
                            startIcon={<AttachFileIcon />}
                            className={classes.fileNameButton}
                          >
                            {attachment ? attachment.name : quickemessage.mediaName}
                          </Button>
                          <IconButton
                            onClick={() => setConfirmationOpen(true)}
                            color="secondary"
                            disabled={isReadOnly}
                            size="small"
                          >
                            <DeleteOutlineIcon color="secondary" />
                          </IconButton>
                        </div>
                      </Grid>
                    )}
                  </Grid>
                </DialogContent>
                <DialogActions className={classes.dialogActions}>
                  {!attachment && !quickemessage.mediaPath && (
                    <Button
                      color="primary"
                      onClick={() => attachmentFile.current.click()}
                      disabled={isSubmitting || isReadOnly}
                      variant="outlined"
                    >
                      {i18n.t("quickMessages.buttons.attach")}
                    </Button>
                  )}
                  <Button
                    onClick={handleClose}
                    color="secondary"
                    disabled={isSubmitting}
                    variant="outlined"
                  >
                    {i18n.t("quickMessages.buttons.cancel")}
                  </Button>
                  <div className={classes.btnWrapper}>
                    <Button
                      type="submit"
                      color="primary"
                      disabled={isSubmitting || isReadOnly}
                      variant="contained"
                    >
                      {quickemessageId
                        ? i18n.t("quickMessages.buttons.edit")
                        : i18n.t("quickMessages.buttons.add")}
                    </Button>
                    {isSubmitting && (
                      <CircularProgress size={24} className={classes.buttonProgress} />
                    )}
                  </div>
                </DialogActions>
              </Form>
            );
          }}
        </Formik>
      </Dialog>
    </div>
  );
};

export default QuickMessageDialog;
