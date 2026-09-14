import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import RefreshIcon from "@material-ui/icons/Refresh";
import DescriptionIcon from "@material-ui/icons/Description";
import ReceiptIcon from "@material-ui/icons/Receipt";
import ShoppingCartIcon from "@material-ui/icons/ShoppingCart";
import BuildIcon from "@material-ui/icons/Build";

import toastError from "../../errors/toastError";
import { money, formatDateBR } from "../../utils/financeFormat";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: 700,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  emitButtons: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  emptyDocs: {
    color: theme.palette.text.secondary,
    padding: theme.spacing(2, 0),
  },
}));

const DOC_TYPE_LABEL = { nfe: "NF-e", nfce: "NFC-e", nfse: "NFS-e" };
const DOC_TYPE_ICON = { nfe: <DescriptionIcon fontSize="small" />, nfce: <ShoppingCartIcon fontSize="small" />, nfse: <BuildIcon fontSize="small" /> };

const statusChip = (status) => {
  if (status === "authorized") return <Chip size="small" label="Autorizada" style={{ backgroundColor: "#10b981", color: "#fff" }} />;
  if (status === "error") return <Chip size="small" label="Erro" style={{ backgroundColor: "#ef4444", color: "#fff" }} />;
  if (status === "cancelled") return <Chip size="small" label="Cancelada" style={{ backgroundColor: "#6b7280", color: "#fff" }} />;
  return <Chip size="small" label="Processando" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />;
};

// Detalhe de uma venda confirmada (Fase 3 — módulo fiscal): mostra os itens
// (travados, não editáveis depois de confirmada) e a seção de notas fiscais
// — histórico de tentativas de emissão + botões pra emitir uma nova.
const SaleDetailModal = ({ open, onClose, sale, fiscal }) => {
  const classes = useStyles();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [emitting, setEmitting] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!sale?.id) return;
    setLoadingDocs(true);
    try {
      const data = await fiscal.fiscalDocuments.list(sale.id);
      setDocuments(data);
    } catch (err) {
      toastError(err);
    }
    setLoadingDocs(false);
  }, [sale, fiscal]);

  useEffect(() => {
    if (open) fetchDocuments();
  }, [open, fetchDocuments]);

  const handleEmit = async (type) => {
    setEmitting(type);
    try {
      await fiscal.fiscalDocuments.emit(sale.id, type);
      toast.success(`Emissão de ${DOC_TYPE_LABEL[type]} enviada ao gateway.`);
      await fetchDocuments();
    } catch (err) {
      toastError(err);
    }
    setEmitting(null);
  };

  const handleRefresh = async (id) => {
    try {
      await fiscal.fiscalDocuments.refreshStatus(id);
      await fetchDocuments();
    } catch (err) {
      toastError(err);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth classes={{ paper: classes.dialogPaper }}>
      <DialogTitle>Venda #{sale.id}</DialogTitle>
      <DialogContent dividers={false}>
        <Typography variant="body2" color="textSecondary">
          Cliente: {sale.customer?.name || "Consumidor não identificado"} · Data:{" "}
          {formatDateBR(sale.saleDate)}
        </Typography>

        <Typography variant="subtitle2" className={classes.sectionTitle}>
          Itens
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell align="center">Qtd.</TableCell>
              <TableCell align="right">Valor unit.</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(sale.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">{money(item.unitPrice)}</TableCell>
                <TableCell align="right">{money(item.totalPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box display="flex" justifyContent="flex-end" mt={1}>
          <Typography style={{ fontWeight: 700 }}>Total: {money(sale.totalValue)}</Typography>
        </Box>

        <Divider style={{ margin: "16px 0" }} />

        <Typography variant="subtitle2" className={classes.sectionTitle}>
          Notas fiscais
        </Typography>

        {sale.status === "confirmed" ? (
          <Box className={classes.emitButtons}>
            {["nfe", "nfce", "nfse"].map((type) => (
              <Button
                key={type}
                size="small"
                variant="outlined"
                startIcon={emitting === type ? <CircularProgress size={14} /> : DOC_TYPE_ICON[type]}
                disabled={!!emitting}
                onClick={() => handleEmit(type)}
              >
                Emitir {DOC_TYPE_LABEL[type]}
              </Button>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Só é possível emitir nota fiscal de uma venda confirmada.
          </Typography>
        )}

        {loadingDocs ? (
          <Box display="flex" justifyContent="center" my={2}>
            <CircularProgress size={24} />
          </Box>
        ) : documents.length === 0 ? (
          <Box className={classes.emptyDocs} display="flex" alignItems="center" style={{ gap: 8 }}>
            <ReceiptIcon color="disabled" />
            <Typography variant="body2">Nenhuma nota fiscal emitida ainda para esta venda.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Número</TableCell>
                <TableCell>Chave de acesso</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{DOC_TYPE_LABEL[doc.type] || doc.type}</TableCell>
                  <TableCell>
                    {statusChip(doc.status)}
                    {doc.status === "error" && doc.errorMessage && (
                      <Tooltip title={doc.errorMessage}>
                        <Typography variant="caption" color="error" style={{ display: "block", marginTop: 2 }}>
                          {doc.errorMessage.slice(0, 40)}
                          {doc.errorMessage.length > 40 ? "..." : ""}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{doc.number || "—"}</TableCell>
                  <TableCell style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.accessKey || "—"}
                  </TableCell>
                  <TableCell align="right">
                    {doc.status === "processing" && (
                      <Tooltip title="Atualizar status">
                        <IconButton size="small" onClick={() => handleRefresh(doc.id)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleDetailModal;
