import React, { useContext, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Redirect, Switch, Route as DomRoute } from "react-router-dom";
import { Slide, ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
const Dashboard = lazy(() => import("../pages/Dashboard"));
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Signup from "../pages/Signup";
import Login from "../pages/Login";
import Connections from "../pages/Connections";
import SettingsCustom from "../pages/SettingsCustom";
import Financeiro from "../pages/Financeiro";
import SupervisorPanel from "../pages/SupervisorPanel";
import RH from "../pages/RH";
import PublicJobBoard from "../pages/PublicJobBoard";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts";
import ContactImportPage from "../pages/Contacts/import";
import ChatMoments from "../pages/Moments";
import Queues from "../pages/Queues";
import Tags from "../pages/Tags";
import MessagesAPI from "../pages/MessagesAPI";
import Helps from "../pages/Helps";
import ContactLists from "../pages/ContactLists";
import ContactListItems from "../pages/ContactListItems";
import Companies from "../pages/Companies";
import QuickMessages from "../pages/QuickMessages";
import { AuthProvider } from "../context/Auth/AuthContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import Schedules from "../pages/Schedules";
import Campaigns from "../pages/Campaigns";
import CampaignsConfig from "../pages/CampaignsConfig";
import CampaignReport from "../pages/CampaignReport";
import Annoucements from "../pages/Annoucements";
import Chat from "../pages/Chat";
import Prompts from "../pages/Prompts";
import AllConnections from "../pages/AllConnections";
import Reports from "../pages/Reports";
import { FlowBuilderConfig } from "../pages/FlowBuilderConfig";
// import Integrations from '../pages/Integrations';
// import GoogleCalendarComponent from '../pages/Integrations/components/GoogleCalendarComponent';
import FlowBuilderHub from "../pages/FlowBuilderHub";
import QueueIntegration from "../pages/QueueIntegration";
import Files from "../pages/Files";
import ToDoList from "../pages/ToDoList";
import Kanban from "../pages/Kanban";
import TagsKanban from "../pages/TagsKanban";
import ForgotPassword from "../pages/ForgetPassWord";
import ResetPassword from "../pages/ResetPassword";

// 🔹 NOVO: página de Configurações Globais (Mercado Pago + SMTP)
import GlobalConfig from "../pages/GlobalConfig";
import ServerMetrics from "../pages/ServerMetrics";
import BirthdaySettings from "../pages/BirthdaySettings";
import AttendanceSchedule from "../pages/AttendanceSchedule";

const SplashGate = () => {
  const { loading } = useContext(AuthContext);

  useEffect(() => {
    if (loading) return;
    try {
      if (typeof window.finishProgress === "function") {
        window.finishProgress();
      }
    } catch (_) {}
  }, [loading]);

  return null;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SplashGate />
        <TicketsContextProvider>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route exact path="/forgot-password" component={ForgotPassword} />
            <Route exact path="/reset-password" component={ResetPassword} />
            {/* Página pública de vagas (Fase 5 — RH) — sem login, não usa o
                wrapper de Route (que redireciona usuários autenticados),
                pra permitir que um Admin logado também consiga visualizar
                a própria página pública. */}
            <DomRoute exact path="/vagas/:companyId/:jobId?" component={PublicJobBoard} />
            <WhatsAppsProvider>
              <LoggedInLayout>
                <Route exact path="/financeiro" component={Financeiro} isPrivate />
                <Route exact path="/rh" component={RH} isPrivate />
                <Route exact path="/painel-vigia" component={SupervisorPanel} isPrivate />

                <Route exact path="/companies" component={Companies} isPrivate />
                <Route exact path="/" isPrivate render={(props) => (
                  <Suspense fallback={null}>
                    <Dashboard {...props} />
                  </Suspense>
                )} />
                <Route
                  exact
                  path="/tickets/:ticketId?"
                  component={TicketResponsiveContainer}
                  isPrivate
                />
                <Route
                  exact
                  path="/connections"
                  component={Connections}
                  isPrivate
                />
                <Route
                  exact
                  path="/quick-messages"
                  component={QuickMessages}
                  isPrivate
                />
                <Route exact path="/todolist" component={ToDoList} isPrivate />
                <Route exact path="/schedules" component={Schedules} isPrivate />
                <Route exact path="/tags" component={Tags} isPrivate />
                <Route exact path="/contacts" component={Contacts} isPrivate />
                <Route
                  exact
                  path="/contacts/import"
                  component={ContactImportPage}
                  isPrivate
                />
                <Route exact path="/helps" component={Helps} isPrivate />
                <Route exact path="/users" component={Users} isPrivate />
                <Route
                  exact
                  path="/messages-api"
                  component={MessagesAPI}
                  isPrivate
                />
                <Route
                  exact
                  path="/settings"
                  component={SettingsCustom}
                  isPrivate
                />

                {/* 🔹 NOVO: rota para Configurações Globais da plataforma */}
                <Route
                  exact
                  path="/global-config"
                  component={GlobalConfig}
                  isPrivate
                />
                <Route
                  exact
                  path="/server-metrics"
                  component={ServerMetrics}
                  isPrivate
                />
                <Route
                  exact
                  path="/birthday-settings"
                  component={BirthdaySettings}
                  isPrivate
                />
                <Route
                  exact
                  path="/attendance-schedule"
                  component={AttendanceSchedule}
                  isPrivate
                />

                <Route exact path="/queues" component={Queues} isPrivate />
                <Route exact path="/reports" component={Reports} isPrivate />
                <Route
                  exact
                  path="/queue-integration"
                  component={QueueIntegration}
                  isPrivate
                />
                <Route
                  exact
                  path="/announcements"
                  component={Annoucements}
                  isPrivate
                />
                <Route
                  exact
                  path="/phrase-lists"
                  component={() => <Redirect to="/flowbuilders/campaign" />}
                  isPrivate
                />
                <Route
                  exact
                  path="/flowbuilders/:tab?"
                  component={FlowBuilderHub}
                  isPrivate
                />
                <Route
                  exact
                  path="/flowbuilder/:id?"
                  component={FlowBuilderConfig}
                  isPrivate
                />
                <Route exact path="/chats/:id?" component={Chat} isPrivate />
                <Route exact path="/files" component={Files} isPrivate />
                <Route exact path="/moments" component={ChatMoments} isPrivate />
                <Route exact path="/Kanban" component={Kanban} isPrivate />
                <Route exact path="/TagsKanban" component={TagsKanban} isPrivate />
                <Route exact path="/prompts" component={Prompts} isPrivate />
                <Route
                  exact
                  path="/allConnections"
                  component={AllConnections}
                  isPrivate
                />
                <Route
                  exact
                  path="/contact-lists"
                  component={ContactLists}
                  isPrivate
                />
                <Route
                  exact
                  path="/contact-lists/:contactListId/contacts"
                  component={ContactListItems}
                  isPrivate
                />
                <Route
                  exact
                  path="/campaigns"
                  component={Campaigns}
                  isPrivate
                />
                <Route
                  exact
                  path="/campaign/:campaignId/report"
                  component={CampaignReport}
                  isPrivate
                />
                <Route
                  exact
                  path="/campaigns-config"
                  component={CampaignsConfig}
                  isPrivate
                />
              </LoggedInLayout>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer
            position="top-center"
            autoClose={3000}
            newestOnTop
            closeOnClick
            pauseOnHover
            draggable
            transition={Slide}
            toastClassName="saas-toast"
            bodyClassName="saas-toast-body"
            progressClassName="saas-toast-progress"
            style={{ zIndex: 999999, position: "fixed" }}
          />
        </TicketsContextProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;