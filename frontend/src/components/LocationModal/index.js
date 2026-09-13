import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField
} from "@material-ui/core";
import toastError from "../../errors/toastError";

const parseCoordinatesFromLink = rawLink => {
  const link = String(rawLink || "").trim();
  if (!link) return null;

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) {
      return { latitude: Number(match[1]), longitude: Number(match[2]) };
    }
  }

  return null;
};

const buildOsmEmbedUrl = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

  const delta = 0.005;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
};

const LocationModal = ({ open, onClose, onSubmit, defaultAddress = "" }) => {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [name, setName] = useState("Localização atual");
  const [address, setAddress] = useState(defaultAddress);
  const [mapLink, setMapLink] = useState("");
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setLatitude("");
      setLongitude("");
      setMapLink("");
      setName("Localização atual");
      setAddress(defaultAddress || "");
      setLoadingCurrentLocation(false);
      setSending(false);
    }
  }, [open, defaultAddress]);

  const mapPreviewUrl = useMemo(
    () => buildOsmEmbedUrl(latitude, longitude),
    [latitude, longitude]
  );

  const handleCaptureCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toastError("Geolocalização não suportada neste navegador.");
      return;
    }

    setLoadingCurrentLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingCurrentLocation(false);
    }
  };

  const handleExtractFromLink = () => {
    const parsed = parseCoordinatesFromLink(mapLink);
    if (!parsed) {
      toastError("Não foi possível extrair latitude/longitude do link.");
      return;
    }

    setLatitude(String(parsed.latitude));
    setLongitude(String(parsed.longitude));
  };

  const handleSubmit = async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toastError("Informe latitude e longitude válidas.");
      return;
    }

    setSending(true);
    try {
      await onSubmit({
        latitude: lat,
        longitude: lng,
        name: String(name || "").trim() || undefined,
        address: String(address || "").trim() || undefined
      });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enviar localização</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleCaptureCurrentLocation}
              disabled={loadingCurrentLocation || sending}
            >
              {loadingCurrentLocation ? (
                <CircularProgress size={20} />
              ) : (
                "Usar localização atual"
              )}
            </Button>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Link do mapa (opcional)"
              placeholder="Cole um link do Google Maps e clique em Extrair"
              value={mapLink}
              onChange={e => setMapLink(e.target.value)}
              disabled={sending}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="text"
              color="primary"
              onClick={handleExtractFromLink}
              disabled={sending || !mapLink.trim()}
            >
              Extrair coordenadas do link
            </Button>
          </Grid>

          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Latitude"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              disabled={sending}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Longitude"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              disabled={sending}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Nome da localização (opcional)"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={sending}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Descrição/Endereço (opcional)"
              value={address}
              onChange={e => setAddress(e.target.value)}
              disabled={sending}
            />
          </Grid>

          {mapPreviewUrl && (
            <Grid item xs={12}>
              <iframe
                title="location-preview"
                src={mapPreviewUrl}
                width="100%"
                height="240"
                style={{ border: 0, borderRadius: 8 }}
                loading="lazy"
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={sending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={sending}
        >
          {sending ? <CircularProgress size={20} /> : "Enviar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationModal;
