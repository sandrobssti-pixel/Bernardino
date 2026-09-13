import React, { useEffect, useState, useContext } from "react";

import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import useSettings from "../../hooks/useSettings";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import OnlyForSuperUser from "../OnlyForSuperUser";
import useAuth from "../../hooks/useAuth.js/index.js";

import { Colorize, Delete, AttachFile, CloudUpload, DeleteOutline } from "@material-ui/icons";
import ColorModeContext from "../../layout/themeContext";
import api from "../../services/api";
import { getBackendUrl } from "../../config";

import defaultLogoLight from "../../assets/logo.png";
import defaultLogoDark from "../../assets/logo-black.png";
import defaultLogoFavicon from "../../assets/favicon.ico";
import defaultAppleTouchIcon from "../../assets/apple-touch-icon.png";
import defaultPwaAndroid192 from "../../assets/android-chrome-192x192.png";
import defaultPwaAndroid512 from "../../assets/android-chrome-512x512.png";
import defaultMsTile150 from "../../assets/mstile-150x150.png";
import ColorBoxModal from "../ColorBoxModal/index.js";

const BRANDING_ASSETS = [
  { key: "appLogoLight", label: "Logotipo claro", mode: "Light", idealSize: "500x160", fallback: defaultLogoLight },
  { key: "appLogoDark", label: "Logotipo escuro", mode: "Dark", idealSize: "500x160", fallback: defaultLogoDark },
  { key: "appLogoFavicon", label: "Favicon", mode: "Favicon", idealSize: "64x64", fallback: defaultLogoFavicon },
  { key: "appLogoAppleTouchIcon", label: "Apple Touch Icon", mode: "AppleTouchIcon", idealSize: "180x180", fallback: defaultAppleTouchIcon },
  { key: "appLogoPwaAndroid192", label: "PWA Android 192", mode: "PwaAndroid192", idealSize: "192x192", fallback: defaultPwaAndroid192 },
  { key: "appLogoPwaAndroid512", label: "PWA Android 512", mode: "PwaAndroid512", idealSize: "512x512", fallback: defaultPwaAndroid512 },
  { key: "appLogoPwaMsTile150", label: "MS Tile 150", mode: "PwaMsTile150", idealSize: "150x150", fallback: defaultMsTile150 },
];

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  panel: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "light"
        ? "0 10px 24px rgba(15, 23, 42, 0.05)"
        : "0 10px 24px rgba(0, 0, 0, 0.35)",
    background: theme.palette.background.paper,
    padding: theme.spacing(1.2),
  },
  sectionTitle: {
    fontSize: "0.74rem",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: theme.palette.text.secondary,
    fontWeight: 700,
    marginBottom: theme.spacing(0.7),
  },
  identityGrid: {
    marginBottom: theme.spacing(1),
  },
  compactInput: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      height: 36,
      fontSize: "0.82rem",
    },
    "& .MuiInputLabel-outlined": {
      transform: "translate(14px, 11px) scale(1)",
      fontSize: "0.77rem",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
  },
  colorCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px 0 10px",
  },
  colorInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  colorText: {
    fontSize: "0.75rem",
    color: theme.palette.text.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  colorAction: {
    width: 24,
    height: 24,
    padding: 2,
  },
  assetSelectorRow: {
    marginTop: theme.spacing(0.5),
  },
  selectedAssetCard: {
    marginTop: theme.spacing(1.25),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(1.2),
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  loginBrandingCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(1.2),
  },
  sectionCardSpacer: {
    marginTop: theme.spacing(1.25),
  },
  logoMain: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoPreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.default,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoPreviewImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  logoTextWrap: {
    minWidth: 0,
  },
  logoTitle: {
    fontSize: "0.78rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  logoMeta: {
    marginTop: 2,
    fontSize: "0.68rem",
    color: theme.palette.text.secondary,
  },
  logoPath: {
    marginTop: 2,
    fontSize: "0.66rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  brandingPreviewImg: {
    maxWidth: "100%",
    maxHeight: 120,
    borderRadius: 8,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    objectFit: "contain",
    background: "#fafafa"
  },
  uploadActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  uploadButton: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  textField: {
    marginBottom: theme.spacing(1.2)
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  actionBtn: {
    width: 26,
    height: 26,
    padding: 2,
  },
  dropHint: {
    marginTop: theme.spacing(0.8),
    fontSize: "0.66rem",
    color: theme.palette.text.secondary,
  },
}));

export default function Whitelabel(props) {
  const {
    settings,
    loginBrandingConfig,
    onLoginBrandingChange,
    onLoginBrandingUpload,
    onLoginBrandingRemove,
    resolveBrandingImageUrl,
    loginBrandingUploading = {},
    loginBrandingRemoving = {}
  } = props;
  const classes = useStyles();
  const [settingsLoaded, setSettingsLoaded] = useState({});
  const [appName, setAppName] = useState("");
  const [assetRefreshToken, setAssetRefreshToken] = useState({});
  const [selectedAssetKey, setSelectedAssetKey] = useState(BRANDING_ASSETS[0].key);

  const { getCurrentUserInfo } = useAuth();
  const [currentUser, setCurrentUser] = useState({});

  const { colorMode } = useContext(ColorModeContext);
  const [primaryColorLightModalOpen, setPrimaryColorLightModalOpen] = useState(false);
  const [primaryColorDarkModalOpen, setPrimaryColorDarkModalOpen] = useState(false);

  const { update } = useSettings();

  function updateSettingsLoaded(key, value) {
    if (key === "primaryColorLight" || key === "primaryColorDark" || key === "appName") {
      localStorage.setItem(key, value);
    }
    setSettingsLoaded((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    getCurrentUserInfo().then((u) => setCurrentUser(u));

    if (Array.isArray(settings) && settings.length) {
      const nextState = {
        primaryColorLight: settings.find((s) => s.key === "primaryColorLight")?.value,
        primaryColorDark: settings.find((s) => s.key === "primaryColorDark")?.value,
        appLogoLight: settings.find((s) => s.key === "appLogoLight")?.value,
        appLogoDark: settings.find((s) => s.key === "appLogoDark")?.value,
        appLogoFavicon: settings.find((s) => s.key === "appLogoFavicon")?.value,
        appLogoAppleTouchIcon: settings.find((s) => s.key === "appLogoAppleTouchIcon")?.value,
        appLogoPwaAndroid192: settings.find((s) => s.key === "appLogoPwaAndroid192")?.value,
        appLogoPwaAndroid512: settings.find((s) => s.key === "appLogoPwaAndroid512")?.value,
        appLogoPwaMsTile150: settings.find((s) => s.key === "appLogoPwaMsTile150")?.value,
        appName: settings.find((s) => s.key === "appName")?.value,
      };

      setAppName(nextState.appName || "");
      setSettingsLoaded(nextState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  async function handleSaveSetting(key, value) {
    await update({ key, value });
    updateSettingsLoaded(key, value);
    toast.success("Operação atualizada com sucesso.");
  }

  const resolveLogoUrl = (logoPath, fallback, refreshToken) => {
    if (!logoPath) return fallback;
    if (logoPath.startsWith("http")) return logoPath;
    const normalizedToken = refreshToken ? `?v=${refreshToken}` : "";
    return `${getBackendUrl()}/public/${logoPath}${normalizedToken}`;
  };

  const uploadAssetFile = async (file, asset) => {
    if (!file || !asset?.mode) return;

    const formData = new FormData();
    formData.append("typeArch", "logo");
    formData.append("mode", asset.mode);
    formData.append("file", file);

    try {
      const response = await api.post("/settings-whitelabel/logo", formData);
      updateSettingsLoaded(asset.key, response.data);

      if (asset.key === "appLogoLight") {
        colorMode.setAppLogoLight(`${getBackendUrl()}/public/${response.data}`);
      }
      if (asset.key === "appLogoDark") {
        colorMode.setAppLogoDark(`${getBackendUrl()}/public/${response.data}`);
      }
      if (asset.key === "appLogoFavicon") {
        colorMode.setAppLogoFavicon(`${getBackendUrl()}/public/${response.data}`);
      }
      if (asset.key === "appLogoAppleTouchIcon") {
        colorMode.setAppLogoAppleTouchIcon(`${getBackendUrl()}/public/${response.data}?v=${Date.now()}`);
      }
      if (asset.key === "appLogoPwaAndroid192") {
        colorMode.setAppLogoPwaAndroid192(`${getBackendUrl()}/public/${response.data}?v=${Date.now()}`);
      }
      if (asset.key === "appLogoPwaAndroid512") {
        colorMode.setAppLogoPwaAndroid512(`${getBackendUrl()}/public/${response.data}?v=${Date.now()}`);
      }
      if (asset.key === "appLogoPwaMsTile150") {
        colorMode.setAppLogoPwaMsTile150(`${getBackendUrl()}/public/${response.data}?v=${Date.now()}`);
      }

      setAssetRefreshToken((prev) => ({ ...prev, [asset.key]: Date.now() }));

      toast.success(`${asset.label} atualizado com sucesso.`);
    } catch (err) {
      console.error("Falha no upload do logo", err);
      toast.error("Falha ao enviar o arquivo selecionado.");
    }
  };

  const uploadLogo = async (e, asset) => {
    if (!e.target.files) return;
    await uploadAssetFile(e.target.files[0], asset);
    e.target.value = "";
  };

  const clearAsset = async (asset) => {
    await handleSaveSetting(asset.key, "");

    if (asset.key === "appLogoLight") {
      colorMode.setAppLogoLight(defaultLogoLight);
    }
    if (asset.key === "appLogoDark") {
      colorMode.setAppLogoDark(defaultLogoDark);
    }
    if (asset.key === "appLogoFavicon") {
      colorMode.setAppLogoFavicon(defaultLogoFavicon);
    }
    if (asset.key === "appLogoAppleTouchIcon") {
      colorMode.setAppLogoAppleTouchIcon(defaultAppleTouchIcon);
    }
    if (asset.key === "appLogoPwaAndroid192") {
      colorMode.setAppLogoPwaAndroid192(defaultPwaAndroid192);
    }
    if (asset.key === "appLogoPwaAndroid512") {
      colorMode.setAppLogoPwaAndroid512(defaultPwaAndroid512);
    }
    if (asset.key === "appLogoPwaMsTile150") {
      colorMode.setAppLogoPwaMsTile150(defaultMsTile150);
    }

    setAssetRefreshToken((prev) => ({ ...prev, [asset.key]: Date.now() }));
  };

  const selectedAsset = BRANDING_ASSETS.find((asset) => asset.key === selectedAssetKey) || BRANDING_ASSETS[0];
  const selectedAssetLogoSrc = resolveLogoUrl(
    settingsLoaded[selectedAsset.key],
    selectedAsset.fallback,
    assetRefreshToken[selectedAsset.key]
  );
  const resolveLoginBrandingImageUrl = resolveBrandingImageUrl || ((value) => value || "");

  return (
    <div className={classes.root}>
      <OnlyForSuperUser
        user={currentUser}
        yes={() => (
          <>
            <Paper elevation={0} className={classes.panel}>
              <Typography className={classes.sectionTitle}>Identidade</Typography>

              <Grid container spacing={1} className={classes.identityGrid}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <TextField
                      id="appname-field"
                      label="Nome do sistema"
                      variant="outlined"
                      value={appName}
                      className={classes.compactInput}
                      onChange={(e) => setAppName(e.target.value)}
                      onBlur={async () => {
                        await handleSaveSetting("appName", appName);
                        colorMode.setAppName(appName || "AtendeFlow");
                      }}
                    />
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <div className={classes.colorCard}>
                    <div className={classes.colorInfo}>
                      <div
                        className={classes.colorDot}
                        style={{ backgroundColor: settingsLoaded.primaryColorLight || "#1976d2" }}
                      />
                      <Typography className={classes.colorText}>
                        Cor clara {settingsLoaded.primaryColorLight || "#1976d2"}
                      </Typography>
                    </div>
                    <IconButton
                      className={classes.colorAction}
                      onClick={() => setPrimaryColorLightModalOpen(true)}
                    >
                      <Colorize fontSize="small" />
                    </IconButton>
                  </div>
                  <ColorBoxModal
                    open={primaryColorLightModalOpen}
                    handleClose={() => setPrimaryColorLightModalOpen(false)}
                    onChange={(color) => {
                      handleSaveSetting("primaryColorLight", `#${color.hex}`);
                      colorMode.setPrimaryColorLight(`#${color.hex}`);
                    }}
                    currentColor={settingsLoaded.primaryColorLight}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <div className={classes.colorCard}>
                    <div className={classes.colorInfo}>
                      <div
                        className={classes.colorDot}
                        style={{ backgroundColor: settingsLoaded.primaryColorDark || "#111827" }}
                      />
                      <Typography className={classes.colorText}>
                        Cor escura {settingsLoaded.primaryColorDark || "#111827"}
                      </Typography>
                    </div>
                    <IconButton
                      className={classes.colorAction}
                      onClick={() => setPrimaryColorDarkModalOpen(true)}
                    >
                      <Colorize fontSize="small" />
                    </IconButton>
                  </div>
                  <ColorBoxModal
                    open={primaryColorDarkModalOpen}
                    handleClose={() => setPrimaryColorDarkModalOpen(false)}
                    onChange={(color) => {
                      handleSaveSetting("primaryColorDark", `#${color.hex}`);
                      colorMode.setPrimaryColorDark(`#${color.hex}`);
                    }}
                    currentColor={settingsLoaded.primaryColorDark}
                  />
                </Grid>
              </Grid>

              <Divider />

              <Typography className={classes.sectionTitle} style={{ marginTop: 10 }}>
                Logotipos
              </Typography>

              <Grid container spacing={1} className={classes.assetSelectorRow}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <TextField
                      select
                      label="Tipo de logotipo"
                      variant="outlined"
                      value={selectedAssetKey}
                      className={classes.compactInput}
                      onChange={(e) => setSelectedAssetKey(e.target.value)}
                    >
                      {BRANDING_ASSETS.map((asset) => (
                        <MenuItem key={asset.key} value={asset.key}>
                          {asset.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </FormControl>
                </Grid>
              </Grid>

              <div className={classes.selectedAssetCard}>
                <div className={classes.logoMain}>
                  <div className={classes.logoPreview}>
                    <img
                      src={selectedAssetLogoSrc}
                      alt={`${selectedAsset.label}-preview`}
                      className={classes.logoPreviewImg}
                    />
                  </div>

                  <div className={classes.logoTextWrap}>
                    <Typography className={classes.logoTitle}>{selectedAsset.label}</Typography>
                    <Typography className={classes.logoMeta}>Ideal: {selectedAsset.idealSize}px</Typography>
                    <Typography className={classes.logoPath}>
                      {settingsLoaded[selectedAsset.key] || "Padrão do sistema"}
                    </Typography>
                  </div>
                </div>

                <div className={classes.rowActions}>
                  <input
                    type="file"
                    id="upload-selected-branding-asset"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => uploadLogo(e, selectedAsset)}
                  />
                  {settingsLoaded[selectedAsset.key] && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<Delete fontSize="small" />}
                      onClick={() => clearAsset(selectedAsset)}
                    >
                      Remover
                    </Button>
                  )}
                  <label htmlFor="upload-selected-branding-asset">
                    <Button
                      variant="outlined"
                      color="primary"
                      component="span"
                      startIcon={<AttachFile fontSize="small" />}
                    >
                      Escolher arquivo
                    </Button>
                  </label>
                </div>
              </div>
            </Paper>

            {loginBrandingConfig && onLoginBrandingChange && onLoginBrandingUpload && onLoginBrandingRemove && (
              <Paper elevation={0} className={`${classes.panel} ${classes.sectionCardSpacer}`}>
                <Typography className={classes.sectionTitle}>Login / capa</Typography>

                <div className={classes.loginBrandingCard}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">Logo do login</Typography>

                      {loginBrandingConfig.loginLogo && (
                        <Box mt={1} mb={1}>
                          <img
                            src={resolveLoginBrandingImageUrl(loginBrandingConfig.loginLogo)}
                            alt="Logo do login"
                            className={classes.brandingPreviewImg}
                          />
                        </Box>
                      )}

                      <input
                        id="whitelabel-login-logo-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => onLoginBrandingUpload("loginLogo", e.target.files[0])}
                      />
                      <div className={classes.uploadActions}>
                        <label htmlFor="whitelabel-login-logo-upload">
                          <Button
                            variant="outlined"
                            component="span"
                            startIcon={<CloudUpload />}
                            className={classes.uploadButton}
                            disabled={loginBrandingUploading.loginLogo}
                          >
                            {loginBrandingUploading.loginLogo ? "Enviando..." : "Enviar logo"}
                          </Button>
                        </label>

                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<DeleteOutline />}
                          className={classes.uploadButton}
                          disabled={!loginBrandingConfig.loginLogo || loginBrandingRemoving.loginLogo}
                          onClick={() => onLoginBrandingRemove("loginLogo")}
                        >
                          {loginBrandingRemoving.loginLogo ? "Removendo..." : "Remover"}
                        </Button>
                      </div>

                      <Typography className={classes.logoMeta}>
                        Se nenhuma imagem for enviada, o sistema usa <code>/logo.png</code>.
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">
                        Imagem de fundo (capa do login)
                      </Typography>

                      {loginBrandingConfig.loginBackground && (
                        <Box mt={1} mb={1}>
                          <img
                            src={resolveLoginBrandingImageUrl(loginBrandingConfig.loginBackground)}
                            alt="Capa do login"
                            className={classes.brandingPreviewImg}
                          />
                        </Box>
                      )}

                      <input
                        id="whitelabel-login-background-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => onLoginBrandingUpload("loginBackground", e.target.files[0])}
                      />
                      <div className={classes.uploadActions}>
                        <label htmlFor="whitelabel-login-background-upload">
                          <Button
                            variant="outlined"
                            component="span"
                            startIcon={<CloudUpload />}
                            className={classes.uploadButton}
                            disabled={loginBrandingUploading.loginBackground}
                          >
                            {loginBrandingUploading.loginBackground ? "Enviando..." : "Enviar capa"}
                          </Button>
                        </label>

                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<DeleteOutline />}
                          className={classes.uploadButton}
                          disabled={!loginBrandingConfig.loginBackground || loginBrandingRemoving.loginBackground}
                          onClick={() => onLoginBrandingRemove("loginBackground")}
                        >
                          {loginBrandingRemoving.loginBackground ? "Removendo..." : "Remover"}
                        </Button>
                      </div>

                      <Typography className={classes.logoMeta}>
                        Recomendada imagem em <code>.webp</code> ou <code>.jpg</code>. Se vazio, o sistema usa a capa padrão.
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Link do WhatsApp do login"
                        name="loginWhatsapp"
                        value={loginBrandingConfig.loginWhatsapp || ""}
                        onChange={onLoginBrandingChange}
                        variant="outlined"
                        fullWidth
                        className={classes.textField}
                        size="small"
                      />
                      <Typography className={classes.logoMeta}>
                        Exemplo: <code>https://wa.me/5541999999999</code>. Usado no botão de WhatsApp da tela de login e no botão "Chamar suporte".
                      </Typography>
                    </Grid>
                  </Grid>
                </div>
              </Paper>
            )}
          </>
        )}
      />
    </div>
  );
}
