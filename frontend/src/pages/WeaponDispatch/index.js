import React, { useState, useEffect, useCallback, useContext } from "react";
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
import Avatar from "@material-ui/core/Avatar";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import PersonIcon from "@material-ui/icons/Person";

import { AuthContext } from "../../context/Auth/AuthContext";
import useWeaponDispatch from "../../hooks/useWeaponDispatch";
import useFinance from "../../hooks/useFinance";
import WeaponDispatchClientModal from "../../components/WeaponDispatchClientModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";

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
    marginBottom: theme.spacing(2),
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
  avatarSmall: {
    width: 32,
    height: 32,
  },
}));

// Módulo Despachante Bélico (gestão de clientes/processos CAC/Posse-Porte/
// Militar) — add-on independente do Financeiro (Plan.useWeaponDispatch),
// mesmo padrão de acesso do módulo de RH. Essa página é só a lista/ficha de
// clientes (Fase 2B) — a esteira (Kanban) completa fica pra uma fase
// própria. Ver docs/MANUAL_TECNICO.md.
const WeaponDispatch = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const weaponDispatch = useWeaponDispatch();
  const finance = useFinance();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [searchParam, setSearchParam] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await weaponDispatch.getAccess();
        setAccess(status);
      } catch (err) {
        setAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await weaponDispatch.clients.list({ searchParam });
      setClients(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam]);

  useEffect(() => {
    if (access?.hasAccess) fetchClients();
  }, [access, fetchClients]);

  const handleOpenNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (client) => {
    setSelected(client);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await weaponDispatch.clients.remove(deleteTarget.id);
      toast.success("Cliente excluído.");
      fetchClients();
    } catch (err) {
      toastError(err);
    }
    setDeleteTarget(null);
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
              Módulo Despachante Bélico não disponível
            </Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Despachante Bélico."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <WeaponDispatchClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={fetchClients}
        record={selected}
        weaponDispatch={weaponDispatch}
        finance={finance}
      />

      <ConfirmationModal
        title={deleteTarget ? `Excluir cliente "${deleteTarget.name}"?` : ""}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Essa ação não pode ser desfeita. Os processos já criados para esse cliente também serão perdidos.
      </ConfirmationModal>

      <Box className={classes.mainHeader}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="Buscar por nome, CPF ou WhatsApp"
          value={searchParam}
          onChange={(e) => setSearchParam(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
          Novo cliente
        </Button>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>OS</TableCell>
              <TableCell></TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>CPF</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{String(client.id).padStart(4, "0")}</TableCell>
                <TableCell>
                  <Avatar src={client.photoUrl || undefined} className={classes.avatarSmall}>
                    {!client.photoUrl && <PersonIcon fontSize="small" />}
                  </Avatar>
                </TableCell>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.cpf || "—"}</TableCell>
                <TableCell>{client.whatsapp || "—"}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleEdit(client)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => setDeleteTarget(client)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
            {!loading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhum cliente cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export default WeaponDispatch;
