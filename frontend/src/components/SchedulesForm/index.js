import React, { useState, useEffect } from "react";
import { makeStyles, TextField, Grid } from "@material-ui/core";
import { Formik, Form, FastField, FieldArray } from "formik";
import { isArray } from "lodash";
import NumberFormat from "react-number-format";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },

  // ── Day card ──────────────────────────────────────────────────────────────
  dayCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.015)",
    padding: theme.spacing(1.5),
    height: "100%",
    boxSizing: "border-box",
  },

  // ── Field overrides ───────────────────────────────────────────────────────
  field: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      fontSize: "0.82rem",
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor:
          theme.palette.type === "dark" ? "#475569" : "#94a3b8",
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderWidth: 1.5,
      },
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.8rem",
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.82rem",
      padding: "9px 12px",
    },
    "& .MuiSelect-outlined": {
      padding: "9px 12px",
      fontSize: "0.82rem",
    },
  },

  // Day name field — disabled styling
  dayNameField: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.03)"
          : "rgba(15,23,42,0.03)",
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.82rem",
      fontWeight: 600,
      padding: "8px 12px",
      color:
        theme.palette.type === "dark" ? "#cbd5e1 !important" : "#334155 !important",
      "-webkit-text-fill-color":
        theme.palette.type === "dark" ? "#cbd5e1 !important" : "#334155 !important",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "transparent !important",
    },
  },

  // Time input — compact monospace
  timeField: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      fontSize: "0.82rem",
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor:
          theme.palette.type === "dark" ? "#475569" : "#94a3b8",
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderWidth: 1.5,
      },
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.75rem",
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.82rem",
      fontFamily: "'Roboto Mono', monospace",
      letterSpacing: "0.04em",
      padding: "8px 10px",
      textAlign: "center",
    },
  },

  // ── Mode pills ────────────────────────────────────────────────────────────
  modePills: {
    display: "flex",
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    width: "100%",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.02)",
  },
  modePill: {
    flex: 1,
    padding: "6px 4px",
    fontSize: "0.72rem",
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    border: "none",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "background-color 0.15s, color 0.15s",
    whiteSpace: "nowrap",
    textAlign: "center",
    "&:last-child": { borderRight: "none" },
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.05)",
    },
  },
  modePillOpen: {
    backgroundColor: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    fontWeight: 700,
  },
  modePillClosed: {
    backgroundColor: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    fontWeight: 700,
  },
  modePillHours: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(99,102,241,0.10)",
    color: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    fontWeight: 700,
  },

  // ── Save button ───────────────────────────────────────────────────────────
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: theme.spacing(2),
    marginTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

function SchedulesForm(props) {
  const { initialValues, onSubmit, loading, labelSaveButton, enableDayMode = false } = props;
  const classes = useStyles();

  const [schedules, setSchedules] = useState([
    { weekday: i18n.t("queueModal.serviceHours.monday"),    weekdayEn: "monday",    dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.tuesday"),   weekdayEn: "tuesday",   dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.wednesday"), weekdayEn: "wednesday", dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.thursday"),  weekdayEn: "thursday",  dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.friday"),    weekdayEn: "friday",    dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.saturday"),  weekdayEn: "saturday",  dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
    { weekday: i18n.t("queueModal.serviceHours.sunday"),    weekdayEn: "sunday",    dayMode: "hours", startTimeA: "", endTimeA: "", startTimeB: "", endTimeB: "" },
  ]);

  useEffect(() => {
    if (isArray(initialValues) && initialValues.length > 0) {
      setSchedules(
        initialValues
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            ...item,
            dayMode: item?.dayMode || "hours",
            startTimeA: item?.startTimeA || "",
            endTimeA: item?.endTimeA || "",
            startTimeB: item?.startTimeB || "",
            endTimeB: item?.endTimeB || "",
          }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const handleSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <Formik
      enableReinitialize
      initialValues={{ schedules }}
      onSubmit={({ schedules }) =>
        setTimeout(() => handleSubmit(schedules), 500)
      }
    >
      {({ values, setFieldValue }) => (
        <Form className={classes.root}>
          <FieldArray name="schedules">
            {() => (
              <Grid container spacing={2}>
                {values.schedules.map((item, index) => (
                  <Grid key={index} xs={12} sm={6} md={4} item>
                    <div className={classes.dayCard}>
                      <Grid container spacing={1}>

                        {/* Day name */}
                        <Grid item xs={12}>
                          <FastField
                            as={TextField}
                            name={`schedules[${index}].weekday`}
                            disabled
                            variant="outlined"
                            size="small"
                            className={classes.dayNameField}
                          />
                        </Grid>

                        {/* Mode pills */}
                        {enableDayMode && (
                          <Grid item xs={12}>
                            <div className={classes.modePills}>
                              {[
                                { value: "open",   label: "Aberto",   active: classes.modePillOpen   },
                                { value: "closed", label: "Fechado",  active: classes.modePillClosed },
                                { value: "hours",  label: "Horário",  active: classes.modePillHours  },
                              ].map(({ value, label, active }) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`${classes.modePill} ${values.schedules[index]?.dayMode === value ? active : ""}`}
                                  onClick={() => setFieldValue(`schedules[${index}].dayMode`, value)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </Grid>
                        )}

                        {/* Time fields */}
                        {(!enableDayMode || values.schedules[index]?.dayMode === "hours") && (
                          <>
                            <Grid item xs={6}>
                              <FastField name={`schedules[${index}].startTimeA`}>
                                {({ field }) => (
                                  <NumberFormat
                                    {...field}
                                    customInput={TextField}
                                    format="##:##"
                                    variant="outlined"
                                    size="small"
                                    label={i18n.t("queueModal.serviceHours.startTimeA")}
                                    className={classes.timeField}
                                    placeholder="00:00"
                                  />
                                )}
                              </FastField>
                            </Grid>
                            <Grid item xs={6}>
                              <FastField name={`schedules[${index}].endTimeA`}>
                                {({ field }) => (
                                  <NumberFormat
                                    {...field}
                                    customInput={TextField}
                                    format="##:##"
                                    variant="outlined"
                                    size="small"
                                    label={i18n.t("queueModal.serviceHours.endTimeA")}
                                    className={classes.timeField}
                                    placeholder="00:00"
                                  />
                                )}
                              </FastField>
                            </Grid>
                            <Grid item xs={6}>
                              <FastField name={`schedules[${index}].startTimeB`}>
                                {({ field }) => (
                                  <NumberFormat
                                    {...field}
                                    customInput={TextField}
                                    format="##:##"
                                    variant="outlined"
                                    size="small"
                                    label={i18n.t("queueModal.serviceHours.startTimeB")}
                                    className={classes.timeField}
                                    placeholder="00:00"
                                  />
                                )}
                              </FastField>
                            </Grid>
                            <Grid item xs={6}>
                              <FastField name={`schedules[${index}].endTimeB`}>
                                {({ field }) => (
                                  <NumberFormat
                                    {...field}
                                    customInput={TextField}
                                    format="##:##"
                                    variant="outlined"
                                    size="small"
                                    label={i18n.t("queueModal.serviceHours.endTimeB")}
                                    className={classes.timeField}
                                    placeholder="00:00"
                                  />
                                )}
                              </FastField>
                            </Grid>
                          </>
                        )}

                      </Grid>
                    </div>
                  </Grid>
                ))}
              </Grid>
            )}
          </FieldArray>

          <div className={classes.buttonContainer}>
            <ButtonWithSpinner
              loading={loading}
              type="button"
              color="primary"
              variant="contained"
              onClick={() => handleSubmit(values.schedules)}
            >
              {labelSaveButton ?? i18n.t("whatsappModal.buttons.okEdit")}
            </ButtonWithSpinner>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default SchedulesForm;
