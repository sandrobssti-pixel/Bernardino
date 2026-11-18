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
  bigBoxId: "",
  lotNumber: "",
  barcodeId: "",
  unitQuantity: "",
  status: "in_stock",
  notes: "",
};

// Rótulo da caixa grande no seletor — mesmo formato usado pra
// snapshotar `lotNumber` no backend (ver resolveBigBoxLot,
// FinanceAmmoVolumeService.ts).
const bigBoxLabel = (bigBox) => `${bigBox.lotLE}/${bigBox.lotLF}`;

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
//
// `bigBoxId` (v2.3.300) — cada caixinha agora pode se vincular a uma
// "caixa grande" (AmmoBigBoxesSection.js, cadastrada ACIMA desta),
// herdando o lote dela (LE/LF) em vez de digitar de novo. Caixinha
// avulsa (sem caixa grande) continua funcionando exatamente como
// antes, com o campo "Lote" digitado à mão — mantido pra cadastro
// antigo/caso simples sem caixa grande.
//
// Exclusão só do Admin (pedido explícito do cliente: "só o adm tem
// poder de excluir algum campo") — `canDelete` vem de cima
// (FinanceRecordModal, calculado a partir do usuário logado).
const AmmoVolumesSection = ({ product, finance, canDelete }) => {
  const classes = useStyles();
  const [volumes, setVolumes] = useState([]);
  const [bigBoxes, setBigBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const productId = product?.id;

  const loadVolumes = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [volumesData, bigBoxesData] = await Promise.all([
        finance.products.ammoVolumes.list(productId),
        finance.products.ammoBigBoxes.list(productId),
      ]);
      setVolumes(volumesData);
      setBigBoxes(bigBoxesData);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVolumes([]);
    setBigBoxes([]);
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
    const barcodeId = draft.barcodeId.trim();
    const lotNumber = draft.lotNumber.trim();
    if (!draft.bigBoxId && !lotNumber) {
      toast.warn("Informe a caixa grande ou o lote, o ID e a quantidade de unidades.");
      return;
    }
    if (!barcodeId || !draft.unitQuantity) {
      toast.warn("Informe o ID e a quantidade de unidades.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bigBoxId: draft.bigBoxId || null,
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
      bigBoxId: volume.bigBoxId || "",
      lotNumber: volume.lotNumber || "",
      barcodeId: volume.barcodeId,
      unitQuantity: String(volume.unitQuantity ?? ""),
      status: volume.status || "in_stock",
      notes: volume.notes || "",
    });
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

  const selectedBigBox = bigBoxes.find((b) => b.id === draft.bigBoxId);
  const draftLotDisplay = selectedBigBox ? bigBoxLabel(selectedBigBox) : draft.lotNumber;

  return (
    <Box className={classes.wrapper}>
      <Typography variant="subtitle2" className={classes.title}>
        Caixinhas desta munição (lote + ID)
      </Typography>

      <div className={classes.formRow}>
        <TextField
          select
          label="Caixa grande"
          size="small"
          variant="outlined"
          value={draft.bigBoxId}
          onChange={(e) => setDraft((d) => ({ ...d, bigBoxId: e.target.value }))}
          style={{ minWidth: 160 }}
        >
          <MenuItem value="">Nenhuma (lote avulso)</MenuItem>
          {bigBoxes.map((bigBox) => (
            <MenuItem key={bigBox.id} value={bigBox.id}>
              {bigBoxLabel(bigBox)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Lote *"
          size="small"
          variant="outlined"
          value={draftLotDisplay}
          onChange={(e) => setDraft((d) => ({ ...d, lotNumber: e.target.value }))}
          disabled={!!draft.bigBoxId}
          helperText={draft.bigBoxId ? "Herdado da caixa grande" : undefined}
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

      {loading ? (
        <CircularProgress size={22} />
      ) : volumes.length === 0 ? (
        <Typography className={classes.helpText}>
          Nenhuma caixinha cadastrada ainda neste SKU.
        </Typography>
      ) : (
        <Box style={{ overflowX: "auto" }}>
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
                  {canDelete && (
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(volume)}
                      title="Excluir"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Box>
      )}
    </Box>
  );
};

export default AmmoVolumesSection;
