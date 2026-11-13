import React, { useState, useEffect, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { AuthContext } from "../../context/Auth/AuthContext";
import useMembers from "../../hooks/useMembers";
import FinanceRecordList from "../../components/FinanceRecordList";
import MemberEditDialog from "./MemberEditDialog";
import CompanyCertificateSettings from "./CompanyCertificateSettings";
import CompanyGeofenceSettings from "./CompanyGeofenceSettings";
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

// Gerenciador CAC — cadastro de associados/atiradores, módulo add-on
// genérico (Plan.useMembers, mesmo padrão de gate de acesso do
// WeaponDispatch/HR) — nome neutro de propósito, pensado pra servir
// qualquer clube de tiro cliente, não só o Cactus. Ver
// docs/MANUAL_TECNICO.md.
//
// Editar/Novo abrem MemberEditDialog (Dados/Endereço/Financeiro/
// Documentos/Controle de Acesso) em vez do modal genérico de
// campo-config do FinanceRecordList (onEditOverride/onCreateOverride) —
// essa tela não tinha NENHUMA dessas seções até a v2.3.275, bug real
// reportado pelo cliente (só existiam na aba "Gerenciador CAC" do
// Contato). `key={refreshToken}` força o FinanceRecordList a recarregar
// a lista ao fechar o diálogo — mesmo padrão já usado em
// Financeiro/index.js (seção 260 do manual).
const Members = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const members = useMembers();
  const [access, setAccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

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

  const handleCreateOverride = () => {
    setEditingMemberId(null);
    setDialogOpen(true);
  };

  const handleEditOverride = (record) => {
    setEditingMemberId(record.id);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMemberId(null);
    setRefreshToken((t) => t + 1);
  };

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
              Módulo Gerenciador CAC não disponível
            </Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Gerenciador CAC."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <CompanyCertificateSettings />
      <CompanyGeofenceSettings />
      <FinanceRecordList
        key={refreshToken}
        title="Associado"
        resource={members}
        columns={memberColumns}
        fields={memberFields}
        enablePhotoUpload
        onEditOverride={handleEditOverride}
        onCreateOverride={handleCreateOverride}
      />
      <MemberEditDialog
        open={dialogOpen}
        memberId={editingMemberId}
        onClose={handleCloseDialog}
      />
    </div>
  );
};

export default Members;
