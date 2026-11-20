import React, { lazy, Suspense } from "react";
import { MemoryRouter } from "react-router-dom";

import { useWorkspace } from "../../context/Workspace";

// Registro dos módulos que podem ser abertos como aba extra (v2.3.324).
// Começa só com os módulos que o cliente pediu de exemplo (Atendimento,
// Vendas, Financeiro/Produtos, RH) — adicionar outro módulo aqui é só
// mais uma linha, mas cada um precisa ser testado antes (preservar
// formulário/scroll ao trocar de aba não é automático pra toda tela).
const MODULE_REGISTRY = {
  tickets: lazy(() => import("../../pages/TicketResponsiveContainer")),
  vendas: lazy(() => import("../../pages/Vendas")),
  financeiro: lazy(() => import("../../pages/Financeiro")),
  rh: lazy(() => import("../../pages/RH")),
};

// Cada aba extra roda dentro do seu próprio `MemoryRouter` — isolado da
// URL de verdade do navegador (a do "sistema mãe"). Isso faz 2 coisas:
// 1) a aba abre já na rota certa (ex.: `/financeiro?tab=products`),
//    sem depender da URL atual da tela principal;
// 2) navegação interna da própria tela (ex.: trocar de sub-aba dentro do
//    Financeiro) não mexe na URL real nem afeta as outras abas abertas.
const WorkspaceTabPane = ({ to, Component }) => (
  <MemoryRouter initialEntries={[to]}>
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  </MemoryRouter>
);

// Mantém TODAS as abas abertas montadas (só esconde com `display: none`
// as que não estão ativas) — é isso que preserva formulário preenchido
// e posição de rolagem ao trocar de aba, pedido explícito do cliente.
const WorkspaceViewport = () => {
  const { tabs, activeTabId } = useWorkspace();

  return (
    <>
      {tabs.map((tab) => {
        const Component = MODULE_REGISTRY[tab.moduleKey];
        if (!Component) return null;
        return (
          <div
            key={tab.id}
            style={{ display: tab.id === activeTabId ? "block" : "none", height: "100%" }}
          >
            <WorkspaceTabPane to={tab.to} Component={Component} />
          </div>
        );
      })}
    </>
  );
};

export default WorkspaceViewport;
