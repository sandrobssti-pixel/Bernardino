import React, { useState, useEffect, useMemo } from "react";
import { unstable_batchedUpdates } from "react-dom";
import api from "./services/api";
import "react-toastify/dist/ReactToastify.css";
import "./styles/toast.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider, responsiveFontSizes } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo.png";
import defaultLogoDark from "./assets/logo-black.png";
import defaultLogoFavicon from "./assets/favicon.ico";
import defaultAppleTouchIcon from "./assets/apple-touch-icon.png";
import defaultPwaAndroid192 from "./assets/android-chrome-192x192.png";
import defaultPwaAndroid512 from "./assets/android-chrome-512x512.png";
import defaultMsTile150 from "./assets/mstile-150x150.png";
import useSettings from "./hooks/useSettings";

const queryClient = new QueryClient();

// Safe localStorage helper for Safari private mode
const safeStorage = {
  getItem: (key, defaultValue = null) => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem failed:", e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem failed:", e);
    }
  }
};

const App = () => {
  const [locale, setLocale] = useState();
  const appColorLocalStorage = safeStorage.getItem("primaryColorLight") || safeStorage.getItem("primaryColorDark") || "#6d5efc";
  const appNameLocalStorage = safeStorage.getItem("appName", "");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preferredTheme = safeStorage.getItem("preferredTheme");
  const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");
  const [primaryColorLight, setPrimaryColorLight] = useState(appColorLocalStorage);
  const [primaryColorDark, setPrimaryColorDark] = useState(appColorLocalStorage);
  const [appLogoLight, setAppLogoLight] = useState(defaultLogoLight);
  const [appLogoDark, setAppLogoDark] = useState(defaultLogoDark);
  const [appLogoFavicon, setAppLogoFavicon] = useState(defaultLogoFavicon);
  const [appLogoAppleTouchIcon, setAppLogoAppleTouchIcon] = useState(defaultAppleTouchIcon);
  const [appLogoPwaAndroid192, setAppLogoPwaAndroid192] = useState(defaultPwaAndroid192);
  const [appLogoPwaAndroid512, setAppLogoPwaAndroid512] = useState(defaultPwaAndroid512);
  const [appLogoPwaMsTile150, setAppLogoPwaMsTile150] = useState(defaultMsTile150);
  const [appName, setAppName] = useState(appNameLocalStorage);
  const { getPublicSetting } = useSettings();

  const resolvePublicLogoUrl = (file, fallback) => {
    if (!file) return fallback;
    if (String(file).startsWith("http")) return file;
    return `${getBackendUrl()}/public/${file}`;
  };

  // Persiste a logo resolvida no localStorage para a splash screen estática
  // (public/index.html) poder exibi-la antes do React montar.
  const setAppLogoLightPersist = (value) => {
    setAppLogoLight(value);
    if (value && value !== defaultLogoLight) {
      safeStorage.setItem("splashLogoLight", value);
    } else {
      safeStorage.removeItem("splashLogoLight");
    }
  };
  const setAppLogoDarkPersist = (value) => {
    setAppLogoDark(value);
    if (value && value !== defaultLogoDark) {
      safeStorage.setItem("splashLogoDark", value);
    } else {
      safeStorage.removeItem("splashLogoDark");
    }
  };
  const setAppNamePersist = (value) => {
    const normalizedValue = String(value || "").trim() || "AtendeFlow";
    setAppName(normalizedValue);
    safeStorage.setItem("appName", normalizedValue);
  };

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          safeStorage.setItem("preferredTheme", newMode); // Persistindo o tema no localStorage
          return newMode;
        });
      },
      setPrimaryColorLight,
      setPrimaryColorDark,
      setAppLogoLight: setAppLogoLightPersist,
      setAppLogoDark: setAppLogoDarkPersist,
      setAppLogoFavicon,
      setAppLogoAppleTouchIcon,
      setAppLogoPwaAndroid192,
      setAppLogoPwaAndroid512,
      setAppLogoPwaMsTile150,
      setAppName: setAppNamePersist,
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      mode,
    }),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, mode]
  );

  const theme = useMemo(
    () => {
      const darkPalette = {
        page: "#0b1220",
        surface: "#111b2e",
        elevated: "#17233a",
        border: "rgba(148, 163, 184, 0.2)",
        textPrimary: "#e6edf8",
        textSecondary: "#a9b6cc",
        topbar: "#12213a",
        tabHeader: "#172740",
        input: "#131f34",
      };

      return responsiveFontSizes(createTheme(
        {
          scrollbarStyles: {
            "&::-webkit-scrollbar": {
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
              backgroundColor: mode === "light" ? primaryColorLight : primaryColorDark,
            },
          },
          scrollbarStylesSoft: {
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: mode === "light" ? "#F3F3F3" : "#333333",
            },
          },
          typography: {
            fontFamily: [
              "Inter",
              "DM Sans",
              "system-ui",
              "-apple-system",
              "BlinkMacSystemFont",
              "Segoe UI",
              "Roboto",
              "Helvetica Neue",
              "Arial",
              "sans-serif",
            ].join(","),
            fontSize: 13,
            // Titulos usam Space Grotesk - identidade visual "tech" (Etapa 2.1)
            h1: { fontFamily: '"Space Grotesk", Inter, sans-serif' },
            h2: { fontFamily: '"Space Grotesk", Inter, sans-serif' },
            h3: { fontFamily: '"Space Grotesk", Inter, sans-serif' },
            h4: { fontFamily: '"Space Grotesk", Inter, sans-serif' },
            h5: { fontFamily: '"Space Grotesk", Inter, sans-serif', fontWeight: 600 },
            h6: { fontFamily: '"Space Grotesk", Inter, sans-serif', fontWeight: 600 },
          },
          palette: {
            type: mode,
            primary: { main: mode === "light" ? primaryColorLight : primaryColorDark },
            textPrimary: mode === "light" ? primaryColorLight : primaryColorDark,
            borderPrimary: mode === "light" ? primaryColorLight : primaryColorDark,
            dark: { main: mode === "light" ? "#333333" : darkPalette.textPrimary },
            light: { main: mode === "light" ? "#F3F3F3" : darkPalette.elevated },
            fontColor: mode === "light" ? primaryColorLight : primaryColorDark,
            tabHeaderBackground: mode === "light" ? "#EEE" : darkPalette.tabHeader,
            optionsBackground: mode === "light" ? "#fafafa" : darkPalette.surface,
            fancyBackground: mode === "light" ? "#fafafa" : darkPalette.page,
            total: mode === "light" ? "#fff" : darkPalette.surface,
            messageIcons: mode === "light" ? "grey" : "#F3F3F3",
            inputBackground: mode === "light" ? "#FFFFFF" : darkPalette.input,
            barraSuperior: mode === "light" ? primaryColorLight : darkPalette.topbar,
            background: {
              default: mode === "light" ? "#f8fafc" : darkPalette.page,
              paper: mode === "light" ? "#ffffff" : darkPalette.surface,
            },
            text: {
              primary: mode === "light" ? "#111827" : darkPalette.textPrimary,
              secondary: mode === "light" ? "#4b5563" : darkPalette.textSecondary,
            },
            divider: mode === "light" ? "rgba(15, 23, 42, 0.1)" : darkPalette.border,
            action: {
              hover: mode === "light" ? "rgba(15, 23, 42, 0.04)" : "rgba(148, 163, 184, 0.12)",
              selected: mode === "light" ? "rgba(37, 99, 235, 0.08)" : "rgba(56, 189, 248, 0.18)",
            },
            // Tokens de design da tela de atendimento (inspirados no WhatsApp Web).
            // Aditivos: não substituem nenhuma chave usada hoje, apenas somam
            // um vocabulário único para os próximos componentes a consumir.
            chat: {
              background: mode === "light" ? "#efeae2" : "#0b141a",
              bubbleOutgoing: mode === "light" ? "#d9fdd3" : "#005c4b",
              bubbleOutgoingText: mode === "light" ? "#111b21" : "#e9edef",
              bubbleIncoming: mode === "light" ? "#ffffff" : "#202c33",
              bubbleIncomingText: mode === "light" ? "#111b21" : "#e9edef",
              bubbleMeta: mode === "light" ? "#667781" : "#8696a0",
              listHover: mode === "light" ? "rgba(11, 20, 26, 0.04)" : "rgba(233, 237, 239, 0.06)",
              listSelected: mode === "light" ? "#f0f2f5" : "#2a3942",
            },
            radius: {
              sm: 6,
              md: 10,
              lg: 16,
            },
            // Gradiente de marca (Etapa 2.1 - identidade visual "tech")
            brandGradient: "linear-gradient(135deg, #6d5efc 0%, #22d3ee 100%)",
          },
          props: {
            MuiDialog: {
              scroll: "paper",
            },
          },
          overrides: {
            // Identidade visual "tech" (Etapa 2.1): botões com gradiente de marca,
            // cantos mais suaves, sem caixa-alta forçada.
            MuiButton: {
              root: {
                borderRadius: 10,
                textTransform: "none",
                fontWeight: 600,
              },
              containedPrimary: {
                backgroundImage: "linear-gradient(135deg, #6d5efc 0%, #22d3ee 100%)",
                boxShadow: "0 0 0 1px rgba(109,94,252,0.35), 0 6px 18px -6px rgba(109,94,252,0.55)",
                "&:hover": {
                  backgroundImage: "linear-gradient(135deg, #5945e0 0%, #06b6d4 100%)",
                  boxShadow: "0 0 0 1px rgba(109,94,252,0.5), 0 8px 22px -6px rgba(109,94,252,0.7)",
                },
                "&.Mui-disabled": {
                  backgroundImage: "none",
                },
              },
            },
            MuiPaper: {
              rounded: {
                borderRadius: 12,
              },
            },
            MuiDialog: {
              paperScrollPaper: {
                "@media (max-height:820px)": {
                  margin: 8,
                  maxHeight: "calc(100vh - 16px)",
                  display: "flex",
                  flexDirection: "column",
                },
              },
            },
            MuiDialogContent: {
              root: {
                "@media (max-height:820px)": {
                  flex: "1 1 auto",
                  minHeight: 0,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                },
              },
            },
            MuiDialogActions: {
              root: {
                "@media (max-height:820px)": {
                  position: "sticky",
                  bottom: 0,
                  zIndex: 1,
                  flexShrink: 0,
                  backgroundColor: mode === "light" ? "#ffffff" : darkPalette.surface,
                  borderTop: `1px solid ${mode === "light" ? "rgba(15, 23, 42, 0.08)" : darkPalette.border}`,
                },
              },
            },
          },
          mode,
          appLogoLight,
          appLogoDark,
          appLogoFavicon,
          appName,
          calculatedLogoDark: () => {
            if (appLogoDark === defaultLogoDark && appLogoLight !== defaultLogoLight) {
              return appLogoLight;
            }
            return appLogoDark;
          },
          calculatedLogoLight: () => {
            if (appLogoDark !== defaultLogoDark && appLogoLight === defaultLogoLight) {
              return appLogoDark;
            }
            return appLogoLight;
          },
        },
        locale
      ));
    },
    [appLogoLight, appLogoDark, appLogoFavicon, appName, locale, mode, primaryColorDark, primaryColorLight]
  );

  useEffect(() => {
    const i18nlocale = safeStorage.getItem("i18nextLng", "pt-BR");
    const normalizedLocale = i18nlocale.includes("-")
      ? i18nlocale
      : `${i18nlocale}-BR`;
    const browserLocale =
      normalizedLocale.substring(0, 2) + normalizedLocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  useEffect(() => {
    safeStorage.setItem("preferredTheme", mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const path = window.location.pathname || "/";
    const isLogin = /\/(login|signup|forgot-password)(\/|$|\?)/i.test(path) || path === "/";
    if (isLogin) return;

    if (mode === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, [mode]);

  useEffect(() => {
    Promise.allSettled([
      getPublicSetting("primaryColorLight"),
      getPublicSetting("primaryColorDark"),
      getPublicSetting("appLogoLight"),
      getPublicSetting("appLogoDark"),
      getPublicSetting("appLogoFavicon"),
      getPublicSetting("appLogoAppleTouchIcon"),
      getPublicSetting("appLogoPwaAndroid192"),
      getPublicSetting("appLogoPwaAndroid512"),
      getPublicSetting("appLogoPwaMsTile150"),
      getPublicSetting("appName"),
    ]).then((results) => {
      const val = (i) => results[i].status === "fulfilled" ? results[i].value : null;
      unstable_batchedUpdates(() => {
        setPrimaryColorLight(val(0) || "#6d5efc");
        setPrimaryColorDark(val(1) || "#8b7bff");
        setAppLogoLightPersist(resolvePublicLogoUrl(val(2), defaultLogoLight));
        setAppLogoDarkPersist(resolvePublicLogoUrl(val(3), defaultLogoDark));
        setAppLogoFavicon(resolvePublicLogoUrl(val(4), defaultLogoFavicon));
        setAppLogoAppleTouchIcon(resolvePublicLogoUrl(val(5), defaultAppleTouchIcon));
        setAppLogoPwaAndroid192(resolvePublicLogoUrl(val(6), defaultPwaAndroid192));
        setAppLogoPwaAndroid512(resolvePublicLogoUrl(val(7), defaultPwaAndroid512));
        setAppLogoPwaMsTile150(resolvePublicLogoUrl(val(8), defaultMsTile150));
        setAppNamePersist(val(9));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primaryColor", mode === "light" ? primaryColorLight : primaryColorDark);
    root.style.setProperty("--appBackground", mode === "light" ? "#ffffff" : "#0b1220");
  }, [primaryColorLight, primaryColorDark, mode]);

  useEffect(() => {
    const root = document.documentElement;
    const isIOS =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent || "") ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    const updateAppHeight = () => {
      const viewport = window.visualViewport;
      // Usa a altura da viewport visual (encolhe quando o teclado abre no iOS/Android).
      // Antes somava offsetTop, mantendo a altura constante — isso causava o espaço
      // branco entre o teclado e o input no iOS/PWA.
      const effectiveViewportHeight = viewport?.height || window.innerHeight;
      // Quando o teclado abre, alguns navegadores mobile "panoram" a visual viewport
      // para baixo (visualViewport.offsetTop > 0) sem mover a layout viewport. Como o
      // layout raiz é position:fixed (ancorado à layout viewport), isso deixa um vão
      // entre o fundo do app e o teclado. Compensamos deslocando o layout raiz pelo
      // mesmo valor (ver layout/index.js, transform: translateY(--app-offset-top)).
      const offsetTop = viewport?.offsetTop || 0;

      root.style.setProperty("--app-height", `${Math.round(effectiveViewportHeight)}px`);
      root.style.setProperty("--app-offset-top", `${Math.round(offsetTop)}px`);
    };

    updateAppHeight();
    window.addEventListener("resize", updateAppHeight);
    window.visualViewport?.addEventListener("resize", updateAppHeight);
    window.visualViewport?.addEventListener("scroll", updateAppHeight);

    return () => {
      window.removeEventListener("resize", updateAppHeight);
      window.visualViewport?.removeEventListener("resize", updateAppHeight);
      window.visualViewport?.removeEventListener("scroll", updateAppHeight);
    };
  }, []);

  useEffect(() => {
    const touchIconLink = document.querySelector('link[rel="apple-touch-icon"]');
    if (touchIconLink) {
      touchIconLink.setAttribute("href", appLogoAppleTouchIcon || defaultAppleTouchIcon);
    }

    let msTileMeta = document.querySelector('meta[name="msapplication-TileImage"]');
    if (!msTileMeta) {
      msTileMeta = document.createElement("meta");
      msTileMeta.setAttribute("name", "msapplication-TileImage");
      document.head.appendChild(msTileMeta);
    }
    msTileMeta.setAttribute("content", appLogoPwaMsTile150 || defaultMsTile150);
  }, [appLogoAppleTouchIcon, appLogoPwaMsTile150]);

  useEffect(() => {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute("content", mode === "light" ? primaryColorLight : primaryColorDark);
  }, [mode, primaryColorLight, primaryColorDark]);

  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && getBackendUrl()) {
      manifestLink.setAttribute("href", `${getBackendUrl()}/manifest.webmanifest`);
    }
  }, []);

  useEffect(() => {
    if (!appName) return;

    document.title = appName;

    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement("meta");
      appleTitleMeta.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.setAttribute("content", appName);

    ["og:title", "twitter:title"].forEach((property) => {
      const selector = property === "og:title"
        ? 'meta[property="og:title"]'
        : 'meta[name="twitter:title"]';
      let titleMeta = document.querySelector(selector);
      if (!titleMeta) {
        titleMeta = document.createElement("meta");
        if (property === "og:title") titleMeta.setAttribute("property", property);
        else titleMeta.setAttribute("name", property);
        document.head.appendChild(titleMeta);
      }
      titleMeta.setAttribute("content", appName);
    });
  }, [appName]);

  useEffect(() => {
    async function fetchVersionData() {
      try {
        const response = await api.get("/version");
        const { data } = response;
        safeStorage.setItem("frontendVersion", data.version);
      } catch (error) {
        console.log("Error fetching data", error);
      }
    }
    fetchVersionData();
  }, []);

  return (
    <>
      <Favicon url={appLogoFavicon || defaultLogoFavicon} />
      <ColorModeContext.Provider value={{ colorMode }}>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <ActiveMenuProvider>
  <div style={{ position: "relative", overflow: "visible", minHeight: "var(--app-height, 100vh)" }}>
    <Routes />
  </div>
            </ActiveMenuProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
};

export default App;
