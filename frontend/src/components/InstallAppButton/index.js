import React, { useState, useEffect, useCallback } from "react";

import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import GetAppIcon from "@material-ui/icons/GetApp";

import { i18n } from "../../translate/i18n";

const isStandaloneDisplay = () => {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  } catch (_) {
    return false;
  }
};

// Botão "instalar aplicativo": aparece só quando o navegador dispara o
// evento beforeinstallprompt, confirmando que o site já cumpre os
// critérios de instalação de PWA (manifest.json + ícones + service
// worker já existiam neste projeto, bastava expor a ação pro usuário —
// a maioria nunca nota o ícone discreto que o Chrome/Edge mostra na
// barra de endereço por conta própria). Sem suporte nativo (ex.:
// Firefox desktop, Safari) ou já instalado, o botão simplesmente nunca
// aparece — não existe fallback manual aqui de propósito, pra não
// prometer um "instalar" que não funciona nesses navegadores.
const InstallAppButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay());

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (installed || !deferredPrompt) return null;

  return (
    <Tooltip title={i18n.t("mainDrawer.appBar.installApp")}>
      <IconButton
        onClick={handleInstall}
        aria-label={i18n.t("mainDrawer.appBar.installApp")}
        color="inherit"
      >
        <GetAppIcon />
      </IconButton>
    </Tooltip>
  );
};

export default InstallAppButton;
