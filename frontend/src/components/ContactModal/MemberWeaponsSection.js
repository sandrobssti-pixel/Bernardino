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
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import GpsFixedIcon from "@material-ui/icons/GpsFixed";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";

const emptyWeapon = {
  usageType: "",
  storageLocation: "",
  brand: "",
  model: "",
  weaponType: "",
  caliber: "",
  serialNumber: "",
  sigmaRegistrationNumber: "",
  crafValidUntil: "",
  active: true,
  notes: "",
};

// Arma PESSOAL do associado (CAC) — diferente da armaria/estoque do
// clube (módulo Financeiro/WeaponArmory). Seção independente dentro da
// aba "Gerenciador CAC" do Contato: próprio estado, próprio Formik (só
// no diálogo), nunca interfere no formulário principal da aba CAC nem
// no do Contato — mesmo cuidado já aplicado no botão de reconhecimento
// facial/PIN do Portal. Ver docs/MANUAL_TECNICO.md.
const MemberWeaponsSection = ({ memberId }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [weapons, setWeapons] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchWeapons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.listWeapons(memberId);
      if (isMounted.current) setWeapons(data);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    if (memberId) fetchWeapons();
  }, [memberId, fetchWeapons]);

  const handleOpenCreate = () => {
    setEditingWeapon(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (weapon) => {
    setEditingWeapon(weapon);
    setDialogOpen(true);
  };

  const handleDelete = async (weapon) => {
    try {
      await members.removeWeapon(weapon.id);
      setWeapons((prev) => prev.filter((w) => w.id !== weapon.id));
      toast.success("Arma removida.");
    } catch (err) {
      toastError(err);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editingWeapon) {
        const data = await members.updateWeapon(editingWeapon.id, values);
        setWeapons((prev) => prev.map((w) => (w.id === data.id ? data : w)));
        toast.success("Arma atualizada.");
      } else {
        const data = await members.createWeapon(memberId, values);
        setWeapons((prev) => [...prev, data]);
        toast.success("Arma cadastrada.");
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
        <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
          Armas do associado
        </Typography>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Adicionar arma
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={22} />
        </Box>
      ) : weapons.length === 0 ? (
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
          Nenhuma arma cadastrada pra este associado.
        </Typography>
      ) : (
        <List dense>
          {weapons.map((weapon) => (
            <ListItem key={weapon.id} divider>
              <GpsFixedIcon fontSize="small" style={{ marginRight: 12, opacity: 0.6 }} />
              <ListItemText
                primary={`${weapon.brand ? `${weapon.brand} ` : ""}${weapon.model}${weapon.caliber ? ` (${weapon.caliber})` : ""}`}
                secondary={
                  [
                    weapon.serialNumber && `Série: ${weapon.serialNumber}`,
                    weapon.sigmaRegistrationNumber && `SIGMA: ${weapon.sigmaRegistrationNumber}`,
                  ]
                    .filter(Boolean)
                    .join(" — ") || "Sem série/SIGMA informados"
                }
              />
              <Chip
                size="small"
                label={weapon.active ? "Ativa" : "Inativa"}
                color={weapon.active ? "primary" : "default"}
                style={{ marginRight: 48 }}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => handleOpenEdit(weapon)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(weapon)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingWeapon ? "Editar arma" : "Adicionar arma"}</DialogTitle>
        <Formik
          initialValues={editingWeapon ? { ...emptyWeapon, ...editingWeapon } : emptyWeapon}
          enableReinitialize
          onSubmit={handleSubmit}
        >
          {({ values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="usageType" label="Tipo de uso" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="storageLocation" label="Local de guarda" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="brand" label="Marca" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth required variant="outlined" size="small" name="model" label="Modelo" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponType" label="Tipo (pistola, revólver...)" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="caliber" label="Calibre" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="serialNumber" label="Número de série" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="sigmaRegistrationNumber" label="SIGMA" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      type="date"
                      name="crafValidUntil"
                      label="Validade do CRAF"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!values.active}
                          onChange={(e) => setFieldValue("active", e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Arma ativa (disponível para uso)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      fullWidth
                      multiline
                      minRows={2}
                      variant="outlined"
                      size="small"
                      name="notes"
                      label="Observações"
                    />
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
          )}
        </Formik>
      </Dialog>
    </Box>
  );
};

export default MemberWeaponsSection;
