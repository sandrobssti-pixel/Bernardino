import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { toast } from "react-toastify";

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
import CircularProgress from "@material-ui/core/CircularProgress";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";

import CloseIcon from "@material-ui/icons/Close";

import { i18n } from "../../translate/i18n";

import toastError from "../../errors/toastError";
import { Stack } from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";

const useStyles = makeStyles(theme => {
  const dark = theme.palette.type === "dark";

  return {
  root: {
    display: "flex",
    flexWrap: "wrap"
  },

  /* ===== Premium Dialog ===== */
  dialogPaper: {
    borderRadius: 14,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    boxShadow: dark ? "0 18px 60px rgba(0, 0, 0, 0.5)" : "0 18px 60px rgba(16, 24, 40, 0.18)",
    overflow: "hidden",
    background: dark ? "#1e293b" : "rgba(255,255,255,0.98)"
  },

  dialogTitle: {
    padding: theme.spacing(1.5, 1.75, 1.25),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(15, 23, 42, 0.08)"
  },

  titleText: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: dark ? "#f1f5f9" : "#0f172a",
    margin: 0
  },

  subtitleText: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif',
    fontWeight: 400,
    fontSize: 12.5,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "rgba(15, 23, 42, 0.62)",
    marginTop: 2
  },

  closeBtn: {
    borderRadius: 10,
    border: dark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(15, 23, 42, 0.10)",
    background: dark ? "rgba(15, 23, 42, 0.5)" : "#ffffff",
    color: dark ? "#e5e7eb" : undefined,
    width: 36,
    height: 36
  },

  dialogContent: {
    padding: theme.spacing(1.5),
    background: dark
      ? "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(30,41,59,0.6) 55%)"
      : "linear-gradient(180deg, rgba(249,250,251,0.85) 0%, rgba(255,255,255,1) 55%)"
  },

  sectionLabel: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif',
    fontWeight: 500,
    fontSize: 12.5,
    color: dark ? "rgba(226, 232, 240, 0.75)" : "rgba(15, 23, 42, 0.70)"
  },

  textField: {
    flex: 1,
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      background: dark ? "rgba(15, 23, 42, 0.4)" : "#ffffff",
      color: dark ? "#f1f5f9" : undefined
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.24)" : "rgba(15, 23, 42, 0.14)"
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(99, 102, 241, 0.35)"
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(99, 102, 241, 0.55)"
    }
  },

  /* Options list */
  optionCard: {
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(15, 23, 42, 0.10)",
    background: dark ? "rgba(15, 23, 42, 0.35)" : "rgba(255,255,255,0.96)",
    borderRadius: 14,
    padding: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1)
  },

  optionRow: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center"
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: dark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(15, 23, 42, 0.10)",
    background: dark ? "rgba(15, 23, 42, 0.5)" : "#ffffff",
    color: dark ? "#e5e7eb" : undefined
  },

  /* Add option button */
  addOptionBtn: {
    borderRadius: 12,
    padding: theme.spacing(0.8, 1.25),
    textTransform: "none",
    fontWeight: 500,
    boxShadow: "0 10px 22px rgba(16, 24, 40, 0.10)"
  },

  /* Footer */
  dialogActions: {
    padding: theme.spacing(1.25, 1.75),
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(15, 23, 42, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.4)" : "#ffffff"
  },

  actionBtn: {
    borderRadius: 12,
    padding: theme.spacing(0.9, 1.5),
    textTransform: "none",
    fontWeight: 500,
    boxShadow: "0 10px 22px rgba(16, 24, 40, 0.10)"
  },

  actionBtnSecondary: {
    borderRadius: 12,
    padding: theme.spacing(0.9, 1.5),
    textTransform: "none",
    fontWeight: 500
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  },

  emptyOptions: {
    border: dark ? "1px dashed rgba(148, 163, 184, 0.3)" : "1px dashed rgba(15, 23, 42, 0.18)",
    borderRadius: 14,
    padding: 14,
    color: dark ? "rgba(226, 232, 240, 0.6)" : "rgba(15, 23, 42, 0.55)",
    fontSize: 12.5,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif'
  }
  };
});

/**
 * (Mantido por compatibilidade - embora não esteja sendo usado aqui)
 */
const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Muito curto!")
    .max(50, "Muito longo!")
    .required("Digite um nome!"),
  text: Yup.string()
    .min(2, "Muito curto!")
    .max(50, "Muito longo!")
    .required("Digite uma mensagem!")
});

const FlowBuilderMenuModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [textDig, setTextDig] = useState("");
  const [arrayOption, setArrayOption] = useState([]);
  const [includeMainMenuOption, setIncludeMainMenuOption] = useState(false);
  const [mainMenuOptionText, setMainMenuOptionText] = useState(
    "Retornar ao Menu Principal"
  );
  const [includeExitOption, setIncludeExitOption] = useState(false);
  const [exitOptionText, setExitOptionText] = useState("Encerrar atendimento");

  const [labels, setLabels] = useState({
    title: "Adicionar menu ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar menu",
        btn: "Salvar"
      });
      setTextDig(data?.data?.message || "");
      setArrayOption(data?.data?.arrayOption || []);
      setIncludeMainMenuOption(Boolean(data?.data?.includeMainMenuOption));
      setMainMenuOptionText(
        String(data?.data?.mainMenuOptionText || "Retornar ao Menu Principal")
      );
      setIncludeExitOption(Boolean(data?.data?.includeExitOption));
      setExitOptionText(
        String(data?.data?.exitOptionText || "Encerrar atendimento")
      );
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar menu ao fluxo",
        btn: "Adicionar"
      });
      setTextDig("");
      setArrayOption([]);
      setIncludeMainMenuOption(false);
      setMainMenuOptionText("Retornar ao Menu Principal");
      setIncludeExitOption(false);
      setExitOptionText("Encerrar atendimento");
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    try {
      if (open === "edit") {
        handleClose();
        onUpdate({
          ...data,
          data: {
            message: textDig,
            arrayOption: arrayOption,
            includeMainMenuOption,
            mainMenuOptionText,
            includeExitOption,
            exitOptionText
          }
        });
        return;
      }
      if (open === "create") {
        handleClose();
        onSave({
          message: textDig,
          arrayOption: arrayOption,
          includeMainMenuOption,
          mainMenuOptionText,
          includeExitOption,
          exitOptionText
        });
      }
    } catch (err) {
      toastError(err);
    }
  };

  const addOption = () => {
    setArrayOption(old => [...old, { number: old.length + 1, value: "" }]);
  };

  const removeOption = number => {
    setArrayOption(old => old.filter(item => item.number !== number));
  };

  const updateOptionValue = (index, value) => {
    setArrayOption(old => {
      const newArr = [...old];
      if (!newArr[index]) return old;
      newArr[index] = { ...newArr[index], value };
      return newArr;
    });
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle disableTypography className={classes.dialogTitle}>
          <div>
            <Typography className={classes.titleText}>{labels.title}</Typography>
            <div className={classes.subtitleText}>
              Defina a mensagem e as opções que o usuário poderá escolher.
            </div>
          </div>

          <IconButton
            onClick={handleClose}
            className={classes.closeBtn}
            aria-label="Fechar"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className={classes.dialogContent}>
          <Stack style={{ gap: 12 }}>
            <Typography className={classes.sectionLabel}>
              Mensagem de explicação do menu
            </Typography>

            <TextField
              rows={4}
              multiline
              variant="outlined"
              value={textDig}
              onChange={e => setTextDig(e.target.value)}
              className={classes.textField}
              style={{ width: "100%" }}
              placeholder="Ex: Escolha uma opção abaixo para continuar…"
            />

            <Stack
              direction={"row"}
              justifyContent={"space-between"}
              alignItems={"center"}
              style={{ marginTop: 4 }}
            >
              <Typography className={classes.sectionLabel}>
                Opções do menu
              </Typography>

              <Button
                onClick={addOption}
                color="primary"
                variant="contained"
                className={classes.addOptionBtn}
                startIcon={<AddCircle />}
              >
                Adicionar
              </Button>
            </Stack>

            <Stack style={{ gap: 10 }}>
              {arrayOption.length === 0 && (
                <div className={classes.emptyOptions}>
                  Nenhuma opção adicionada ainda. Clique em <b>Adicionar</b> para
                  criar a primeira opção.
                </div>
              )}

              {arrayOption.map((item, index) => (
                <div className={classes.optionCard} key={item.number}>
                  <Typography className={classes.sectionLabel}>
                    Opção {item.number}
                  </Typography>

                  <div className={classes.optionRow}>
                    <TextField
                      placeholder={"Digite a opção"}
                      variant="outlined"
                      defaultValue={item.value}
                      className={classes.textField}
                      style={{ width: "100%" }}
                      onChange={event =>
                        updateOptionValue(index, event.target.value)
                      }
                    />

                    {arrayOption.length === item.number && (
                      <IconButton
                        onClick={() => removeOption(item.number)}
                        className={classes.iconBtn}
                        aria-label="Remover opção"
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </div>
                </div>
              ))}
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={includeMainMenuOption}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIncludeMainMenuOption(checked);
                    if (
                      checked &&
                      (!mainMenuOptionText ||
                        !String(mainMenuOptionText).trim())
                    ) {
                      setMainMenuOptionText("Retornar ao Menu Principal");
                    }
                  }}
                />
              }
              label="Incluir opção [#] para voltar ao menu principal"
            />

            {includeMainMenuOption && (
              <TextField
                variant="outlined"
                value={mainMenuOptionText}
                onChange={e => setMainMenuOptionText(e.target.value)}
                className={classes.textField}
                style={{ width: "100%" }}
                label="Texto da opção [#]"
                placeholder="Retornar ao Menu Principal"
              />
            )}

            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={includeExitOption}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIncludeExitOption(checked);
                    if (
                      checked &&
                      (!exitOptionText || !String(exitOptionText).trim())
                    ) {
                      setExitOptionText("Encerrar atendimento");
                    }
                  }}
                />
              }
              label="Incluir opção [Sair] para encerrar atendimento"
            />

            {includeExitOption && (
              <TextField
                variant="outlined"
                value={exitOptionText}
                onChange={e => setExitOptionText(e.target.value)}
                className={classes.textField}
                style={{ width: "100%" }}
                label="Texto da opção [Sair]"
                placeholder="Encerrar atendimento"
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            color="secondary"
            variant="outlined"
            className={classes.actionBtnSecondary}
          >
            {i18n.t("contactModal.buttons.cancel")}
          </Button>

          <Button
            type="button"
            color="primary"
            variant="contained"
            className={`${classes.btnWrapper} ${classes.actionBtn}`}
            onClick={handleSave}
          >
            {labels.btn}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderMenuModal;
