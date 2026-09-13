(function () {
  "use strict";

  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
        currentScript = scripts[i];
        break;
      }
    }
  }

  if (!currentScript) return;

  var widgetId = currentScript.getAttribute("data-widget-id");
  if (!widgetId) {
    console.error("[webchat widget] data-widget-id não informado no script.");
    return;
  }

  var scriptUrl = new URL(currentScript.src);
  var apiBase = scriptUrl.origin + "/webchat/public/" + widgetId;

  var STORAGE_KEY = "zapchat_webchat_visitor_" + widgetId;
  var POLL_INTERVAL_MS = 3000;

  var state = {
    visitorId: null,
    ticketUuid: null,
    lastMessageId: 0,
    open: false,
    pollTimer: null,
    // ids já renderizados na tela — evita duplicar uma mensagem quando um
    // poll que já estava em andamento (iniciado com um "after" antigo)
    // responde depois do envio otimista da própria mensagem do visitante.
    renderedMessageIds: {}
  };

  function loadStoredSession() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function storeSession(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* localStorage indisponível (modo privado etc.) — segue sem persistir */
    }
  }

  function request(path, options) {
    return fetch(apiBase + path, options).then(function (response) {
      if (!response.ok) {
        return response.json().then(
          function (data) {
            throw new Error((data && data.error) || "Erro na requisição");
          },
          function () {
            throw new Error("Erro na requisição");
          }
        );
      }
      return response.json();
    });
  }

  function buildStyles(config) {
    var appearance = config.appearance || {};
    var primaryColor = appearance.primaryColor || "#2563eb";
    var position = config.position === "left" ? "left" : "right";

    var style = document.createElement("style");
    style.textContent =
      "#zc-webchat-root{position:fixed;bottom:20px;" + position + ":20px;z-index:2147483000;font-family:Inter,system-ui,Arial,sans-serif;}" +
      "#zc-webchat-button{width:60px;height:60px;border-radius:50%;background:" + primaryColor + ";box-shadow:0 6px 20px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;}" +
      "#zc-webchat-button svg{width:28px;height:28px;fill:#fff;}" +
      "#zc-webchat-window{position:fixed;bottom:90px;" + position + ":20px;width:340px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;}" +
      "#zc-webchat-window.zc-open{display:flex;}" +
      "#zc-webchat-header{background:" + primaryColor + ";color:#fff;padding:16px;display:flex;align-items:center;gap:10px;}" +
      "#zc-webchat-header img{width:36px;height:36px;border-radius:50%;object-fit:cover;background:#fff;}" +
      "#zc-webchat-header-texts{flex:1;min-width:0;}" +
      "#zc-webchat-header-title{font-weight:600;font-size:14px;}" +
      "#zc-webchat-header-subtitle{font-size:12px;opacity:.85;}" +
      "#zc-webchat-close{cursor:pointer;background:none;border:none;color:#fff;font-size:18px;line-height:1;}" +
      "#zc-webchat-messages{flex:1;overflow-y:auto;padding:12px;background:#f4f6f8;display:flex;flex-direction:column;gap:8px;}" +
      ".zc-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}" +
      ".zc-msg-in{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;}" +
      ".zc-msg-out{align-self:flex-end;background:" + primaryColor + ";color:#fff;}" +
      "#zc-webchat-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;}" +
      "#zc-webchat-input{flex:1;border:1px solid #e2e8f0;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;}" +
      "#zc-webchat-send{background:" + primaryColor + ";color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;flex-shrink:0;}" +
      "#zc-webchat-chatbody{flex:1;min-height:0;display:flex;flex-direction:column;}" +
      "#zc-webchat-precontact{flex:1;padding:20px 16px;display:flex;flex-direction:column;justify-content:center;gap:10px;}" +
      "#zc-webchat-precontact-title{font-size:14px;font-weight:600;color:#1f2937;margin-bottom:4px;}" +
      "#zc-webchat-precontact input{border:1px solid #e2e8f0;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;}" +
      "#zc-webchat-precontact button{background:" + primaryColor + ";color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;cursor:pointer;}" +
      "#zc-webchat-precontact button:disabled{opacity:.7;cursor:default;}" +
      "#zc-webchat-precontact-error{color:#dc2626;font-size:12px;display:none;}";
    document.head.appendChild(style);
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  function renderMessage(container, message) {
    var el = document.createElement("div");
    el.className = "zc-msg " + (message.fromMe ? "zc-msg-out" : "zc-msg-in");
    if (message.mediaUrl) {
      var link = document.createElement("a");
      link.href = message.mediaUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = message.body || "Arquivo enviado";
      el.appendChild(link);
    } else {
      el.innerHTML = escapeHtml(message.body);
    }
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function showTypingBubble(container) {
    var el = document.createElement("div");
    el.className = "zc-msg zc-msg-in";
    el.textContent = "digitando...";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Beep curto via WebAudio — evita depender de um arquivo de áudio externo.
  function playNotificationSound() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      var ctx = new AudioContextClass();
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
      oscillator.onended = function () { ctx.close(); };
    } catch (e) {
      /* navegador sem suporte a WebAudio — ignora silenciosamente */
    }
  }

  async function processIncomingMessage(container, message, config) {
    var behavior = config.behavior || {};
    if (message.fromMe && behavior.simulateTyping) {
      var typingEl = showTypingBubble(container);
      await wait(Math.max(0, Number(behavior.typingDuration || 0)) * 1000);
      typingEl.remove();
    }

    renderMessage(container, message);

    if (message.fromMe && behavior.notificationSound) {
      playNotificationSound();
    }
  }

  function startPolling(messagesContainer, config) {
    // Idempotente: cada envio de mensagem chama startPolling de novo (para
    // cobrir o caso de sessão ainda não iniciada). Se o polling já está
    // rodando, reiniciar o interval só gera uma busca imediata extra,
    // concorrente com o próprio envio — e essa corrida é a causa de
    // mensagens aparecendo duplicadas na tela.
    if (state.pollTimer) return;
    var processing = false;

    function poll() {
      if (!state.ticketUuid || processing) return;
      request(
        "/messages?visitorId=" +
          encodeURIComponent(state.visitorId) +
          "&ticketUuid=" +
          encodeURIComponent(state.ticketUuid) +
          "&after=" +
          state.lastMessageId,
        { method: "GET" }
      )
        .then(async function (data) {
          var messages = data.messages || [];
          if (!messages.length) return;
          processing = true;
          for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            if (message.id && state.renderedMessageIds[message.id]) {
              if (message.id > state.lastMessageId) {
                state.lastMessageId = message.id;
              }
              continue;
            }
            await processIncomingMessage(messagesContainer, message, config);
            if (message.id) state.renderedMessageIds[message.id] = true;
            if (message.id > state.lastMessageId) {
              state.lastMessageId = message.id;
            }
          }
          processing = false;
        })
        .catch(function () {
          /* falha de rede pontual não deve travar o widget — tenta de novo no próximo ciclo */
          processing = false;
        });
    }

    // Busca imediatamente ao iniciar (sem esperar o 1º tick do intervalo):
    // mensagens automáticas (ex.: fluxo de boas-vindas) já podem ter sido
    // criadas durante a abertura da sessão, antes do visitante digitar
    // qualquer coisa. Sem isso, se o visitante enviar uma mensagem antes do
    // 1º tick, o lastMessageId avança para além dessas mensagens e elas
    // nunca mais são buscadas (o filtro do backend é "id > lastMessageId").
    poll();
    state.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  }

  function ensureSession(config, contactInfo) {
    if (state.ticketUuid) return Promise.resolve();

    var stored = loadStoredSession();

    return request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: stored ? stored.visitorId : undefined,
        name: contactInfo && contactInfo.name ? contactInfo.name : undefined,
        phone: contactInfo && contactInfo.phone ? contactInfo.phone : undefined
      })
    }).then(function (data) {
      state.visitorId = data.visitorId;
      state.ticketUuid = data.ticketUuid;
      storeSession({ visitorId: data.visitorId });
    });
  }

  function sendMessage(messagesContainer, input) {
    var text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.disabled = true;

    request("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: state.visitorId,
        ticketUuid: state.ticketUuid,
        body: text
      })
    })
      .then(function (data) {
        var messageId = data && data.messageId;
        // Um poll concorrente (em andamento desde antes deste envio) pode
        // ganhar a corrida e já ter renderizado essa mesma mensagem — só
        // desenha aqui se isso ainda não aconteceu, senão duplica na tela.
        if (!messageId || !state.renderedMessageIds[messageId]) {
          renderMessage(messagesContainer, {
            id: messageId,
            body: text,
            fromMe: false
          });
        }
        if (messageId) {
          state.renderedMessageIds[messageId] = true;
          if (messageId > state.lastMessageId) {
            state.lastMessageId = messageId;
          }
        }
      })
      .catch(function (err) {
        renderMessage(messagesContainer, {
          body: "Não foi possível enviar sua mensagem. Tente novamente.",
          fromMe: true
        });
      })
      .then(function () {
        input.disabled = false;
        input.focus();
      });
  }

  // Formulário de pré-atendimento (nome/telefone), exibido antes do chat
  // quando a conexão exige essas informações (config.requireName /
  // config.requirePhone) e ainda não existe sessão salva para o visitante.
  function buildPrecontactForm(config, onValid) {
    var wrap = document.createElement("form");
    wrap.id = "zc-webchat-precontact";

    var html = "";
    if (config.formTitle) {
      html += '<div id="zc-webchat-precontact-title">' + escapeHtml(config.formTitle) + "</div>";
    }
    if (config.requireName) {
      html +=
        '<input id="zc-webchat-precontact-name" type="text" placeholder="Seu nome" autocomplete="name">';
    }
    if (config.requirePhone) {
      html +=
        '<input id="zc-webchat-precontact-phone" type="tel" placeholder="Seu telefone" autocomplete="tel">';
    }
    html +=
      '<div id="zc-webchat-precontact-error"></div>' +
      '<button type="submit">Iniciar conversa</button>';
    wrap.innerHTML = html;

    wrap.addEventListener("submit", function (event) {
      event.preventDefault();
      var nameInput = wrap.querySelector("#zc-webchat-precontact-name");
      var phoneInput = wrap.querySelector("#zc-webchat-precontact-phone");
      var errorEl = wrap.querySelector("#zc-webchat-precontact-error");
      var submitBtn = wrap.querySelector("button[type=submit]");

      var name = nameInput ? nameInput.value.trim() : "";
      var phone = phoneInput ? phoneInput.value.trim() : "";

      if (config.requireName && !name) {
        errorEl.textContent = "Informe seu nome para continuar.";
        errorEl.style.display = "block";
        return;
      }
      if (config.requirePhone && !phone) {
        errorEl.textContent = "Informe seu telefone para continuar.";
        errorEl.style.display = "block";
        return;
      }
      errorEl.style.display = "none";

      submitBtn.disabled = true;
      submitBtn.textContent = "Aguarde...";

      onValid({ name: name, phone: phone }, function (message) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Iniciar conversa";
        errorEl.textContent = message;
        errorEl.style.display = "block";
      });
    });

    return wrap;
  }

  function buildWindow(config) {
    var win = document.createElement("div");
    win.id = "zc-webchat-window";

    var header = document.createElement("div");
    header.id = "zc-webchat-header";
    header.innerHTML =
      (config.avatar ? '<img src="' + config.avatar + '" alt="">' : "") +
      '<div id="zc-webchat-header-texts">' +
      '<div id="zc-webchat-header-title">' + escapeHtml(config.name || "Atendimento") + "</div>" +
      (config.subtitle ? '<div id="zc-webchat-header-subtitle">' + escapeHtml(config.subtitle) + "</div>" : "") +
      "</div>" +
      '<button id="zc-webchat-close" aria-label="Fechar">×</button>';
    win.appendChild(header);

    var chatBody = document.createElement("div");
    chatBody.id = "zc-webchat-chatbody";

    var messagesContainer = document.createElement("div");
    messagesContainer.id = "zc-webchat-messages";
    chatBody.appendChild(messagesContainer);

    if (config.greetingMessage) {
      renderMessage(messagesContainer, { body: config.greetingMessage, fromMe: true });
    }

    var form = document.createElement("form");
    form.id = "zc-webchat-form";
    form.innerHTML =
      '<input id="zc-webchat-input" type="text" placeholder="Digite sua mensagem..." autocomplete="off">' +
      '<button id="zc-webchat-send" type="submit" aria-label="Enviar">➤</button>';
    chatBody.appendChild(form);

    win.appendChild(chatBody);

    var stored = loadStoredSession();
    var needsPrecontact = Boolean(
      (config.requireName || config.requirePhone) && !(stored && stored.visitorId)
    );

    if (needsPrecontact) {
      chatBody.style.display = "none";
      var precontact = buildPrecontactForm(config, function (contactInfo, onError) {
        ensureSession(config, contactInfo)
          .then(function () {
            precontact.remove();
            chatBody.style.display = "flex";
            startPolling(messagesContainer, config);
            form.querySelector("#zc-webchat-input").focus();
          })
          .catch(function () {
            onError("Não foi possível iniciar a conversa. Tente novamente.");
          });
      });
      win.insertBefore(precontact, chatBody);
    }

    header.querySelector("#zc-webchat-close").addEventListener("click", function () {
      toggleWindow(false, win);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = form.querySelector("#zc-webchat-input");
      ensureSession(config)
        .then(function () {
          startPolling(messagesContainer, config);
          sendMessage(messagesContainer, input);
        })
        .catch(function () {
          renderMessage(messagesContainer, {
            body: "Não foi possível iniciar a conversa. Tente novamente mais tarde.",
            fromMe: true
          });
        });
    });

    return win;
  }

  function toggleWindow(open, win) {
    state.open = open;
    if (open) {
      win.classList.add("zc-open");
    } else {
      win.classList.remove("zc-open");
    }
  }

  function init(config) {
    if (config.active === false) return;

    buildStyles(config);

    var root = document.createElement("div");
    root.id = "zc-webchat-root";
    document.body.appendChild(root);

    var win = buildWindow(config);
    document.body.appendChild(win);

    if (!config.hideDefaultButton) {
      var button = document.createElement("button");
      button.id = "zc-webchat-button";
      button.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
      button.addEventListener("click", function () {
        toggleWindow(!state.open, win);
      });
      root.appendChild(button);
    }

    var stored = loadStoredSession();
    if (stored && stored.visitorId) {
      var messagesContainer = win.querySelector("#zc-webchat-messages");
      ensureSession(config).then(function () {
        startPolling(messagesContainer, config);
      });
    }

    var behavior = config.behavior || {};
    if (behavior.autoOpen) {
      var delayMs = Math.max(0, Number(behavior.autoOpenDelay || 0)) * 1000;
      setTimeout(function () {
        if (!state.open) toggleWindow(true, win);
      }, delayMs);
    }
  }

  request("/config", { method: "GET" })
    .then(init)
    .catch(function (err) {
      console.error("[webchat widget] falha ao carregar configuração:", err.message);
    });
})();
