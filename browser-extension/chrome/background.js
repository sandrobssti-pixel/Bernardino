// Atalho do AtendeFlow: clicar no ícone da extensão abre o painel numa aba
// nova, ou só foca a aba já aberta se já tiver uma (evita duplicar abas
// toda vez que o técnico clica de novo durante o dia).
//
// URL fixa pro domínio real da Confianza Technologies — se precisar
// reaproveitar essa extensão pra outro cliente/domínio, troque só esta
// constante.
const ATENDEFLOW_URL = "https://atendeflow.confiancatechnologies.com";

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => (tab.url || "").startsWith(ATENDEFLOW_URL));

  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }

  await chrome.tabs.create({ url: ATENDEFLOW_URL });
});
