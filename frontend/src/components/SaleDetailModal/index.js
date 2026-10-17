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
import TextField from "@material-ui/core/TextField";
import RefreshIcon from "@material-ui/icons/Refresh";
import DescriptionIcon from "@material-ui/icons/Description";
import ReceiptIcon from "@material-ui/icons/Receipt";
import ShoppingCartIcon from "@material-ui/icons/ShoppingCart";
import BuildIcon from "@material-ui/icons/Build";
import EmailIcon from "@material-ui/icons/Email";
import EditIcon from "@material-ui/icons/Edit";
import VisibilityIcon from "@material-ui/icons/Visibility";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CodeIcon from "@material-ui/icons/Code";

import toastError from "../../errors/toastError";
import { money, formatDateBR } from "../../utils/financeFormat";
import ConfirmationModal from "../ConfirmationModal";

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
// (travados, não editáveis depois de confirmada), os botões de emissão
// (sempre visíveis) e o histórico de tentativas anteriores.
//
// `focusFiscal` só decide se o HISTÓRICO (tabela com tentativas/erros
// antigos) já abre expandido (ícone de recibo na lista) ou recolhido atrás
// de um botão "Ver histórico" (ícone de olho) — os botões de emissão em si
// aparecem direto nos dois casos. Antes (v2.3.127) a seção inteira ficava
// escondida atrás de um botão extra, o que confundia mais do que ajudava;
// o problema real nunca foi "abrir direto", era o histórico de erro antigo
// aparecendo sem avisar (v2.3.129).
const SaleDetailModal = ({ open, onClose, sale, fiscal, focusFiscal = false }) => {
  const classes = useStyles();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(focusFiscal);
  const [emitting, setEmitting] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [emailDialogDoc, setEmailDialogDoc] = useState(null);
  const [emailValue, setEmailValue] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [correctionDialogDoc, setCorrectionDialogDoc] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [deleteDialogDoc, setDeleteDialogDoc] = useState(null);
  // Resposta bruta do gateway (JSON completo) — diagnóstico pra quando
  // `errorMessage` (já resumido) não traz detalhe suficiente (v2.3.122).
  const [rawDialogDoc, setRawDialogDoc] = useState(null);

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
    if (open) setHistoryExpanded(focusFiscal);
  }, [open, focusFiscal, sale?.id]);

  useEffect(() => {
    if (open && historyExpanded) fetchDocuments();
  }, [open, historyExpanded, fetchDocuments]);

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

  // Exclui de verdade um documento de teste (Homologação) — nunca
  // disponível pra um documento de Produção (ver botão na tabela, v2.3.118).
  const handleDeleteDocument = async () => {
    if (!deleteDialogDoc) return;
    try {
      await fiscal.fiscalDocuments.remove(deleteDialogDoc.id);
      toast.success("Nota de teste excluída.");
      await fetchDocuments();
    } catch (err) {
      toastError(err);
    }
    setDeleteDialogDoc(null);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const blob = await fiscal.fiscalDocuments.previewDanfe(sale.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      // `previewDanfe` pede responseType: "blob" (a resposta de sucesso é o
      // PDF em binário) — por causa disso, numa resposta de ERRO (502 JSON
      // do backend) o axios também devolve `err.response.data` como Blob,
      // não como objeto já parseado, e `toastError` (que só olha
      // `err.response.data.error`) sempre caía no fallback genérico "An
      // error occurred!", escondendo a mensagem real do gateway. Precisa
      // ler o Blob como texto e parsear manualmente antes de desistir e
      // cair no toastError padrão.
      const blobData = err?.response?.data;
      if (blobData instanceof Blob) {
        try {
          const text = await blobData.text();
          const parsed = JSON.parse(text);
          toast.error(parsed?.error || "Falha ao gerar a pré-visualização do DANFe.");
        } catch {
          toastError(err);
        }
      } else {
        toastError(err);
      }
    }
    setPreviewing(false);
  };

  const openEmailDialog = (doc) => {
    setEmailDialogDoc(doc);
    setEmailValue(sale.customer?.email || "");
  };

  const handleSendEmail = async () => {
    if (!emailValue.trim()) {
      toast.error("Informe pelo menos um e-mail.");
      return;
    }
    setSendingEmail(true);
    try {
      const emails = emailValue.split(",").map((e) => e.trim()).filter(Boolean);
      await fiscal.fiscalDocuments.sendEmail(emailDialogDoc.id, emails);
      toast.success("Nota fiscal enviada por e-mail.");
      setEmailDialogDoc(null);
    } catch (err) {
      toastError(err);
    }
    setSendingEmail(false);
  };

  const handleSendCorrection = async () => {
    if (correctionText.trim().length < 15) {
      toast.error("O texto da correção precisa ter pelo menos 15 caracteres.");
      return;
    }
    setSendingCorrection(true);
    try {
      await fiscal.fiscalDocuments.correctionLetter(correctionDialogDoc.id, correctionText);
      toast.success("Carta de correção enviada.");
      setCorrectionDialogDoc(null);
      setCorrectionText("");
    } catch (err) {
      toastError(err);
    }
    setSendingCorrection(false);
  };

  if (!sale) return null;

  // Valor bruto é sempre sale.totalValue (o que o cliente pagou de verdade);
  // "líquido" aqui é informativo — venda menos a parte que vai de imposto
  // (snapshot de alíquota gravado no item no momento da venda, dashboard de
  // lucro v2.3.117), não uma dedução real sobre o que foi recebido.
  const totalTax = (sale.items || []).reduce(
    (sum, item) => sum + Number(item.totalPrice || 0) * (Number(item.taxRate || 0) / 100),
    0
  );
  const netValue = Number(sale.totalValue || 0) - totalTax;

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
              <TableCell>Código</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell align="center">Qtd.</TableCell>
              <TableCell align="right">Valor unit.</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(sale.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.sku || item.product?.sku || "—"}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">{money(item.unitPrice)}</TableCell>
                <TableCell align="right">{money(item.totalPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box display="flex" flexDirection="column" alignItems="flex-end" mt={1}>
          <Typography style={{ fontWeight: 700 }}>Valor bruto: {money(sale.totalValue)}</Typography>
          <Typography variant="body2" color="textSecondary">
            Impostos: {money(totalTax)}
          </Typography>
          <Typography variant="body2" style={{ fontWeight: 700, color: "#10b981" }}>
            Valor líquido (após impostos): {money(netValue)}
          </Typography>
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
            <Button
              size="small"
              variant="outlined"
              startIcon={previewing ? <CircularProgress size={14} /> : <VisibilityIcon fontSize="small" />}
              disabled={previewing}
              onClick={handlePreview}
            >
              Pré-visualizar DANFe
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Só é possível emitir nota fiscal de uma venda confirmada.
          </Typography>
        )}

        {!historyExpanded ? (
          <Button size="small" onClick={() => setHistoryExpanded(true)} style={{ marginTop: 8 }}>
            Ver histórico de tentativas
          </Button>
        ) : loadingDocs ? (
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
                      <Typography
                        variant="caption"
                        color="error"
                        style={{ display: "block", marginTop: 2, whiteSpace: "normal", wordBreak: "break-word" }}
                      >
                        {doc.errorMessage}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{doc.number || "—"}</TableCell>
                  <TableCell style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.accessKey || "—"}
                  </TableCell>
                  <TableCell align="right">
                    {doc.status === "error" && doc.raw && (
                      <Tooltip title="Ver resposta completa do gateway">
                        <IconButton size="small" onClick={() => setRawDialogDoc(doc)}>
                          <CodeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {doc.status === "processing" && (
                      <Tooltip title="Atualizar status">
                        <IconButton size="small" onClick={() => handleRefresh(doc.id)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {doc.status === "authorized" && (
                      <>
                        <Tooltip title="Enviar por e-mail">
                          <IconButton size="small" onClick={() => openEmailDialog(doc)}>
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {doc.type === "nfe" && (
                          <Tooltip title="Carta de correção">
                            <IconButton size="small" onClick={() => setCorrectionDialogDoc(doc)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                    {doc.environment !== "production" && (
                      <Tooltip title="Excluir nota de teste (Homologação)">
                        <IconButton size="small" onClick={() => setDeleteDialogDoc(doc)}>
                          <DeleteOutlineIcon fontSize="small" />
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

      <ConfirmationModal
        title={deleteDialogDoc ? `Excluir ${DOC_TYPE_LABEL[deleteDialogDoc.type] || deleteDialogDoc.type} de teste?` : ""}
        open={!!deleteDialogDoc}
        onClose={() => setDeleteDialogDoc(null)}
        onConfirm={handleDeleteDocument}
      >
        Essa ação não pode ser desfeita. Essa nota foi emitida em Homologação (teste),
        não é uma nota fiscal real.
      </ConfirmationModal>

      <Dialog open={!!emailDialogDoc} onClose={() => setEmailDialogDoc(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Enviar nota fiscal por e-mail</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            size="small"
            margin="dense"
            label="E-mail(s)"
            placeholder="separe vários por vírgula"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogDoc(null)} disabled={sendingEmail}>
            Cancelar
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleSendEmail}
            disabled={sendingEmail}
            startIcon={sendingEmail ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Enviar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!correctionDialogDoc} onClose={() => setCorrectionDialogDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Carta de correção</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Use só pra corrigir erro que não muda valor/imposto/dados do destinatário (ex.: descrição de
            item) — qualquer coisa além disso exige cancelar e emitir de novo.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            variant="outlined"
            size="small"
            label="Texto da correção (mín. 15 caracteres)"
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCorrectionDialogDoc(null)} disabled={sendingCorrection}>
            Cancelar
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleSendCorrection}
            disabled={sendingCorrection}
            startIcon={sendingCorrection ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Enviar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rawDialogDoc} onClose={() => setRawDialogDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Resposta completa do gateway</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            JSON bruto devolvido pela Focus NFe nesta tentativa — útil quando a mensagem de erro
            não vem com detalhe suficiente.
          </Typography>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.75rem",
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 12,
              borderRadius: 8,
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {rawDialogDoc ? JSON.stringify(rawDialogDoc.raw, null, 2) : ""}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(JSON.stringify(rawDialogDoc?.raw, null, 2));
              toast.success("Copiado.");
            }}
          >
            Copiar
          </Button>
          <Button onClick={() => setRawDialogDoc(null)} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default SaleDetailModal;
