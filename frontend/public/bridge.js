;(function () {
  "use strict";

  var STORE_URL = "https://chromewebstore.google.com/detail/multi-api-connector/hjnkheajbddiibcmmaljoihnmadlhngo";
  var extensionPresent = false;
  var searchParams = new URLSearchParams(location.search);

  function $(id) {
    return document.getElementById(id);
  }

  function decodeBridgePayload(b64url) {
    var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }

  var url = null;
  var token = null;

  function hydrateFromHash() {
    var rawHash = location.hash.replace(/^#/, "");
    var params = new URLSearchParams(rawHash);
    var payload = params.get("p");

    if (!payload) {
      return false;
    }

    try {
      var decoded = decodeBridgePayload(payload);
      url = decoded.url;
      token = decoded.token;
      return Boolean(url && token);
    } catch (e) {
      url = null;
      token = null;
      return false;
    }
  }

  var hasPayload = hydrateFromHash();

  if (location.hash.replace(/^#/, "")) {
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {}
  }

  function setStatus(text, hideSpinner) {
    $("status").textContent = text;
    $("spinner").style.display = hideSpinner ? "none" : "block";
  }

  var errorEl = null;
  function showError(text) {
    setStatus(text, true);
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "error";
      document.querySelector(".box").appendChild(errorEl);
    }
    errorEl.textContent = text;
  }

  function clearError() {
    if (errorEl) {
      errorEl.remove();
      errorEl = null;
    }
  }

  function showInstallFlow() {
    $("normalFlow").style.display = "none";
    $("installFlow").style.display = "block";
    clearError();
  }

  function showNormalFlow() {
    $("normalFlow").style.display = "block";
    $("installFlow").style.display = "none";
  }

  function req(type, extra, timeoutMs) {
    return new Promise(function (resolve) {
      function onMsg(ev) {
        if (ev.source !== window || ev.origin !== window.location.origin) return;
        var data = ev.data;
        if (!data || data.type !== type + "_RESULT") return;
        window.removeEventListener("message", onMsg);
        clearTimeout(timer);
        resolve(data);
      }

      var timer = setTimeout(function () {
        window.removeEventListener("message", onMsg);
        resolve({ ok: false, error: "timeout" });
      }, timeoutMs || 4000);

      window.addEventListener("message", onMsg);
      window.postMessage(Object.assign({ __waBridgeReq: true, type: type }, extra || {}), window.location.origin);
    });
  }

  function onStatus(data) {
    if (data.step === "logged_in") {
      clearError();
      setStatus("Login detectado. Quando o WhatsApp terminar de carregar, clique abaixo.", true);
      $("openBtn").style.display = "none";
      $("confirmBtn").textContent = "Extrair agora";
      $("confirmBtn").disabled = false;
      $("confirmBtn").style.display = "block";
      return;
    }

    if (data.step === "extracting") {
      $("confirmBtn").style.display = "none";
      setStatus("Extraindo sessao...", false);
      return;
    }

    if (data.step === "sending") {
      setStatus("Enviando ao sistema...", false);
      return;
    }

    if (data.step === "done") {
      clearError();
      setStatus("Conectado. Pode fechar esta aba.", true);
      setTimeout(function () {
        try {
          window.close();
        } catch (e) {}
      }, 1500);
      return;
    }

    if (data.step === "error") {
      showError("Erro: " + (data.error || "unknown"));
      if (data.canRetry) {
        $("confirmBtn").textContent = "Tentar novamente";
        $("confirmBtn").disabled = false;
        $("confirmBtn").style.display = "block";
      }
    }
  }

  async function onExtensionDetected() {
    showNormalFlow();
    setStatus("Extensão detectada. Preparando...", false);

    var armRes = await req("ARM", { url: url, token: token });
    if (!armRes.ok) {
      showError("Falha ao preparar a extensão. Recarregue a página e tente novamente.");
      return;
    }

    setStatus("Abrindo WhatsApp Web...", false);
    var openRes = await req("OPEN_WA");
    if (!openRes.ok) {
      showError("Não foi possível abrir o WhatsApp Web.");
      setStatus("Clique para abrir o WhatsApp Web manualmente.", true);
      $("openBtn").style.display = "block";
    }
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    var data = ev.data;
    if (!data) return;

    if (data.type === "EXTENSION_PRESENT" && !extensionPresent) {
      extensionPresent = true;
      onExtensionDetected();
    }

    if (data.type === "STATUS") {
      onStatus(data);
    }
  });

  $("installBtn").addEventListener("click", function () {
    window.open(STORE_URL, "_blank", "noopener,noreferrer");
  });

  $("reloadBtn").addEventListener("click", function () {
    window.location.reload();
  });

  $("openBtn").addEventListener("click", async function () {
    $("openBtn").disabled = true;
    setStatus("Abrindo WhatsApp Web...", false);
    var res = await req("OPEN_WA");
    if (!res.ok) {
      showError("Não foi possível abrir o WhatsApp Web.");
      $("openBtn").disabled = false;
    }
  });

  $("confirmBtn").addEventListener("click", async function () {
    $("confirmBtn").disabled = true;
    clearError();
    setStatus("Extraindo sessão...", false);
    // FORCE_EXTRACT so responde depois que o backend termina de iniciar a
    // sessao do WhatsApp (StartWhatsAppSession), o que pode levar bem mais
    // que os 4s padrao usados pelo ARM/OPEN_WA — por isso um timeout maior aqui.
    var res = await req("FORCE_EXTRACT", null, 60000);
    if (!res.ok) {
      showError(res.error || "Não foi possível extrair a sessão.");
      $("confirmBtn").disabled = false;
    }
  });

  function startDetection() {
    setStatus("Detectando extensão...", false);
    setTimeout(function () {
      if (!extensionPresent) {
        showInstallFlow();
        setStatus("Extensão não detectada.", true);
      }
    }, 2500);
  }

  if (hasPayload && url && token) {
    startDetection();
    return;
  }

  if (searchParams.get("init") === "1") {
    setStatus("Preparando conexão...", false);
  } else {
    setStatus("Preparando conexão...", false);
  }

  var attempts = 0;
  var waitForPayloadTimer = setInterval(function () {
    attempts += 1;
    if (hydrateFromHash() && url && token) {
      clearInterval(waitForPayloadTimer);
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {}
      startDetection();
      return;
    }

    if (attempts >= 50) {
      clearInterval(waitForPayloadTimer);
      showError("Link inválido ou expirado. Gere um novo link pelo sistema.");
    }
  }, 300);
})();
