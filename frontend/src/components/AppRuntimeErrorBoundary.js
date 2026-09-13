import React from "react";
import { debugGetStoredLogs, debugLogFrontend } from "../utils/runtimeDebug";

class AppRuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro inesperado",
    };
  }

  componentDidCatch(error, errorInfo) {
    debugLogFrontend("react.error.boundary", {
      stage: "react",
      message: `${error?.message || "unknown"} | stack: ${errorInfo?.componentStack || ""}`,
    });
  }

  handleCopyLogs = async () => {
    const logs = debugGetStoredLogs();
    const text = JSON.stringify(logs, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {}
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Erro de renderização detectado</h2>
          <p style={{ marginBottom: 8 }}>
            O sistema registrou detalhes de diagnóstico automaticamente.
          </p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            Detalhe: {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleCopyLogs}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              cursor: "pointer",
              background: "#ffffff",
            }}
          >
            Copiar logs de diagnóstico
          </button>
        </div>
      </div>
    );
  }
}

export default AppRuntimeErrorBoundary;

