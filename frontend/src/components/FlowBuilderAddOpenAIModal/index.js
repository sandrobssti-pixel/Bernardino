import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import {
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import Alert from "@material-ui/lab/Alert";
import { i18n } from "../../translate/i18n";
import QueueSelectSingle from "../QueueSelectSingle"; // 🔹 NOVO
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

const useStyles = makeStyles((theme) => {
  const dark = theme.palette.type === "dark";

  return {
  root: { display: "flex", flexWrap: "wrap" },

  dialogPaper: {
    borderRadius: 14,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    boxShadow: dark ? "0 18px 60px rgba(0, 0, 0, 0.5)" : "0 18px 60px rgba(16, 24, 40, 0.18)",
    maxHeight: "92vh",
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
    maxHeight: "62vh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    background: dark
      ? "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(30,41,59,0.6) 55%)"
      : "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)",

    "& .MuiFormControl-root": {
      marginTop: 6,
      marginBottom: 6
    },

    "& .MuiInputLabel-outlined": {
      fontSize: 13
    },

    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: dark ? "rgba(15, 23, 42, 0.4)" : "#fff",
      color: dark ? "#f1f5f9" : undefined
    },

    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.24)" : "rgba(17, 24, 39, 0.14)"
    },

    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.35)" : "rgba(17, 24, 39, 0.22)"
    },

    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(59, 130, 246, 0.65)"
    },

    "& .MuiFormHelperText-root": {
      marginLeft: 2
    },

    [theme.breakpoints.down("sm")]: {
      padding: 14,
      maxHeight: "calc(100vh - 200px)"
    }
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

  btnWrapper: { position: "relative" },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  },

  dialogActions: {
    padding: "14px 20px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10,
    background: dark ? "#1e293b" : "#fff",
    position: "sticky",
    bottom: 0,
    zIndex: 2
  },

  primaryButton: {
    borderRadius: 12,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },

  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },

  helpText: {
    fontSize: 12,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280",
    marginTop: 6
  },

  aiAlert: {
    borderRadius: 10,
    fontSize: "0.76rem",
    lineHeight: 1.5,
    marginTop: 4,
    marginBottom: 4
  }
  };
});

// Esquema de validação alinhado com o backend/front
const DialogflowSchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  provider: Yup.string()
    .oneOf(Object.keys(AI_PROVIDER_MODELS), "Provedor inválido")
    .required("Informe o provedor"),
  model: Yup.string()
    .oneOf(ALL_AI_MODELS, "Modelo inválido")
    .required("Informe o modelo"),
  maxTokens: Yup.number()
    .min(10, "Mínimo 10 tokens")
    .max(4096, "Máximo 4096 tokens")
    .required("Informe o número máximo de tokens"),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(1, "Máximo 1")
    .required("Informe a temperatura"),
  apiKey: Yup.string().required("Informe a API Key"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(50, "Máximo 50 mensagens")
    .required("Informe o número máximo de mensagens"),
  voice: Yup.string().when("model", {
    // voz só obrigatória no modelo principal de voz (gpt-4.1-mini)
    is: "gpt-4.1-mini",
    then: Yup.string().required("Informe o modo para Voz"),
    otherwise: Yup.string().notRequired()
  }),
  voiceKey: Yup.string().notRequired(),
  voiceRegion: Yup.string().notRequired(),
  queueId: Yup.number()
    .transform((value, originalValue) =>
      originalValue === "" || originalValue === null ? undefined : value
    )
    .required("O campo Fila deve ser preenchido"),
});

const FlowBuilderOpenAIModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));
  const isMounted = useRef(true);

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
    maxMessages: 10,
    queueId: "" // 🔹 NOVO
  };

  const [showApiKey, setShowApiKey] = useState(false);
  const [integration, setIntegration] = useState(initialState);
  const [labels, setLabels] = useState({
    title: "Adicionar IA ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar IA do fluxo",
        btn: "Salvar"
      });
      const typebotIntegration = data?.data?.typebotIntegration || {};
      const normalizedProvider = normalizeAIProvider(
        typebotIntegration.provider || getProviderFromModel(typebotIntegration.model)
      );
      const normalizedModel = ALL_AI_MODELS.includes(typebotIntegration.model)
        ? typebotIntegration.model
        : getDefaultModelByProvider(normalizedProvider);
      setIntegration({
        ...initialState,
        ...typebotIntegration,
        provider: normalizedProvider,
        model: normalizedModel
      });
    } else if (open === "create") {
      setLabels({
        title: "Adicionar IA ao fluxo",
        btn: "Adicionar"
      });
      setIntegration(initialState);
    }

    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
  };

  const handleSavePrompt = (values, { setSubmitting }) => {
    const promptData = {
      ...values,
      // garante que enviamos número (Formik pode manter como string em inputs type=number)
      temperature: Number(values.temperature),
      // força voz texto se não estiver usando o modelo principal de voz
      voice: values.model === "gpt-4.1-mini" ? values.voice : "texto"
    };

    if (open === "edit") {
      onUpdate({
        ...data,
        data: { typebotIntegration: promptData }
      });
    } else if (open === "create") {
      promptData.projectName = promptData.name;
      onSave({
        typebotIntegration: promptData
      });
    }
    handleClose();
    setSubmitting(false);
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open === "create" || open === "edit"}
        onClose={handleClose}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <div className={classes.title}>{labels.title}</div>
            <div className={classes.subtitle}>
              Configure a integração de IA para o fluxo
            </div>
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
          enableReinitialize={true}
          validationSchema={DialogflowSchema}
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
              <DialogContent className={classes.dialogContent} dividers>
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

                <FormControl fullWidth margin="dense" variant="outlined">
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
                          <IconButton onClick={() => setShowApiKey(!showApiKey)}>
                            {showApiKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </FormControl>

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
                  rows={10}
                  multiline
                />

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
                      onChange={(e) => {
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
                      <div style={{ color: "red", fontSize: "12px", marginTop: 6 }}>
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
                    <InputLabel>{i18n.t("promptModal.form.model")}</InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.model")}
                      name="model"
                      onChange={(e) => {
                        setFieldValue("provider", getProviderFromModel(e.target.value));
                        setFieldValue("model", e.target.value);
                        if (e.target.value !== "gpt-4.1-mini") {
                          setFieldValue("voice", "texto");
                        }
                      }}
                    >
                      {(AI_PROVIDER_MODELS[values.provider] || []).map((model) => (
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
                      <div style={{ color: "red", fontSize: "12px", marginTop: 6 }}>
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
                    <InputLabel>{i18n.t("promptModal.form.voice")}</InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.voice")}
                      name="voice"
                    >
                      <MenuItem value="texto">Texto</MenuItem>
                      <MenuItem value="pt-BR-FranciscaNeural">Francisca</MenuItem>
                      <MenuItem value="pt-BR-AntonioNeural">Antônio</MenuItem>
                      <MenuItem value="pt-BR-BrendaNeural">Brenda</MenuItem>
                      <MenuItem value="pt-BR-DonatoNeural">Donato</MenuItem>
                      <MenuItem value="pt-BR-ElzaNeural">Elza</MenuItem>
                      <MenuItem value="pt-BR-FabioNeural">Fábio</MenuItem>
                      <MenuItem value="pt-BR-GiovannaNeural">Giovanna</MenuItem>
                      <MenuItem value="pt-BR-HumbertoNeural">Humberto</MenuItem>
                      <MenuItem value="pt-BR-JulioNeural">Julio</MenuItem>
                      <MenuItem value="pt-BR-LeilaNeural">Leila</MenuItem>
                      <MenuItem value="pt-BR-LeticiaNeural">Letícia</MenuItem>
                      <MenuItem value="pt-BR-ManuelaNeural">Manuela</MenuItem>
                      <MenuItem value="pt-BR-NicolauNeural">Nicolau</MenuItem>
                      <MenuItem value="pt-BR-ValerioNeural">Valério</MenuItem>
                      <MenuItem value="pt-BR-YaraNeural">Yara</MenuItem>
                    </Field>
                    {touched.voice && errors.voice && (
                      <div style={{ color: "red", fontSize: "12px", marginTop: 6 }}>
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

                <div style={{ marginTop: 10, marginBottom: 10 }}>
                  <InputLabel shrink required>
                    Fila para transferir atendimento
                  </InputLabel>
                  <QueueSelectSingle
                    value={values.queueId}
                    onChange={(value) => setFieldValue("queueId", value)}
                  />
                  {touched.queueId && errors.queueId && (
                    <div style={{ color: "red", fontSize: "12px", marginTop: 6 }}>
                      {errors.queueId}
                    </div>
                  )}
                  <div className={classes.helpText}>
                    Quando o cliente pedir para falar com um atendente, a IA irá
                    transferir o ticket para esta fila.
                  </div>
                </div>

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
                      max: "1"
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
                  />
                </div>
              </DialogContent>

              <DialogActions className={classes.dialogActions}>
                <Button
                  onClick={handleClose}
                  variant="outlined"
                  disabled={isSubmitting}
                  className={classes.secondaryButton}
                >
                  {i18n.t("promptModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.primaryButton}
                  disabled={isSubmitting}
                >
                  {labels.btn}
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

export default FlowBuilderOpenAIModal;
