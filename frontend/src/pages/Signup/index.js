import React, { useState, useEffect } from "react";
import qs from "query-string";
import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";
import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import defaultLoginLogo from "../../assets/login-logo-default.png";

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    overflowX: "hidden",
    minHeight: "100vh",
    background: "#eef1f6",
    backgroundImage:
      "radial-gradient(circle at 12% 12%, rgba(99, 102, 241, 0.16) 0%, rgba(99, 102, 241, 0) 45%), radial-gradient(circle at 88% 82%, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0) 45%), linear-gradient(160deg, #eef1f6 0%, #e2e8f0 100%)",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  rootWithBackground: {
    backgroundColor: "#d1d5db",
  },
  backgroundOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    background: "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.2) 100%)",
  },
  backgroundMedia: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  backgroundImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center center",
    userSelect: "none",
    pointerEvents: "none",
  },
  paper: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.97)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderRadius: 24,
    boxShadow:
      "0 32px 70px -25px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)",
    padding: theme.spacing(3),
    margin: theme.spacing(1),
    animation: "$fadeIn .55s cubic-bezier(0.16, 1, 0.3, 1)",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100%",
      padding: theme.spacing(2.5),
      margin: theme.spacing(1),
      borderRadius: 20,
    },
  },
  "@keyframes fadeIn": {
    "0%": { opacity: 0, transform: "translateY(18px) scale(0.96)" },
    "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
  },
  headerSection: {
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
  logoImg: {
    display: "block",
    margin: "0 auto 14px",
    maxWidth: 190,
    height: "auto",
    filter: "drop-shadow(0 8px 16px rgba(15, 23, 42, 0.18))",
    [theme.breakpoints.down("sm")]: {
      maxWidth: 150,
    },
  },
  title: {
    fontSize: "1.45rem",
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
    lineHeight: 1.2,
    marginBottom: 4,
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.25rem",
    },
  },
  subtitle: {
    fontSize: "0.82rem",
    color: "#64748b",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  form: {
    width: "100%",
  },
  inputField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor: "#f8fafc",
      transition: "background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
      "& fieldset": {
        borderColor: "rgba(148, 163, 184, 0.35)",
      },
      "&:hover fieldset": {
        borderColor: theme.palette.primary.main,
      },
      "&.Mui-focused": {
        backgroundColor: "#fff",
        boxShadow: `0 0 0 4px ${theme.palette.primary.main}26`,
        transform: "translateY(-1px)",
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        borderWidth: 1.5,
      },
    },
    "& .MuiInputLabel-root": {
      color: "#64748b",
      backgroundColor: "transparent",
      padding: "0 4px",
      marginLeft: -4,
      transform: "translate(14px, 14px) scale(1)",
      transition: "all 0.2s ease",
      "&.Mui-focused": {
        color: theme.palette.primary.main,
        backgroundColor: "#f8fafc",
        transform: "translate(14px, -8px) scale(0.75)",
      },
      "&.MuiInputLabel-shrink": {
        backgroundColor: "#f8fafc",
        transform: "translate(14px, -8px) scale(0.75)",
      },
    },
    "& .MuiInputBase-root": {
      height: 44,
    },
    "& .MuiInputBase-input": {
      padding: "10px 14px",
      height: "auto",
    },
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  planCardsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  planCard: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",
    "&:hover": {
      borderColor: "#cbd5e1",
      boxShadow: "0 4px 12px -4px rgba(15, 23, 42, 0.1)",
    },
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.25),
      gap: theme.spacing(1),
    },
  },
  planCardActive: {
    borderColor: theme.palette.primary.main,
    background: `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, #ffffff 100%)`,
    boxShadow: `0 8px 30px -10px ${theme.palette.primary.main}40`,
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)",
      boxShadow: `0 12px 35px -10px ${theme.palette.primary.main}50`,
    },
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      borderRadius: "2px 0 0 2px",
    },
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "2px solid #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.15s ease",
  },
  planRadioActive: {
    borderColor: theme.palette.primary.main,
    background: theme.palette.primary.main,
  },
  planRadioInner: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ffffff",
    transform: "scale(0)",
    transition: "transform 0.15s ease",
  },
  planRadioInnerActive: {
    transform: "scale(1)",
  },
  planContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  planName: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    [theme.breakpoints.down("sm")]: {
      fontSize: 13,
    },
  },
  planBadge: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    padding: "1px 6px",
    borderRadius: 12,
    background: theme.palette.primary.main,
    color: "#ffffff",
  },
  planMeta: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.25, 1.5),
    [theme.breakpoints.down("sm")]: {
      fontSize: 11,
      gap: theme.spacing(0.25, 1),
    },
  },
  planMetaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.palette.primary.main,
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      fontSize: 15,
    },
  },
  submitButton: {
    marginTop: theme.spacing(2),
    padding: "13px 20px",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "none",
    borderRadius: 14,
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    boxShadow: `0 14px 28px -12px ${theme.palette.primary.main}`,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: `0 18px 34px -12px ${theme.palette.primary.main}`,
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },
  loginLink: {
    marginTop: theme.spacing(1.5),
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    "& a": {
      color: theme.palette.primary.main,
      fontWeight: 500,
      textDecoration: "none",
      "&:hover": {
        textDecoration: "underline",
      },
    },
  },
  versionCompany: {
    marginTop: theme.spacing(1.5),
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: 500,
    color: "#94a3b8",
    letterSpacing: "0.04em",
  },
  whatsappButton: {
    position: "fixed",
    bottom: 24,
    right: 24,
    display: "flex",
    alignItems: "center",
    backgroundColor: "#25D366",
    borderRadius: 999,
    width: 58,
    height: 58,
    padding: 0,
    justifyContent: "center",
    boxShadow: "0 10px 28px -6px rgba(4, 64, 18, 0.6)",
    cursor: "pointer",
    zIndex: 999,
    overflow: "hidden",
    transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease, box-shadow 0.2s ease",
    animation: "$pulse 2.6s infinite",
    "&:hover": {
      width: 190,
      justifyContent: "flex-start",
      paddingLeft: 17,
      backgroundColor: "#1ebe5b",
      transform: "scale(1.03)",
      animation: "none",
      "& $whatsappLabel": {
        maxWidth: 140,
        marginLeft: 10,
        opacity: 1,
      },
    },
    [theme.breakpoints.down("sm")]: {
      width: 50,
      height: 50,
      bottom: 16,
      right: 16,
    },
  },
  whatsappLabel: {
    display: "inline-block",
    maxWidth: 0,
    marginLeft: 0,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    opacity: 0,
    transition: "max-width 0.3s ease, margin-left 0.3s ease, opacity 0.2s ease 0.1s",
  },
  "@keyframes pulse": {
    "0%": { boxShadow: "0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 0 rgba(37, 211, 102, 0.5)" },
    "70%": { boxShadow: "0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 16px rgba(37, 211, 102, 0)" },
    "100%": { boxShadow: "0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 0 rgba(37, 211, 102, 0)" },
  },
  whatsappIcon: {
    fontSize: 30,
    color: "#fff",
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      fontSize: 26,
    },
  },
}));

const sanitizeCpfCnpj = value => String(value || "").replace(/\D/g, "");

const isValidCpfCnpj = value => {
  const normalized = sanitizeCpfCnpj(value);
  return normalized.length === 11 || normalized.length === 14;
};

const formatCpfCnpj = value => {
  const digits = sanitizeCpfCnpj(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const buildUserSchema = (documentRequired) =>
  Yup.object().shape({
    name: Yup.string()
      .min(2, "Too Short!")
      .max(50, "Too Long!")
      .required("Obrigatório"),
    companyName: Yup.string()
      .min(2, "Too Short!")
      .max(50, "Too Long!")
      .required("Obrigatório"),
    password: Yup.string()
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .max(50, "Too Long!")
      .matches(
        /^(?=.*[A-Za-z])(?=.*\d).+$/,
        "A senha deve conter letras e números."
      )
      .required("Obrigatório"),
    email: Yup.string().email("Invalid email").required("Obrigatório"),
    phone: Yup.string()
      .required("Obrigatório")
      .test(
        "valid-br-phone",
        "Informe DDD + número (8 ou 9 dígitos).",
        value => {
          const digits = String(value || "").replace(/\D/g, "");
          return digits.length === 10 || digits.length === 11;
        }
      ),
    document: Yup.string().test(
      "valid-cpf-cnpj",
      "Informe um CPF ou CNPJ válido.",
      value => {
        const normalized = sanitizeCpfCnpj(value);
        if (!normalized) return !documentRequired;
        return isValidCpfCnpj(normalized);
      }
    ),
    planId: Yup.string().required("Obrigatório"),
  });

const formatSignupPhone = value => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) {
    return `(${ddd}${rest ? ") " + rest : ""}`;
  }

  if (rest.length <= 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
};

const normalizeSignupPhone = value =>
  String(value || "").replace(/\D/g, "").slice(0, 11);

const SignUp = () => {
  const classes = useStyles();
  const history = useHistory();
  const { getPlanList } = usePlans();
  const [plans, setPlans] = useState([]);
  const [branding, setBranding] = useState({
    loginLogo: "/logo.png",
    loginBackground: "",
    loginWhatsapp: "https://wa.me/5500000000000",
    companyName: "Whaticket",
    signupRequireCpfCnpj: "disabled"
  });
  const [userCreationEnabled, setUserCreationEnabled] = useState(true);

  let companyId = null;
  const params = qs.parse(window.location.search);
  if (params.companyId !== undefined) {
    companyId = params.companyId;
  }

  const initialState = {
    name: "",
    email: "",
    password: "",
    phone: "",
    document: "",
    companyId,
    companyName: "",
    planId: "",
  };

  const [user] = useState(initialState);

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL === "https://localhost:8090"
      ? "https://localhost:8090"
      : process.env.REACT_APP_BACKEND_URL;

  const resolveImageUrl = (value, fallback) => {
    if (!value) return fallback;
    if (value.startsWith("http")) return value;
    if (!backendUrl) return value;
    const normalizedBase = backendUrl.replace(/\/+$/, "");
    const path = value.startsWith("/") ? value : `/${value}`;
    return `${normalizedBase}${path}`;
  };

  const isDefaultBackendBackground = (value) => {
    if (!value) return true;
    const normalized = String(value).toLowerCase();
    return normalized.includes("/public/branding/login-background-default");
  };

  useEffect(() => {
    const fetchUserCreationStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/settings/userCreation`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user creation status");
        }

        const data = await response.json();
        const isEnabled = data.userCreation === "enabled";
        setUserCreationEnabled(isEnabled);

        if (!isEnabled) {
          toast.info("Cadastro de novos usuários está desabilitado.");
          history.push("/login");
        }
      } catch (err) {
        console.error("Erro ao verificar userCreation:", err);
        setUserCreationEnabled(false);
        toast.error("Erro ao verificar permissão de cadastro.");
        history.push("/login");
      }
    };

    fetchUserCreationStatus();
  }, [backendUrl, history]);

  useEffect(() => {
    const fetchData = async () => {
      const planList = await getPlanList({ listPublic: "false" });
      setPlans(planList);
    };
    fetchData();
  }, [getPlanList]);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const [{ data: brandingData }, { data: publicAppName }] =
          await Promise.all([
            openApi.get("/global-config/public-branding"),
            openApi.get("/public-settings/appName", {
              params: { token: "wtV" },
            }),
          ]);

        setBranding({
          loginLogo: brandingData.loginLogo || "/logo.png",
          loginBackground: isDefaultBackendBackground(brandingData.loginBackground)
            ? ""
            : brandingData.loginBackground,
          loginWhatsapp: brandingData.loginWhatsapp || "https://wa.me/5500000000000",
          companyName: String(publicAppName || "").trim() || "Whaticket",
          signupRequireCpfCnpj: brandingData.signupRequireCpfCnpj || "disabled"
        });
      } catch (err) {
        // segue com fallback local
      }
    };
    fetchBranding();
  }, []);

  const handleSignUp = async (values) => {
    try {
      await openApi.post("/auth/signup", {
        ...values,
        phone: normalizeSignupPhone(values.phone)
      });
      toast.success(i18n.t("signup.toasts.success"));
      history.push("/login");
    } catch (err) {
      toastError(err);
    }
  };

  if (!userCreationEnabled) {
    return null;
  }

  return (
    <div className={`${classes.root} ${branding.loginBackground ? classes.rootWithBackground : ""}`}>
      {!!branding.loginBackground && (
        <>
          <div className={classes.backgroundMedia}>
            <img
              src={resolveImageUrl(branding.loginBackground, "")}
              alt="Background cadastro"
              className={classes.backgroundImg}
            />
          </div>
          <div className={classes.backgroundOverlay} />
        </>
      )}
      <div className={classes.paper}>
        <div className={classes.headerSection}>
          <img
            src={resolveImageUrl(branding.loginLogo, defaultLoginLogo)}
            alt="Logo"
            className={classes.logoImg}
          />
          <Typography component="h1" className={classes.title}>
            {i18n.t("signup.title")}
          </Typography>
          <Typography className={classes.subtitle}>
            Crie sua conta e escolha o melhor plano.
          </Typography>
        </div>
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={buildUserSchema(String(branding.signupRequireCpfCnpj) === "enabled")}
          onSubmit={async (values, actions) => {
            await handleSignUp(values);
            actions.setSubmitting(false);
          }}
        >
          {({ touched, errors, values, setFieldValue }) => (
            <Form className={classes.form}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    id="companyName"
                    label={i18n.t("signup.form.company")}
                    error={touched.companyName && Boolean(errors.companyName)}
                    helperText={touched.companyName && errors.companyName}
                    name="companyName"
                    autoComplete="companyName"
                    autoFocus
                    className={classes.inputField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    autoComplete="name"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    fullWidth
                    id="name"
                    label={i18n.t("signup.form.name")}
                    className={classes.inputField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    id="email"
                    label={i18n.t("signup.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    autoComplete="email"
                    inputProps={{ style: { textTransform: "lowercase" } }}
                    className={classes.inputField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    name="password"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    label={i18n.t("signup.form.password")}
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    className={classes.inputField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    variant="outlined"
                    fullWidth
                    id="phone"
                    label={i18n.t("signup.form.phone")}
                    name="phone"
                    autoComplete="tel-national"
                    placeholder="(00) 00000-0000"
                    value={formatSignupPhone(values.phone)}
                    onChange={(e) =>
                      setFieldValue("phone", formatSignupPhone(e.target.value))
                    }
                    error={touched.phone && Boolean(errors.phone)}
                    helperText={touched.phone && errors.phone}
                    className={classes.inputField}
                  />
                </Grid>
                {String(branding.signupRequireCpfCnpj) === "enabled" && (
                  <Grid item xs={12}>
                    <TextField
                      variant="outlined"
                      fullWidth
                      id="document"
                      label={i18n.t("signup.form.document")}
                      name="document"
                      autoComplete="off"
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      value={formatCpfCnpj(values.document)}
                      onChange={(e) =>
                        setFieldValue("document", formatCpfCnpj(e.target.value))
                      }
                      error={touched.document && Boolean(errors.document)}
                      helperText={touched.document && errors.document}
                      className={classes.inputField}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography className={classes.sectionLabel}>
                    Escolha seu plano
                  </Typography>
                  <Field type="hidden" name="planId" />
                  <div className={classes.planCardsGrid}>
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`${classes.planCard} ${
                          String(values.planId) === String(plan.id)
                            ? classes.planCardActive
                            : ""
                        }`}
                        onClick={() => setFieldValue("planId", String(plan.id))}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setFieldValue("planId", String(plan.id));
                          }
                        }}
                      >
                        <div
                          className={`${classes.planRadio} ${
                            String(values.planId) === String(plan.id)
                              ? classes.planRadioActive
                              : ""
                          }`}
                        >
                          <div
                            className={`${classes.planRadioInner} ${
                              String(values.planId) === String(plan.id)
                                ? classes.planRadioInnerActive
                                : ""
                            }`}
                          />
                        </div>
                        <div className={classes.planContent}>
                          <Typography className={classes.planName}>
                            {plan.name}
                            {String(values.planId) === String(plan.id) && (
                              <span className={classes.planBadge}>Selecionado</span>
                            )}
                          </Typography>
                          <div className={classes.planMeta}>
                            <span className={classes.planMetaItem}>
                              {plan.users} atendentes
                            </span>
                            <span className={classes.planMetaItem}>
                              {plan.connections} WhatsApp
                            </span>
                            <span className={classes.planMetaItem}>
                              {plan.queues} filas
                            </span>
                          </div>
                        </div>
                        <div className={classes.planPrice}>
                          R${plan.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                  {touched.planId && errors.planId && (
                    <Typography
                      variant="caption"
                      style={{ color: "#d32f2f", marginTop: 6, display: "block" }}
                    >
                      {errors.planId}
                    </Typography>
                  )}
                </Grid>
              </Grid>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submitButton}
              >
                {i18n.t("signup.buttons.submit")}
              </Button>
              <div className={classes.loginLink}>
                <Link
                  href="#"
                  variant="body2"
                  component={RouterLink}
                  to="/login"
                >
                  {i18n.t("signup.buttons.login")}
                </Link>
              </div>
            </Form>
          )}
        </Formik>
        <Typography className={classes.versionCompany}>
          {branding.companyName}
        </Typography>
      </div>
      <div
        className={classes.whatsappButton}
        onClick={() => window.open(branding.loginWhatsapp)}
      >
        <WhatsAppIcon className={classes.whatsappIcon} />
        <span className={classes.whatsappLabel}>Fale conosco</span>
      </div>
    </div>
  );
};

export default SignUp;
