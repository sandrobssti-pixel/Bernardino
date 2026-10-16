import React, { useState, useEffect, useCallback, useRef } from "react";
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
import MenuItem from "@material-ui/core/MenuItem";
import TablePagination from "@material-ui/core/TablePagination";

import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PublishIcon from "@material-ui/icons/Publish";
import GetAppIcon from "@material-ui/icons/GetApp";

import TableRowSkeleton from "../TableRowSkeleton";
import ConfirmationModal from "../ConfirmationModal";
import FinanceRecordModal from "../FinanceRecordModal";
import toastError from "../../errors/toastError";

// Tem que bater com o `limit` fixo no backend (`FinanceCustomerService.list`,
// `FinanceProductService.list`, etc.) — não é um valor configurável aqui,
// só usado pra `TablePagination` calcular quantas páginas existem.
const PAGE_SIZE = 20;

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
// fornecedores, produtos; Fase 2 — contas a pagar/receber). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.
//
// `filters` (Fase 2, opcional): lista de `{ name, label, options }` — cada um
// vira um select ao lado da busca, cujo valor é enviado como query param
// pro `resource.list(...)` (ex.: filtrar contas por status). `finance`
// (opcional): o hook `useFinance()` inteiro, repassado ao modal só pra
// resolver campos "asyncSelect" (ex.: escolher fornecedor/cliente).
const FinanceRecordList = ({
  title,
  resource,
  columns,
  fields,
  filters = [],
  finance,
  allowImport = false,
  allowTemplateDownload = false,
  templateFilename,
}) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resource.list({ searchParam, pageNumber, ...filterValues });
      setRecords(data.records || []);
      setCount(data.count || 0);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // `resource` faz parte das deps de propósito: sem isso, trocar de aba
    // (ex.: "Contas a Pagar" -> "Contas a Receber") reaproveita a mesma
    // instância do componente e o fetch antigo, memoizado só em
    // searchParam/filterValues, continuava lendo o recurso ERRADO — a
    // tela mostrava os registros da aba anterior. `renderPanel` em
    // Financeiro/index.js também usa `key={financeTab}` como reforço, pra
    // garantir estado limpo (busca, filtros) a cada troca de aba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, filterValues, resource]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchRecords]);

  // A lista inteira é paginada no servidor (20 por página, fixo — ver
  // `FinanceCustomerService.list`/`FinanceProductService.list` etc.), mas
  // até a v2.3.107 a tela nunca mostrava um jeito de ir pra próxima
  // página — com mais de 20 registros, o resto ficava inacessível (só
  // dava pra achar via busca). Buscar de novo ou trocar filtro sempre
  // volta pra página 1, senão uma busca nova podia abrir numa página sem
  // resultado nenhum.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPageNumber(1);
  }, [searchParam, filterValues, resource]);

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Importação via planilha Excel (detecção automática de coluna, feita no
  // backend) — ver docs/MANUAL_TECNICO.md, seção 6.2 (Fase 6). Duplicata
  // (SKU/nome ou CPF-CNPJ/nome) atualiza o registro já existente.
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const summary = await resource.importSpreadsheet(file);
      const parts = [`${summary.created} criado(s)`, `${summary.updated} atualizado(s)`];
      if (summary.invalid > 0) parts.push(`${summary.invalid} inválido(s)/ignorado(s)`);
      toast.success(`Importação concluída: ${parts.join(", ")}.`);
      fetchRecords();
    } catch (err) {
      toastError(err);
    }
    setImporting(false);
  };

  // Planilha-modelo (Fase 6) — baixa um .xlsx com as colunas que a
  // importação reconhece, já com uma linha de exemplo, pra preencher e
  // reimportar depois.
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await resource.downloadTemplate(templateFilename || "modelo-importacao.xlsx");
    } catch (err) {
      toastError(err);
    }
    setDownloadingTemplate(false);
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={
          deleteTarget
            ? `Excluir "${deleteTarget.name || deleteTarget.description}"?`
            : ""
        }
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
        finance={finance}
      />

      <Box className={classes.mainHeader}>
        <Box display="flex" flexWrap="wrap" style={{ gap: 12 }}>
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
          {filters.map((filter) => (
            <TextField
              key={filter.name}
              select
              variant="outlined"
              size="small"
              label={filter.label}
              style={{ minWidth: 160 }}
              value={filterValues[filter.name] ?? ""}
              onChange={(e) =>
                setFilterValues((prev) => ({ ...prev, [filter.name]: e.target.value }))
              }
            >
              {filter.options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
        <Box display="flex" style={{ gap: 8 }}>
          {allowTemplateDownload && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<GetAppIcon />}
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? "Baixando..." : "Baixar modelo"}
            </Button>
          )}
          {allowImport && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={handleImportFile}
              />
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PublishIcon />}
                onClick={handleImportClick}
                disabled={importing}
              >
                {importing ? "Importando..." : "Importar planilha"}
              </Button>
            </>
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenNew}
          >
            Novo(a) {title}
          </Button>
        </Box>
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
        <TablePagination
          component="div"
          count={count}
          page={pageNumber - 1}
          onPageChange={(e, newPage) => setPageNumber(newPage + 1)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count: total }) => `${from}–${to} de ${total}`}
        />
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
