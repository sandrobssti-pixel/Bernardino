import io from "socket.io-client";

class SocketWorker {
  constructor(companyId , userId) {
    if (!SocketWorker.instance) {
      this.companyId = companyId
      this.userId = userId
      this.socket = null;
      this.manualDisconnect = false;
      this.lastWakeReconnectAt = 0;
      this.lifecycleHooksInitialized = false;
      this.configureSocket();
      this.setupLifecycleHooks();
      this.eventListeners = {}; // Armazena os ouvintes de eventos registrados
      SocketWorker.instance = this;

    } 

    return SocketWorker.instance;
  }

  configureSocket() {
    this.manualDisconnect = false;
    let token = "";
    try {
      token = JSON.parse(localStorage.getItem("token") || "\"\"");
    } catch (error) {
      token = "";
    }
    if (!token || !this.companyId) {
      this.socket = null;
      return;
    }

    this.socket = io(`${process.env.REACT_APP_BACKEND_URL}/${this?.companyId}` , {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      query: { token }
    });

    this.socket.on("connect", () => {
      console.log("Conectado ao servidor Socket.IO", this.socket.nsp);
    });

    this.socket.on("disconnect", () => {
      console.log("Desconectado do servidor Socket.IO");
      if (!this.manualDisconnect) {
        this.reconnectAfterDelay();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Erro ao conectar Socket.IO:", error?.message || error);
    });
  }

  // Adiciona um ouvinte de eventos
  on(event, callback) {
    this.connect();
    if (!this.socket) return;
    this.socket.on(event, callback);

    // Armazena o ouvinte no objeto de ouvintes
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  // Emite um evento
  emit(event, data) {
    this.connect();
    if (!this.socket) return;
    this.socket.emit(event, data);
  }

  // Desconecta um ou mais ouvintes de eventos
  off(event, callback) {
    if (!this.socket) return;
    if (this.eventListeners[event]) {
      // console.log("Desconectando do servidor Socket.IO:", event, callback);
      if (callback) {
        // Desconecta um ouvinte específico
        this.socket.off(event, callback);
        this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
      } else {
        // console.log("DELETOU EVENTOS DO SOCKET:", this.eventListeners[event]);

        // Desconecta todos os ouvintes do evento
        this.eventListeners[event].forEach(cb => this.socket.off(event, cb));
        delete this.eventListeners[event];
      }
      // console.log("EVENTOS DO SOCKET:", this.eventListeners);
    }
  }

  disconnect() {
    if (this.socket) {
      this.manualDisconnect = true;
      this.socket.disconnect();
      this.socket = null
      SocketWorker.instance = null
      this.eventListeners = {};
      console.log("Socket desconectado manualmente");
    }

    if (this.lifecycleHooksInitialized && typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      window.removeEventListener("focus", this.onWindowFocus);
      window.removeEventListener("pageshow", this.onPageShow);
      this.lifecycleHooksInitialized = false;
    }
  }

  reconnectAfterDelay() {
    setTimeout(() => {
      if (this.manualDisconnect) return;
      if (!this.socket || !this.socket.connected) {
        console.log("Tentando reconectar após desconexão");
        this.connect();
      }
    }, 1000);
  }

  reconnectOnWake(reason = "wake") {
    const now = Date.now();
    if (now - this.lastWakeReconnectAt < 2000) return;
    this.lastWakeReconnectAt = now;

    if (!this.socket) {
      this.configureSocket();
      return;
    }

    try {
      // Evita derrubar conexão saudável ao retomar app.
      if (this.socket.connected) return;

      // Se já está tentando reconectar, não duplicar tentativas.
      if (this.socket.active) return;

      this.socket.connect();
      console.log(`Reconexão do socket ao retomar app (${reason})`);
    } catch (error) {
      console.warn("Falha ao reconectar socket ao retomar app:", error);
      this.connect();
    }
  }

  setupLifecycleHooks() {
    if (this.lifecycleHooksInitialized || typeof window === "undefined") return;
    this.lifecycleHooksInitialized = true;

    this.onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        this.reconnectOnWake("visibility");
      }
    };

    this.onWindowFocus = () => this.reconnectOnWake("focus");
    this.onPageShow = () => this.reconnectOnWake("pageshow");

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("focus", this.onWindowFocus);
    window.addEventListener("pageshow", this.onPageShow);
  }

  // Garante que o socket esteja conectado
  connect() {
    if (this.manualDisconnect) return;
    let token = "";
    try {
      token = JSON.parse(localStorage.getItem("token") || "\"\"");
    } catch (_) {
      token = "";
    }
    if (!token || !this.companyId) return;

    if (!this.socket) {
      this.configureSocket();
      return;
    }

    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  forceReconnect() {

  }
}

// const instance = (companyId, userId) => new SocketWorker(companyId,userId);
const instance = (companyId, userId) => new SocketWorker(companyId, userId);

export default instance;
