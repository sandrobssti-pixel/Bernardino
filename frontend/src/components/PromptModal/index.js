import React, { useState, useEffect } from "react";
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
import { i18n } from "../../translate/i18n";
import {
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import QueueSelectSingle from "../QueueSelectSingle";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  AI_MODEL_LABELS,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODELS,
  ALL_AI_MODELS,
  getDefaultModelByProvider,
  getProviderFromModel,
  normalizeAIProvider,
  providerSupportsVision
} from "../../utils/aiProviders";

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === "dark";

  return {
    root: {
      display: "flex",
      flexWrap: "wrap",
    },
    dialogPaper: {
      borderRadius: 16,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: isDark
        ? "0 20px 60px rgba(0, 0, 0, 0.5)"
        : "0 20px 60px rgba(15, 23, 42, 0.2)",
      backgroundColor: theme.palette.background.paper,
    },
    dialogTitle: {
      padding: "18px 22px 14px",
      borderBottom: `1px solid ${theme.palette.divider}`,
      background: isDark
        ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)"
        : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    },
    titleText: {
      fontWeight: 700,
      fontSize: "1.2rem",
      letterSpacing: "-0.3px",
      lineHeight: 1.2,
      color: isDark ? "#f1f5f9" : "#0f172a",
    },
    subtitleText: {
      marginTop: 4,
      fontSize: "0.82rem",
      fontWeight: 400,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    sectionLabel: {
      fontWeight: 600,
      fontSize: "0.72rem",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 18,
      marginBottom: 6,
      "&:first-child": {
        marginTop: 2,
      },
    },
    dialogContent: {
      padding: "18px 20px",
      maxHeight: "62vh",
      overflowY: "auto",
      overscrollBehavior: "contain",
      background: isDark
        ? "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0) 100%)"
        : "linear-gradient(180deg, rgba(248,250,252,0.65) 0%, rgba(255,255,255,1) 100%)",
      "& .MuiFormLabel-root": {
        fontSize: "0.85rem",
      },
      "& .MuiOutlinedInput-input": {
        fontSize: "0.85rem",
      },
      "& .MuiOutlinedInput-root": {
        borderRadius: 10,
        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#fff",
      },
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: isDark
          ? "rgba(255,255,255,0.14)"
          : "rgba(15, 23, 42, 0.16)",
      },
      "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: isDark
          ? "rgba(255,255,255,0.24)"
          : "rgba(15, 23, 42, 0.24)",
      },
      "& .MuiFormHelperText-root": {
        fontSize: "0.7rem",
      },
    },
    aiAlert: {
      borderRadius: 10,
      fontSize: "0.76rem",
      lineHeight: 1.5,
      marginTop: 4,
      marginBottom: 4,
      padding: "6px 14px",
      alignItems: "flex-start",
    },
    tabs: {
      minHeight: 42,
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.015)",
      "& .MuiTab-root": {
        minHeight: 42,
        fontWeight: 600,
        fontSize: "0.78rem",
        textTransform: "none",
        color: isDark ? "#94a3b8" : "#64748b",
      },
      "& .Mui-selected": {
        color: isDark ? "#f1f5f9" : "#0f172a",
      },
    },
    multFieldLine: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      "& > *": {
        flex: 1
      },
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        gap: 0
      }
    },
    btnWrapper: {
      position: "relative",
      borderRadius: 8,
      fontWeight: 600,
      fontSize: "0.8rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    },
    btnCancel: {
      borderRadius: 8,
      fontWeight: 500,
      fontSize: "0.8rem",
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
      margin: theme.spacing(1),
      minWidth: 120,
    },
    colorAdorment: {
      width: 20,
      height: 20,
    },
    dialogActions: {
      padding: "12px 20px",
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
    },
    helpText: {
      fontSize: "0.75rem",
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 6,
      lineHeight: 1.5,
    }
  };
});

const PromptSchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  model: Yup.string()
    .oneOf(ALL_AI_MODELS, "Modelo inválido")
    .required("Informe o modelo"),
  provider: Yup.string()
    .oneOf(Object.keys(AI_PROVIDER_MODELS), "Provedor inválido")
    .required("Informe o provedor"),
  maxTokens: Yup.number()
    .min(10, "Mínimo 10 tokens")
    .max(4096, "Máximo 4096 tokens")
    .required("Informe o número máximo de tokens"),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(1, "Máximo 1")
    .required("Informe a temperatura"),
  apiKey: Yup.string().required("Informe a API Key"),
  queueId: Yup.number()
    .transform((value, originalValue) =>
      originalValue === "" || originalValue === null ? undefined : value
    )
    .required("O campo Fila deve ser preenchido"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(50, "Máximo 50 mensagens")
    .required("Informe o número máximo de mensagens"),
  // Voz obrigatória apenas para o modelo principal de voz (gpt-4.1-mini)
  voice: Yup.string().when("model", {
    is: "gpt-4.1-mini",
    then: Yup.string().required("Informe o modo para Voz"),
    otherwise: Yup.string().notRequired(),
  }),
  voiceKey: Yup.string().notRequired(),
  voiceRegion: Yup.string().notRequired(),
});

const PromptModal = ({ open, onClose, promptId }) => {
  const classes = useStyles();
  const [showApiKey, setShowApiKey] = useState(false);

  const handleToggleApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  const initialState = {
    name: "",
    prompt: "",
    provider: "openai",
    model: getDefaultModelByProvider("openai"),
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    maxTokens: 100,
    temperature: 1,
    apiKey: "",
    queueId: "",
    maxMessages: 10
  };

  const [prompt, setPrompt] = useState(initialState);

  useEffect(() => {
    const fetchPrompt = async () => {
      if (!promptId) {
        setPrompt(initialState);
        return;
      }
      try {
        const { data } = await api.get(`/prompt/${promptId}`);
        const normalizedProvider = normalizeAIProvider(
          data.provider || getProviderFromModel(data.model)
        );
        const normalizedModel = ALL_AI_MODELS.includes(data.model)
          ? data.model
          : getDefaultModelByProvider(normalizedProvider);

        setPrompt({
          ...initialState,
          ...data,
          queueId: data?.queueId ?? "",
          provider: normalizedProvider,
          model: normalizedModel
        });
      } catch (err) {
        toastError(err);
      }
    };

    fetchPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId, open]);

  const handleClose = () => {
    setPrompt(initialState);
    onClose();
  };

  const handleSavePrompt = async (values, { setSubmitting, setErrors }) => {
    try {
      const promptData = {
        ...values,
        // garante que enviamos número (Formik pode manter como string em inputs type=number)
        temperature: Number(values.temperature),
        // se não for o modelo de voz, força "texto" só pra garantir
        voice: values.model === "gpt-4.1-mini" ? values.voice : "texto",
      };

      if (promptId) {
        await api.put(`/prompt/${promptId}`, promptData);
      } else {
        await api.post("/prompt", promptData);
      }

      toast.success(i18n.t("promptModal.success"));
      handleClose();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Erro ao salvar o prompt";
      toastError(errorMessage);

      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.errors) {
          const fieldErrors = {};
          parsedError.errors.forEach(error => {
            if (error.includes("NAME")) fieldErrors.name = error;
            if (error.includes("PROMPT")) fieldErrors.prompt = error;
            if (error.includes("MODEL")) fieldErrors.model = error;
            if (error.includes("TOKENS")) fieldErrors.maxTokens = error;
            if (error.includes("TEMPERATURE")) fieldErrors.temperature = error;
            if (error.includes("APIKEY")) fieldErrors.apiKey = error;
            if (error.includes("QUEUEID")) fieldErrors.queueId = error;
            if (error.includes("MESSAGES")) fieldErrors.maxMessages = error;
            if (error.includes("VOICE")) fieldErrors.voice = error;
          });
          setErrors(fieldErrors);
        }
      } catch (jsonError) {
        // se não for JSON, ignora e mantém erro genérico
      }

      setSubmitting(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        scroll="paper"
        fullWidth
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
          <div className={classes.titleText}>
            {promptId
              ? i18n.t("promptModal.title.edit")
              : i18n.t("promptModal.title.add")}
          </div>
          <div className={classes.subtitleText}>
            Configure o provedor, modelo e comportamento do atendimento.
          </div>
        </DialogTitle>
        <Formik
          initialValues={prompt}
          enableReinitialize={true}
          validationSchema={PromptSchema}
          onSubmit={handleSavePrompt}
        >
          {({
            touched,
            errors,
            isSubmitting,
            values,
            setFieldValue,
            validateForm,
            handleSubmit,
          }) => {
            const handleValidatedSubmit = async event => {
              const formErrors = await validateForm();
              if (formErrors.queueId) {
                toast.error(formErrors.queueId);
              }
              handleSubmit(event);
            };

            return (
            <Form style={{ width: "100%" }} onSubmit={handleValidatedSubmit}>
              <DialogContent dividers className={classes.dialogContent}>
                <div className={classes.sectionLabel}>Identificação</div>
                <Field
                  as={TextField}
                  label={i18n.t("promptModal.form.name")}
                  name="name"
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />

                <FormControl
                  fullWidth
                  margin="dense"
                  variant="outlined"
                >
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.apikey")}
                    name="apiKey"
                    type={showApiKey ? "text" : "password"}
                    error={touched.apiKey && Boolean(errors.apiKey)}
                    helperText={touched.apiKey && errors.apiKey}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleToggleApiKey}>
                            {showApiKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </FormControl>

                <div className={classes.sectionLabel}>Treinamento</div>
                <Field
                  as={TextField}
                  label={i18n.t("promptModal.form.prompt")}
                  name="prompt"
                  error={touched.prompt && Boolean(errors.prompt)}
                  helperText={touched.prompt && errors.prompt}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  minRows={8}
                  multiline
                />

                <div className={classes.sectionLabel}>Transferência para humano</div>
                <div className={classes.helpText}>
                  Quando o cliente pedir para falar com um atendente, a IA irá
                  transferir o ticket para esta fila.
                </div>
                <Field
                  name="queueId"
                  component={({ field, form }) => (
                    <QueueSelectSingle
                      selectedQueueId={field.value}
                      onChange={value => form.setFieldValue("queueId", value)}
                    />
                  )}
                />
                {touched.queueId && errors.queueId && (
                  <div style={{ color: "red", fontSize: "12px", marginTop: 6 }}>
                    {errors.queueId}
                  </div>
                )}

                <div className={classes.sectionLabel}>Provedor e modelo</div>
                <div className={classes.multFieldLine}>
                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    error={touched.provider && Boolean(errors.provider)}
                  >
                    <InputLabel>{i18n.t("promptModal.form.provider")}</InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.provider")}
                      name="provider"
                      onChange={e => {
                        const provider = e.target.value;
                        const firstModel = getDefaultModelByProvider(provider);
                        setFieldValue("provider", provider);
                        setFieldValue("model", firstModel);
                        if (firstModel !== "gpt-4.1-mini") {
                          setFieldValue("voice", "texto");
                        }
                      }}
                    >
                      {Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Field>
                    {touched.provider && errors.provider && (
                      <div style={{ color: "red", fontSize: "12px" }}>
                        {errors.provider}
                      </div>
                    )}
                  </FormControl>

                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    error={touched.model && Boolean(errors.model)}
                  >
                    <InputLabel>
                      {i18n.t("promptModal.form.model")}
                    </InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.model")}
                      name="model"
                      onChange={e => {
                        setFieldValue(
                          "provider",
                          getProviderFromModel(e.target.value)
                        );
                        setFieldValue("model", e.target.value);
                        if (e.target.value !== "gpt-4.1-mini") {
                          setFieldValue("voice", "texto");
                        }
                      }}
                    >
                      {(AI_PROVIDER_MODELS[values.provider] || []).map(model => (
                        <MenuItem key={model} value={model}>
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            width="100%"
                            gridGap={8}
                          >
                            <span>{AI_MODEL_LABELS[model] || model}</span>
                          </Box>
                        </MenuItem>
                      ))}
                    </Field>
                    {touched.model && errors.model && (
                      <div style={{ color: "red", fontSize: "12px" }}>
                        {errors.model}
                      </div>
                    )}
                  </FormControl>

                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    disabled={values.model !== "gpt-4.1-mini"}
                    error={touched.voice && Boolean(errors.voice)}
                  >
                    <InputLabel>
                      {i18n.t("promptModal.form.voice")}
                    </InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.voice")}
                      name="voice"
                    >
                      <MenuItem value="texto">Texto</MenuItem>
                      <MenuItem value="pt-BR-FranciscaNeural">
                        Francisca
                      </MenuItem>
                      <MenuItem value="pt-BR-AntonioNeural">
                        Antônio
                      </MenuItem>
                      <MenuItem value="pt-BR-BrendaNeural">Brenda</MenuItem>
                      <MenuItem value="pt-BR-DonatoNeural">Donato</MenuItem>
                      <MenuItem value="pt-BR-ElzaNeural">Elza</MenuItem>
                      <MenuItem value="pt-BR-FabioNeural">Fábio</MenuItem>
                      <MenuItem value="pt-BR-GiovannaNeural">
                        Giovanna
                      </MenuItem>
                      <MenuItem value="pt-BR-HumbertoNeural">
                        Humberto
                      </MenuItem>
                      <MenuItem value="pt-BR-JulioNeural">Julio</MenuItem>
                      <MenuItem value="pt-BR-LeilaNeural">Leila</MenuItem>
                      <MenuItem value="pt-BR-LeticiaNeural">
                        Letícia
                      </MenuItem>
                      <MenuItem value="pt-BR-ManuelaNeural">
                        Manuela
                      </MenuItem>
                      <MenuItem value="pt-BR-NicolauNeural">
                        Nicolau
                      </MenuItem>
                      <MenuItem value="pt-BR-ValerioNeural">
                        Valério
                      </MenuItem>
                      <MenuItem value="pt-BR-YaraNeural">Yara</MenuItem>
                    </Field>
                    {touched.voice && errors.voice && (
                      <div style={{ color: "red", fontSize: "12px" }}>
                        {errors.voice}
                      </div>
                    )}
                  </FormControl>
                </div>

                <Alert severity="info" className={classes.aiAlert}>
                  {providerSupportsVision(values.provider) ? (
                    <>
                      <strong>{AI_PROVIDER_LABELS[values.provider]}</strong> lê
                      imagens enviadas pelo cliente (visão). Envio de arquivos do
                      catálogo (aba "Arquivos da IA") funciona com qualquer provedor.
                    </>
                  ) : (
                    <>
                      <strong>{AI_PROVIDER_LABELS[values.provider]}</strong> não lê
                      imagens enviadas pelo cliente — apenas OpenAI e Gemini têm
                      essa leitura (visão). Nesse provedor, a IA avisa
                      automaticamente que não consegue analisar imagens. O envio
                      de arquivos do catálogo (aba "Arquivos da IA") continua
                      funcionando normalmente.
                    </>
                  )}
                </Alert>

                <div className={classes.sectionLabel}>Voz (opcional)</div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.voiceKey")}
                    name="voiceKey"
                    error={touched.voiceKey && Boolean(errors.voiceKey)}
                    helperText={touched.voiceKey && errors.voiceKey}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={values.model !== "gpt-4.1-mini"}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.voiceRegion")}
                    name="voiceRegion"
                    error={touched.voiceRegion && Boolean(errors.voiceRegion)}
                    helperText={touched.voiceRegion && errors.voiceRegion}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={values.model !== "gpt-4.1-mini"}
                  />
                </div>

                <div className={classes.sectionLabel}>Parâmetros de resposta</div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.temperature")}
                    name="temperature"
                    error={touched.temperature && Boolean(errors.temperature)}
                    helperText={touched.temperature && errors.temperature}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    type="number"
                    inputProps={{
                      step: "0.1",
                      min: "0",
                      max: "1",
                    }}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.max_tokens")}
                    name="maxTokens"
                    error={touched.maxTokens && Boolean(errors.maxTokens)}
                    helperText={touched.maxTokens && errors.maxTokens}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    type="number"
                    InputLabelProps={{ shrink: true }}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.max_messages")}
                    name="maxMessages"
                    error={touched.maxMessages && Boolean(errors.maxMessages)}
                    helperText={touched.maxMessages && errors.maxMessages}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    type="number"
                    InputLabelProps={{ shrink: true }}
                  />
                </div>
              </DialogContent>

              <DialogActions className={classes.dialogActions}>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                  className={classes.btnCancel}
                >
                  {i18n.t("promptModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {promptId
                    ? i18n.t("promptModal.buttons.okEdit")
                    : i18n.t("promptModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
            );
          }}
        </Formik>
      </Dialog>
    </div>
  );
};

export default PromptModal;
