import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import axios from "axios";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import { debugLogFrontend } from "../../utils/runtimeDebug";
import { dispatchBrandingRefresh } from "../../utils/brandingEvents";
// import { useDate } from "../../hooks/useDate";
import moment from "moment";

// Helper functions for safe localStorage access (Safari private mode protection)
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem failed:", e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("localStorage.setItem failed:", e);
      return false;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn("localStorage.removeItem failed:", e);
      return false;
    }
  },
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.warn("localStorage.clear failed:", e);
      return false;
    }
  }
};

const SUBSCRIPTION_EXPIRED_FLAG_KEY = "subscriptionExpiredOnLogin";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const logoutInProgressRef = useRef(false);
  const pendingRequestsRef = useRef(new Set());
  const noopSocket = useRef({
    connected: false,
    on: () => { },
    off: () => { },
    emit: () => { },
    connect: () => { },
    disconnect: () => { },
  });

  const clearAuthState = () => {
    safeLocalStorage.removeItem("token");
    safeLocalStorage.removeItem("cshow");
    api.defaults.headers.Authorization = undefined;
    setIsAuth(false);
    setUser({});
  };

  const finalizeLogout = async () => {
    // Não bloqueia navegação para login por eventuais atrasos de Service Worker/Push.
    unregisterPushSubscription().catch(() => {});
    logoutInProgressRef.current = false;
    setIsAuth(false);
    setUser({});
    socketRef.current = null;
    setSocket(null);
    safeLocalStorage.removeItem("token");
    safeLocalStorage.removeItem("cshow");
    api.defaults.headers.Authorization = undefined;
    setLoading(false);
    history.push("/login");
  };

  const cancelPendingRequests = () => {
    pendingRequestsRef.current.forEach((controller) => {
      try {
        controller.abort("logout");
      } catch (_) {}
    });
    pendingRequestsRef.current.clear();
  };

  const getCurrentPushEndpoint = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 300))
      ]);
      if (!registration) return null;
      const subscription = await registration.pushManager.getSubscription();
      return subscription?.endpoint || null;
    } catch (_) {
      return null;
    }
  };

  const unregisterPushSubscription = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe().catch(() => {});
      }
    } catch (_) {}
  };

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        const requestUrl = String(config?.url || "");
        const isLogoutRequest = requestUrl.includes("/auth/logout");
        if (logoutInProgressRef.current && !isLogoutRequest) {
          return Promise.reject(new axios.Cancel("Logout in progress"));
        }

        if (!isLogoutRequest) {
          const controller = new AbortController();
          config.signal = controller.signal;
          config.__abortController = controller;
          pendingRequestsRef.current.add(controller);
        }

        const token = safeLocalStorage.getItem("token");
        if (token) {
          try {
            const parsedToken = JSON.parse(token);
            config.headers["Authorization"] = `Bearer ${parsedToken}`;
            setIsAuth(true);
          } catch (err) {
            safeLocalStorage.removeItem("token");
            setIsAuth(false);
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = api.interceptors.response.use(
      (response) => {
        const controller = response?.config?.__abortController;
        if (controller) {
          pendingRequestsRef.current.delete(controller);
        }
        return response;
      },
      async (error) => {
        const controller = error?.config?.__abortController;
        if (controller) {
          pendingRequestsRef.current.delete(controller);
        }

        if (
          logoutInProgressRef.current &&
          (error?.code === "ERR_CANCELED" || error?.name === "CanceledError")
        ) {
          return Promise.reject(error);
        }

        const originalRequest = error.config;
        const status = error?.response?.status;
        const requestUrl = String(originalRequest?.url || "");
        const isRefreshRequest = requestUrl.includes("/auth/refresh_token");

        if (
          (status === 401 || status === 403) &&
          !isRefreshRequest &&
          !originalRequest?._retry &&
          !logoutInProgressRef.current
        ) {
          try {
            originalRequest._retry = true;

            const { data } = await api.post("/auth/refresh_token");
            if (data?.token) {
              safeLocalStorage.setItem("token", JSON.stringify(data.token));
              api.defaults.headers.Authorization = `Bearer ${data.token}`;
            }
            if (data?.user) {
              setUser(data.user);
            }
            return api(originalRequest);
          } catch (_) {
            clearAuthState();
            return Promise.reject(error);
          }
        }

        if (status === 401 && !logoutInProgressRef.current) {
          clearAuthState();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          let parsedToken;
          try {
            parsedToken = JSON.parse(token);
          } catch (e) {
            safeLocalStorage.removeItem("token");
            setLoading(false);
            return;
          }
          const { data } = await api.post("/auth/refresh_token", {}, {
            headers: { Authorization: `Bearer ${parsedToken}` }
          });
          if (data?.token) {
            safeLocalStorage.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.Authorization = `Bearer ${data.token}`;
          }
          setIsAuth(true);
          setUser(data?.user || {});
        } catch (err) {
          clearAuthState();
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (Object.keys(user).length && user.id > 0) {
      let io = socketRef.current;

      if (!io) {
        io = socketConnection({ user });
        socketRef.current = io;
        setSocket(io);
      }

      if (!io || typeof io.on !== "function") {
        return;
      }

      io.on(`company-${user.companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser(data.user);
        }
      });

      return () => {
        io.off(`company-${user.companyId}-user`);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [user]);

  const handleLogin = async (userData) => {
    setLoading(true);
    debugLogFrontend("auth.login.start", {
      stage: "auth",
      message: `email=${userData?.email || ""}`,
    });

    try {
      const { data } = await api.post("/auth/login", userData);
      debugLogFrontend("auth.login.api.success", {
        stage: "auth",
        message: `userId=${data?.user?.id || ""}`,
      });
      const {
        user: { company },
      } = data;

      if (has(company, "companieSettings") && isArray(company.companieSettings[0])) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          safeLocalStorage.setItem("cshow", "null"); //regra pra exibir campanhas
        }
      }

      if (has(company, "companieSettings") && isArray(company.companieSettings[0])) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "sendSignMessage"
        );

        const signEnable = setting.value === "enable";

        if (setting && setting.value === "enabled") {
          safeLocalStorage.setItem("sendSignMessage", signEnable); //regra pra exibir campanhas
        }
      }
      safeLocalStorage.setItem("profileImage", data.user.profileImage); //regra pra exibir imagem contato

      moment.locale('pt-br');
      let dueDate;
      if (data.user.company.id === 1) {
        dueDate = '2999-12-31T00:00:00.000Z'
      } else {
        dueDate = data.user.company.dueDate;
      }
      const hoje = moment().format("DD/MM/YYYY");
      const vencimento = moment(dueDate).format("DD/MM/YYYY");

      var diff = moment(dueDate).diff(moment(moment()).format());

      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      if (before === true) {
        safeLocalStorage.removeItem(SUBSCRIPTION_EXPIRED_FLAG_KEY);
        safeLocalStorage.setItem("token", JSON.stringify(data.token));
        safeLocalStorage.setItem("companyDueDate", vencimento);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        dispatchBrandingRefresh();
        setUser(data.user);
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        if (Math.round(dias) < 5) {
          toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
        }

        history.push("/tickets");
        debugLogFrontend("auth.login.redirect.tickets", {
          stage: "auth",
          message: "history.push(/tickets) executed",
        });
        setLoading(false);
      } else {
        safeLocalStorage.setItem("token", JSON.stringify(data.token));
        safeLocalStorage.setItem(
          SUBSCRIPTION_EXPIRED_FLAG_KEY,
          JSON.stringify({
            dueDate,
            flaggedAt: new Date().toISOString(),
          })
        );
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        dispatchBrandingRefresh();
        setUser(data.user);
        setIsAuth(true);
        history.push("/financeiro");
        debugLogFrontend("auth.login.redirect.financeiro", {
          stage: "auth",
          message: "subscription expired redirect",
        });
        setLoading(false);
      }

    } catch (err) {
      debugLogFrontend("auth.login.error", {
        stage: "auth",
        message: err?.message || "unknown error",
      });
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    logoutInProgressRef.current = true;
    cancelPendingRequests();
    const tokenBeforeLogout = safeLocalStorage.getItem("token");

    if (socketRef.current && typeof socketRef.current.disconnect === "function") {
      socketRef.current.disconnect();
    }

    // Logout otimista: não bloqueia o redirect por chamadas de rede.
    await finalizeLogout();

    Promise.resolve()
      .then(async () => {
        const endpoint = await Promise.race([
          getCurrentPushEndpoint().catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 300))
        ]);
        let authHeader;
        try {
          const parsedToken = tokenBeforeLogout ? JSON.parse(tokenBeforeLogout) : null;
          if (parsedToken) {
            authHeader = `Bearer ${parsedToken}`;
          }
        } catch (_) {}
        await api.delete("/auth/logout", {
          data: endpoint ? { endpoint } : {},
          headers: authHeader ? { Authorization: authHeader } : undefined
        });
      })
      .catch(() => {});
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      console.log(data)
      return data;
    } catch (_) {
      return null;
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
    socket: socket || noopSocket.current
  };
};

export default useAuth;
