import { i18n } from "../../translate/i18n";

import React, { useState, useEffect, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import { Button, TextField, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { IconButton, InputAdornment, Switch } from "@mui/material";
import { styled } from "@mui/material/styles";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import EmailIcon from "@material-ui/icons/Email";
import LockIcon from "@material-ui/icons/Lock";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import { Helmet } from "react-helmet";

import api, { openApi } from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import defaultLoginLogo from "../../assets/login-logo-default.png";

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#0a0f1e",
    backgroundImage:
      "radial-gradient(60rem 30rem at 15% -10%, rgba(109, 94, 252, 0.24) 0%, rgba(109, 94, 252, 0) 60%), radial-gradient(50rem 25rem at 100% 0%, rgba(34, 211, 238, 0.18) 0%, rgba(34, 211, 238, 0) 55%), #0a0f1e",
  },
  rootWithBackground: {
    backgroundColor: "#05070f",
  },
  backgroundOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    background:
      "linear-gradient(180deg, rgba(15, 23, 42, 0.5) 0%, rgba(15, 23, 42, 0.32) 100%)",
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
  formContainer: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: "410px",
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderRadius: "28px",
    boxShadow:
      "0 40px 90px -25px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.02)",
    padding: "26px 34px 18px",
    margin: "24px",
    overflow: "hidden",
    animation: "$fadeIn .55s cubic-bezier(0.16, 1, 0.3, 1)",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "360px",
      padding: "20px 22px 14px",
      margin: "14px",
      borderRadius: "22px",
    },
  },
  "@keyframes fadeIn": {
    "0%": { opacity: 0, transform: "translateY(18px) scale(0.96)" },
    "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
  },
  logoImg: {
    display: "block",
    margin: "0 auto 14px",
    maxWidth: "210px",
    height: "auto",
    filter: "drop-shadow(0 8px 16px rgba(15, 23, 42, 0.18))",
  },
  heading: {
    textAlign: "center",
    marginBottom: 4,
    color: "#eef1fb",
    fontFamily: '"Space Grotesk", "Inter", sans-serif',
    fontSize: "1.45rem",
    fontWeight: 700,
    letterSpacing: "-0.3px",
    lineHeight: 1.2,
  },
  subtitle: {
    textAlign: "center",
    color: "#9aa6c4",
    marginBottom: 10,
    fontSize: "0.82rem",
    fontWeight: 400,
  },
  submitBtn: {
    position: "relative",
    overflow: "hidden",
    marginTop: "12px",
    backgroundImage: theme.palette.brandGradient || `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: "#fff",
    borderRadius: "14px",
    padding: "13px",
    fontWeight: 700,
    textTransform: "none",
    fontSize: 14,
    width: "100%",
    boxShadow: `0 0 0 1px rgba(109,94,252,0.4), 0 14px 28px -12px ${theme.palette.primary.main}`,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: `0 0 0 1px rgba(109,94,252,0.55), 0 18px 34px -12px ${theme.palette.primary.main}`,
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },
  registerBtn: {
    backgroundColor: `${theme.palette.primary.main}18`,
    color: theme.palette.primary.dark,
    border: `1.5px solid ${theme.palette.primary.main}40`,
    borderRadius: "14px",
    padding: "13px",
    fontWeight: 700,
    textTransform: "none",
    fontSize: 14,
    width: "100%",
    marginTop: "10px",
    boxShadow: "none",
    transition: "background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
    "&:hover": {
      backgroundColor: `${theme.palette.primary.main}28`,
      borderColor: theme.palette.primary.main,
      boxShadow: "none",
      transform: "translateY(-2px)",
    },
  },
  divider: {
    display: "flex",
    alignItems: "center",
    margin: "12px 0 4px",
    color: "#5c6790",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    "&::before, &::after": {
      content: '""',
      flex: 1,
      height: "1px",
      background: "rgba(255, 255, 255, 0.1)",
    },
    "&::before": { marginRight: 12 },
    "&::after": { marginLeft: 12 },
  },
  forgotPassword: { marginTop: "10px", textAlign: "center" },
  forgotPasswordLink: {
    color: theme.palette.primary.main,
    textDecoration: "none",
    fontWeight: "600",
    fontSize: 12.5,
    "&:hover": { textDecoration: "underline" },
  },
  rememberMeContainer: {
    display: "flex",
    alignItems: "center",
    marginTop: "10px",
  },
  versionCompany: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: 500,
    color: "#5c6790",
    letterSpacing: "0.04em",
  },
  whatsappButton: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#25D366",
    borderRadius: "999px",
    height: "58px",
    width: "58px",
    padding: 0,
    justifyContent: "center",
    boxShadow: "0 10px 28px -6px rgba(4, 64, 18, 0.6)",
    cursor: "pointer",
    zIndex: 999,
    overflow: "hidden",
    transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease, box-shadow 0.2s ease",
    animation: "$pulse 2.6s infinite",
    "&:hover": {
      width: "190px",
      justifyContent: "flex-start",
      paddingLeft: "17px",
      backgroundColor: "#1ebe5b",
      transform: "scale(1.03)",
      animation: "none",
      "& $whatsappLabel": {
        maxWidth: "140px",
        marginLeft: "10px",
        opacity: 1,
      },
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
  },
  input: {
    "& .MuiOutlinedInput-root": {
      borderRadius: "14px",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      color: "#eef1fb",
      transition: "background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
      "& fieldset": {
        borderColor: "rgba(255, 255, 255, 0.14)",
      },
      "&:hover fieldset": {
        borderColor: theme.palette.primary.main,
      },
      "&.Mui-focused": {
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        boxShadow: `0 0 0 4px ${theme.palette.primary.main}26`,
        transform: "translateY(-1px)",
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        borderWidth: "1.5px",
      },
    },
    "& .MuiInputLabel-root": {
      color: "#9aa6c4",
    },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": {
      color: "#5c6790",
    },
  },
}));

const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

// resolve URL vinda do backend (relativa ou absoluta) com fallback
const resolveImageUrl = (value, fallback) => {
  if (!value) return fallback;
  if (value.startsWith("http")) return value;
  if (!backendUrl) return value;
  const base = backendUrl.replace(/\/+$/, "");
  const clean = value.replace(/^\/+/, "");
  return `${base}/${clean}`;
};

const isDefaultBackendBackground = (value) => {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return normalized.includes("/public/branding/login-background-default");
};

const IOSSwitch = styled((props) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(() => ({
  width: 34,
  height: 20,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 0,
    margin: 2,
    transitionDuration: "200ms",
    "&.Mui-checked": {
      transform: "translateX(14px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#34c759",
        opacity: 1,
        border: 0,
      },
    },
    "&.Mui-disabled + .MuiSwitch-track": {
      opacity: 0.5,
    },
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    width: 16,
    height: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
  },
  "& .MuiSwitch-track": {
    borderRadius: 20 / 2,
    backgroundColor: "#d1d5db",
    opacity: 1,
    transition: "background-color 200ms ease",
  },
}));

const Login = () => {
  const classes = useStyles();
  const { handleLogin } = useContext(AuthContext);

  const [user, setUser] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [branding, setBranding] = useState({
    loginLogo: "/logo.png",
    loginBackground: "",
    loginWhatsapp: "https://wa.me/5500000000000",
    companyName: "AtendeFlow",
  });

  const [error] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userCreationEnabled, setUserCreationEnabled] = useState(true);

  // ========= Tema e aparência da página =============
  useEffect(() => {
    try {
      localStorage.setItem("theme", "light");
    } catch (e) {}
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  // ========= Buscar settings globais ============
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const [{ data: brandingData }, { data: publicAppName }] =
          await Promise.all([
            api.get("/global-config/public-branding"),
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
          companyName: String(publicAppName || "").trim() || "AtendeFlow",
        });
      } catch (err) {
        console.error("Erro ao carregar branding:", err);
      }
    };

    fetchBranding();
  }, []);


  // ========== Verificar se cadastro está habilitado ==========
  useEffect(() => {
    const fetchUserCreationStatus = async () => {
      try {
        const { data } = await api.get("/settings/userCreation");
        setUserCreationEnabled(data.userCreation === "enabled");
      } catch (err) {
        setUserCreationEnabled(false);
      }
    };

    fetchUserCreationStatus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    let lang = "pt";
    try {
      lang = localStorage.getItem("i18nextLng") || "pt";
    } catch (e) {}
    i18n.changeLanguage(lang);
    handleLogin(user);
  };

  return (
    <>
      <Helmet>
        <title>{branding.companyName}</title>
      </Helmet>

      <div
        className={`${classes.root} ${branding.loginBackground ? classes.rootWithBackground : ""}`}
      >
        {!branding.loginBackground && (
          <>
            <div className={`${classes.blob} ${classes.blob1}`} />
            <div className={`${classes.blob} ${classes.blob2}`} />
            <div className={`${classes.blob} ${classes.blob3}`} />
          </>
        )}
        {!!branding.loginBackground && (
          <>
            <div className={classes.backgroundMedia}>
              <img
                src={resolveImageUrl(branding.loginBackground, "")}
                alt="Background login"
                className={classes.backgroundImg}
              />
            </div>
            <div className={classes.backgroundOverlay} />
          </>
        )}
        <form
          className={classes.formContainer}
          onSubmit={handleSubmit}
        >
          <img
            src={resolveImageUrl(branding.loginLogo, defaultLoginLogo)}
            alt="Logo"
            className={classes.logoImg}
          />

          <Typography className={classes.heading}>Entrar</Typography>
          <Typography className={classes.subtitle}>
            Acesse sua conta para continuar.
          </Typography>

          {error && <Typography color="error">{error}</Typography>}

          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            className={classes.input}
            type="email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Senha"
            variant="outlined"
            fullWidth
            margin="normal"
            className={classes.input}
            type={showPassword ? "text" : "password"}
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    style={{ color: "#374151" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <div className={classes.rememberMeContainer}>
            <IOSSwitch
              checked={user.remember}
              onChange={(e) =>
                setUser({ ...user, remember: e.target.checked })
              }
              style={{ marginRight: 8 }}
            />
            <Typography style={{ marginLeft: 4 }}>Lembrar de mim</Typography>
          </div>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            className={classes.submitBtn}
          >
            Entrar
          </Button>

          {userCreationEnabled && (
            <>
              <div className={classes.divider}>ou</div>
              <Button
                component={RouterLink}
                to="/signup"
                variant="outlined"
                className={classes.registerBtn}
              >
                Criar conta gratuita
              </Button>
            </>
          )}

          <div className={classes.forgotPassword}>
            <RouterLink
              to="/forgot-password"
              className={classes.forgotPasswordLink}
            >
              Esqueceu a senha?
            </RouterLink>
          </div>

          <Typography className={classes.versionCompany}>
            {branding.companyName}
          </Typography>
        </form>

        {/* ===== BOTÃO WHATSAPP DINÂMICO ===== */}
        <div
          className={classes.whatsappButton}
          onClick={() => window.open(branding.loginWhatsapp)}
        >
          <WhatsAppIcon className={classes.whatsappIcon} />
          <span className={classes.whatsappLabel}>Fale conosco</span>
        </div>
      </div>
    </>
  );
};

export default Login;
