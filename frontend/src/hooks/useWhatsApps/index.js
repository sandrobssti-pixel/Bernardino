import { useState, useEffect, useReducer, useContext, useCallback } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_WHATSAPPS") {
    const whatsApps = action.payload;

    return [...whatsApps];
  }

  if (action.type === "UPDATE_WHATSAPPS") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = whatsApp;
      return [...state];
    } else {
      return [whatsApp, ...state];
    }
  }

  if (action.type === "UPDATE_SESSION") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex].status = whatsApp.status;
      state[whatsAppIndex].updatedAt = whatsApp.updatedAt;
      state[whatsAppIndex].qrcode = whatsApp.qrcode;
      state[whatsAppIndex].retries = whatsApp.retries;
      state[whatsAppIndex].number = whatsApp.number;
      return [...state];
    } else {
      return [...state];
    }
  }

  if (action.type === "DELETE_WHATSAPPS") {
    const whatsAppId = action.payload;

    const whatsAppIndex = state.findIndex((s) => s.id === whatsAppId);
    if (whatsAppIndex !== -1) {
      state.splice(whatsAppIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);
//   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const fetchSession = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/whatsapp/?session=0");
      dispatch({ type: "LOAD_WHATSAPPS", payload: data });
    } catch (err) {
      toastError(err);
      dispatch({ type: "RESET" });
    } finally {
      setLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (user.companyId) {

      const companyId = user.companyId;
//    const socket = socketManager.GetSocket();

      const onCompanyWhatsapp = (data) => {
        if (data.action === "update") {
          dispatch({ type: "UPDATE_WHATSAPPS", payload: data.whatsapp });
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
        }
      }

      const onCompanyWhatsappSession = (data) => {
        if (data.action === "update") {
          dispatch({ type: "UPDATE_SESSION", payload: data.session });
        }
      }

      const onConnectWhatsApps = () => {
        fetchSession();
      };

      socket.on("connect", onConnectWhatsApps);
      socket.on(`company-${companyId}-whatsapp`, onCompanyWhatsapp);
      socket.on(`company-${companyId}-whatsappSession`, onCompanyWhatsappSession);

      return () => {
        socket.off("connect", onConnectWhatsApps);
        socket.off(`company-${companyId}-whatsapp`, onCompanyWhatsapp);
        socket.off(`company-${companyId}-whatsappSession`, onCompanyWhatsappSession);
      };
    }
  }, [socket, user.companyId, fetchSession]);

  return { whatsApps, loading };
};

export default useWhatsApps;
