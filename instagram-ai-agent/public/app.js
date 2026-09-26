// Painel do agente de IA do Instagram — Confianza Technologies.

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const STATUS = [
  ["novo", "Novo"],
  ["em_contato", "Em contato"],
  ["qualificado", "Qualificado"],
  ["convertido", "Convertido"],
  ["perdido", "Perdido"]
];
const SOURCE = { dm: "Direct", comentario: "Comentário" };
const BY = {
  cliente: ["Cliente", "in"],
  ia: ["IA", "ia"],
  "boas-vindas": ["Boas-vindas", "ia"],
  comentario: ["Direct do comentário", "ia"],
  equipe: ["Equipe", "team"],
  escalacao: ["Escalação", "bad"],
  sistema: ["Sistema", "warn"]
};

const state = { tab: "overview", leads: [], currentLead: null, config: null, overviewTimer: null };

// ---------------- util ----------------

const fmtNum = n => new Intl.NumberFormat("pt-BR").format(n || 0);
const fmtTime = ms => {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fmtDay = key => {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
};
const leadLabel = lead => (lead?.username ? `@${lead.username}` : lead?.name || `ID ${String(lead?.id || "").slice(-6)}`);
const initials = lead => (lead?.name || lead?.username || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
const avatar = lead =>
  lead?.profilePic
    ? `<img class="avatar" src="${esc(lead.profilePic)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-initial="${esc(initials(lead))}">`
    : `<span class="avatar">${esc(initials(lead))}</span>`;

// Foto de perfil expirada (links do Instagram vencem): mostra a inicial.
document.addEventListener(
  "error",
  event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("avatar")) return;
    const span = document.createElement("span");
    span.className = "avatar";
    span.textContent = img.dataset.initial || "?";
    img.replaceWith(span);
  },
  true
);

const toast = message => {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3200);
};

const api = async (route, { method = "GET", body } = {}) => {
  const response = await fetch(`/api/admin?r=${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && route !== "login") {
    showLogin();
    throw new Error("Sessão expirada");
  }
  if (!response.ok) {
    const error = new Error(data.error || `Erro ${response.status}`);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
};

// ---------------- tema ----------------

const storage = {
  get: key => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sem armazenamento local */
    }
  }
};

const applyTheme = theme => {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
};
applyTheme(storage.get("theme"));
$("#themeToggle").addEventListener("click", () => {
  const isLight =
    document.documentElement.dataset.theme === "light" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches);
  const next = isLight ? "dark" : "light";
  applyTheme(next);
  storage.set("theme", next);
  if (state.tab === "overview" && state.stats) renderChart(state.stats);
});

// ---------------- login ----------------

const showLogin = () => {
  $("#app").hidden = true;
  $("#login").hidden = false;
  clearInterval(state.overviewTimer);
  $("#loginPassword").focus();
};

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    await api("login", { method: "POST", body: { password: $("#loginPassword").value } });
    $("#loginPassword").value = "";
    startApp();
  } catch (error) {
    $("#loginError").textContent = error.message;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("logout", { method: "POST" }).catch(() => {});
  showLogin();
});

// ---------------- abas ----------------

const openTab = tab => {
  state.tab = tab;
  $$(".tabs button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
  $$(".panel").forEach(panel => (panel.hidden = panel.id !== `tab-${tab}`));
  storage.set("tab", tab);
  ({ overview: loadOverview, conversations: loadConversations, leads: loadLeads, comments: loadComments, settings: loadSettings })[tab]?.();
};
$$(".tabs button").forEach(button => button.addEventListener("click", () => openTab(button.dataset.tab)));

const handleLoadError = error => {
  if (error.status === 503 && error.data?.setup) {
    renderSetupBanner(error.data.setup);
  } else if (error.message !== "Sessão expirada") {
    toast(error.message);
  }
};

const renderSetupBanner = setup => {
  const missing = [];
  if (!setup.hasDatabase) missing.push("banco de dados (Vercel → Storage → Redis → Connect Project)");
  if (!setup.hasAccessToken) missing.push("IG_ACCESS_TOKEN");
  if (!setup.hasVerifyToken) missing.push("VERIFY_TOKEN");
  if (!setup.aiProvider) missing.push("ANTHROPIC_API_KEY ou OPENAI_API_KEY");
  const banner = $("#setupBanner");
  banner.hidden = !missing.length;
  banner.innerHTML = missing.length
    ? `<strong>Falta configurar:</strong> ${missing.map(esc).join(" · ")}. Depois rode <code>vercel --prod</code>.`
    : "";
};

// ---------------- visão geral ----------------

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);

const loadOverview = async () => {
  try {
    const data = await api("overview");
    state.stats = data.stats;
    renderSetupBanner(data.setup);
    const today = data.stats[data.stats.length - 1] || {};
    const week = data.stats.slice(-7);
    const days = data.token?.daysLeft;
    const kpis = [
      { label: "Leads hoje", value: today.leads, sub: `${fmtNum(sum(week, "leads"))} em 7 dias` },
      { label: "Total de leads", value: data.totalLeads, sub: "desde o início" },
      { label: "DMs recebidas", week: true, value: sum(week, "in"), sub: `${fmtNum(today.in)} hoje` },
      { label: "Respostas da IA", week: true, value: sum(week, "ai"), sub: `${fmtNum(today.ai)} hoje` },
      { label: "Escalações p/ humano", week: true, value: sum(week, "escalations"), sub: `${fmtNum(today.escalations)} hoje` },
      {
        label: "Comentários",
        week: true,
        value: sum(week, "comments"),
        sub: `${fmtNum(sum(week, "commentsReplied"))} respondidos · ${fmtNum(sum(week, "commentErrors"))} falhas`,
        tone: sum(week, "commentErrors") ? "caution" : ""
      },
      {
        label: "Token do Instagram",
        value: days === null || days === undefined ? "—" : days,
        sub: days === null || days === undefined ? "renove em Configurações" : "dias até vencer",
        tone: days !== null && days !== undefined && days < 5 ? "alert" : ""
      }
    ];
    $("#kpis").innerHTML = kpis
      .map(k => `<div class="kpi ${k.tone || ""}"><div class="label">${esc(k.label)}${k.week ? " <span class='muted'>· 7 dias</span>" : ""}</div><div class="value">${typeof k.value === "number" ? fmtNum(k.value) : esc(k.value)}</div><div class="sub">${esc(k.sub)}</div></div>`)
      .join("");
    renderChart(data.stats);
    renderChartTable(data.stats);
    renderFeed(data.feed);
    $("#lastUpdate").textContent = `atualizado ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    handleLoadError(error);
  }
};

const renderChart = stats => {
  // Largura real do container: texto do eixo não fica esticado no celular.
  const W = Math.max(300, Math.round($("#chart").clientWidth || 760));
  const H = 260;
  const pad = { l: 34, r: 8, t: 12, b: 28 };
  const max = Math.max(4, ...stats.map(s => Math.max(s.in, s.out)));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const group = plotW / stats.length;
  const barW = Math.max(4, Math.min(16, (group - 10) / 2));
  const y = v => pad.t + plotH - (v / top) * plotH;

  const bar = (x, value, cls) => {
    if (!value) return "";
    const h = Math.max(2, plotH - (y(value) - pad.t));
    const yTop = pad.t + plotH - h;
    const r = Math.min(4, barW / 2, h);
    // topo arredondado, base reta apoiada na linha de base
    return `<path class="${cls}" d="M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z"/>`;
  };

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mensagens recebidas e enviadas por dia, últimos 14 dias">`;
  for (let i = 0; i <= 4; i++) {
    const v = step * i;
    svg += `<line class="gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="axis" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  stats.forEach((s, i) => {
    const gx = pad.l + i * group;
    const x1 = gx + group / 2 - barW - 1; // 2px de respiro entre as barras
    const x2 = gx + group / 2 + 1;
    svg += bar(x1, s.in, "bar-in") + bar(x2, s.out, "bar-out");
    const every = group < 40 ? 3 : 2;
    if ((stats.length - 1 - i) % every === 0) {
      svg += `<text class="axis" x="${gx + group / 2}" y="${H - 8}" text-anchor="middle">${fmtDay(s.day)}</text>`;
    }
    svg += `<rect class="hit" data-i="${i}" x="${gx}" y="${pad.t}" width="${group}" height="${plotH}"/>`;
  });
  svg += "</svg>";
  $("#chart").innerHTML = svg;

  const tip = $("#tooltip");
  $$("#chart .hit").forEach(rect => {
    rect.addEventListener("mousemove", event => {
      const s = stats[Number(rect.dataset.i)];
      tip.innerHTML = `<div class="mono">${fmtDay(s.day)}</div>
        <div><i class="sw sw-in"></i> Recebidas <b>${fmtNum(s.in)}</b></div>
        <div><i class="sw sw-out"></i> Enviadas <b>${fmtNum(s.out)}</b></div>
        <div class="muted">IA ${fmtNum(s.ai)} · leads ${fmtNum(s.leads)} · comentários ${fmtNum(s.comments)}</div>`;
      tip.hidden = false;
      const x = Math.min(event.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = `${x}px`;
      tip.style.top = `${event.clientY + 14}px`;
    });
    rect.addEventListener("mouseleave", () => (tip.hidden = true));
  });
};

const renderChartTable = stats => {
  $("#chartTable").innerHTML = `<table class="table"><thead><tr><th>Dia</th><th>Recebidas</th><th>Enviadas</th><th>IA</th><th>Leads</th><th>Comentários</th></tr></thead><tbody>${[...stats]
    .reverse()
    .map(s => `<tr><td class="mono">${fmtDay(s.day)}</td><td class="num">${s.in}</td><td class="num">${s.out}</td><td class="num">${s.ai}</td><td class="num">${s.leads}</td><td class="num">${s.comments}</td></tr>`)
    .join("")}</tbody></table>`;
};

$("#chartTableToggle").addEventListener("click", event => {
  const showTable = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(showTable));
  event.currentTarget.textContent = showTable ? "Ver gráfico" : "Ver tabela";
  $("#chart").hidden = showTable;
  $("#chartTable").hidden = !showTable;
});

const renderFeed = feed => {
  if (!feed.length) {
    $("#feed").innerHTML = `<li class="empty" style="display:block">Nenhuma movimentação ainda. Mande uma DM ou comente num post para testar.</li>`;
    return;
  }
  $("#feed").innerHTML = feed
    .map(item => {
      const isComment = item.kind === "comment";
      const [label, cls] = isComment ? ["Comentário", "warn"] : item.kind === "escalation" ? ["Pediu humano", "bad"] : item.kind === "test" ? ["Teste da Meta", "team"] : item.kind === "deletion" ? ["Exclusão de dados", "bad"] : BY[item.by] || [item.by, ""];
      const who = item.kind === "test" ? "Meta" : item.leadLabel || (item.username ? `@${item.username}` : "cliente");
      const arrow = item.direction === "in" ? "" : "→ ";
      return `<li>
        <span class="tag ${cls}">${esc(label)}</span>
        <div><span class="who">${esc(arrow + who)}</span> <span class="txt">${esc(String(item.text).slice(0, 400))}</span></div>
        <time>${fmtTime(item.at)}</time></li>`;
    })
    .join("");
};

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.tab === "overview" && state.stats && renderChart(state.stats), 150);
});

// ---------------- conversas ----------------

const loadConversations = async () => {
  try {
    const { leads } = await api("leads");
    state.leads = leads;
    renderConvoList();
    if (state.currentLead) openConversation(state.currentLead);
  } catch (error) {
    handleLoadError(error);
  }
};

const renderConvoList = () => {
  const q = $("#convoSearch").value.trim().toLowerCase();
  const list = state.leads.filter(lead => !q || `${lead.username} ${lead.name}`.toLowerCase().includes(q));
  $("#convoList").innerHTML = list.length
    ? list
        .map(
          lead => `<li><button type="button" data-id="${esc(lead.id)}" aria-current="${lead.id === state.currentLead}">
          ${avatar(lead)}
          <span style="min-width:0"><span class="name"><span>${esc(leadLabel(lead))}</span><time class="muted mono" style="font-size:11px">${lead.lastAt ? fmtTime(lead.lastAt) : ""}</time></span>
          <span class="last">${lead.lastDirection === "out" ? "Você: " : ""}${esc(lead.lastText || "")}</span></span></button></li>`
        )
        .join("")
    : `<li class="empty">Nenhuma conversa ainda.</li>`;
  $$("#convoList button").forEach(button => button.addEventListener("click", () => openConversation(button.dataset.id)));
};
$("#convoSearch").addEventListener("input", renderConvoList);

const openConversation = async id => {
  state.currentLead = id;
  $$("#convoList button").forEach(button => button.setAttribute("aria-current", String(button.dataset.id === id)));
  try {
    const { lead, messages } = await api(`conversation&id=${encodeURIComponent(id)}`);
    $("#thread").innerHTML = `
      <div class="thread-head">
        ${avatar(lead)}
        <div class="grow"><strong>${esc(leadLabel(lead))}</strong>
          <div class="muted">${[lead.name, SOURCE[lead.source] || lead.source, lead.phone, lead.email].filter(Boolean).map(esc).join(" · ")}</div></div>
        <label class="switch" style="margin:0"><input type="checkbox" id="aiToggle" ${lead.aiPaused ? "" : "checked"}><span></span>IA ativa</label>
        ${lead.username ? `<a class="btn btn-ghost btn-sm" href="https://ig.me/m/${encodeURIComponent(lead.username)}" target="_blank" rel="noopener">Abrir no Instagram</a>` : ""}
        <button id="deleteLead" class="btn btn-ghost btn-sm" type="button" title="Apaga o lead, a conversa e os comentários dele (pedido de exclusão de dados)">Excluir dados</button>
      </div>
      <div class="bubbles" id="bubbles">${
        messages.length
          ? messages
              .map(m => {
                const [label] = BY[m.by] || [m.by];
                return `<div class="bubble ${m.direction === "in" ? "in" : "out"}">${esc(m.text)}<span class="meta">${m.direction === "in" ? "" : `${esc(label)} · `}${fmtTime(m.at)}</span></div>`;
              })
              .join("")
          : `<p class="empty">Sem mensagens registradas.</p>`
      }</div>
      <form class="composer" id="composer">
        <textarea id="composerText" rows="2" maxlength="1000" placeholder="Responder como equipe (a IA pausa nesta conversa)" required></textarea>
        <button class="btn btn-primary" type="submit">Enviar</button>
      </form>`;
    const bubbles = $("#bubbles");
    bubbles.scrollTop = bubbles.scrollHeight;

    $("#deleteLead").addEventListener("click", async () => {
      if (!confirm(`Apagar TODOS os dados de ${leadLabel(lead)} (lead, conversa e comentários)? Não dá para desfazer.`)) return;
      try {
        await api("delete-lead", { method: "POST", body: { id } });
        toast("Dados do lead apagados");
        state.currentLead = null;
        $("#thread").innerHTML = `<p class="empty">Dados apagados.</p>`;
        loadConversations();
      } catch (error) {
        toast(error.message);
      }
    });

    $("#aiToggle").addEventListener("change", async event => {
      try {
        await api("lead", { method: "POST", body: { id, patch: { aiPaused: !event.target.checked } } });
        toast(event.target.checked ? "IA reativada nesta conversa" : "IA pausada nesta conversa");
      } catch (error) {
        toast(error.message);
      }
    });

    $("#composer").addEventListener("submit", async event => {
      event.preventDefault();
      const text = $("#composerText").value.trim();
      if (!text) return;
      const button = event.currentTarget.querySelector("button");
      button.disabled = true;
      try {
        await api("send", { method: "POST", body: { id, text } });
        toast("Mensagem enviada");
        openConversation(id);
      } catch (error) {
        toast(`Não enviou: ${error.message}`);
        button.disabled = false;
      }
    });
  } catch (error) {
    handleLoadError(error);
  }
};

// ---------------- leads ----------------

$("#leadStatus").innerHTML += STATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

const loadLeads = async () => {
  try {
    const { leads } = await api("leads");
    state.leads = leads;
    renderLeads();
  } catch (error) {
    handleLoadError(error);
  }
};

const renderLeads = () => {
  const q = $("#leadSearch").value.trim().toLowerCase();
  const status = $("#leadStatus").value;
  const source = $("#leadSource").value;
  const list = state.leads.filter(
    lead =>
      (!q || `${lead.username} ${lead.name} ${lead.phone} ${lead.email}`.toLowerCase().includes(q)) &&
      (!status || lead.status === status) &&
      (!source || lead.source === source)
  );
  $("#leadTable").innerHTML = `<thead><tr><th>Lead</th><th>Origem</th><th>Status</th><th>Contato</th><th>Msgs</th><th>Primeiro contato</th><th>Último</th><th></th></tr></thead>
    <tbody>${
      list.length
        ? list
            .map(
              lead => `<tr>
          <td><div class="row">${avatar(lead)}<div><strong>${esc(leadLabel(lead))}</strong><div class="muted">${esc(lead.name || "")}</div></div></div></td>
          <td><span class="tag">${esc(SOURCE[lead.source] || lead.source)}</span></td>
          <td><select data-id="${esc(lead.id)}" aria-label="Status do lead">${STATUS.map(([v, l]) => `<option value="${v}" ${lead.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
          <td>${esc(lead.phone || "")}${lead.phone && lead.email ? "<br>" : ""}${esc(lead.email || "")}</td>
          <td class="num">${fmtNum(lead.messagesIn)}</td>
          <td class="mono">${fmtTime(lead.firstAt)}</td>
          <td class="mono">${fmtTime(lead.lastAt)}</td>
          <td><button class="btn btn-ghost btn-sm" data-open="${esc(lead.id)}" type="button">Conversa</button></td></tr>`
            )
            .join("")
        : `<tr><td colspan="8" class="empty">Nenhum lead encontrado.</td></tr>`
    }</tbody>`;
  $$("#leadTable select").forEach(select =>
    select.addEventListener("change", async () => {
      try {
        await api("lead", { method: "POST", body: { id: select.dataset.id, patch: { status: select.value } } });
        const lead = state.leads.find(item => item.id === select.dataset.id);
        if (lead) lead.status = select.value;
        toast("Status atualizado");
      } catch (error) {
        toast(error.message);
      }
    })
  );
  $$("#leadTable [data-open]").forEach(button =>
    button.addEventListener("click", () => {
      state.currentLead = button.dataset.open;
      openTab("conversations");
    })
  );
};
["#leadSearch", "#leadStatus", "#leadSource"].forEach(sel => $(sel).addEventListener("input", renderLeads));

// ---------------- comentários ----------------

const loadComments = async () => {
  try {
    const { comments } = await api("comments");
    $("#commentList").innerHTML = comments.length
      ? comments
          .map(
            c => `<li>
        <div class="row"><strong>${esc(c.username ? `@${c.username}` : "Alguém")}</strong>
          ${c.newLead ? `<span class="tag ia">novo lead</span>` : ""}
          ${c.rule ? `<span class="tag">regra: ${esc(c.rule)}</span>` : ""}
          <time class="muted mono" style="margin-left:auto">${fmtTime(c.at)}</time></div>
        <div>${esc(c.text)}</div>
        ${c.publicReply ? `<div class="reply"><span class="muted">Resposta pública:</span> ${esc(c.publicReply)}</div>` : ""}
        ${c.privateReply ? `<div class="reply dm"><span class="muted">Direct:</span> ${esc(c.privateReply)}</div>` : ""}
        ${(c.errors || []).map(e => `<div><span class="tag bad">erro</span> <span class="muted">${esc(e)}</span></div>`).join("")}
        ${!c.publicReply && !c.privateReply && !(c.errors || []).length ? `<div class="muted">Sem resposta automática (desligada nas Configurações).</div>` : ""}
      </li>`
          )
          .join("")
      : `<li class="empty">Nenhum comentário recebido ainda. Na Meta, assine o campo <code>comments</code> do webhook.</li>`;
  } catch (error) {
    handleLoadError(error);
  }
};

// ---------------- configurações ----------------

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  let o = obj;
  keys.slice(0, -1).forEach(k => (o = o[k] = o[k] || {}));
  o[keys[keys.length - 1]] = value;
};

const ruleTemplate = (rule = {}) => `<div class="rule">
  <div class="rule-head"><strong>Regra</strong><button type="button" class="btn btn-ghost btn-sm" data-remove>Remover</button></div>
  <label class="field"><span>Palavras-chave</span><input data-k="keywords" value="${esc(rule.keywords || "")}" placeholder="preço, valor, quanto custa"></label>
  <label class="field"><span>Link de destino <em class="muted">(entra no lugar de {link})</em></span><input data-k="link" type="url" value="${esc(rule.link || "")}" placeholder="https://..."></label>
  <label class="field"><span>Resposta pública</span><textarea data-k="publicReply" rows="2">${esc(rule.publicReply || "")}</textarea></label>
  <label class="field"><span>Mensagem no Direct</span><textarea data-k="privateReply" rows="2">${esc(rule.privateReply || "")}</textarea></label>
</div>`;

const bindRuleButtons = () =>
  $$("#rules [data-remove]").forEach(button => (button.onclick = () => button.closest(".rule").remove()));

$("#addRule").addEventListener("click", () => {
  $("#rules").insertAdjacentHTML("beforeend", ruleTemplate());
  bindRuleButtons();
});

const productTemplate = (product = {}) => `<div class="product">
  <div class="rule-head"><strong>${esc(product.name || "Novo produto")}</strong>
    <span class="row"><button type="button" class="btn btn-ghost btn-sm" data-extract>Extrair do link</button><button type="button" class="btn btn-ghost btn-sm" data-remove>Remover</button></span></div>
  <div class="grid2">
    <label class="field"><span>Nome</span><input data-k="name" value="${esc(product.name || "")}" required></label>
    <label class="field"><span>Link de compra</span><input data-k="url" type="url" value="${esc(product.url || "")}" placeholder="https://..."></label>
  </div>
  <label class="field"><span>Descrição / diferenciais</span><textarea data-k="description" rows="3">${esc(product.description || "")}</textarea></label>
  <div class="grid2">
    <label class="field"><span>Preço</span><input data-k="price" value="${esc(product.price || "")}" placeholder="R$ 297 ou sob orçamento"></label>
    <label class="field"><span>Bônus <em class="muted">(opcional)</em></span><input data-k="bonus" value="${esc(product.bonus || "")}"></label>
  </div>
</div>`;

const bindProductButtons = () => {
  $$("#products [data-remove]").forEach(button => (button.onclick = () => button.closest(".product").remove()));
  $$("#products [data-extract]").forEach(
    button =>
      (button.onclick = async () => {
        const box = button.closest(".product");
        const url = box.querySelector('[data-k="url"]').value.trim();
        if (!url) return toast("Cole o link do produto primeiro");
        button.disabled = true;
        try {
          const { product } = await api("extract-url", { method: "POST", body: { url } });
          const fill = (key, value) => {
            const el = box.querySelector(`[data-k="${key}"]`);
            if (value && !el.value.trim()) el.value = value;
          };
          fill("name", product.name);
          fill("description", product.description);
          fill("price", product.price);
          toast("Dados extraídos — revise e clique em Salvar");
        } catch (error) {
          toast(`Não consegui ler o link: ${error.message}`);
        } finally {
          button.disabled = false;
        }
      })
  );
};

$("#addProduct").addEventListener("click", () => {
  $("#products").insertAdjacentHTML("beforeend", productTemplate());
  bindProductButtons();
});

$("#configForm").addEventListener("submit", event => event.preventDefault());

// ---------------- conexão com o Instagram ----------------

const loadInstagram = async () => {
  $("#igStatus").innerHTML = `<p class="muted">Sincronizando com o Instagram…</p>`;
  try {
    const data = await api("instagram");
    const a = data.account;
    const days = data.token?.daysLeft;
    const fields = data.webhookFields || [];
    const missing = ["messages", "comments"].filter(f => !fields.includes(f));
    const lock = data.expectedUserId
      ? a && String(a.user_id) === data.expectedUserId
        ? `<span class="tag team">conta travada (IG_USER_ID)</span>`
        : `<span class="tag bad">token de outra conta!</span>`
      : "";
    $("#igStatus").innerHTML = `
      ${a
        ? `<div class="ig-account">
            ${a.profile_picture_url ? `<img class="avatar" src="${esc(a.profile_picture_url)}" alt="" referrerpolicy="no-referrer" data-initial="${esc((a.username || "?")[0].toUpperCase())}">` : `<span class="avatar">${esc((a.username || "?")[0].toUpperCase())}</span>`}
            <div><div class="row"><strong>@${esc(a.username)}</strong><span class="tag team">conectado</span>${lock}</div>
              <div class="muted">${esc(a.name || "")} · ${esc(a.account_type || "")} · ID ${esc(a.user_id)}</div>
              <div class="ig-stats"><span><b>${fmtNum(a.followers_count)}</b><span class="muted">seguidores</span></span><span><b>${fmtNum(a.media_count)}</b><span class="muted">posts</span></span><span><b>${fmtNum(a.follows_count)}</b><span class="muted">seguindo</span></span></div>
            </div></div>`
        : `<p><span class="tag bad">desconectado</span> ${esc(data.accountError || "Token inválido")}</p>`}
      <div class="ig-meta">
        <div><span class="muted">Token:</span> ${days === undefined || days === null ? `<span class="tag warn">vencimento desconhecido</span> — clique em Renovar token` : `<span class="tag ${days < 5 ? "bad" : days < 15 ? "warn" : "team"}">${days} dias</span> até vencer`} <span class="muted">· origem: ${esc(data.tokenSource)}</span></div>
        <div><span class="muted">Webhook:</span> ${data.webhookError ? `<span class="tag warn">não foi possível ler</span> ${esc(data.webhookError)}` : missing.length ? `<span class="tag bad">faltam ${esc(missing.join(", "))}</span> — clique em Assinar webhook` : `<span class="tag team">${esc(fields.join(", "))}</span>`}</div>
      </div>`;
  } catch (error) {
    $("#igStatus").innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
  }
};

const withButton = async (button, action) => {
  button.disabled = true;
  try {
    await action();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
};

$("#igSync").addEventListener("click", event => withButton(event.currentTarget, loadInstagram));
$("#igRefresh").addEventListener("click", event =>
  withButton(event.currentTarget, async () => {
    await api("refresh-token", { method: "POST" });
    toast("Token renovado por mais 60 dias");
    await loadInstagram();
  })
);
$("#igSubscribe").addEventListener("click", event =>
  withButton(event.currentTarget, async () => {
    await api("subscribe-webhook", { method: "POST" });
    toast("Webhook assinado");
    await loadInstagram();
  })
);
$("#igSyncLeads").addEventListener("click", event =>
  withButton(event.currentTarget, async () => {
    const { checked, updated } = await api("sync-leads", { method: "POST" });
    toast(`${updated} de ${checked} leads atualizados`);
  })
);
$("#igSaveToken").addEventListener("click", event =>
  withButton(event.currentTarget, async () => {
    const token = $("#igNewToken").value.trim();
    if (!token) return toast("Cole o token novo");
    const { username } = await api("instagram-token", { method: "POST", body: { token } });
    $("#igNewToken").value = "";
    toast(`Token salvo — conectado como @${username}`);
    await loadInstagram();
  })
);

$("#resumeAll").addEventListener("click", event =>
  withButton(event.currentTarget, async () => {
    const { resumed } = await api("resume-all", { method: "POST" });
    toast(resumed ? `IA reativada em ${resumed} conversa(s)` : "Nenhuma conversa estava pausada");
  })
);

const loadSettings = async () => {
  loadInstagram();
  try {
    const { config, setup } = await api("config");
    state.config = config;
    renderSetupBanner(setup);
    $$("#configForm [name]").forEach(input => {
      const value = getPath(config, input.name);
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value ?? "";
    });
    $("#rules").innerHTML = (config.comments.rules || []).map(ruleTemplate).join("");
    bindRuleButtons();
    $("#products").innerHTML = (config.products || []).map(productTemplate).join("");
    bindProductButtons();
    const item = (ok, text) => `<li><span class="tag ${ok ? "team" : "bad"}">${ok ? "ok" : "falta"}</span> ${text}</li>`;
    $("#setupList").innerHTML = `<h2>Status da instalação</h2><ul class="checklist">
      ${item(setup.hasDatabase, "Banco de dados (Redis) conectado")}
      ${item(setup.hasAccessToken, "Token do Instagram (IG_ACCESS_TOKEN)")}
      ${item(setup.hasVerifyToken, "Verify Token do webhook (VERIFY_TOKEN)")}
      ${item(Boolean(setup.aiProvider), `Chave da IA${setup.aiProvider ? ` (${esc(setup.aiProvider)})` : ""}`)}
      ${item(setup.agentEnvEnabled, "Agente habilitado (AGENT_ENABLED)")}
    </ul>
    <h3>Token do Instagram</h3>
    <p class="muted">O token vale 60 dias e é renovado automaticamente toda segunda-feira.
      ${setup.token ? `Última renovação: <span class="mono">${fmtTime(setup.token.refreshedAt)}</span> · vence em <span class="mono">${new Date(setup.token.expiresAt).toLocaleDateString("pt-BR")}</span>.` : "Ainda não foi renovado por aqui (usa o da variável IG_ACCESS_TOKEN)."}</p>
    <button id="refreshToken" class="btn btn-ghost btn-sm" type="button" style="margin-top:10px">Renovar token agora</button>`;
    $("#refreshToken").addEventListener("click", async () => {
      try {
        await api("refresh-token", { method: "POST" });
        toast("Token renovado por mais 60 dias");
        loadSettings();
      } catch (error) {
        toast(error.message);
      }
    });
  } catch (error) {
    handleLoadError(error);
  }
};

$("#saveConfig").addEventListener("click", async () => {
  const config = structuredClone(state.config || {});
  $$("#configForm [name]").forEach(input => setPath(config, input.name, input.type === "checkbox" ? input.checked : input.value));
  config.comments.rules = $$("#rules .rule")
    .map(rule => Object.fromEntries([...rule.querySelectorAll("[data-k]")].map(el => [el.dataset.k, el.value.trim()])))
    .filter(rule => rule.keywords);
  config.products = $$("#products .product")
    .map(box => Object.fromEntries([...box.querySelectorAll("[data-k]")].map(el => [el.dataset.k, el.value.trim()])))
    .filter(product => product.name);
  try {
    const saved = await api("config", { method: "POST", body: { config } });
    state.config = saved.config;
    toast("Configurações salvas");
  } catch (error) {
    toast(error.message);
  }
});

// ---------------- testes, simuladores e auditoria ----------------

const planHtml = plan =>
  plan.skipped
    ? `<div class="muted">Não responderia: ${esc(plan.skipped)}.</div>`
    : `${plan.rule ? `<div><span class="tag">regra: ${esc(plan.rule)}</span></div>` : ""}
       ${plan.publicText ? `<div class="reply"><span class="muted">Público:</span> ${esc(plan.publicText)}</div>` : ""}
       ${plan.privateText ? `<div class="reply dm"><span class="muted">Direct:</span> ${esc(plan.privateText)}</div>` : ""}
       ${!plan.publicText && !plan.privateText ? `<div class="muted">Nenhuma mensagem configurada para enviar.</div>` : ""}
       ${(plan.errors || []).map(e => `<div><span class="tag bad">erro</span> ${esc(e)}</div>`).join("")}`;

$("#simComment").addEventListener("click", async () => {
  const text = $("#simCommentText").value.trim();
  if (!text) return toast("Digite um comentário de exemplo");
  try {
    const plan = await api("simulate-comment", { method: "POST", body: { text } });
    $("#simCommentResult").innerHTML = `<div class="sim-result comment-list"><li>${planHtml(plan)}</li></div>`;
  } catch (error) {
    toast(error.message);
  }
});

$("#dryRun").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $("#simCommentResult").innerHTML = `<p class="muted">Lendo os últimos 5 posts…</p>`;
  try {
    const { posts } = await api("dry-run");
    $("#simCommentResult").innerHTML = posts.length
      ? posts
          .map(
            post => `<div class="dry-post"><div class="row"><strong>${esc(post.caption || "(sem legenda)")}</strong>
              ${post.permalink ? `<a class="muted" href="${esc(post.permalink)}" target="_blank" rel="noopener">abrir post</a>` : ""}</div>
              ${post.comments.length ? `<ul class="comment-list" style="margin-top:8px">${post.comments.map(c => `<li><div><strong>${esc(c.username ? `@${c.username}` : "alguém")}</strong> ${esc(c.text)}</div>${planHtml(c)}</li>`).join("")}</ul>` : `<p class="muted">Sem comentários.</p>`}</div>`
          )
          .join("")
      : `<p class="muted">Nenhum post encontrado.</p>`;
  } catch (error) {
    $("#simCommentResult").innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
});

const simState = [];
const renderSim = () => {
  $("#simChat").innerHTML = simState.length
    ? simState
        .map(m => `<div class="bubble ${m.role === "user" ? "in" : "out"}">${esc(m.text)}${m.escalation ? `<span class="meta">→ escalaria para humano</span>` : ""}</div>`)
        .join("")
    : `<p class="empty">Escreva como se fosse um cliente.</p>`;
  $("#simChat").scrollTop = $("#simChat").scrollHeight;
};
renderSim();

$("#simDmSend").addEventListener("click", async event => {
  const text = $("#simDmText").value.trim();
  if (!text) return;
  const button = event.currentTarget;
  simState.push({ role: "user", text });
  $("#simDmText").value = "";
  renderSim();
  button.disabled = true;
  try {
    const { reply, escalation } = await api("simulate-dm", { method: "POST", body: { messages: simState } });
    simState.push({ role: "assistant", text: reply || "(sem resposta)", escalation });
  } catch (error) {
    simState.push({ role: "assistant", text: `Erro: ${error.message}` });
  } finally {
    button.disabled = false;
    renderSim();
  }
});
$("#simDmReset").addEventListener("click", () => {
  simState.length = 0;
  renderSim();
});

$("#testWhatsapp").addEventListener("click", async () => {
  try {
    await api("test-whatsapp", { method: "POST" });
    toast("Teste enviado — confira seu WhatsApp");
  } catch (error) {
    toast(`Falhou: ${error.message} (salve as configurações antes)`);
  }
});

$("#runAudit").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $("#auditResult").innerHTML = `<p class="muted">Rodando os testes…</p>`;
  try {
    const { checks, summary } = await api("audit");
    const tag = { ok: ["ok", "team"], warn: ["atenção", "warn"], fail: ["falha", "bad"] };
    $("#auditResult").innerHTML = `<p style="margin-top:12px"><span class="tag team">${summary.ok} ok</span> <span class="tag warn">${summary.warn} atenção</span> <span class="tag bad">${summary.fail} falha(s)</span></p>
      <ul class="audit">${checks
        .map(c => `<li><span class="tag ${tag[c.status][1]}">${tag[c.status][0]}</span><strong>${esc(c.name)}</strong><span class="detail">${esc(c.detail)}${c.fixed ? ` · <em>${esc(c.fixed)}</em>` : ""}</span></li>`)
        .join("")}</ul>`;
  } catch (error) {
    $("#auditResult").innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
});

// ---------------- início ----------------

const startApp = () => {
  $("#login").hidden = true;
  $("#app").hidden = false;
  const saved = storage.get("tab");
  openTab(["overview", "conversations", "leads", "comments", "settings"].includes(saved) ? saved : "overview");
  clearInterval(state.overviewTimer);
  state.overviewTimer = setInterval(() => {
    if (document.hidden) return;
    if (state.tab === "overview") loadOverview();
    if (state.tab === "conversations" && state.currentLead) openConversation(state.currentLead);
  }, 30000);
};

(async () => {
  try {
    const session = await api("session");
    if (!session.passwordConfigured) {
      $("#login").hidden = false;
      $("#loginError").textContent = "Cadastre DASHBOARD_PASSWORD na Vercel (mínimo 6 caracteres) e rode vercel --prod.";
      return;
    }
    session.authenticated ? startApp() : showLogin();
  } catch {
    showLogin();
  }
})();
