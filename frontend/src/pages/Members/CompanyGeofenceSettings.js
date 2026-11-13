import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import RoomIcon from "@material-ui/icons/Room";
import MyLocationIcon from "@material-ui/icons/MyLocation";
import WarningIcon from "@material-ui/icons/Warning";

import useCompanyGeofence from "../../hooks/useCompanyGeofence";
import toastError from "../../errors/toastError";

// Geofencing do Controle de Acesso (Gerenciador CAC, Fase 4) — coordenada
// + raio do clube, usados pra aprovar automaticamente a entrada de
// habitualidade quando a localização enviada pelo associado bate dentro
// do raio, sem o Admin precisar conferir manualmente cada uma. Sem
// configurar, o comportamento continua exatamente como antes (sempre
// aprovação manual). Ver docs/MANUAL_TECNICO.md.
const CompanyGeofenceSettings = () => {
  const geofence = useCompanyGeofence();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("150");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await geofence.getSettings();
      if (isMounted.current) setSettings(data);
    } catch (err) {
      // Sem acesso (não-admin) — não é um erro pra mostrar, só esconde a seção.
      if (isMounted.current) setSettings(null);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleOpenDialog = () => {
    setLatitude(settings?.latitude != null ? String(settings.latitude) : "");
    setLongitude(settings?.longitude != null ? String(settings.longitude) : "");
    setRadiusMeters(settings?.radiusMeters != null ? String(settings.radiusMeters) : "150");
    setDialogOpen(true);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toastError("Seu navegador não suporta geolocalização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocating(false);
      },
      () => {
        toastError("Não foi possível obter sua localização — ative o GPS e permita o acesso.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await geofence.updateSettings({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: parseFloat(radiusMeters),
      });
      setSettings(data);
      toast.success("Geofencing do clube configurado.");
      setDialogOpen(false);
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    try {
      await geofence.removeSettings();
      setSettings({ configured: false, latitude: null, longitude: null, radiusMeters: null });
      toast.success("Geofencing removido — habitualidade volta a exigir aprovação manual.");
    } catch (err) {
      toastError(err);
    }
  };

  if (loading || !settings) return null;

  const canSave =
    latitude !== "" && longitude !== "" && !Number.isNaN(parseFloat(latitude)) && !Number.isNaN(parseFloat(longitude));

  return (
    <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gridGap={8}>
        <Box display="flex" alignItems="center" gridGap={8}>
          {settings.configured ? (
            <RoomIcon style={{ color: "#0ea473" }} />
          ) : (
            <WarningIcon style={{ color: "#bdbdbd" }} />
          )}
          <Box>
            <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
              Geofencing do clube (aprovação automática de habitualidade)
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {settings.configured
                ? `Raio de ${settings.radiusMeters}m — habitualidade dentro do raio é aprovada automaticamente.`
                : "Não configurado — toda entrada de habitualidade exige aprovação manual."}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gridGap={8}>
          <Button size="small" variant="outlined" onClick={handleOpenDialog}>
            {settings.configured ? "Editar" : "Configurar geofencing"}
          </Button>
          {settings.configured && (
            <Button size="small" style={{ color: "#c62828" }} onClick={handleRemove}>
              Remover
            </Button>
          )}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Geofencing do clube</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Informe a coordenada do clube — fique no local e use o botão
            abaixo, ou digite manualmente.
          </Typography>
          <Box mt={1} mb={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<MyLocationIcon />}
              disabled={locating}
              onClick={handleUseMyLocation}
            >
              {locating ? "Obtendo localização..." : "Usar minha localização atual"}
            </Button>
          </Box>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            type="number"
            label="Raio (metros)"
            helperText="Entre 20 e 5000 metros. Sugestão: 150m."
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSave || saving}
            onClick={handleSave}
          >
            {saving ? <CircularProgress size={20} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CompanyGeofenceSettings;
