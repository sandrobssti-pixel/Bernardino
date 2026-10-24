import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { toast } from "react-toastify";
import moment from "moment";

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
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import TablePagination from "@material-ui/core/TablePagination";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Typography from "@material-ui/core/Typography";

import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import VisibilityIcon from "@material-ui/icons/Visibility";
import ReceiptIcon from "@material-ui/icons/Receipt";
import PublishIcon from "@material-ui/icons/Publish";
import GetAppIcon from "@material-ui/icons/GetApp";

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

// Mesma regra que já decide se o ícone de excluir individual aparece pra
// uma venda (rascunho sempre; confirmada/cancelada só se for de teste/
// Homologação) — reaproveitada pra decidir quais linhas podem entrar na
// seleção em massa, pra não deixar marcar algo que o backend vai recusar
// de qualquer jeito (venda com nota de Produção, `SaleService.remove`).
const isDeletable = (sale, fiscalConfig) =>
  sale.status === "draft" || isTestSale(sale, fiscalConfig);

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

// v2.3.216 (pedido do cliente, print real da venda #519): o status da
// LISTA de vendas mostrava só "Confirmada" pra uma venda que já tinha nota
// fiscal AUTORIZADA de verdade pela Sefaz — o "autorizada" só aparecia
// entrando no detalhe da venda (chip de status do documento, dentro do
// histórico). Confunde o operador, que não enxerga sem abrir se já saiu
// nota ou não. Agora deriva do mesmo `sale.fiscalDocuments` que a lista já
// recebe (mesmo include usado pelos ícones de ação logo abaixo) — sem
// chamada nova ao backend.
const hasDocumentWithStatus = (sale, status) => (sale.fiscalDocuments || []).some((doc) => doc.status === status);

const statusChip = (sale) => {
  if (sale.status === "confirmed") {
    if (hasDocumentWithStatus(sale, "authorized")) {
      return <Chip size="small" label="Autorizada" style={{ backgroundColor: "#4f46e5", color: "#fff" }} />;
    }
    if (hasDocumentWithStatus(sale, "processing")) {
      return <Chip size="small" label="Processando NF" style={{ backgroundColor: "#3b82f6", color: "#fff" }} />;
    }
    return <Chip size="small" label="Confirmada" style={{ backgroundColor: "#10b981", color: "#fff" }} />;
  }
  if (sale.status === "cancelled") return <Chip size="small" label="Cancelada" style={{ backgroundColor: "#6b7280", color: "#fff" }} />;
  return <Chip size="small" label="Rascunho" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />;
};

// Lista de vendas (Fase 3 — módulo fiscal, ver docs/MANUAL_TECNICO.md, seção
// 6.2). Diferente do FinanceRecordList genérico (Fases 1/2) porque uma venda
// tem itens dinâmicos e um ciclo de vida com mais estados (rascunho ->
// confirmada -> [nota fiscal emitida] / cancelada) — precisa de ações e
// modais próprios.
const SaleList = ({ fiscal, finance, customers, products, fiscalConfig }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  // Mesma regra do FinanceRecordList.js — admin/Master sempre pode importar,
  // usuário comum só com `allowImport` ligado no cadastro (UserModal.js).
  // Backend trava também (SaleImportController.ts).
  const canImport = user?.profile === "admin" || user?.super || user?.allowImport === "enabled";
  // Seleção em massa ("selecionar tudo da página" + excluir) é admin-only,
  // sem exceção configurável — mesma regra do FinanceRecordList.js.
  const isAdmin = user?.profile === "admin" || !!user?.super;
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [forceDeleteProduction, setForceDeleteProduction] = useState(false);
  // Formato pra baixar em massa (seleção de nota(s), igual o padrão de
  // seleção já usado pra excluir) — "pdf" por padrão, só muda se o usuário
  // trocar explicitamente.
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const [downloading, setDownloading] = useState(false);
  // "Baixar notas do período" (v2.3.220) — formato do zip (padrão: os
  // dois juntos, PDF + XML, é o que a contabilidade pede no fechamento
  // mensal).
  const [periodExportFormat, setPeriodExportFormat] = useState("both");
  const [exportingPeriod, setExportingPeriod] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = resolvePeriodRange(periodPreset, customStart, customEnd);
      const data = await fiscal.sales.list({ pageNumber, startDate, endDate });
      setSales(data.records || []);
      setCount(data.count || 0);
      setSelectedIds([]);
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
    setDetailOpen(false);
    setModalOpen(true);
  };

  const handleViewDetail = (sale, focusFiscal = false) => {
    setSelectedSale(sale);
    setDetailFocusFiscal(focusFiscal);
    setDetailOpen(true);
  };

  // "Baixar nota" direto na lista (v2.3.173, pedido do cliente: "um botão
  // que sempre baixe a nota fiscal, mesmo depois de enviada para o
  // cliente") — antes só dava pra baixar entrando no detalhe da venda.
  // Mesma lógica do `handleBulkDownload` abaixo: a lista de vendas não
  // traz `pdfUrl` (lista enxuta de propósito), busca o histórico na hora
  // e abre a nota autorizada mais recente.
  const [downloadingRowId, setDownloadingRowId] = useState(null);
  const handleDownloadRow = async (sale) => {
    setDownloadingRowId(sale.id);
    try {
      const documents = await fiscal.fiscalDocuments.list(sale.id);
      const doc = (documents || []).find((d) => d.status === "authorized" && d.pdfUrl);
      if (doc) {
        // v2.3.220: passa pelo backend (blob) em vez de abrir `doc.pdfUrl`
        // direto — mesmo caminho usado no detalhe da venda, consistente
        // pros dois lugares que baixam PDF.
        const blob = await fiscal.fiscalDocuments.downloadPdf(doc.id);
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        toast.info("Nenhuma nota autorizada encontrada pra essa venda.");
      }
    } catch (err) {
      toastError(err);
    }
    setDownloadingRowId(null);
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

  // Qualquer venda da página pode ser selecionada (não só as "normais") —
  // uma com nota de Produção só é excluída de verdade se "Também excluir
  // vendas com nota de Produção" estiver marcado na confirmação (ver
  // `forceDeleteProduction` abaixo); sem isso, o backend recusa normalmente
  // e ela aparece no resumo de falhas, igual qualquer outro erro.
  const allSelectedOnPage = sales.length > 0 && sales.every((sale) => selectedIds.includes(sale.id));
  const someSelectedOnPage = sales.some((sale) => selectedIds.includes(sale.id));
  const hasProductionInSelection = sales.some(
    (sale) => selectedIds.includes(sale.id) && !isDeletable(sale, fiscalConfig)
  );

  const toggleSelectAll = () => {
    setSelectedIds(allSelectedOnPage ? [] : sales.map((sale) => sale.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  // Reaproveita o mesmo `fiscal.sales.remove` do excluir individual.
  // `forceDeleteProduction` (pedido explícito do cliente, v2.3.143) manda
  // junto em TODAS as chamadas do lote — pra venda sem nota de Produção não
  // faz diferença nenhuma; pra venda COM nota de Produção, é o que permite
  // excluir mesmo assim (o XML autorizado pela Sefaz continua intacto na
  // Focus, só o registro local some).
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    let success = 0;
    const failures = [];
    for (const id of selectedIds) {
      try {
        await fiscal.sales.remove(id, forceDeleteProduction);
        success += 1;
      } catch (err) {
        failures.push(err?.response?.data?.error || err.message || `Venda #${id}`);
      }
    }
    setBulkDeleting(false);
    setBulkConfirmOpen(false);
    setForceDeleteProduction(false);
    if (success > 0) {
      toast.success(`${success} venda(s) excluída(s) com sucesso.`);
    }
    if (failures.length > 0) {
      toast.warn(`${failures.length} venda(s) não puderam ser excluídas.`);
      failures.slice(0, 5).forEach((msg) => toast.warn(msg));
    }
    fetchSales();
  };

  // Baixar PDF/XML em massa — pedido pra funcionar "igual os outros
  // filtros": escolhe o formato, seleciona nota a nota (ou usa "selecionar
  // tudo da página" depois de filtrar por Período) e baixa. Cada arquivo
  // abre numa aba separada (confirmado com o cliente — sem zipar tudo num
  // arquivo só). O `pdfUrl`/`xmlUrl` não vem na listagem de Vendas (lista é
  // enxuta de propósito), então busca o histórico de documentos de cada
  // venda selecionada na hora (mesmo endpoint que a tela "Ver histórico"
  // já usa, com as URLs já resolvidas pro host certo da Focus — ver
  // FiscalDocumentService.resolveDocumentUrls, seção 112).
  const handleBulkDownload = async () => {
    setDownloading(true);
    let opened = 0;
    let skipped = 0;
    for (const id of selectedIds) {
      try {
        const documents = await fiscal.fiscalDocuments.list(id);
        const doc = (documents || []).find(
          (d) => d.status === "authorized" && (downloadFormat === "pdf" ? d.pdfUrl : d.xmlUrl)
        );
        const url = doc && (downloadFormat === "pdf" ? doc.pdfUrl : doc.xmlUrl);
        if (url) {
          window.open(url, "_blank");
          opened += 1;
        } else {
          skipped += 1;
        }
      } catch (err) {
        skipped += 1;
      }
    }
    setDownloading(false);
    if (opened > 0) {
      toast.success(`${opened} ${downloadFormat.toUpperCase()} aberto(s) em nova(s) aba(s).`);
    }
    if (skipped > 0) {
      toast.warn(
        `${skipped} venda(s) sem nota autorizada com ${downloadFormat.toUpperCase()} disponível — ignorada(s).`
      );
    }
  };

  // "Baixar notas do período" (v2.3.220, pedido do cliente: "preciso de
  // um filtro pra baixar PDF e XML por período, pois no final do mês
  // tem que mandar pra contabilidade gerar o DARF do Simples Nacional")
  // — diferente do `handleBulkDownload` acima (que depende de marcar
  // manualmente as vendas da PÁGINA atual, até 20 por vez): usa direto o
  // período já escolhido no filtro ali em cima e baixa TODAS as notas
  // autorizadas daquele intervalo, de uma vez, num ZIP só (backend monta
  // o zip, ver FiscalDocumentService.exportPeriodZip).
  const handleExportPeriod = async () => {
    const { startDate, endDate } = resolvePeriodRange(periodPreset, customStart, customEnd);
    if (!startDate || !endDate) {
      toast.warn("Escolha um período (Hoje/Semana/Mês/Personalizado) antes de baixar.");
      return;
    }
    setExportingPeriod(true);
    try {
      const blob = await fiscal.fiscalDocuments.exportPeriod(startDate, endDate, periodExportFormat);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notas-fiscais-${startDate}-a-${endDate}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Mesmo motivo do handlePreview em SaleDetailModal.js: resposta de
      // erro também vem como Blob por causa do `responseType: "blob"`.
      const blobData = err?.response?.data;
      if (blobData instanceof Blob) {
        try {
          const text = await blobData.text();
          const parsed = JSON.parse(text);
          toastError({ response: { data: parsed } });
        } catch {
          toastError(err);
        }
      } else {
        toastError(err);
      }
    }
    setExportingPeriod(false);
  };

  const handleConfirmAction = async () => {
    try {
      if (confirmAction === "confirm") {
        await fiscal.sales.confirm(confirmTarget.id);
        toast.success("Venda confirmada — conta a receber gerada.");
      } else if (confirmAction === "cancel") {
        await fiscal.sales.cancel(confirmTarget.id);
        toast.success("Venda cancelada.");
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

      <ConfirmationModal
        title={`Excluir ${selectedIds.length} venda(s) selecionada(s)?`}
        open={bulkConfirmOpen}
        onClose={() => { setBulkConfirmOpen(false); setForceDeleteProduction(false); }}
        onConfirm={handleBulkDelete}
      >
        Essa ação não pode ser desfeita.
        {hasProductionInSelection && (
          <Box mt={2}>
            <Typography variant="body2" color="error" gutterBottom>
              {selectedIds.length > 1 ? "Algumas das" : "A"} venda(s) selecionada(s) tem
              nota fiscal de Produção (já autorizada pela Sefaz). Por padrão essas ficam de
              fora — a nota continua existindo normalmente na Focus, só o registro local é
              que não some sozinho.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={forceDeleteProduction}
                  onChange={(e) => setForceDeleteProduction(e.target.checked)}
                />
              }
              label="Também excluir vendas com nota de Produção"
            />
          </Box>
        )}
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
        onEdit={handleEdit}
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
          <TextField
            select
            variant="outlined"
            size="small"
            label="Baixar como"
            style={{ minWidth: 130 }}
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
          >
            <MenuItem value="pdf">PDF</MenuItem>
            <MenuItem value="xml">XML</MenuItem>
          </TextField>
          {/* "Baixar notas do período" (v2.3.220) — diferente do botão
              "Baixar selecionadas" (precisa marcar venda por venda, só
              as da página atual): baixa TODAS as notas autorizadas do
              período escolhido ali em cima, de uma vez, num ZIP só.
              Pedido do cliente pro fechamento mensal com a
              contabilidade (DARF do Simples Nacional). */}
          <TextField
            select
            variant="outlined"
            size="small"
            label="Zip do período"
            style={{ minWidth: 140 }}
            value={periodExportFormat}
            onChange={(e) => setPeriodExportFormat(e.target.value)}
          >
            <MenuItem value="both">PDF + XML</MenuItem>
            <MenuItem value="pdf">Só PDF</MenuItem>
            <MenuItem value="xml">Só XML</MenuItem>
          </TextField>
          <Tooltip title="Baixa num ZIP só todas as notas autorizadas do período escolhido acima — pro fechamento mensal com a contabilidade">
            <span>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<GetAppIcon />}
                onClick={handleExportPeriod}
                disabled={exportingPeriod}
              >
                {exportingPeriod ? "Gerando ZIP..." : "Baixar notas do período"}
              </Button>
            </span>
          </Tooltip>
        </Box>
        <Box display="flex" style={{ gap: 8 }}>
          {canImport && (
            <>
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
            </>
          )}
          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<GetAppIcon />}
              onClick={handleBulkDownload}
              disabled={downloading}
            >
              {downloading ? "Baixando..." : `Baixar selecionadas (${selectedIds.length})`}
            </Button>
          )}
          {isAdmin && selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkDeleting}
            >
              Excluir selecionadas ({selectedIds.length})
            </Button>
          )}
          <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Nova venda
          </Button>
        </Box>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={someSelectedOnPage && !allSelectedOnPage}
                  checked={allSelectedOnPage}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              {/* "Nº Venda" (v2.3.218, pedido do cliente) — era o `id`
                  interno do banco (confuso, não sequencial-bonito tipo o
                  código do cliente). Agora mostra `sale.saleNumber`
                  (sequencial PRÓPRIO da venda, por empresa — ver
                  comentário em Sale.ts: não reaproveita o código do
                  cliente porque aí toda venda do mesmo cliente mostraria
                  o mesmo número, perdendo a função de identificar cada
                  venda). */}
              <TableCell>Nº Venda</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Data</TableCell>
              <TableCell align="right">Total</TableCell>
              {/* Código do produto + Nº da nota fiscal (v2.3.217, pedido do
                  cliente) — antes só apareciam entrando no detalhe da
                  venda. Código do produto junta o SKU de todos os itens
                  (uma venda pode ter mais de um produto); nº da nota vem
                  do documento AUTORIZADO mais recente (mesmo
                  `sale.fiscalDocuments` que já decide o chip de Status). */}
              <TableCell>Código do produto</TableCell>
              <TableCell>Nº Nota Fiscal</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id} selected={selectedIds.includes(sale.id)}>
                <TableCell padding="checkbox">
                  <Tooltip
                    title={
                      isAdmin && !isDeletable(sale, fiscalConfig)
                        ? "Tem nota de Produção — só exclui marcando \"Também excluir vendas com nota de Produção\" na confirmação"
                        : ""
                    }
                  >
                    <Checkbox
                      size="small"
                      checked={selectedIds.includes(sale.id)}
                      onChange={() => toggleSelectOne(sale.id)}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{sale.saleNumber || sale.id}</TableCell>
                <TableCell>{sale.customer?.name || "Consumidor não identificado"}</TableCell>
                <TableCell>{formatDateBR(sale.saleDate)}</TableCell>
                <TableCell align="right">{money(sale.totalValue)}</TableCell>
                <TableCell>
                  {(sale.items || []).map((item) => item.sku).filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  {(sale.fiscalDocuments || []).find((d) => d.status === "authorized")?.number || "—"}
                </TableCell>
                <TableCell>{statusChip(sale)}</TableCell>
                <TableCell align="right">
                  {sale.status === "draft" && (
                    <>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(sale)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Pré-visualizar itens e valores">
                        <IconButton size="small" onClick={() => handleViewDetail(sale, false)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Confirmar venda">
                        <IconButton size="small" onClick={() => requestConfirm(sale)}>
                          <CheckCircleIcon fontSize="small" />
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
                      {!sale.fiscalDocuments?.some((d) => ["authorized", "processing"].includes(d.status)) && (
                        <Tooltip title="Editar (corrigir antes de emitir)">
                          <IconButton size="small" onClick={() => handleEdit(sale)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* Rótulo muda pra "Ver nota fiscal" assim que já existe
                          documento autorizado/processando (v2.3.216) — o
                          ícone continua abrindo a mesma tela (agora sem os
                          botões de emitir de novo, ver SaleDetailModal.js),
                          mas não pode mais dizer "Emitir" pro operador não
                          entender que ainda precisa/pode clicar pra gerar
                          outra nota. */}
                      <Tooltip
                        title={
                          sale.fiscalDocuments?.some((d) => ["authorized", "processing"].includes(d.status))
                            ? "Ver nota fiscal"
                            : "Emitir nota fiscal"
                        }
                      >
                        <IconButton size="small" onClick={() => handleViewDetail(sale, true)}>
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {sale.fiscalDocuments?.some((d) => d.status === "authorized") && (
                        <Tooltip title="Baixar nota (PDF)">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadRow(sale)}
                            disabled={downloadingRowId === sale.id}
                          >
                            <GetAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* "Cancelar venda" (X) só aparece SEM nota real —
                          bug real corrigido na v2.3.218: esse botão
                          cancelava a venda por baixo (devolve estoque,
                          cancela cobrança) sem nunca cancelar a NF-e de
                          verdade na Sefaz, deixando uma nota AUTORIZADA
                          "esquecida" enquanto o sistema já achava que
                          estava tudo cancelado. Com nota real, o único
                          caminho agora é "Cancelar nota" (dentro de "Ver
                          nota fiscal" acima), que cancela a Sefaz PRIMEIRO
                          e só depois cancela a venda por baixo — mesmo
                          prazo real de 24h da Sefaz pra cancelamento de
                          NF-e, avisado lá (SaleDetailModal.js). */}
                      {!sale.fiscalDocuments?.some((d) => ["authorized", "processing"].includes(d.status)) && (
                        <Tooltip title="Cancelar venda">
                          <IconButton size="small" onClick={() => requestCancel(sale)}>
                            <CancelIcon fontSize="small" />
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
                      {sale.fiscalDocuments?.some((d) => d.status === "authorized") && (
                        <Tooltip title="Baixar nota (PDF)">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadRow(sale)}
                            disabled={downloadingRowId === sale.id}
                          >
                            <GetAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={9} />}
            {!loading && sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
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
