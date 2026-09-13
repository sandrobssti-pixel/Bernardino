import { makeStyles } from '@material-ui/core/styles';
export default makeStyles(theme => ({
  reviewWrap: {
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(160deg, rgba(30,41,59,0.65) 0%, rgba(17,24,39,0.9) 100%)"
        : "linear-gradient(160deg, #f7fbff 0%, #eef6ff 100%)",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148,163,184,0.28)" : "#d4e5fb"}`,
    borderRadius: 16,
    padding: theme.spacing(2.5),
    boxShadow:
      theme.palette.type === "dark"
        ? "0 14px 36px rgba(2,6,23,0.5)"
        : "0 14px 36px rgba(15,23,42,0.09)"
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: 0.2,
    marginBottom: theme.spacing(0.5)
  },
  headerSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.86rem",
    marginBottom: theme.spacing(2)
  },
  summaryCard: {
    borderRadius: 14,
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148,163,184,0.25)" : "#d9e7fb"}`,
    background: theme.palette.type === "dark" ? "rgba(15,23,42,0.4)" : "#ffffff"
  },
  sectionTitle: {
    fontSize: "0.92rem",
    fontWeight: 700,
    marginBottom: theme.spacing(1.5)
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.7, 0),
    borderBottom: `1px dashed ${theme.palette.type === "dark" ? "rgba(148,163,184,0.25)" : "#dfeafb"}`,
    "&:last-child": {
      borderBottom: "none",
      paddingBottom: 0
    }
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.82rem",
    fontWeight: 600
  },
  rowValue: {
    fontSize: "0.88rem",
    fontWeight: 600,
    textAlign: "right",
    wordBreak: "break-word"
  },
  totalValue: {
    color: theme.palette.primary.main,
    fontWeight: 800,
    fontSize: "1rem"
  },
  tag: {
    marginTop: theme.spacing(1.5),
    display: "inline-flex",
    alignItems: "center",
    padding: theme.spacing(0.4, 1.1),
    borderRadius: 999,
    fontSize: "0.73rem",
    fontWeight: 700,
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148,163,184,0.4)" : "#c8dcfb"}`,
    color: theme.palette.type === "dark" ? "#dbeafe" : "#1d4ed8",
    background: theme.palette.type === "dark" ? "rgba(30,64,175,0.2)" : "#eff6ff"
  },
  responsiveColumn: {
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    }
  },
  listItem: {
    padding: theme.spacing(1, 0)
  },
  total: {
    fontWeight: '700'
  },
  title: {
    marginTop: theme.spacing(2)
  }
}));
