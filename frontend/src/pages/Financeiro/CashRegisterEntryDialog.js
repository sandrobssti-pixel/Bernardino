import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Paper from "@material-ui/core/Paper";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import useFinance from "../../hooks/useFinance";
import FinanceAsyncAutocomplete from "../../components/FinanceAsyncAutocomplete";
import toastError from "../../errors/toastError";
import { fetchAddressByCep } from "../../utils/cep";
import { money } from "../../utils/financeFormat";
import { CASH_REGISTER_TYPE_OPTIONS } from "./financeConfig";

const emptyItem = () => ({ itemType: "", description: "", unit: "UN", quantity: "1", unitPrice: "0" });

// "Caixa Registradora" virou um mini frente de caixa pra vendas sem nota
// fiscal (pedido do cliente, v2.3.292) — substitui o modal genérico de
// campo-config do FinanceRecordList (onEditOverride/onCreateOverride,
// mesmo padrão já usado em MemberEditDialog) porque o formulário
// genérico não suporta uma lista de itens repetível nem o
// autopreenchimento de endereço pelo cliente escolhido.
//
// Cliente usa o MESMO cadastro único de FinanceCustomer já usado em
// Vendas (pedido explícito: "o cadastro do cliente continuar sendo
// único, ao digitar o nome ou cpf já preenche todos os campo igual a
// vendas") — escolher um cliente aqui preenche nome/CPF/endereço como
// um snapshot (mesma lógica de Sale.recipientZipCode/
// handleCustomerChange no SaleModal.js), sempre editável depois, sem
// nunca mudar retroativamente se o cadastro do cliente mudar.
//
// Fica 100% independente do Painel Financeiro/fechamento de caixa
// oficial (pedido explícito do cliente) — nunca grava em Contas a
// Pagar/Receber, nenhum relatório soma isso junto com vendas de
// verdade.
const CashRegisterEntryDialog = ({ open, entryId, onClose }) => {
  const finance = useFinance();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("physical_cash");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [name, setName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const resetForm = () => {
    setType("physical_cash");
    setSelectedCustomer(null);
    setName("");
    setDocumentNumber("");
    setZipCode("");
    setStreet("");
    setNumber("");
    setComplement("");
    setNeighborhood("");
    setCity("");
    setState("");
    setNotes("");
    setItems([emptyItem()]);
  };

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    try {
      const data = await finance.cashRegister.show(entryId);
      if (!isMounted.current) return;
      setType(data.type || "physical_cash");
      setSelectedCustomer(data.customerId ? { id: data.customerId, name: data.name } : null);
      setName(data.name || "");
      setDocumentNumber(data.document || "");
      setZipCode(data.zipCode || "");
      setStreet(data.street || "");
      setNumber(data.number || "");
      setComplement(data.complement || "");
      setNeighborhood(data.neighborhood || "");
      setCity(data.city || "");
      setState(data.state || "");
      setNotes(data.notes || "");
      setItems(
        data.items?.length
          ? data.items.map((item) => ({
              itemType: item.itemType || "",
              description: item.description || "",
              unit: item.unit || "UN",
              quantity: item.quantity || "1",
              unitPrice: item.unitPrice || "0",
            }))
          : [emptyItem()]
      );
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  useEffect(() => {
    if (open) {
      if (entryId) {
        fetchEntry();
      } else {
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entryId]);

  const fetchCustomerOptions = async (searchParam) => {
    const { records } = await finance.customers.list({ searchParam });
    return records || [];
  };

  // Mesma lógica de handleCustomerChange do SaleModal.js — preenche
  // nome/CPF/endereço como snapshot, sempre editável depois.
  const handleCustomerChange = (customer) => {
    setSelectedCustomer(customer || null);
    if (!customer) return;
    setName(customer.name || "");
    setDocumentNumber(customer.document || "");
    setZipCode(customer.zipCode || "");
    setStreet(customer.street || "");
    setNumber(customer.number || "");
    setComplement(customer.complement || "");
    setNeighborhood(customer.neighborhood || "");
    setCity(customer.city || "");
    setState(customer.state || "");
  };

  const handleCepBlur = async (e) => {
    const address = await fetchAddressByCep(e.target.value);
    if (!address) return;
    setStreet(address.street);
    setNeighborhood(address.neighborhood);
    setCity(address.city);
    setState(address.state);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleRemoveItem = (index) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const canSave = items.every((item) => item.description.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        type,
        customerId: selectedCustomer?.id || null,
        name,
        document: documentNumber,
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        notes,
        items,
      };
      if (entryId) {
        await finance.cashRegister.update(entryId, payload);
      } else {
        await finance.cashRegister.save(payload);
      }
      toast.success("Lançamento salvo.");
      onClose(true);
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth>
      <DialogTitle>{entryId ? "Editar lançamento" : "Novo(a) Caixa Registradora"}</DialogTitle>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={240}>
          <CircularProgress />
        </Box>
      ) : (
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                variant="outlined"
                size="small"
                label="Forma de pagamento"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {CASH_REGISTER_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FinanceAsyncAutocomplete
                label="Cliente"
                placeholder="Nome, CPF/CNPJ ou e-mail"
                value={selectedCustomer}
                getOptionLabel={(opt) => opt?.name || ""}
                fetchOptions={fetchCustomerOptions}
                onChange={(e, newValue) => handleCustomerChange(newValue)}
              />
            </Grid>

            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="CPF"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="CEP"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                onBlur={handleCepBlur}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Rua"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Número"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Complemento"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={1}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="UF"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              />
            </Grid>
          </Grid>

          <Box mt={3} mb={1} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
              Itens
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddItem}>
              Adicionar item
            </Button>
          </Box>
          <Divider style={{ marginBottom: 16 }} />

          {items.map((item, index) => (
            <Paper
              key={index}
              variant="outlined"
              style={{ padding: 12, marginBottom: 12 }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Tipo"
                    value={item.itemType}
                    onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    variant="outlined"
                    size="small"
                    label="Descrição"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} sm={1}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="number"
                    label="Qtde"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} sm={1}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Unidade"
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                  />
                </Grid>
                <Grid item xs={8} sm={2}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="number"
                    label="Valor unitário (R$)"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                  />
                </Grid>
                <Grid item xs={3} sm={1}>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>
                    {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                  </Typography>
                </Grid>
                <Grid item xs={1} sm={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}

          <Box display="flex" justifyContent="flex-end" mt={1} mb={2}>
            <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
              Total: {money(total)}
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={2}
            variant="outlined"
            size="small"
            label="Observações"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancelar</Button>
        <Button
          variant="contained"
          color="primary"
          disabled={loading || saving || !canSave}
          onClick={handleSave}
        >
          {saving ? <CircularProgress size={20} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CashRegisterEntryDialog;
