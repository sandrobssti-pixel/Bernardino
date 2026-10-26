import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CloseIcon from "@material-ui/icons/Close";

import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  wrapper: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
  },
  title: {
    fontWeight: 700,
    marginBottom: theme.spacing(0.5),
  },
  helpText: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  formRow: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.5),
  },
}));

const EMPTY_DRAFT = {
  id: null,
  lotNumber: "",
  barcodeId: "",
  unitQuantity: "",
  status: "in_stock",
  notes: "",
};

const STATUS_LABELS = {
  in_stock: "Em estoque",
  reserved: "Reservada (venda em aberto)",
  sold: "Vendida",
};
const statusLabel = (value) => STATUS_LABELS[value] || value || "—";

// Sub-cadastro de caixinhas pequenas de munição (lote + ID/código de
// barras) dentro do Produto/SKU (a "caixa cheia") — v2.3.223, pedido do
// cliente: "preciso cadastrar o código do produto, caixa cheia, e
// depois eu abro a caixa e cadastro as caixas pequenas uma por uma pra
// sabermos realmente a quantidade exata e ter o controle do lote com ID
// de cada uma — evita vender o mesmo produto duas vezes pois vamos
// verificar pelo ID de cada uma". Mesmo padrão de WeaponUnitsSection.js
// (ação salva na hora, não espera o "Salvar" do produto — a caixinha só
// pode existir depois que o Produto/SKU já tem id salvo).
const AmmoVolumesSection = ({ product, finance }) => {
  const classes = useStyles();
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [bulkLot, setBulkLot] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const productId = product?.id;

  const loadVolumes = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await finance.products.ammoVolumes.list(productId);
      setVolumes(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVolumes([]);
    setDraft(EMPTY_DRAFT);
    loadVolumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!productId) {
    return (
      <Box className={classes.wrapper}>
        <Typography variant="subtitle2" className={classes.title}>
          Caixinhas desta munição (lote + ID)
        </Typography>
        <Typography className={classes.helpText}>
          Salve o produto primeiro — depois disso você pode cadastrar
          aqui cada caixinha/cartela física que sair da caixa cheia,
          uma por ID (código de barras).
        </Typography>
      </Box>
    );
  }

  const handleSave = async () => {
    const lotNumber = draft.lotNumber.trim();
    const barcodeId = draft.barcodeId.trim();
    if (!lotNumber || !barcodeId || !draft.unitQuantity) {
      toast.warn("Informe lote, ID e quantidade de unidades.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        lotNumber,
        barcodeId,
        unitQuantity: Number(draft.unitQuantity),
        status: draft.status,
        notes: draft.notes,
      };
      if (draft.id) {
        await finance.products.ammoVolumes.update(productId, draft.id, payload);
        toast.success("Caixinha atualizada.");
      } else {
        await finance.products.ammoVolumes.save(productId, payload);
        toast.success("Caixinha cadastrada.");
      }
      setDraft(EMPTY_DRAFT);
      await loadVolumes();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (volume) => {
    setDraft({
      id: volume.id,
      lotNumber: volume.lotNumber,
      barcodeId: volume.barcodeId,
      unitQuantity: String(volume.unitQuantity ?? ""),
      status: volume.status || "in_stock",
      notes: volume.notes || "",
    });
  };

  // Uma remessa de caixa cheia vira várias caixinhas de uma vez — mesmo
  // Lote e mesma Quantidade por caixinha pra todas (pedido do cliente:
  // "na caixa cheia tem... 20 caixinhas pequenas que tem o lote da
  // caixa grande e cada caixinha tem seu ID próprio"). Cola só os IDs,
  // um por linha; uma linha "ID,quantidade" sobrescreve a quantidade
  // padrão só naquela caixinha (exceção real: "as vezes pode acontecer
  // que tem uma caixa" com quantidade diferente).
  const handleBulkSave = async () => {
    const lotNumber = bulkLot.trim();
    const lines = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lotNumber || !bulkQuantity || lines.length === 0) {
      toast.warn("Informe o lote, a quantidade padrão por caixinha, e cole pelo menos um ID.");
      return;
    }
    setBulkSaving(true);
    try {
      const result = await finance.products.ammoVolumes.saveBulk(productId, {
        lotNumber,
        defaultUnitQuantity: Number(bulkQuantity),
        lines,
      });
      if (result.created.length > 0) {
        toast.success(`${result.created.length} caixinha(s) cadastrada(s).`);
      }
      if (result.duplicates.length > 0) {
        toast.warn(`Já cadastrado/repetido/inválido, ignorado: ${result.duplicates.join(", ")}`);
      }
      setBulkText("");
      await loadVolumes();
    } catch (err) {
      toastError(err);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRemove = async (volume) => {
    if (!window.confirm(`Excluir a caixinha de ID "${volume.barcodeId}"?`)) return;
    try {
      await finance.products.ammoVolumes.remove(productId, volume.id);
      toast.success("Caixinha excluída.");
      if (draft.id === volume.id) setDraft(EMPTY_DRAFT);
      await loadVolumes();
    } catch (err) {
      toastError(err);
    }
  };

  const totalUnitsInStock = volumes
    .filter((v) => v.status === "in_stock")
    .reduce((sum, v) => sum + (Number(v.unitQuantity) || 0), 0);

  return (
    <Box className={classes.wrapper}>
      <Typography variant="subtitle2" className={classes.title}>
        Caixinhas desta munição (lote + ID)
      </Typography>
      <Typography className={classes.helpText}>
        Cada caixinha/cartela física aberta da caixa cheia entra aqui com
        o próprio ID (código de barras) — todas da mesma remessa
        compartilham o mesmo lote. {volumes.length > 0 && `${totalUnitsInStock} unidade(s) em estoque, em ${volumes.filter((v) => v.status === "in_stock").length} caixinha(s).`}
      </Typography>

      <div className={classes.formRow}>
        <TextField
          label="Lote *"
          size="small"
          variant="outlined"
          value={draft.lotNumber}
          onChange={(e) => setDraft((d) => ({ ...d, lotNumber: e.target.value }))}
          style={{ minWidth: 140 }}
        />
        <TextField
          label="ID / código de barras *"
          size="small"
          variant="outlined"
          value={draft.barcodeId}
          onChange={(e) => setDraft((d) => ({ ...d, barcodeId: e.target.value }))}
          style={{ minWidth: 160 }}
        />
        <TextField
          label="Unidades nesta caixinha *"
          type="number"
          size="small"
          variant="outlined"
          value={draft.unitQuantity}
          onChange={(e) => setDraft((d) => ({ ...d, unitQuantity: e.target.value }))}
          style={{ minWidth: 150 }}
        />
        <TextField
          select
          label="Situação"
          size="small"
          variant="outlined"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          style={{ minWidth: 150 }}
          disabled={draft.status === "reserved" || draft.status === "sold"}
        >
          <MenuItem value="in_stock">Em estoque</MenuItem>
          {(draft.status === "reserved" || draft.status === "sold") && (
            <MenuItem value={draft.status}>{statusLabel(draft.status)}</MenuItem>
          )}
        </TextField>
        <TextField
          label="Observações"
          size="small"
          variant="outlined"
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          style={{ minWidth: 160 }}
        />
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={draft.id ? undefined : <AddIcon />}
          onClick={handleSave}
          disabled={saving}
          style={{ height: 40 }}
        >
          {saving ? <CircularProgress size={18} /> : draft.id ? "Salvar alteração" : "Adicionar"}
        </Button>
        {draft.id && (
          <IconButton size="small" onClick={() => setDraft(EMPTY_DRAFT)} title="Cancelar edição">
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </div>

      <Box mb={2}>
        <Typography variant="caption" color="textSecondary">
          Cadastrar uma remessa inteira de uma vez (mesmo lote pra todas as caixinhas):
        </Typography>
        <div className={classes.formRow} style={{ marginTop: 4 }}>
          <TextField
            label="Lote da remessa *"
            size="small"
            variant="outlined"
            value={bulkLot}
            onChange={(e) => setBulkLot(e.target.value)}
            style={{ minWidth: 140 }}
          />
          <TextField
            label="Unidades por caixinha (padrão) *"
            type="number"
            size="small"
            variant="outlined"
            value={bulkQuantity}
            onChange={(e) => setBulkQuantity(e.target.value)}
            style={{ minWidth: 190 }}
          />
        </div>
        <TextField
          label="IDs / códigos de barras (um por linha — ou 'ID,quantidade' pra sobrescrever a quantidade padrão numa caixinha)"
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={3}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleBulkSave}
          disabled={bulkSaving}
          style={{ marginTop: 8 }}
        >
          {bulkSaving ? <CircularProgress size={18} /> : "Adicionar todas"}
        </Button>
      </Box>

      {loading ? (
        <CircularProgress size={22} />
      ) : volumes.length === 0 ? (
        <Typography className={classes.helpText}>
          Nenhuma caixinha cadastrada ainda neste SKU.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lote</TableCell>
              <TableCell>ID / código de barras</TableCell>
              <TableCell align="right">Unidades</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Observações</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {volumes.map((volume) => (
              <TableRow key={volume.id}>
                <TableCell>{volume.lotNumber}</TableCell>
                <TableCell>{volume.barcodeId}</TableCell>
                <TableCell align="right">{volume.unitQuantity}</TableCell>
                <TableCell>{statusLabel(volume.status)}</TableCell>
                <TableCell>{volume.notes || "—"}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(volume)} title="Editar">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(volume)}
                    disabled={volume.status === "reserved" || volume.status === "sold"}
                    title={
                      volume.status === "reserved" || volume.status === "sold"
                        ? "Presa numa venda — cancele a venda pra liberar"
                        : "Excluir"
                    }
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default AmmoVolumesSection;
