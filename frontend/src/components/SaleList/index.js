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
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";

import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import VisibilityIcon from "@material-ui/icons/Visibility";
import ReceiptIcon from "@material-ui/icons/Receipt";

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
const SaleList = ({ fiscal, customers, products, fiscalConfig }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fiscal.sales.list({});
      setSales(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [fiscal]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleOpenNew = () => {
    setSelectedSale(null);
    setModalOpen(true);
  };

  const handleEdit = (sale) => {
    setSelectedSale(sale);
    setModalOpen(true);
  };

  const handleViewDetail = (sale) => {
    setSelectedSale(sale);
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
      body: "Essa ação não pode ser desfeita.",
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
        defaultCfop={fiscalConfig?.defaultCfop}
      />

      <SaleDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        sale={selectedSale}
        fiscal={fiscal}
      />

      <Box className={classes.mainHeader}>
        <div />
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
          Nova venda
        </Button>
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
                      <Tooltip title="Ver itens e notas fiscais">
                        <IconButton size="small" onClick={() => handleViewDetail(sale)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Emitir nota fiscal">
                        <IconButton size="small" onClick={() => handleViewDetail(sale)}>
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancelar venda">
                        <IconButton size="small" onClick={() => requestCancel(sale)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {sale.status === "cancelled" && (
                    <Tooltip title="Ver itens">
                      <IconButton size="small" onClick={() => handleViewDetail(sale)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
      </Paper>
    </div>
  );
};

export default SaleList;
