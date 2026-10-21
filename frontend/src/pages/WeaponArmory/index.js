import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import Avatar from "@material-ui/core/Avatar";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ImageIcon from "@material-ui/icons/Image";

import { AuthContext } from "../../context/Auth/AuthContext";
import useWeaponArmory from "../../hooks/useWeaponArmory";
import useCompanies from "../../hooks/useCompanies";
import WeaponArmoryServiceModal from "../../components/WeaponArmoryServiceModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";

const STATUS_LABELS = {
  received: "Recebida",
  in_service: "Em serviço",
  completed: "Concluída",
  returned: "Devolvida",
};

const STATUS_COLORS = {
  received: "default",
  in_service: "primary",
  completed: "secondary",
  returned: "default",
};

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
  mainHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  logoAvatar: {
    width: 40,
    height: 40,
    cursor: "pointer",
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
  lockedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    flex: 1,
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

// Módulo Serviço Armaria (v2.3.178) — recebimento de arma pra manutenção/
// conserto (Termo de Cautela, Recebimento e Depósito de Arma de Fogo, no
// padrão da Polícia Federal). Add-on independente do Despachante Bélico
// (Plan.useWeaponArmory), mesmo padrão de acesso. Ver docs/MANUAL_TECNICO.md.
const WeaponArmory = () => {
  const classes = useStyles();
  const { user, updateUser } = useContext(AuthContext);
  const weaponArmory = useWeaponArmory();
  const companies = useCompanies();
  const logoInputRef = useRef(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchParam, setSearchParam] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Lê direto do AuthContext (não em estado local próprio) — pedido do
  // cliente: a logo sumia ao sair da tela e voltar, porque antes ficava
  // só num `useState` que não sincronizava de volta com o contexto global
  // depois do upload. Ver `updateUser` em handleLogoChange.
  const logoUrl = user?.company?.logoUrl || "";
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await weaponArmory.getAccess();
        setAccess(status);
      } catch (err) {
        setAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await weaponArmory.services.list({ searchParam });
      setRecords(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam]);

  useEffect(() => {
    if (access?.hasAccess) fetchRecords();
  }, [access, fetchRecords]);

  const handleOpenNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setSelected(record);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await weaponArmory.services.remove(deleteTarget.id);
      toast.success("Registro excluído.");
      fetchRecords();
    } catch (err) {
      toastError(err);
    }
    setDeleteTarget(null);
  };

  // Logomarca da empresa — usada no cabeçalho do Termo de Cautela impresso
  // (ver WeaponArmoryServiceModal). Cada empresa-cliente sobe a sua
  // própria (pedido explícito do cliente: nunca fixa no código).
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.companyId) return;
    setUploadingLogo(true);
    try {
      const { logoUrl: newLogoUrl } = await companies.uploadLogo(user.companyId, file);
      updateUser({ company: { ...user.company, logoUrl: newLogoUrl } });
      toast.success("Logomarca atualizada.");
    } catch (err) {
      toastError(err);
    }
    setUploadingLogo(false);
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
              Módulo Serviço Armaria não disponível
            </Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Serviço Armaria."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <WeaponArmoryServiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={fetchRecords}
        record={selected}
        weaponArmory={weaponArmory}
        companyLogoUrl={logoUrl}
      />

      <ConfirmationModal
        title={deleteTarget ? `Excluir registro de "${deleteTarget.clientName}"?` : ""}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <Box className={classes.mainHeader}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="Buscar por nome, CPF ou nº de série"
          value={searchParam}
          onChange={(e) => setSearchParam(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          {(user.profile === "admin" || user.super) && (
            <Box className={classes.logoBox}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
              <Avatar
                src={logoUrl || undefined}
                className={classes.logoAvatar}
                onClick={() => logoInputRef.current?.click()}
              >
                {!logoUrl && <ImageIcon fontSize="small" />}
              </Avatar>
              <Button
                size="small"
                variant="outlined"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <CircularProgress size={16} /> : "Anexar logomarca"}
              </Button>
            </Box>
          )}
          <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Novo registro
          </Button>
        </Box>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nº</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Arma</TableCell>
              <TableCell>Nº de série</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{String(r.id).padStart(4, "0")}</TableCell>
                <TableCell>{r.clientName}</TableCell>
                <TableCell>
                  {[r.weaponBrand, r.weaponModel].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell>{r.weaponSerialNumber || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={STATUS_LABELS[r.status] || r.status}
                    color={STATUS_COLORS[r.status] || "default"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleEdit(r)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => setDeleteTarget(r)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhum registro cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export default WeaponArmory;
