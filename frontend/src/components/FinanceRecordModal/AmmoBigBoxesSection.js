import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
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
import LinkIcon from "@material-ui/icons/Link";

import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  wrapper: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(2),
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
  lotLE: "",
  lotLF: "",
  totalUnits: "",
  notes: "",
};

// Lote LE aceita letras e números; lote LF é só números — pedido
// explícito do cliente. Filtra em tempo real enquanto o usuário digita
// (mesma validação é reforçada no backend, ver bigBoxSchema em
// FinanceAmmoBigBoxService.ts).
const sanitizeLotLE = (value) => value.replace(/[^A-Za-z0-9]/g, "");
const sanitizeLotLF = (value) => value.replace(/[^0-9]/g, "");

// Sub-cadastro "caixa grande" de munição — v2.3.300, pedido do
// cliente: "compramos uma caixa fechada, dentro da caixa grande vem
// outras caixas menores... pra cadastrar tudo temos que cadastrar a
// caixa grande [primeiro] e dentro dessa caixa cadastrar os outros
// itens menores". Nível ACIMA de AmmoVolumesSection.js (a caixinha
// pequena) — cada caixinha se vincula a uma caixa grande cadastrada
// aqui, herdando o lote dela (LE/LF). Mesmo padrão de
// AmmoVolumesSection.js (ação salva na hora, só existe depois do
// Produto/SKU já ter id salvo).
//
// Exclusão só do Admin (pedido explícito do cliente: "só o adm tem
// poder de excluir algum campo") — `canDelete` vem de cima
// (FinanceRecordModal, calculado a partir do usuário logado).
const AmmoBigBoxesSection = ({ product, finance, canDelete }) => {
  const classes = useStyles();
  const [bigBoxes, setBigBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  // Busca por lote ou observações — pedido do cliente (v2.3.318):
  // "o filtro é nesse local" (cadastro de caixa grande/caixinha dentro
  // do produto), pra achar mais rápido com muita linha cadastrada.
  // SKU não entra na busca aqui porque é sempre o mesmo pra todo mundo
  // nesta tela (já é o produto aberto).
  const [search, setSearch] = useState("");

  const productId = product?.id;

  // Caixinhas cadastradas/vendidas são contagem automática real (não
  // dá pra digitar por cima) — só aparecem no formulário quando está
  // editando uma caixa grande já salva (uma nova ainda não tem
  // caixinha vinculada). Pedido do cliente (v2.3.308): "coloque pra
  // aparecer" no formulário, mas confirmado que continua automática,
  // sem opção de editar manualmente.
  const editingBigBox = draft.id ? bigBoxes.find((b) => b.id === draft.id) : null;
  const registeredCount = editingBigBox?.volumes?.length ?? 0;
  const inStockCount = editingBigBox?.volumes?.filter((v) => v.status === "in_stock").length ?? 0;
  const soldCount = editingBigBox?.volumes?.filter((v) => v.status === "sold").length ?? 0;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBigBoxes = normalizedSearch
    ? bigBoxes.filter((b) =>
        [b.lotLE, b.lotLF, `${b.lotLE}/${b.lotLF}`, b.notes]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(normalizedSearch))
      )
    : bigBoxes;

  const loadBigBoxes = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await finance.products.ammoBigBoxes.list(productId);
      setBigBoxes(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setBigBoxes([]);
    setDraft(EMPTY_DRAFT);
    loadBigBoxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!productId) {
    return (
      <Box className={classes.wrapper}>
        <Typography variant="subtitle2" className={classes.title}>
          Caixas grandes desta munição (lote LE/LF)
        </Typography>
        <Typography className={classes.helpText}>
          Salve o produto primeiro — depois disso você pode cadastrar
          aqui cada caixa grande que chegar (lote + total de unidades),
          antes de abrir e cadastrar as caixinhas de dentro.
        </Typography>
      </Box>
    );
  }

  const handleSave = async () => {
    const lotLE = draft.lotLE.trim();
    const lotLF = draft.lotLF.trim();
    if (!lotLE || !lotLF || !draft.totalUnits) {
      toast.warn("Informe o lote LE, o lote LF e o total de unidades.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        lotLE,
        lotLF,
        totalUnits: Number(draft.totalUnits),
        notes: draft.notes,
      };
      if (draft.id) {
        await finance.products.ammoBigBoxes.update(productId, draft.id, payload);
        toast.success("Caixa grande atualizada.");
      } else {
        await finance.products.ammoBigBoxes.save(productId, payload);
        toast.success("Caixa grande cadastrada.");
      }
      setDraft(EMPTY_DRAFT);
      await loadBigBoxes();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (bigBox) => {
    setDraft({
      id: bigBox.id,
      lotLE: bigBox.lotLE,
      lotLF: bigBox.lotLF,
      totalUnits: String(bigBox.totalUnits ?? ""),
      notes: bigBox.notes || "",
    });
  };

  // Vincula caixinhas com o texto do lote batendo mas cadastradas sem
  // selecionar essa caixa grande no formulário (dado legado real
  // encontrado em produção — v2.3.309). Nunca troca vínculo já
  // existente, só preenche onde está vazio.
  const handleLinkMatching = async (bigBox) => {
    try {
      const { linkedCount } = await finance.products.ammoBigBoxes.linkMatchingVolumes(
        productId,
        bigBox.id
      );
      if (linkedCount > 0) {
        toast.success(
          `${linkedCount} caixinha(s) vinculada(s) a esta caixa grande.`
        );
      } else {
        toast.info("Nenhuma caixinha com o lote batendo pra vincular.");
      }
      await loadBigBoxes();
    } catch (err) {
      toastError(err);
    }
  };

  const handleRemove = async (bigBox) => {
    if (!window.confirm(`Excluir a caixa grande do lote "${bigBox.lotLE}/${bigBox.lotLF}"?`)) return;
    try {
      await finance.products.ammoBigBoxes.remove(productId, bigBox.id);
      toast.success("Caixa grande excluída.");
      if (draft.id === bigBox.id) setDraft(EMPTY_DRAFT);
      await loadBigBoxes();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Box className={classes.wrapper}>
      <Typography variant="subtitle2" className={classes.title}>
        Caixas grandes desta munição (lote LE/LF)
      </Typography>
      <Typography className={classes.helpText}>
        Cadastre aqui cada caixa grande (fechada) que chegar — depois,
        abra e cadastre as caixinhas/cartelas de dentro dela mais
        abaixo, vinculando cada uma a esta caixa grande.
      </Typography>

      <div className={classes.formRow}>
        <TextField
          label="SKU/código"
          size="small"
          variant="outlined"
          value={product.sku || ""}
          disabled
          helperText="Do produto"
          style={{ minWidth: 140 }}
        />
        <TextField
          label="Lote LE *"
          size="small"
          variant="outlined"
          value={draft.lotLE}
          onChange={(e) => setDraft((d) => ({ ...d, lotLE: sanitizeLotLE(e.target.value) }))}
          helperText="Letras e números"
          style={{ minWidth: 120 }}
        />
        <TextField
          label="Lote LF *"
          size="small"
          variant="outlined"
          value={draft.lotLF}
          onChange={(e) => setDraft((d) => ({ ...d, lotLF: sanitizeLotLF(e.target.value) }))}
          helperText="Só números"
          style={{ minWidth: 120 }}
        />
        <TextField
          label="Total de unidades *"
          type="number"
          size="small"
          variant="outlined"
          value={draft.totalUnits}
          onChange={(e) => setDraft((d) => ({ ...d, totalUnits: e.target.value }))}
          style={{ minWidth: 160 }}
        />
        {draft.id && (
          <>
            <TextField
              label="Caixinhas cadastradas"
              size="small"
              variant="outlined"
              value={registeredCount}
              disabled
              helperText="Automático"
              style={{ minWidth: 150 }}
            />
            <TextField
              label="Caixinhas em estoque"
              size="small"
              variant="outlined"
              value={inStockCount}
              disabled
              helperText="Automático"
              style={{ minWidth: 150 }}
            />
            <TextField
              label="Caixinhas vendidas"
              size="small"
              variant="outlined"
              value={soldCount}
              disabled
              helperText="Automático"
              style={{ minWidth: 150 }}
            />
          </>
        )}
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

      {bigBoxes.length > 0 && (
        <TextField
          label="Buscar por lote ou observações"
          size="small"
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260, marginBottom: 12 }}
        />
      )}

      {loading ? (
        <CircularProgress size={22} />
      ) : bigBoxes.length === 0 ? (
        <Typography className={classes.helpText}>
          Nenhuma caixa grande cadastrada ainda neste SKU.
        </Typography>
      ) : filteredBigBoxes.length === 0 ? (
        <Typography className={classes.helpText}>
          Nenhuma caixa grande encontrada pra essa busca.
        </Typography>
      ) : (
        <Box style={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Lote LE</TableCell>
              <TableCell>Lote LF</TableCell>
              <TableCell align="right">Total de unidades</TableCell>
              <TableCell align="right">Caixinhas cadastradas</TableCell>
              <TableCell align="right">Caixinhas em estoque</TableCell>
              <TableCell align="right">Caixinhas vendidas</TableCell>
              <TableCell>Observações</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBigBoxes.map((bigBox) => (
              <TableRow key={bigBox.id}>
                <TableCell>{product.sku || "—"}</TableCell>
                <TableCell>{bigBox.lotLE}</TableCell>
                <TableCell>{bigBox.lotLF}</TableCell>
                <TableCell align="right">{bigBox.totalUnits}</TableCell>
                <TableCell align="right">{bigBox.volumes?.length ?? 0}</TableCell>
                <TableCell align="right">
                  {bigBox.volumes?.filter((v) => v.status === "in_stock").length ?? 0}
                </TableCell>
                <TableCell align="right">
                  {bigBox.volumes?.filter((v) => v.status === "sold").length ?? 0}
                </TableCell>
                <TableCell>{bigBox.notes || "—"}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(bigBox)} title="Editar">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleLinkMatching(bigBox)}
                    title="Vincular caixinhas com o lote batendo mas cadastradas sem essa caixa grande selecionada"
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                  {canDelete && (
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(bigBox)}
                      disabled={(bigBox.volumes?.length ?? 0) > 0}
                      title={
                        (bigBox.volumes?.length ?? 0) > 0
                          ? "Tem caixinha vinculada — exclua as caixinhas primeiro"
                          : "Excluir"
                      }
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

export default AmmoBigBoxesSection;
