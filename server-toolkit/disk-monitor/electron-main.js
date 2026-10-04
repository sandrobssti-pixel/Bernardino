const { app, BrowserWindow } = require("electron");

// Janela própria do app, em vez de abrir pelo navegador — reaproveita o
// mesmo servidor Express de sempre (server.js, com todas as rotas/lib
// intactas) só trocando "acessar http://localhost:8091 pelo navegador"
// por "o técnico abre um aplicativo e já cai direto no painel", sem ver
// barra de endereço, URL nem nada que pareça site.
//
// `require("./server.js")` sobe o servidor de verdade (mesmo processo,
// mesma porta) — nada foi duplicado nem reimplementado; é o MESMO
// server.js usado na instalação como serviço systemd (ver
// disk-monitor.service), só chamado de um jeito diferente.
require("./server.js");

const PORT = process.env.PORT || 8091;
// Tempo de folga pro Express terminar de subir (ler config, montar
// rotas) antes da janela tentar carregar a página — não tem callback
// exposto pelo server.js pra saber "pronto" com certeza (ele só chama
// app.listen() no final do arquivo), então uma folga curta é o jeito
// simples de evitar a primeira tentativa de carregamento falhar.
const SERVER_READY_DELAY_MS = 800;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: "disk-monitor",
    // Sem barra de menu (File/Edit/View...) — não faz sentido pra esse
    // painel, e menu de app "genérico do Electron" só reforça a
    // confusão "isso é site ou programa?" que é exatamente o que essa
    // mudança resolve.
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  setTimeout(createWindow, SERVER_READY_DELAY_MS);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
