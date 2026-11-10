import React, { useState, useEffect, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { AuthContext } from "../../context/Auth/AuthContext";
import useMembers from "../../hooks/useMembers";
import FinanceRecordList from "../../components/FinanceRecordList";
import { memberColumns, memberFields } from "./membersConfig";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  lockedBox: {
    maxWidth: 480,
    margin: "0 auto",
    textAlign: "center",
    padding: theme.spacing(4),
  },
}));

// Associados — cadastro de membros/filiados, módulo add-on genérico
// (Plan.useMembers, mesmo padrão de gate de acesso do WeaponDispatch/HR).
// Ver docs/MANUAL_TECNICO.md.
const Members = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const members = useMembers();
  const [access, setAccess] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await members.getAccess();
        setAccess(status);
      } catch (err) {
        setAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user.super) {
    if (access === null) {
      return (
        <div className={classes.pageRoot}>
          <Box display="flex" justifyContent="center" my={6}>
            <CircularProgress />
          </Box>
        </div>
      );
    }

    if (!access.hasAccess) {
      return (
        <div className={classes.pageRoot}>
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>
              Módulo Associados não disponível
            </Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Associados."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <FinanceRecordList
        title="Associado"
        resource={members}
        columns={memberColumns}
        fields={memberFields}
        enablePhotoUpload
      />
    </div>
  );
};

export default Members;
