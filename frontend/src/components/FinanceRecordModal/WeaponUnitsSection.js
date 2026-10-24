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
import { WEAPON_STATUS_OPTIONS } from "../../pages/Financeiro/financeConfig";

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
  serialNumber: "",
  sigmaRegistrationNumber: "",
  status: "in_stock",
  notes: "",
};

// "reserved" não é uma opção do <select> de edição manual (só existe
// linkada a uma venda em aberto, ver FinanceWeaponUnitService.reserveForSale
// — Etapa 2, v2.3.207), mas precisa de um rótulo legível na tabela.
const statusLabel = (value) =>
  value === "reserved"
    ? "Reservada (venda em aberto)"
    : WEAPON_STATUS_OPTIONS.find((o) => o.value === value)?.label || value || "—";

// Sub-cadastro de unidades físicas de arma (uma linha por número de série)
// dentro do Produto/SKU — v2.3.205, Etapa 1. Diferente dos outros campos
// do formulário de Produto: cada ação aqui (adicionar/editar/excluir
// unidade) chama a API na hora, não espera o "Salvar" do produto — mesma
// lógica já usada pro upload de foto (`enablePhotoUpload`), porque a
// unidade só pode existir depois que o Produto (SKU) já tem um id salvo.
// Ver docs/MANUAL_TECNICO.md, seção 184.
const WeaponUnitsSection = ({ product, finance }) => {
  const classes = useStyles();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const productId = product?.id;

  const loadUnits = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await finance.products.weaponUnits.list(productId);
      setUnits(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUnits([]);
    setDraft(EMPTY_DRAFT);
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!productId) {
    return (
      <Box className={classes.wrapper}>
        <Typography variant="subtitle2" className={classes.title}>
          Armas deste modelo (por número de série)
        </Typography>
        <Typography className={classes.helpText}>
          Salve o produto primeiro — depois disso você pode cadastrar aqui
          cada arma física deste SKU, uma por número de série.
        </Typography>
      </Box>
    );
  }

  const handleSave = async () => {
    const serialNumber = draft.serialNumber.trim();
    if (!serialNumber) {
      toast.warn("Informe o número de série.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serialNumber,
        sigmaRegistrationNumber: draft.sigmaRegistrationNumber,
        status: draft.status,
        notes: draft.notes,
      };
      if (draft.id) {
        await finance.products.weaponUnits.update(productId, draft.id, payload);
        toast.success("Arma atualizada.");
      } else {
        await finance.products.weaponUnits.save(productId, payload);
        toast.success("Arma cadastrada.");
      }
      setDraft(EMPTY_DRAFT);
      await loadUnits();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (unit) => {
    setDraft({
      id: unit.id,
      serialNumber: unit.serialNumber,
      sigmaRegistrationNumber: unit.sigmaRegistrationNumber || "",
      status: unit.status || "in_stock",
      notes: unit.notes || "",
    });
  };

  const handleBulkSave = async () => {
    const serialNumbers = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (serialNumbers.length === 0) {
      toast.warn("Cole pelo menos um número de série, um por linha.");
      return;
    }
    setBulkSaving(true);
    try {
      const result = await finance.products.weaponUnits.saveBulk(productId, serialNumbers);
      if (result.created.length > 0) {
        toast.success(`${result.created.length} arma(s) cadastrada(s).`);
      }
      if (result.duplicates.length > 0) {
        toast.warn(`Já cadastrado/repetido, ignorado: ${result.duplicates.join(", ")}`);
      }
      setBulkText("");
      await loadUnits();
    } catch (err) {
      toastError(err);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRemove = async (unit) => {
    if (!window.confirm(`Excluir a arma de número de série "${unit.serialNumber}"?`)) return;
    try {
      await finance.products.weaponUnits.remove(productId, unit.id);
      toast.success("Arma excluída.");
      if (draft.id === unit.id) setDraft(EMPTY_DRAFT);
      await loadUnits();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Box className={classes.wrapper}>
      <Typography variant="subtitle2" className={classes.title}>
        Armas deste modelo (por número de série)
      </Typography>
      <Typography className={classes.helpText}>
        Cada arma física deste SKU entra aqui com o próprio número de série
        — só ele é obrigatório. Registro SIGMA/SINARM e situação são
        opcionais e podem ser completados depois.
      </Typography>

      <div className={classes.formRow}>
        <TextField
          label="Número de série *"
          size="small"
          variant="outlined"
          value={draft.serialNumber}
          onChange={(e) => setDraft((d) => ({ ...d, serialNumber: e.target.value }))}
          style={{ minWidth: 160 }}
        />
        <TextField
          label="Nº de registro SIGMA/SINARM"
          size="small"
          variant="outlined"
          value={draft.sigmaRegistrationNumber}
          onChange={(e) => setDraft((d) => ({ ...d, sigmaRegistrationNumber: e.target.value }))}
          style={{ minWidth: 180 }}
        />
        <TextField
          select
          label="Situação"
          size="small"
          variant="outlined"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          style={{ minWidth: 150 }}
        >
          {WEAPON_STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
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
        <TextField
          label="Cadastrar em lote (colar lista, um número de série por linha)"
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
      ) : units.length === 0 ? (
        <Typography className={classes.helpText}>
          Nenhuma arma cadastrada ainda neste SKU.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número de série</TableCell>
              <TableCell>Registro SIGMA/SINARM</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Observações</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell>{unit.serialNumber}</TableCell>
                <TableCell>{unit.sigmaRegistrationNumber || "—"}</TableCell>
                <TableCell>{statusLabel(unit.status)}</TableCell>
                <TableCell>{unit.notes || "—"}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(unit)} title="Editar">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(unit)}
                    disabled={unit.status === "reserved" || unit.status === "sold"}
                    title={
                      unit.status === "reserved" || unit.status === "sold"
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

export default WeaponUnitsSection;
