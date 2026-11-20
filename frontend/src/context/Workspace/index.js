import React, { createContext, useContext, useState, useCallback } from "react";
import { toast } from "react-toastify";

// Multi-telas (v2.3.324, pedido do cliente) — abre um módulo "por cima"
// da navegação normal (o "sistema mãe"), sem perder o que já estava
// preenchido nele. Navegação normal do menu (clicar num item sem usar
// o botão "abrir em nova aba") continua trocando a tela inteira, exatamente
// como sempre foi — isso aqui é só uma camada OPCIONAL, explícita, por
// cima. Máximo de 3 telas abertas AO MESMO TEMPO contando a navegação
// normal como a 1ª — ou seja, até 2 abas extras abertas explicitamente.
// Confirmado com o cliente: bloquear e avisar ao tentar abrir a 4ª (não
// fechar nada sozinho), e troca de aba só por clique (sem atalho de
// teclado, pra não conflitar com Tab usado pra navegar entre campos de
// formulário).
const MAX_EXTRA_TABS = 2;

const WorkspaceContext = createContext();

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider = ({ children }) => {
  // `tabs` = só as abas EXTRAS (abertas explicitamente) — a navegação
  // normal (menu lateral/rotas) nunca entra nessa lista, ela é sempre a
  // aba "Principal" implícita. `activeTabId: null` = aba Principal ativa.
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  const openInNewTab = useCallback((moduleKey, label, to) => {
    setTabs((current) => {
      const existing = current.find((tab) => tab.to === to);
      if (existing) {
        setActiveTabId(existing.id);
        return current;
      }
      if (current.length >= MAX_EXTRA_TABS) {
        toast.warn(
          `Você já tem ${MAX_EXTRA_TABS} tela(s) extra(s) aberta(s) — feche uma antes de abrir outra.`
        );
        return current;
      }
      const id = `${moduleKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setActiveTabId(id);
      return [...current, { id, moduleKey, label, to }];
    });
  }, []);

  const closeTab = useCallback((id) => {
    setTabs((current) => current.filter((tab) => tab.id !== id));
    setActiveTabId((current) => (current === id ? null : current));
  }, []);

  const setActiveTab = useCallback((id) => {
    setActiveTabId(id);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ tabs, activeTabId, openInNewTab, closeTab, setActiveTab, maxExtraTabs: MAX_EXTRA_TABS }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
