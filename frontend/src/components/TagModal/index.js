import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { alpha, makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import { Colorize } from "@material-ui/icons";
import { ColorBox } from "material-ui-color";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select } from "@material-ui/core";
import { Grid } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("xs")]: {
      margin: theme.spacing(2),
      width: "calc(100% - 32px)",
      maxHeight: "92vh",
      borderRadius: 10,
    },
  },
  dialogTitle: {
    padding: theme.spacing(2, 2.2, 1.4),
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(120deg, rgba(20,30,45,1) 0%, rgba(27,43,68,1) 100%)"
        : "linear-gradient(120deg, #f6f9ff 0%, #edf3ff 100%)",
    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.3, 1.5, 1.1),
    },
  },
  titleText: {
    fontSize: "1rem",
    fontWeight: 700,
    lineHeight: 1.3,
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.95rem",
    },
  },
  dialogContent: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.25, 1.5),
      paddingBottom: theme.spacing(3),
    },
  },
  dialogActions: {
    padding: theme.spacing(1.2, 2, 1.8),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.01)" : "#fbfcff",
    flexShrink: 0,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1, 1.5, 1.5),
      flexDirection: "column",
      alignItems: "stretch",
      "& > *": {
        marginLeft: "0 !important",
        width: "100%",
      },
      "& > *:not(:first-child)": {
        marginTop: theme.spacing(1),
      },
    },
  },
  btnWrapper: {
    position: "relative",
    minWidth: 150,
    minHeight: 40,
    borderRadius: 10,
    boxShadow: `0 10px 18px ${alpha(theme.palette.primary.main, 0.25)}`,
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
    margin: 0,
    minWidth: 120,
  },
  colorAdorment: {
    width: 18,
    height: 18,
    borderRadius: 5,
    border: "1px solid rgba(0,0,0,0.12)",
  },
  fieldRoot: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "#f9fbff",
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.9rem",
    },
    "& .MuiInputBase-input": {
      fontSize: "0.92rem",
    },
    "& .MuiFormHelperText-root": {
      fontSize: "0.75rem",
    },
    "& .MuiInputBase-inputMultiline": {
      lineHeight: 1.4,
    },
  },
  cancelButton: {
    borderRadius: 10,
    minWidth: 110,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.85rem",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.82rem",
      minHeight: 38,
    },
  },
  submitButton: {
    textTransform: "none",
    fontSize: "0.85rem",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.82rem",
      minHeight: 38,
    },
  },
  colorPickerTrigger: {
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.09),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    borderRadius: 8,
    padding: 4,
    "&:hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.16),
    },
  },
  colorPickerBox: {
    marginTop: theme.spacing(1.6),
    padding: theme.spacing(1.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "#fbfdff",
  },
}));

const TagSchema = Yup.object().shape({
  name: Yup.string().min(3, "Mensagem muito curta").required("Obrigatório"),
});

const TagModal = ({ open, onClose, tagId, kanban }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [lanes, setLanes] = useState([]);
  const [selectedLane, setSelectedLane] = useState("");
  const [selectedRollbackLane, setSelectedRollbackLane] = useState("");

  const initialState = {
    name: "",
    color: getRandomHexColor(),
    kanban: kanban,
    timeLane: 0,
    timeLaneUnit: "hours",
    nextLaneId: 0,
    greetingMessageLane: "",
    rollbackLaneId: 0,
  };

  const [tag, setTag] = useState(initialState);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const fetchTags = async () => {
        try {
          const { data } = await api.get("/tags/", {
            params: { kanban: 1, tagId },
          });
          setLanes(data.tags);
        } catch (err) {
          toastError(err);
        }
      };
      fetchTags();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, []);

  useEffect(() => {
    try {
      (async () => {
        if (!tagId) return;

        const { data } = await api.get(`/tags/${tagId}`);
        setTag((prevState) => {
          return { ...prevState, ...data };
        });
        if (data.nextLaneId) {
          setSelectedLane(data.nextLaneId);
        }
        if (data.rollbackLaneId) {
          setSelectedRollbackLane(data.rollbackLaneId);
        }
      })();
    } catch (err) {
      toastError(err);
    }
  }, [tagId, open]);

  const handleClose = () => {
    setTag(initialState);
    setSelectedLane("");
    setSelectedRollbackLane("");
    setColorPickerModalOpen(false);
    onClose();
  };

  const handleSaveTag = async (values) => {
    const tagData = {
      ...values,
      userId: user?.id,
      kanban: kanban,
      timeLaneUnit: values.timeLaneUnit || "hours",
      nextLaneId: selectedLane || null,
      rollbackLaneId: selectedRollbackLane || null,
    };

    try {
      if (tagId) {
        await api.put(`/tags/${tagId}`, tagData);
      } else {
        await api.post("/tags", tagData);
      }
      toast.success(kanban === 0 ? `${i18n.t("tagModal.success")}` : `${i18n.t("tagModal.successKanban")}`);
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  function getRandomHexColor() {
    const red = Math.floor(Math.random() * 256);
    const green = Math.floor(Math.random() * 256);
    const blue = Math.floor(Math.random() * 256);
    return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue
      .toString(16)
      .padStart(2, "0")}`;
  }

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
          <Typography className={classes.titleText}>
            {tagId
              ? kanban === 0
                ? `${i18n.t("tagModal.title.edit")}`
                : `${i18n.t("tagModal.title.editKanban")}`
              : kanban === 0
              ? `${i18n.t("tagModal.title.add")}`
              : `${i18n.t("tagModal.title.addKanban")}`}
          </Typography>
        </DialogTitle>
        <Formik
          initialValues={tag}
          enableReinitialize={true}
          validationSchema={TagSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveTag(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers className={classes.dialogContent}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={12} xl={12}>
                    <Field
                      as={TextField}
                      label={i18n.t("tagModal.form.name")}
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      variant="outlined"
                      margin="dense"
                      onChange={(e) => {
                        setFieldValue("name", e.target.value);
                        setTag((prev) => ({ ...prev, name: e.target.value }));
                      }}
                      fullWidth
                      className={classes.fieldRoot}
                    />
                  </Grid>
                  <Grid item xs={12} md={12} xl={12}>
                    <Field
                      as={TextField}
                      fullWidth
                      label={i18n.t("tagModal.form.color")}
                      name="color"
                      autoFocus
                      id="color"
                      error={touched.color && Boolean(errors.color)}
                      helperText={touched.color && errors.color}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <div style={{ backgroundColor: values.color }} className={classes.colorAdorment}></div>
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <IconButton
                            size="small"
                            color="default"
                            onClick={() => setColorPickerModalOpen(!colorPickerModalOpen)}
                            className={classes.colorPickerTrigger}
                          >
                            <Colorize />
                          </IconButton>
                        ),
                      }}
                      variant="outlined"
                      margin="dense"
                      className={classes.fieldRoot}
                    />

                    {colorPickerModalOpen && (
                      <div className={classes.colorPickerBox}>
                        <ColorBox
                          disableAlpha={true}
                          hslGradient={false}
                          style={{ margin: "0 auto" }}
                          value={tag.color}
                          onChange={(val) => {
                            setTag((prev) => ({ ...prev, color: `#${val.hex}` }));
                          }}
                        />
                      </div>
                    )}
                  </Grid>

                  {kanban === 1 && (
                    <>
                      <Grid item xs={7} md={4} xl={4}>
                        <Field
                          as={TextField}
                          label={i18n.t("tagModal.form.timeLane")}
                          name="timeLane"
                          type="number"
                          inputProps={{ min: 0 }}
                          error={touched.timeLane && Boolean(errors.timeLane)}
                          helperText={touched.timeLane && errors.timeLane}
                          variant="outlined"
                          margin="dense"
                          InputLabelProps={{ shrink: true }}
                          onChange={(e) => {
                            setFieldValue("timeLane", e.target.value);
                            setTag((prev) => ({ ...prev, timeLane: e.target.value }));
                          }}
                          fullWidth
                          className={classes.fieldRoot}
                        />
                      </Grid>
                      <Grid item xs={5} md={2} xl={2}>
                        <FormControl variant="outlined" margin="dense" fullWidth className={classes.formControl}>
                          <InputLabel id="time-lane-unit-label">
                            {i18n.t("tagModal.form.timeLaneUnit")}
                          </InputLabel>
                          <Select
                            label={i18n.t("tagModal.form.timeLaneUnit")}
                            labelId="time-lane-unit-label"
                            value={values.timeLaneUnit || "hours"}
                            onChange={(e) => {
                              setFieldValue("timeLaneUnit", e.target.value);
                              setTag((prev) => ({ ...prev, timeLaneUnit: e.target.value }));
                            }}
                          >
                            <MenuItem value="hours">{i18n.t("tagModal.form.timeLaneUnitHours")}</MenuItem>
                            <MenuItem value="minutes">{i18n.t("tagModal.form.timeLaneUnitMinutes")}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6} xl={6} style={{ marginLeft: "auto" }}>
                        <FormControl variant="outlined" margin="dense" fullWidth className={classes.formControl}>
                          <InputLabel id="next-lane-selection-label">
                            {i18n.t("tagModal.form.nextLaneId")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("tagModal.form.nextLaneId")}
                            placeholder={i18n.t("tagModal.form.nextLaneId")}
                            labelId="next-lane-selection-label"
                            id="nextLaneId"
                            name="nextLaneId"
                            error={touched.nextLaneId && Boolean(errors.nextLaneId)}
                            value={selectedLane || ""}
                            onChange={(e) => setSelectedLane(e.target.value || null)}
                          >
                            <MenuItem value="">Selecione uma lane</MenuItem>
                            {lanes &&
                              lanes.map((lane) => (
                                <MenuItem key={lane.id} value={lane.id}>
                                  {lane.name}
                                </MenuItem>
                              ))}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={12} xl={12}>
                        <Field
                          as={TextField}
                          label={i18n.t("tagModal.form.greetingMessageLane")}
                          name="greetingMessageLane"
                          rows={5}
                          multiline
                          error={touched.greetingMessageLane && Boolean(errors.greetingMessageLane)}
                          helperText={touched.greetingMessageLane && errors.greetingMessageLane}
                          variant="outlined"
                          margin="dense"
                          onChange={(e) => {
                            setFieldValue("greetingMessageLane", e.target.value);
                            setTag((prev) => ({ ...prev, greetingMessageLane: e.target.value }));
                          }}
                          fullWidth
                          className={classes.fieldRoot}
                        />
                      </Grid>
                      <Grid item xs={12} md={12} xl={12}>
                        <FormControl variant="outlined" margin="dense" fullWidth className={classes.formControl}>
                          <InputLabel id="rollback-lane-selection-label">
                            {i18n.t("tagModal.form.rollbackLaneId")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("tagModal.form.rollbackLaneId")}
                            placeholder={i18n.t("tagModal.form.rollbackLaneId")}
                            labelId="rollback-lane-selection-label"
                            id="rollbackLaneId"
                            name="rollbackLaneId"
                            error={touched.rollbackLaneId && Boolean(errors.rollbackLaneId)}
                            value={selectedRollbackLane || ""}
                            onChange={(e) => setSelectedRollbackLane(e.target.value)}
                          >
                            <MenuItem value="">Selecione uma lane</MenuItem>
                            {lanes &&
                              lanes.map((lane) => (
                                <MenuItem key={lane.id} value={lane.id}>
                                  {lane.name}
                                </MenuItem>
                              ))}
                          </Field>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions className={classes.dialogActions}>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                  className={classes.cancelButton}
                >
                  {i18n.t("tagModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={`${classes.btnWrapper} ${classes.submitButton}`}
                >
                  {tagId ? `${i18n.t("tagModal.buttons.okEdit")}` : `${i18n.t("tagModal.buttons.okAdd")}`}
                  {isSubmitting && <CircularProgress size={24} className={classes.buttonProgress} />}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default TagModal;
