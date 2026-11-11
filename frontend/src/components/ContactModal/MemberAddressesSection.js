import React, { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import HomeWorkIcon from "@material-ui/icons/HomeWork";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";
import { ADDRESS_TYPE_OPTIONS } from "../../pages/Members/membersConfig";

const emptyAddress = {
  addressType: "residencial",
  description: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

// Endereços ADICIONAIS do associado (rural, comercial, local de guarda
// de armas...) — complementares ao principal (editado nos campos da
// própria aba "Endereço"). Seção independente: próprio estado, próprio
// diálogo (Formik isolado), mesmo cuidado já aplicado em
// MemberWeaponsSection. Ver docs/MANUAL_TECNICO.md.
const MemberAddressesSection = ({ memberId }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.listAddresses(memberId);
      if (isMounted.current) setAddresses(data);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    if (memberId) fetchAddresses();
  }, [memberId, fetchAddresses]);

  const handleOpenCreate = () => {
    setEditingAddress(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (address) => {
    setEditingAddress(address);
    setDialogOpen(true);
  };

  const handleDelete = async (address) => {
    try {
      await members.removeAddress(address.id);
      setAddresses((prev) => prev.filter((a) => a.id !== address.id));
      toast.success("Endereço removido.");
    } catch (err) {
      toastError(err);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editingAddress) {
        const data = await members.updateAddress(editingAddress.id, values);
        setAddresses((prev) => prev.map((a) => (a.id === data.id ? data : a)));
        toast.success("Endereço atualizado.");
      } else {
        const data = await members.createAddress(memberId, values);
        setAddresses((prev) => [...prev, data]);
        toast.success("Endereço adicionado.");
      }
      setDialogOpen(false);
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            Endereços adicionais (opcional)
          </Typography>
          <Typography variant="caption" color="textSecondary">
            CACs podem ter mais de um endereço (rural, comercial, local de guarda de armas). Estes são complementares ao principal.
          </Typography>
        </Box>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Adicionar endereço
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={22} />
        </Box>
      ) : addresses.length === 0 ? (
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
          Nenhum endereço adicional.
        </Typography>
      ) : (
        <List dense>
          {addresses.map((address) => (
            <ListItem key={address.id} divider>
              <HomeWorkIcon fontSize="small" style={{ marginRight: 12, opacity: 0.6 }} />
              <ListItemText
                primary={
                  ADDRESS_TYPE_OPTIONS.find((o) => o.value === address.addressType)?.label ||
                  address.addressType ||
                  "Endereço"
                }
                secondary={`${address.street}, ${address.number} — ${address.neighborhood}, ${address.city}/${address.state}`}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => handleOpenEdit(address)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(address)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAddress ? "Editar endereço" : "Adicionar endereço"}</DialogTitle>
        <Formik
          initialValues={editingAddress ? { ...emptyAddress, ...editingAddress } : emptyAddress}
          enableReinitialize
          onSubmit={handleSubmit}
        >
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} select fullWidth variant="outlined" size="small" name="addressType" label="Tipo">
                    {ADDRESS_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="description" label="Descrição (opcional)" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="zipCode" label="CEP" />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="street" label="Rua" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="number" label="Número" />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="complement" label="Complemento (opcional)" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="neighborhood" label="Bairro" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="city" label="Cidade" />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="state" label="UF" />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" color="primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogActions>
          </Form>
        </Formik>
      </Dialog>
    </Box>
  );
};

export default MemberAddressesSection;
