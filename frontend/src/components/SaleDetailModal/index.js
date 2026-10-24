import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import moment from "moment";

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
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import GetAppIcon from "@material-ui/icons/GetApp";
import EditIcon from "@material-ui/icons/Edit";
import VisibilityIcon from "@material-ui/icons/Visibility";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CodeIcon from "@material-ui/icons/Code";
import PrintIcon from "@material-ui/icons/Print";
import FlagIcon from "@material-ui/icons/Flag";
import FlagOutlinedIcon from "@material-ui/icons/FlagOutlined";
import BlockIcon from "@material-ui/icons/Block";
import HistoryIcon from "@material-ui/icons/History";

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

// "Status NF" (v2.3.166, pedido do cliente): verde = autorizada, vermelho =
// erro (já mostrava o tipo do erro logo abaixo do chip, ver JSX mais
// embaixo), amarelo = "precisa modificar alguma informação"
// (`pending_correction`, novo — marcado manualmente, ver
// `togglePendingCorrection` abaixo). "Processando" passou de amarelo pra
// azul pra não ficar ambíguo com o amarelo novo, que agora tem um
// significado específico (não é só "aguardando resposta do gateway").
const statusChip = (status) => {
  if (status === "authorized") return <Chip size="small" label="Autorizada" style={{ backgroundColor: "#10b981", color: "#fff" }} />;
  if (status === "error") return <Chip size="small" label="Erro" style={{ backgroundColor: "#ef4444", color: "#fff" }} />;
  if (status === "pending_correction") return <Chip size="small" label="Precisa corrigir" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />;
  if (status === "cancelled") return <Chip size="small" label="Cancelada" style={{ backgroundColor: "#6b7280", color: "#fff" }} />;
  return <Chip size="small" label="Processando" style={{ backgroundColor: "#3b82f6", color: "#fff" }} />;
};

// Prazo de 24h pra cancelar NF-e (v2.3.218, pedido do cliente) — mesma
// regra já checada no backend (`FiscalDocumentService.cancel`), repetida
// aqui só pra desabilitar o botão achar/avisar ANTES de clicar, com uma
// mensagem clara; quem decide de verdade continua sendo o backend/Sefaz.
const isPastCancelDeadline = (doc) => {
  if (!doc?.issuedAt) return false;
  const hoursSinceIssued = (Date.now() - new Date(doc.issuedAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceIssued > 24;
};

// Detalhe de uma venda (Fase 3 — módulo fiscal): mostra os itens, os
// botões de emissão (quando confirmada) e o histórico de tentativas
// anteriores. Desde a v2.3.188, "Editar" (via `onEdit`) continua
// disponível mesmo com a venda já confirmada — dá pra corrigir um erro
// achado aqui na pré-visualização antes de emitir a nota de verdade; só
// fica bloqueado (erro vindo do backend) se já tiver nota autorizada/em
// processamento ou cobrança já gerada/paga na conta a receber, ver
// `SaleService.assertSaleEditable`.
//
// `focusFiscal` só decide se o HISTÓRICO (tabela com tentativas/erros
// antigos) já abre expandido (ícone de recibo na lista) ou recolhido atrás
// de um botão "Ver histórico" (ícone de olho) — os botões de emissão em si
// aparecem direto nos dois casos. Antes (v2.3.127) a seção inteira ficava
// escondida atrás de um botão extra, o que confundia mais do que ajudava;
// o problema real nunca foi "abrir direto", era o histórico de erro antigo
// aparecendo sem avisar (v2.3.129).
const SaleDetailModal = ({ open, onClose, sale, fiscal, focusFiscal = false, onEdit }) => {
  const classes = useStyles();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(focusFiscal);
  const [emitting, setEmitting] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [emailDialogDoc, setEmailDialogDoc] = useState(null);
  const [emailValue, setEmailValue] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  // Histórico de envios por e-mail (v2.3.190) — auditoria de quem pediu,
  // quando, pra qual(is) e-mail(s) e se deu certo, ver
  // FiscalDocumentEmailLog.ts.
  const [emailLogsDialogDoc, setEmailLogsDialogDoc] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [correctionDialogDoc, setCorrectionDialogDoc] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [sendingCorrection, setSendingCorrection] = useState(false);
  // Cancelamento de nota autorizada (v2.3.185) — o backend
  // (`FiscalDocumentService.cancel`) já existia, mas não tinha nenhum
  // botão na tela pra chamar — pedido do cliente depois de perguntar "como
  // faço pra cancelar a nota 498" e não achar. Mesmo padrão da Carta de
  // Correção (justificativa mín. 15 caracteres), mas irreversível.
  const [cancelDialogDoc, setCancelDialogDoc] = useState(null);
  const [cancelText, setCancelText] = useState("");
  const [sendingCancel, setSendingCancel] = useState(false);
  const [deleteDialogDoc, setDeleteDialogDoc] = useState(null);
  // Revisão antes de enviar (v2.3.183, pedido do cliente: "essa opção de
  // editar antes é pro usuário ver antes se tem algum ajuste, só depois
  // que o mesmo conferir ele envia") — clicar em "Emitir X" não manda mais
  // direto pro gateway; abre este resumo primeiro, `handleEmit` real só
  // roda depois de confirmar aqui. O botão "Pré-visualizar DANFe" (olho,
  // já existia antes) continua à parte, pra quem quiser ver o PDF inteiro.
  const [pendingEmitType, setPendingEmitType] = useState(null);
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

  // Busca os documentos sempre que a tela abre (não só quando o histórico
  // está expandido, v2.3.215) — precisa saber se já existe nota
  // autorizada/processando ANTES de decidir se mostra os botões "Emitir",
  // senão reabrir essa tela (ex.: pelo ícone de recibo na lista de Vendas)
  // continuava oferecendo "Emitir" de novo pra uma venda que já tinha nota
  // real, e nada no frontend barrava o clique — ver bug real das notas
  // 505/506 duplicadas.
  useEffect(() => {
    if (open) fetchDocuments();
  }, [open, fetchDocuments]);

  const handleConfirmEmit = async () => {
    const type = pendingEmitType;
    setPendingEmitType(null);
    await handleEmit(type);
  };

  const handleEmit = async (type) => {
    setEmitting(type);
    try {
      const result = await fiscal.fiscalDocuments.emit(sale.id, type);
      toast.success(`Emissão de ${DOC_TYPE_LABEL[type]} enviada ao gateway.`);
      await fetchDocuments();
      // "Quando gerar a nota fiscal tem a opção de mandar por email"
      // (v2.3.173) — alguns gateways/documentos autorizam na hora (já
      // volta "authorized" na resposta do emit, sem precisar de
      // "Atualizar status" depois); nesse caso já abre o diálogo de
      // e-mail em seguida, em vez de esperar o usuário achar o ícone na
      // lista. Quando fica "processando", o ícone de e-mail continua lá
      // (abaixo) assim que a nota autorizar.
      if (result?.status === "authorized") {
        openEmailDialog(result);
      }
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

  // "Imprimir direto na impressora" (v2.3.215, pedido do cliente) — abre o
  // DANFe numa aba nova e já chama o diálogo de impressão do navegador,
  // em vez de deixar o operador abrir o PDF e achar o Ctrl+P/ícone de
  // impressão sozinho. O PDF é servido por outro domínio (Focus NFe), então
  // não dá pra saber quando terminou de carregar pra chamar `print()` na
  // hora certa (acesso ao conteúdo de uma janela de outra origem é
  // bloqueado pelo navegador) — por isso o pequeno atraso fixo abaixo, que
  // é o mesmo contorno usado por sistemas que imprimem PDF de terceiro.
  const handlePrint = (doc) => {
    if (!doc?.pdfUrl) return;
    const printWindow = window.open(doc.pdfUrl, "_blank");
    if (!printWindow) return;
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (err) {
        // Pop-up bloqueado/navegador recusou — o PDF já abriu na aba nova,
        // o operador ainda consegue imprimir por lá manualmente.
      }
    }, 1200);
  };

  // Marca/desmarca "Precisa corrigir" (amarelo) numa nota com erro —
  // v2.3.166, ver comentário em FiscalDocumentService.ts.
  const handleTogglePendingCorrection = async (id) => {
    try {
      await fiscal.fiscalDocuments.togglePendingCorrection(id);
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

  const openEmailLogsDialog = async (doc) => {
    setEmailLogsDialogDoc(doc);
    setLoadingEmailLogs(true);
    try {
      const data = await fiscal.fiscalDocuments.emailLogs(doc.id);
      setEmailLogs(data || []);
    } catch (err) {
      toastError(err);
    }
    setLoadingEmailLogs(false);
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

  const handleCancelDocument = async () => {
    if (cancelText.trim().length < 15) {
      toast.error("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    setSendingCancel(true);
    try {
      await fiscal.fiscalDocuments.cancel(cancelDialogDoc.id, cancelText);
      toast.success("Nota cancelada.");
      setCancelDialogDoc(null);
      setCancelText("");
      await fetchDocuments();
    } catch (err) {
      toastError(err);
    }
    setSendingCancel(false);
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

  // Mesma checagem do backend (`FiscalDocumentService.emit`,
  // `SaleService.assertSaleEditable`) — esconde os botões "Emitir" assim
  // que já existe nota autorizada/processando, pra não oferecer na tela
  // uma ação que o backend vai recusar (ou pior, aceitar de novo se o
  // guard de lá um dia regredir — ver bug real das notas 505/506).
  const hasRealFiscalDocument = documents.some(doc => ["authorized", "processing"].includes(doc.status));

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

        {sale.status === "confirmed" && hasRealFiscalDocument ? (
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Esta venda já tem nota fiscal autorizada ou em processamento —
            para corrigir, use carta de correção ou cancele a nota antes de
            emitir outra.
          </Typography>
        ) : sale.status === "confirmed" ? (
          <Box className={classes.emitButtons}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={emitting === "nfe" ? <CircularProgress size={14} color="inherit" /> : DOC_TYPE_ICON.nfe}
              disabled={!!emitting}
              onClick={() => setPendingEmitType("nfe")}
            >
              Emitir Nota Fiscal
            </Button>
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
                    {(doc.status === "error" || doc.status === "pending_correction") && doc.errorMessage && (
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
                    {(doc.status === "error" || doc.status === "pending_correction") && doc.raw && (
                      <Tooltip title="Ver resposta completa do gateway">
                        <IconButton size="small" onClick={() => setRawDialogDoc(doc)}>
                          <CodeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {doc.status === "error" && (
                      <Tooltip title="Marcar como 'precisa corrigir' (amarelo)">
                        <IconButton size="small" onClick={() => handleTogglePendingCorrection(doc.id)}>
                          <FlagOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {doc.status === "pending_correction" && (
                      <Tooltip title="Desmarcar 'precisa corrigir' (volta pra Erro)">
                        <IconButton size="small" onClick={() => handleTogglePendingCorrection(doc.id)}>
                          <FlagIcon fontSize="small" style={{ color: "#f59e0b" }} />
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
                        {doc.pdfUrl && (
                          <Tooltip title="Ver DANFe (PDF)">
                            <IconButton size="small" onClick={() => window.open(doc.pdfUrl, "_blank")}>
                              <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {doc.pdfUrl && (
                          <Tooltip title="Imprimir DANFe direto na impressora">
                            <IconButton size="small" onClick={() => handlePrint(doc)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {doc.xmlUrl && (
                          <Tooltip title="Baixar XML">
                            <IconButton size="small" onClick={() => window.open(doc.xmlUrl, "_blank")}>
                              <GetAppIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Enviar por e-mail">
                          <IconButton size="small" onClick={() => openEmailDialog(doc)}>
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Histórico de envios por e-mail">
                          <IconButton size="small" onClick={() => openEmailLogsDialog(doc)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {doc.type === "nfe" && (
                          <Tooltip title="Carta de correção">
                            <IconButton size="small" onClick={() => setCorrectionDialogDoc(doc)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip
                          title={
                            isPastCancelDeadline(doc)
                              ? "Prazo de 24h pra cancelar essa nota já passou — use Carta de Correção ou resolva com a Sefaz/contador"
                              : "Cancelar nota"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              disabled={isPastCancelDeadline(doc)}
                              onClick={() => setCancelDialogDoc(doc)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                    {(doc.environment !== "production" ||
                      !["authorized", "processing", "cancelled"].includes(doc.status)) && (
                      <Tooltip
                        title={
                          doc.environment === "production"
                            ? "Excluir tentativa que falhou (nunca gerou chave de acesso)"
                            : "Excluir nota de teste (Homologação)"
                        }
                      >
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
        {onEdit && sale.status !== "cancelled" && (
          <Button
            onClick={() => onEdit(sale)}
            color="primary"
            startIcon={<EditIcon fontSize="small" />}
          >
            Editar
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Fechar
        </Button>
      </DialogActions>

      <ConfirmationModal
        title={
          deleteDialogDoc ? `Excluir ${DOC_TYPE_LABEL[deleteDialogDoc.type] || deleteDialogDoc.type}?` : ""
        }
        open={!!deleteDialogDoc}
        onClose={() => setDeleteDialogDoc(null)}
        onConfirm={handleDeleteDocument}
      >
        {deleteDialogDoc?.environment === "production"
          ? "Essa ação não pode ser desfeita. Essa tentativa falhou e nunca gerou chave de acesso — não é uma nota fiscal real."
          : "Essa ação não pode ser desfeita. Essa nota foi emitida em Homologação (teste), não é uma nota fiscal real."}
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

      <Dialog open={!!cancelDialogDoc} onClose={() => setCancelDialogDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancelar nota {cancelDialogDoc ? DOC_TYPE_LABEL[cancelDialogDoc.type] : ""}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Essa ação não pode ser desfeita. A Sefaz só permite cancelar dentro de um prazo curto
            depois da autorização (normalmente algumas horas, varia por estado) — se já tiver
            passado do prazo, o cancelamento vai ser rejeitado e você vai precisar emitir uma Nota
            de Crédito/Devolução em vez disso.
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
            Cancelar a nota também cancela a venda (devolve o estoque) e a conta a receber ligada.
            Se já estava paga, o reembolso ainda precisa ser feito manualmente — via Pix no painel
            do Asaas/Mercado Pago, ou solicitando o estorno à operadora no caso de cartão.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            variant="outlined"
            size="small"
            label="Justificativa do cancelamento (mín. 15 caracteres)"
            value={cancelText}
            onChange={(e) => setCancelText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogDoc(null)} disabled={sendingCancel}>
            Voltar
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={handleCancelDocument}
            disabled={sendingCancel}
            startIcon={sendingCancel ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Cancelar nota
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

      <Dialog open={!!emailLogsDialogDoc} onClose={() => setEmailLogsDialogDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Histórico de envios por e-mail</DialogTitle>
        <DialogContent>
          {loadingEmailLogs ? (
            <Box display="flex" justifyContent="center" my={2}>
              <CircularProgress size={24} />
            </Box>
          ) : emailLogs.length === 0 ? (
            <Typography variant="body2" className={classes.emptyDocs}>
              Nenhum envio registrado ainda pra esta nota.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Quando</TableCell>
                  <TableCell>Solicitado por</TableCell>
                  <TableCell>Destinatário(s)</TableCell>
                  <TableCell>Resultado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {emailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{moment(log.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                    <TableCell>{log.requestedByUser?.name || "—"}</TableCell>
                    <TableCell style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.emails}
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Chip size="small" label="Enviado" style={{ backgroundColor: "#10b981", color: "#fff" }} />
                      ) : (
                        <Tooltip title={log.errorMessage || "Falha ao enviar"}>
                          <Chip size="small" label="Falhou" style={{ backgroundColor: "#ef4444", color: "#fff" }} />
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
          <Button onClick={() => setEmailLogsDialogDoc(null)} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingEmitType} onClose={() => setPendingEmitType(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Conferir antes de enviar {pendingEmitType ? DOC_TYPE_LABEL[pendingEmitType] : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
            Confere os dados abaixo antes de enviar pra Sefaz — depois de enviada, a nota não pode
            mais ser editada (só cancelada/corrigida).
          </Typography>
          <Typography variant="body2">
            <strong>Destinatário:</strong> {sale.customer?.name || "Consumidor não identificado"}
          </Typography>
          <Typography variant="body2" style={{ marginBottom: 8 }}>
            <strong>Data da venda:</strong> {formatDateBR(sale.saleDate)}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="center">Qtd.</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>SIGMA / Lote / ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(sale.items || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.sku || item.product?.sku || "—"}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell align="right">{money(item.totalPrice)}</TableCell>
                  <TableCell>
                    {[item.sigmaSinarm, item.ammoLot, item.packageId].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box display="flex" justifyContent="flex-end" mt={1}>
            <Typography style={{ fontWeight: 700 }}>
              Valor total da nota: {money(sale.totalValue)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingEmitType(null)} color="secondary">
            Cancelar
          </Button>
          <Button onClick={handleConfirmEmit} color="primary" variant="contained" disabled={!!emitting}>
            {emitting ? <CircularProgress size={18} /> : "Confirmar e enviar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default SaleDetailModal;
