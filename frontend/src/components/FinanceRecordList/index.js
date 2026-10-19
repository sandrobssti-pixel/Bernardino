import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

import { AuthContext } from "../../context/Auth/AuthContext";

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
import Checkbox from "@material-ui/core/Checkbox";

import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PublishIcon from "@material-ui/icons/Publish";
import GetAppIcon from "@material-ui/icons/GetApp";
import PrintIcon from "@material-ui/icons/Print";

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
  printArea: {
    display: "none",
  },
  // Só a área de impressão (tabela simples, montada na hora a partir do
  // mesmo `columns`/`records` da tela) vai pro papel/PDF — mesma técnica já
  // usada em FinancePainel/index.js (window.print() + @media print, sem
  // gerar PDF no servidor). Ver docs/MANUAL_TECNICO.md.
  "@global": {
    "@media print": {
      "body *": {
        visibility: "hidden",
      },
      "#finance-record-list-print-area, #finance-record-list-print-area *": {
        visibility: "visible",
      },
      "#finance-record-list-print-area": {
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
      },
    },
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
  initialFilterValues = {},
  finance,
  allowImport = false,
  allowTemplateDownload = false,
  templateFilename,
  context = {},
  enablePayments = false,
}) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  // Botão "Importar planilha" é admin-only por padrão — usuário comum só
  // vê se `allowImport` estiver ligado explicitamente no cadastro dele
  // (ver UserModal.js). Backend também trava (FinanceImportController.ts),
  // isso aqui é só pra não mostrar um botão que vai dar 403.
  const canImport = user?.profile === "admin" || user?.super || user?.allowImport === "enabled";
  // Imprimir/exportar PDF/Excel — permissão separada de `allowImport`
  // (UserModal.js). 100% client-side, sem endpoint pra proteger.
  const canExport = user?.profile === "admin" || user?.super || user?.allowExport === "enabled";
  // Seleção em massa ("selecionar tudo da página" + excluir) é admin-only,
  // sem exceção configurável — pedido explícito do cliente, diferente do
  // `allowImport` acima (esse não tem toggle por usuário).
  const isAdmin = user?.profile === "admin" || !!user?.super;
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printRows, setPrintRows] = useState(null);
  // Valor inicial vem do link que trouxe o usuário pra essa aba (ex.: menu
  // lateral Financeiro > Produtos > Armas nacionais, ver MainListItems.js) —
  // só lido na primeira renderização; a tela troca de filtro navegando de
  // novo (o `key` em Financeiro/index.js remonta o componente).
  const [filterValues, setFilterValues] = useState(initialFilterValues);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resource.list({ searchParam, pageNumber, ...filterValues });
      setRecords(data.records || []);
      setCount(data.count || 0);
      setSelectedIds([]);
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

  const allSelectedOnPage = records.length > 0 && records.every((r) => selectedIds.includes(r.id));
  const someSelectedOnPage = records.some((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelectedOnPage ? [] : records.map((r) => r.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  // Exclui um a um reaproveitando o mesmo `resource.remove` do botão de
  // excluir individual — mantém qualquer regra de negócio que já exista ali
  // (ex.: venda com nota de produção não pode ser excluída) em vez de um
  // endpoint de exclusão em massa novo que precisaria reimplementar tudo
  // isso. Sequencial de propósito (não Promise.all), pra não sobrecarregar
  // o servidor numa seleção grande.
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    let success = 0;
    const failures = [];
    for (const id of selectedIds) {
      try {
        await resource.remove(id);
        success += 1;
      } catch (err) {
        failures.push(err?.response?.data?.error || err.message || `Registro #${id}`);
      }
    }
    setBulkDeleting(false);
    setBulkConfirmOpen(false);
    if (success > 0) {
      toast.success(`${success} registro(s) excluído(s) com sucesso.`);
    }
    if (failures.length > 0) {
      toast.warn(`${failures.length} registro(s) não puderam ser excluídos.`);
      failures.slice(0, 5).forEach((msg) => toast.warn(msg));
    }
    fetchRecords();
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
      if (summary.errors?.length) {
        summary.errors.slice(0, 5).forEach((msg) => toast.warn(msg));
      }
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

  // Imprimir/exportar — pedido do cliente: "quando filtrar ou selecionar"
  // ter a opção. Com algo marcado na seleção em massa, usa só isso; sem
  // nada marcado, busca TODAS as páginas que batem no filtro/busca atual
  // (a tela só tem 20 por vez carregado) — por isso é assíncrono, com
  // loading próprio (`exporting`), diferente da lista já carregada em
  // `records`.
  const getExportRows = useCallback(async () => {
    if (selectedIds.length > 0) {
      return records.filter((r) => selectedIds.includes(r.id));
    }
    let all = [];
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = await resource.list({ searchParam, pageNumber: page, ...filterValues });
      all = all.concat(data.records || []);
      if (!data.hasMore) break;
      page += 1;
    }
    return all;
  }, [selectedIds, records, resource, searchParam, filterValues]);

  // Mesma técnica do Painel Financeiro (FinancePainel.js): monta uma tabela
  // simples escondida (`#finance-record-list-print-area`) com os dados e
  // manda `window.print()` — o navegador que decide imprimir de verdade ou
  // "Salvar como PDF" (não gera PDF no servidor). Um pequeno delay depois de
  // `setPrintRows` dá tempo do React desenhar a tabela antes de chamar
  // print — sem isso, a primeira impressão sairia vazia.
  const handlePrint = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      if (rows.length === 0) {
        toast.warn("Nenhum registro pra imprimir.");
        return;
      }
      setPrintRows(rows);
      setTimeout(() => {
        window.print();
        setPrintRows(null);
      }, 150);
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(false);
    }
  };

  // Mesmo padrão já usado em FinancePainel.js/Reports.js —
  // XLSX.utils.json_to_sheet + XLSX.writeFile, direto no navegador. Usa o
  // valor "cru" do campo (`record[col.field]`), não `col.render` — colunas
  // que mostram um chip/ícone na tela (ex. status "Ativo"/"Inativo") vão pro
  // Excel com o valor original da coluna, não o rótulo formatado.
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const rows = await getExportRows();
      if (rows.length === 0) {
        toast.warn("Nenhum registro pra exportar.");
        return;
      }
      const sheetRows = rows.map((record) => {
        const row = {};
        columns.forEach((col) => {
          row[col.label] = record[col.field];
        });
        return row;
      });
      const sheet = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, title.slice(0, 31) || "Dados");
      XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={`Excluir ${selectedIds.length} registro(s) selecionado(s)?`}
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
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
        context={context}
        canExport={canExport}
        enablePayments={enablePayments}
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
          {allowImport && canImport && (
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
          {isAdmin && selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkDeleting}
            >
              Excluir selecionados ({selectedIds.length})
            </Button>
          )}
          {canExport && (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                disabled={exporting}
              >
                {selectedIds.length > 0
                  ? `Imprimir / PDF (${selectedIds.length})`
                  : "Imprimir / Exportar PDF"}
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<GetAppIcon />}
                onClick={handleExportExcel}
                disabled={exporting}
              >
                {selectedIds.length > 0
                  ? `Exportar Excel (${selectedIds.length})`
                  : "Exportar Excel"}
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
              {isAdmin && (
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={someSelectedOnPage && !allSelectedOnPage}
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
              )}
              {columns.map((col) => (
                <TableCell key={col.field}>{col.label}</TableCell>
              ))}
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} selected={selectedIds.includes(record.id)}>
                {isAdmin && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => toggleSelectOne(record.id)}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.field}>
                    {col.render ? col.render(record) : record[col.field]}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(record)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={columns.length + (isAdmin ? 2 : 1)} />}
            {!loading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (isAdmin ? 2 : 1)} align="center">
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

      {printRows && (
        <div id="finance-record-list-print-area" className={classes.printArea}>
          <h2>{title}</h2>
          <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.field} style={{ textAlign: "left", borderBottom: "1px solid #000" }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printRows.map((record) => (
                <tr key={record.id}>
                  {columns.map((col) => (
                    <td key={col.field} style={{ borderBottom: "1px solid #ddd" }}>
                      {col.render ? col.render(record) : record[col.field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
