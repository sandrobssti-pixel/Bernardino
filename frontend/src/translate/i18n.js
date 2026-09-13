import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { messages } from "./languages";

i18n
  .use(LanguageDetector)
  .init({
    debug: false,
    fallbackLng: "pt",
    defaultNS: ["translations"],
    ns: ["translations"],
    resources: messages,
    detection: {
      // Removido "navigator": antes, sem uma escolha salva, o idioma do
      // navegador/sistema operacional do usuário (ex.: espanhol) sobrepunha o
      // "fallbackLng: pt" e a interface carregava traduzida sem ninguém
      // pedir. Agora, sem escolha salva, cai direto no fallback (português).
      // Quem trocar de idioma manualmente (UserLanguageSelector) continua
      // tendo a escolha salva e respeitada nas próximas visitas.
      order: ["localStorage", "htmlTag"],
      caches: ["localStorage"]
    }
  });

export { i18n };
