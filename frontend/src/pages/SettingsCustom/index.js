import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import MainHeader from "../../components/MainHeader";
import { makeStyles, Paper, Tabs, Tab } from "@material-ui/core";

import TabPanel from "../../components/TabPanel";

import CompaniesManager from "../../components/CompaniesManager";
import PlansManager from "../../components/PlansManager";
import HelpsManager from "../../components/HelpsManager";
import Options from "../../components/Settings/Options";
import SubscriptionPanel from "../../components/Settings/SubscriptionPanel";

import { i18n } from "../../translate/i18n.js";
import { toast } from "react-toastify";

import useCompanies from "../../hooks/useCompanies";
import { AuthContext } from "../../context/Auth/AuthContext";

import OnlyForSuperUser from "../../components/OnlyForSuperUser";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import useSettings from "../../hooks/useSettings";
import ForbiddenPage from "../../components/ForbiddenPage/index.js";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    minHeight: "100%",
    overflow: "visible",
    display: "flex",
    flexDirection: "column",
    background:
      theme.mode === "light"
        ? "linear-gradient(180deg, #f6f9ff 0%, #eef3fb 100%)"
        : "linear-gradient(180deg, #0f1724 0%, #111b2f 100%)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  pageWrap: {
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },
  mainPaper: {
    ...theme.scrollbarStyles,
    overflow: "visible",
    display: "flex",
    flexDirection: "column",
    flex: "0 0 auto",
    minHeight: "auto",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.mode === "light" ? "0 16px 36px rgba(15, 23, 42, 0.08)" : "0 16px 36px rgba(0, 0, 0, 0.35)",
    padding: theme.spacing(2),
  },
  tabsShell: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.mode === "light" ? "#f8fbff" : "#122038",
    padding: theme.spacing(0.5),
    marginBottom: theme.spacing(2),
  },
  tabsRoot: {
    ...theme.scrollbarStyles,
    minHeight: 44,
    "& .MuiTabs-indicator": {
      display: "none",
    },
    "& .MuiTab-root": {
      minHeight: 40,
      borderRadius: 10,
      textTransform: "none",
      fontWeight: 600,
      fontSize: "0.8rem",
      color: theme.palette.text.secondary,
      transition: "all 0.2s ease",
      marginRight: theme.spacing(0.5),
    },
    "& .Mui-selected": {
      color: theme.palette.primary.main,
      backgroundColor: theme.mode === "light" ? "#ffffff" : "#1a2a47",
      boxShadow: theme.mode === "light" ? "0 4px 12px rgba(15, 23, 42, 0.08)" : "0 4px 12px rgba(0, 0, 0, 0.3)",
    },
  },
  panelPaper: {
    ...theme.scrollbarStyles,
    overflowY: "visible",
    flex: "0 0 auto",
    minHeight: "auto",
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#13213a",
    width: "100%",
  },
  container: {
    width: "100%",
    maxHeight: "100%",
  },
  control: {
    padding: theme.spacing(1),
  },
  textfield: {
    width: "100%",
  },
}));

const SettingsCustom = () => {
  const classes = useStyles();
  const location = useLocation();
  const initialTab = new URLSearchParams(location.search).get("tab") || "options";
  const [tab, setTab] = useState(initialTab);
  const [currentUser, setCurrentUser] = useState({});
  const [settings, setSettings] = useState({});
  const [oldSettings, setOldSettings] = useState({});

  const { find } = useCompanies();

  //novo hook
  const { getAll: getAllSettings } = useCompanySettings();
  const { getAll: getAllSettingsOld } = useSettings();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    async function findData() {
      try {
        const companyId = user.companyId;
        await find(companyId);

        const settingList = await getAllSettings(companyId);

        const settingListOld = await getAllSettingsOld();

        setSettings(settingList);
        setOldSettings(settingListOld);

        /*  if (Array.isArray(settingList)) {
           const scheduleType = settingList.find(
             (d) => d.key === "scheduleType"
           );
           if (scheduleType) {
             setSchedulesEnabled(scheduleType.value === "company");
           }
         } */
        setCurrentUser(user);
      } catch (e) {
        toast.error(e);
      }
    }
    findData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const isSuper = () => {
    return currentUser.super;
  };

  return (
    <div className={classes.pageRoot}>
      {user.profile === "user" ?
        <ForbiddenPage />
        :
        <div className={classes.pageWrap}>
          <MainHeader>
          </MainHeader>
          <Paper className={classes.mainPaper} elevation={0}>
            <Paper elevation={0} className={classes.tabsShell}>
              <Tabs
                value={tab}
                scrollButtons="on"
                variant="scrollable"
                onChange={handleTabChange}
                className={classes.tabsRoot}
              >
                <Tab label={i18n.t("settings.tabs.options")} value={"options"} />
                {!isSuper() ? <Tab label="Assinatura" value={"subscription"} /> : null}
                {isSuper() ? <Tab label="Empresas" value={"companies"} /> : null}
                {isSuper() ? <Tab label={i18n.t("settings.tabs.plans")} value={"plans"} /> : null}
                {isSuper() ? <Tab label={i18n.t("settings.tabs.helps")} value={"helps"} /> : null}
              </Tabs>
            </Paper>
            <Paper className={classes.panelPaper} elevation={0}>
              <OnlyForSuperUser
                user={currentUser}
                yes={() => (
                  <>
                    <TabPanel
                      className={classes.container}
                      value={tab}
                      name={"companies"}
                    >
                      <CompaniesManager />
                    </TabPanel>

                    <TabPanel
                      className={classes.container}
                      value={tab}
                      name={"plans"}
                    >
                      <PlansManager />
                    </TabPanel>

                    <TabPanel
                      className={classes.container}
                      value={tab}
                      name={"helps"}
                    >
                      <HelpsManager />
                    </TabPanel>
                  </>
                )}
              />
              <TabPanel className={classes.container} value={tab} name={"options"}>
                <Options
                  settings={settings}
                  oldSettings={oldSettings}
                  user={currentUser}
                />
              </TabPanel>
              {!isSuper() && (
                <TabPanel className={classes.container} value={tab} name={"subscription"}>
                  <SubscriptionPanel />
                </TabPanel>
              )}
            </Paper>
          </Paper>
        </div>}
    </div>
  );
};

export default SettingsCustom;
