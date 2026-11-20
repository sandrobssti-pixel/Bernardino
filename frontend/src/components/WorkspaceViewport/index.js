import React, { lazy, Suspense } from "react";
import { MemoryRouter } from "react-router-dom";

import { useWorkspace } from "../../context/Workspace";

// Registro dos módulos que podem ser abertos como aba extra (v2.3.324,
// estendido na v2.3.325 pra cobrir todo o menu lateral — pedido do
// cliente: "pode extender para todos os serviços, modulos, cadastros,
// relatorios todos"). Cada `moduleKey` aqui tem que bater com a prop
// `moduleKey` passada no `<ListItemLink>` correspondente em
// `MainListItems.js`. Adicionar outro módulo novo (que não existia
// ainda no menu) é só mais uma linha aqui + a prop no menu.
//
// Ficaram DE FORA de propósito (não ganharam o botão "abrir em nova
// aba" no menu): o item "Grupos" (mesma rota `/tickets` de
// Atendimentos, mas que depende de um `setTabOpen("group")` fora da
// URL — não dá pra isolar por `MemoryRouter` igual o resto, ver seção
// 28 da skill atendeflow-dev) e telas que não são itens de menu de
// verdade (ex.: importar contatos, relatório de campanha específica —
// acessadas por um botão de dentro de outra tela, não pelo menu
// lateral).
const MODULE_REGISTRY = {
  dashboard: lazy(() => import("../../pages/Dashboard")),
  tickets: lazy(() => import("../../pages/TicketResponsiveContainer")),
  "quick-messages": lazy(() => import("../../pages/QuickMessages")),
  todolist: lazy(() => import("../../pages/ToDoList")),
  kanban: lazy(() => import("../../pages/Kanban")),
  contacts: lazy(() => import("../../pages/Contacts")),
  schedules: lazy(() => import("../../pages/Schedules")),
  tags: lazy(() => import("../../pages/Tags")),
  chats: lazy(() => import("../../pages/Chat")),
  helps: lazy(() => import("../../pages/Helps")),
  campaigns: lazy(() => import("../../pages/Campaigns")),
  "contact-lists": lazy(() => import("../../pages/ContactLists")),
  "campaigns-config": lazy(() => import("../../pages/CampaignsConfig")),
  flowbuilders: lazy(() => import("../../pages/FlowBuilderHub")),
  announcements: lazy(() => import("../../pages/Annoucements")),
  "payroll-tables": lazy(() => import("../../pages/PayrollTables")),
  "messages-api": lazy(() => import("../../pages/MessagesAPI")),
  users: lazy(() => import("../../pages/Users")),
  "birthday-settings": lazy(() => import("../../pages/BirthdaySettings")),
  queues: lazy(() => import("../../pages/Queues")),
  prompts: lazy(() => import("../../pages/Prompts")),
  "queue-integration": lazy(() => import("../../pages/QueueIntegration")),
  connections: lazy(() => import("../../pages/Connections")),
  "all-connections": lazy(() => import("../../pages/AllConnections")),
  files: lazy(() => import("../../pages/Files")),
  moments: lazy(() => import("../../pages/Moments")),
  reports: lazy(() => import("../../pages/Reports")),
  settings: lazy(() => import("../../pages/SettingsCustom")),
  vendas: lazy(() => import("../../pages/Vendas")),
  financeiro: lazy(() => import("../../pages/Financeiro")),
  rh: lazy(() => import("../../pages/RH")),
  "weapon-dispatch": lazy(() => import("../../pages/WeaponDispatch")),
  services: lazy(() => import("../../pages/Services")),
  "weapon-armory": lazy(() => import("../../pages/WeaponArmory")),
  members: lazy(() => import("../../pages/Members")),
  "member-checkin": lazy(() => import("../../pages/MemberCheckIn")),
  "attendance-schedule": lazy(() => import("../../pages/AttendanceSchedule")),
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
