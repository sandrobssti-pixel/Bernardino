import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import moment from "moment";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import TablePagination from "@material-ui/core/TablePagination";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";

import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import VisibilityIcon from "@material-ui/icons/Visibility";
import ReceiptIcon from "@material-ui/icons/Receipt";
import PublishIcon from "@material-ui/icons/Publish";

import TableRowSkeleton from "../TableRowSkeleton";
import ConfirmationModal from "../ConfirmationModal";
import SaleModal from "../SaleModal";
import SaleDetailModal from "../SaleDetailModal";
import toastError from "../../errors/toastError";
import { money, formatDateBR } from "../../utils/financeFormat";

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },
  mainHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2),
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
}));

// Tem que bater com o `limit` fixo em `SaleService.list` — só usado aqui
// pra `TablePagination` calcular quantas páginas existem.
const PAGE_SIZE = 20;

// Venda de teste (Homologação) excluível de verdade (v2.3.118) — nunca
// teve nota de Produção, e, se ainda não tem nota nenhuma, a empresa não
// está com Produção ativa agora (senão seria uma venda real aguardando
// emissão). Mesma regra usada no backend (`SaleService.remove`).
const isTestSale = (sale, fiscalConfig) => {
  const documents = sale.fiscalDocuments || [];
  if (documents.some((doc) => doc.environment === "production")) return false;
  if (documents.length === 0 && fiscalConfig?.productionEnabled) return false;
  return true;
};

// Filtro de período (Hoje/Semana/Mês/Personalizado) — resolve o preset pra
// um par startDate/endDate ("YYYY-MM-DD", igual `Sale.saleDate`, DATEONLY)
// que o backend já sabe filtrar (`SaleService.list`). "custom" usa as datas
// digitadas pelo usuário direto, sem conversão.
const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "custom", label: "Período personalizado" },
];

const resolvePeriodRange = (preset, customStart, customEnd) => {
  if (preset === "today") {
    const today = moment().format("YYYY-MM-DD");
    return { startDate: today, endDate: today };
  }
  if (preset === "week") {
    return {
      startDate: moment().startOf("week").format("YYYY-MM-DD"),
      endDate: moment().endOf("week").format("YYYY-MM-DD"),
    };
  }
  if (preset === "month") {
    return {
      startDate: moment().startOf("month").format("YYYY-MM-DD"),
      endDate: moment().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (preset === "custom") {
    return { startDate: customStart || undefined, endDate: customEnd || undefined };
  }
  return {};
};

const statusChip = (status) => {
  if (status === "confirmed") return <Chip size="small" label="Confirmada" style={{ backgroundColor: "#10b981", color: "#fff" }} />;
  if (status === "cancelled") return <Chip size="small" label="Cancelada" style={{ backgroundColor: "#6b7280", color: "#fff" }} />;
  return <Chip size="small" label="Rascunho" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />;
};

// Lista de vendas (Fase 3 — módulo fiscal, ver docs/MANUAL_TECNICO.md, seção
// 6.2). Diferente do FinanceRecordList genérico (Fases 1/2) porque uma venda
// tem itens dinâmicos e um ciclo de vida com mais estados (rascunho ->
// confirmada -> [nota fiscal emitida] / cancelada) — precisa de ações e
// modais próprios.
const SaleList = ({ fiscal, finance, customers, products, fiscalConfig }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [count, setCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFocusFiscal, setDetailFocusFiscal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [importing, setImporting] = useState(false);
  const [periodPreset, setPeriodPreset] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const fileInputRef = useRef(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = resolvePeriodRange(periodPreset, customStart, customEnd);
      const data = await fiscal.sales.list({ pageNumber, startDate, endDate });
      setSales(data.records || []);
      setCount(data.count || 0);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [fiscal, pageNumber, periodPreset, customStart, customEnd]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Troca de filtro de período sempre volta pra página 1 — senão uma busca
  // nova pode abrir numa página sem resultado nenhum (mesmo padrão já usado
  // no Financeiro genérico, ver FinanceRecordList.js).
  useEffect(() => {
    setPageNumber(1);
  }, [periodPreset, customStart, customEnd]);

  const handleOpenNew = () => {
    setSelectedSale(null);
    setModalOpen(true);
  };

  const handleEdit = (sale) => {
    setSelectedSale(sale);
    setModalOpen(true);
  };

  const handleViewDetail = (sale, focusFiscal = false) => {
    setSelectedSale(sale);
    setDetailFocusFiscal(focusFiscal);
    setDetailOpen(true);
  };

  const handleSave = async (values) => {
    if (selectedSale?.id) {
      await fiscal.sales.update(selectedSale.id, values);
      toast.success("Venda atualizada com sucesso.");
    } else {
      await fiscal.sales.save(values);
      toast.success("Venda criada com sucesso.");
    }
    fetchSales();
  };

  const requestConfirm = (sale) => {
    setConfirmTarget(sale);
    setConfirmAction("confirm");
  };

  const requestCancel = (sale) => {
    setConfirmTarget(sale);
    setConfirmAction("cancel");
  };

  const requestDelete = (sale) => {
    setConfirmTarget(sale);
    setConfirmAction("delete");
  };

  const handleConfirmAction = async () => {
    try {
      if (confirmAction === "confirm") {
        await fiscal.sales.confirm(confirmTarget.id);
        toast.success("Venda confirmada — conta a receber gerada.");
      } else if (confirmAction === "cancel") {
        await fiscal.sales.cancel(confirmTarget.id);
        toast.success("Venda cancelada.");
      } else if (confirmAction === "delete") {
        await fiscal.sales.remove(confirmTarget.id);
        toast.success("Venda excluída.");
      }
      fetchSales();
    } catch (err) {
      toastError(err);
    }
    setConfirmTarget(null);
    setConfirmAction(null);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Importação de vendas históricas já faturadas no sistema anterior do
  // cliente (migração de ERP, v2.3.116) — só registra o que já existe
  // (número da nota, itens, cliente), nunca emite nada via gateway e nunca
  // mexe em estoque. Ver SaleImportService.ts.
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const summary = await fiscal.sales.importSpreadsheet(file);
      const parts = [`${summary.created} criada(s)`, `${summary.skipped} ignorada(s)`];
      toast.success(`Importação concluída: ${summary.total} nota(s) lida(s), ${parts.join(", ")}.`);
      if (summary.errors?.length) {
        summary.errors.slice(0, 5).forEach((msg) => toast.warn(msg));
      }
      fetchSales();
    } catch (err) {
      toastError(err);
    }
    setImporting(false);
  };

  const confirmModalProps = {
    confirm: {
      title: confirmTarget ? `Confirmar venda #${confirmTarget.id}?` : "",
      body: "Isso gera a conta a receber e trava os itens da venda — não é possível desfazer.",
    },
    cancel: {
      title: confirmTarget ? `Cancelar venda #${confirmTarget.id}?` : "",
      body: "A venda ficará marcada como cancelada.",
    },
    delete: {
      title: confirmTarget ? `Excluir venda #${confirmTarget.id}?` : "",
      body:
        confirmTarget?.status === "draft"
          ? "Essa ação não pode ser desfeita."
          : "Essa ação não pode ser desfeita. Exclui também os itens e as notas fiscais de teste dessa venda (nenhuma delas é de Produção) e, se houver, a conta a receber gerada — sem alterar o estoque atual.",
    },
  }[confirmAction] || { title: "", body: "" };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={confirmModalProps.title}
        open={!!confirmAction}
        onClose={() => { setConfirmTarget(null); setConfirmAction(null); }}
        onConfirm={handleConfirmAction}
      >
        {confirmModalProps.body}
      </ConfirmationModal>

      <SaleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        sale={selectedSale}
        customers={customers}
        products={products}
        finance={finance}
        defaultCfop={fiscalConfig?.defaultCfop}
        reform2027Enabled={!!fiscalConfig?.reform2027Enabled}
      />

      <SaleDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        sale={selectedSale}
        fiscal={fiscal}
        focusFiscal={detailFocusFiscal}
      />

      <Box className={classes.mainHeader}>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <TextField
            select
            variant="outlined"
            size="small"
            label="Período"
            style={{ minWidth: 180 }}
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {periodPreset === "custom" && (
            <>
              <TextField
                type="date"
                variant="outlined"
                size="small"
                label="De"
                InputLabelProps={{ shrink: true }}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <TextField
                type="date"
                variant="outlined"
                size="small"
                label="Até"
                InputLabelProps={{ shrink: true }}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          )}
        </Box>
        <Box display="flex" style={{ gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
          <Tooltip title="Importa vendas já faturadas no sistema anterior (não emite nota nem mexe em estoque)">
            <span>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PublishIcon />}
                onClick={handleImportClick}
                disabled={importing}
              >
                {importing ? "Importando..." : "Importar planilha"}
              </Button>
            </span>
          </Tooltip>
          <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Nova venda
          </Button>
        </Box>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Data</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{sale.id}</TableCell>
                <TableCell>{sale.customer?.name || "Consumidor não identificado"}</TableCell>
                <TableCell>{formatDateBR(sale.saleDate)}</TableCell>
                <TableCell align="right">{money(sale.totalValue)}</TableCell>
                <TableCell>{statusChip(sale.status)}</TableCell>
                <TableCell align="right">
                  {sale.status === "draft" && (
                    <>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(sale)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Confirmar venda">
                        <IconButton size="small" onClick={() => requestConfirm(sale)}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" onClick={() => requestDelete(sale)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {sale.status === "confirmed" && (
                    <>
                      <Tooltip title="Ver itens da venda">
                        <IconButton size="small" onClick={() => handleViewDetail(sale, false)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Emitir nota fiscal">
                        <IconButton size="small" onClick={() => handleViewDetail(sale, true)}>
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancelar venda">
                        <IconButton size="small" onClick={() => requestCancel(sale)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isTestSale(sale, fiscalConfig) && (
                        <Tooltip title="Excluir venda de teste (Homologação) — não afeta estoque">
                          <IconButton size="small" onClick={() => requestDelete(sale)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                  {sale.status === "cancelled" && (
                    <>
                      <Tooltip title="Ver itens">
                        <IconButton size="small" onClick={() => handleViewDetail(sale)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isTestSale(sale, fiscalConfig) && (
                        <Tooltip title="Excluir venda de teste (Homologação) — não afeta estoque">
                          <IconButton size="small" onClick={() => requestDelete(sale)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
            {!loading && sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhuma venda registrada ainda.
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

export default SaleList;
