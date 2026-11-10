import React, { useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import FaceIcon from "@material-ui/icons/Face";

import useMemberPortal from "../../hooks/useMemberPortal";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    backgroundColor: theme.palette.type === "light" ? "#f4f7fb" : theme.palette.background.default,
  },
  paper: {
    padding: theme.spacing(4, 3),
    borderRadius: 16,
    textAlign: "center",
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 164, 115, 0.12)",
    color: "#0ea473",
    margin: "0 auto",
    marginBottom: theme.spacing(2),
    "& svg": { fontSize: 28 },
  },
  form: {
    marginTop: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
}));

// Portal do Associado (Gerenciador CAC) — login PRÓPRIO do associado
// (CPF + PIN gerado pelo Admin do clube), independente do login de
// equipe/Admin do AtendeFlow. Página pública (DomRoute, ver
// routes/index.js) — não usa o i18n de 5 idiomas da UI de equipe, mesmo
// padrão já usado em PublicJobBoard. Ver docs/MANUAL_TECNICO.md.
const MemberPortalLogin = () => {
  const classes = useStyles();
  const history = useHistory();
  const memberPortal = useMemberPortal();
  const [document, setDocument] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document.trim() || !pin.trim()) return;

    setLoading(true);
    try {
      await memberPortal.login({ document: document.trim(), pin: pin.trim() });
      history.push("/portal/checkin");
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  return (
    <div className={classes.page}>
      <Container maxWidth="xs">
        <Paper className={classes.paper} elevation={3}>
          <div className={classes.heroIcon}>
            <FaceIcon />
          </div>
          <Typography variant="h6">Portal do Associado</Typography>
          <Typography variant="body2" color="textSecondary">
            Entre com seu CPF e o PIN fornecido pela secretaria do clube.
          </Typography>

          <form className={classes.form} onSubmit={handleSubmit}>
            <TextField
              label="CPF"
              variant="outlined"
              fullWidth
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              inputProps={{ inputMode: "numeric" }}
              autoFocus
            />
            <TextField
              label="PIN"
              variant="outlined"
              fullWidth
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Entrar"}
            </Button>
          </form>

          <Box mt={3}>
            <Typography variant="caption" color="textSecondary">
              Ainda não tem um PIN? Procure a secretaria do seu clube.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default MemberPortalLogin;
