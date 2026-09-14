import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";

import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import TableRowSkeleton from "../TableRowSkeleton";
import ConfirmationModal from "../ConfirmationModal";
import FinanceRecordModal from "../FinanceRecordModal";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  mainHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  searchField: {
    minWidth: 240,
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
}));

// Lista + CRUD genérico do módulo Financeiro (Fase 1 — clientes,
// fornecedores, produtos). Ver docs/MANUAL_TECNICO.md, seção 6.2.
const FinanceRecordList = ({ title, resource, columns, fields }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchParam, setSearchParam] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resource.list({ searchParam });
      setRecords(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchRecords]);

  const handleOpenNew = () => {
    setSelectedRecord(null);
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    if (selectedRecord?.id) {
      await resource.update(selectedRecord.id, values);
      toast.success("Registro atualizado com sucesso.");
    } else {
      await resource.save(values);
      toast.success("Registro adicionado com sucesso.");
    }
    fetchRecords();
  };

  const handleRequestDelete = (record) => {
    setDeleteTarget(record);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await resource.remove(deleteTarget.id);
      toast.success("Registro excluído com sucesso.");
      fetchRecords();
    } catch (err) {
      toastError(err);
    }
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={deleteTarget ? `Excluir "${deleteTarget.name}"?` : ""}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <FinanceRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        title={title}
        fields={fields}
        record={selectedRecord}
      />

      <Box className={classes.mainHeader}>
        <TextField
          className={classes.searchField}
          placeholder={`Pesquisar ${title.toLowerCase()}...`}
          variant="outlined"
          size="small"
          value={searchParam}
          onChange={(e) => setSearchParam(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenNew}
        >
          Novo(a) {title}
        </Button>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field}>{col.label}</TableCell>
              ))}
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                {columns.map((col) => (
                  <TableCell key={col.field}>
                    {col.render ? col.render(record) : record[col.field]}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(record)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleRequestDelete(record)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={columns.length + 1} />}
            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export const ActiveChip = ({ active }) => (
  <Chip
    size="small"
    label={active === false ? "Inativo" : "Ativo"}
    color={active === false ? "default" : "primary"}
    variant={active === false ? "outlined" : "default"}
  />
);

export default FinanceRecordList;
