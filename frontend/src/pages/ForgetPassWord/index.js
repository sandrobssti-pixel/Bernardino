import {
  Box,
  Button,
  Container,
  CssBaseline,
  Grid,
  Link,
  TextField,
  Typography,
  Fade,
  Grow,
  LinearProgress,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import React, { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import toastError from "../../errors/toastError";
import api, { openApi } from "../../services/api";
import defaultLoginLogo from "../../assets/login-logo-default.png";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '100vh',
    background: "#eef1f6",
    backgroundImage:
      "radial-gradient(circle at 12% 12%, rgba(99, 102, 241, 0.16) 0%, rgba(99, 102, 241, 0) 45%), radial-gradient(circle at 88% 82%, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0) 45%), linear-gradient(160deg, #eef1f6 0%, #e2e8f0 100%)",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  container: {
    position: 'relative',
    zIndex: 1,
  },
  formBox: {
    background: 'rgba(255, 255, 255, 0.97)',
    borderRadius: '24px',
    padding: theme.spacing(4),
    boxShadow:
      '0 32px 70px -25px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    maxWidth: '380px',
    width: '100%',
  },
  logoImg: {
    display: 'block',
    margin: '0 auto 14px',
    maxWidth: 190,
    height: 'auto',
    filter: 'drop-shadow(0 8px 16px rgba(15, 23, 42, 0.18))',
  },
  title: {
    color: '#0f172a',
    fontSize: '1.45rem',
    fontWeight: 700,
    letterSpacing: '-0.3px',
    lineHeight: 1.2,
    marginBottom: theme.spacing(3),
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '14px',
      backgroundColor: '#f8fafc',
      transition: 'background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
      '& fieldset': {
        borderColor: 'rgba(148, 163, 184, 0.35)',
      },
      '&:hover fieldset': {
        borderColor: theme.palette.primary.main,
      },
      '&.Mui-focused': {
        backgroundColor: '#fff',
        boxShadow: `0 0 0 4px ${theme.palette.primary.main}26`,
        transform: 'translateY(-1px)',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
        borderWidth: '1.5px',
      },
    },
  },
  submitButton: {
    margin: theme.spacing(3, 0, 2),
    padding: '13px',
    borderRadius: '14px',
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: '#fff',
    textTransform: 'none',
    fontWeight: 700,
    fontSize: 14,
    boxShadow: `0 14px 28px -12px ${theme.palette.primary.main}`,
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 18px 34px -12px ${theme.palette.primary.main}`,
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  },
  loadingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '4px',
    '& .MuiLinearProgress-bar': {
      background: 'rgba(255, 255, 255, 0.8)',
    },
  },
  sentAnimation: {
    position: 'relative',
    background: 'linear-gradient(45deg,rgb(23, 80, 45),rgb(17, 75, 40))',
    '&:after': {
      content: '"✉️"',
      position: 'absolute',
      fontSize: '24px',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      animation: 'flyAway 1s ease-out forwards',
    },
  },
  link: {
    color: theme.palette.primary.main,
    fontWeight: 600,
    fontSize: 13,
    textDecoration: 'none',
    transition: 'text-decoration 0.2s ease',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '@keyframes flyAway': {
    '0%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    '100%': { transform: 'translate(-50%, -150%) scale(0.5)', opacity: 0 },
  },
  whatsappButton: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 999,
    width: 58,
    height: 58,
    padding: 0,
    justifyContent: 'center',
    boxShadow: '0 10px 28px -6px rgba(4, 64, 18, 0.6)',
    cursor: 'pointer',
    zIndex: 999,
    overflow: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease, box-shadow 0.2s ease',
    animation: '$pulse 2.6s infinite',
    '&:hover': {
      width: 190,
      justifyContent: 'flex-start',
      paddingLeft: 17,
      backgroundColor: '#1ebe5b',
      transform: 'scale(1.03)',
      animation: 'none',
      '& $whatsappLabel': {
        maxWidth: 140,
        marginLeft: 10,
        opacity: 1,
      },
    },
  },
  whatsappLabel: {
    display: 'inline-block',
    maxWidth: 0,
    marginLeft: 0,
    color: '#fff',
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    opacity: 0,
    transition: 'max-width 0.3s ease, margin-left 0.3s ease, opacity 0.2s ease 0.1s',
  },
  '@keyframes pulse': {
    '0%': { boxShadow: '0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 0 rgba(37, 211, 102, 0.5)' },
    '70%': { boxShadow: '0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 16px rgba(37, 211, 102, 0)' },
    '100%': { boxShadow: '0 10px 28px -6px rgba(4, 64, 18, 0.6), 0 0 0 0 rgba(37, 211, 102, 0)' },
  },
  whatsappIcon: {
    fontSize: 30,
    color: '#fff',
    flexShrink: 0,
  },
}));

const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

const resolveImageUrl = (value, fallback) => {
  if (!value) return fallback;
  if (value.startsWith("http")) return value;
  if (!backendUrl) return value;
  const base = backendUrl.replace(/\/+$/, "");
  const clean = value.replace(/^\/+/, "");
  return `${base}/${clean}`;
};

const EsqueciSenha = () => {
  const classes = useStyles();
  const [email, setEmail] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [branding, setBranding] = useState({
    loginLogo: "/logo.png",
    loginWhatsapp: "https://wa.me/5500000000000",
  });

  React.useEffect(() => {
    setVisivel(true);
  }, []);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data } = await openApi.get("/global-config/public-branding");
        setBranding({
          loginLogo: data.loginLogo || "/logo.png",
          loginWhatsapp: data.loginWhatsapp || "https://wa.me/5500000000000",
        });
      } catch (err) {
        // segue com fallback local
      }
    };
    fetchBranding();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setEnviando(false);
      setEnviado(true);
      toast.success("Link de redefinição de senha enviado com sucesso");
      setTimeout(() => setEnviado(false), 2000); // Reset após 2 segundos
    } catch (err) {
      setEnviando(false);
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <CssBaseline />
      <Fade in={visivel} timeout={1000}>
        <Container className={classes.container} maxWidth="xs">
          <Grow in={visivel} timeout={1200}>
            <Box className={classes.formBox}>
              <img
                src={resolveImageUrl(branding.loginLogo, defaultLoginLogo)}
                alt="Logo"
                className={classes.logoImg}
              />
              <Typography variant="h4" className={classes.title}>
                Redefinir Senha
              </Typography>
              <form className={classes.form} noValidate onSubmit={handleSubmit}>
                <TextField
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Digite seu e-mail"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={classes.textField}
                  disabled={enviando}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={`${classes.submitButton} ${enviado ? classes.sentAnimation : ''}`}
                  disabled={enviando || enviado}
                >
                  {enviando ? "Enviando..." : enviado ? "Enviado!" : "Enviar Link de Redefinição"}
                  {enviando && (
                    <LinearProgress className={classes.loadingBar} />
                  )}
                </Button>
                <Grid container justifyContent="center">
                  <Grid item>
                    <Link
                      component={RouterLink}
                      to="/login"
                      className={classes.link}
                    >
                      Voltar ao Login
                    </Link>
                  </Grid>
                </Grid>
              </form>
            </Box>
          </Grow>
        </Container>
      </Fade>
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

export default EsqueciSenha;
