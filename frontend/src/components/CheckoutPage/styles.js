import { makeStyles } from '@material-ui/core/styles';
export default makeStyles(theme => ({
  pageTitle: {
    fontWeight: 700,
    letterSpacing: 0.2,
    fontSize: "1.22rem",
  },
  stepper: {
    padding: theme.spacing(1.5, 0, 2.5),
    marginBottom: theme.spacing(1),
    background: "transparent"
  },
  stepperWrap: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148,163,184,0.24)" : "#d8e7fb"}`,
    background: theme.palette.type === "dark" ? "rgba(15,23,42,0.35)" : "#ffffff",
    padding: theme.spacing(0.5, 1.5),
    marginBottom: theme.spacing(1.5),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.2, 0.6),
    }
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: "center",
    marginTop: theme.spacing(1.5),
    [theme.breakpoints.down("sm")]: {
      justifyContent: "stretch",
      flexDirection: "column-reverse",
      gap: theme.spacing(1),
      "& > *": {
        width: "100%"
      }
    }
  },
  button: {
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(1)
  },
  wrapper: {
    margin: theme.spacing(1),
    position: 'relative'
  },
  buttonProgress: {
    position: 'absolute',
    top: '50%',
    left: '50%'
  },
  payHint: {
    background: theme.palette.type === "dark" ? "rgba(30,41,59,0.6)" : "#eef7ff",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148,163,184,0.28)" : "#cfe3ff"}`,
    padding: theme.spacing(1.2, 1.5),
    borderRadius: 12,
    marginTop: theme.spacing(1.5),
  }
}));
