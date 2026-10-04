const { app, BrowserWindow, dialog } = require("electron");
const http = require("http");

// Janela própria do app, em vez de abrir pelo navegador — mas este
// processo NUNCA sobe seu próprio server.js. O serviço systemd
// (disk-monitor, roda como root, 24/7, inclusive sem ninguém logado —
// é ele que faz os checks automáticos de RAID/disco por cron) já está
// ocupando a porta. Subir um segundo Express aqui (como esta versão
// fazia antes) bateria EADDRINUSE contra o serviço já rodando. Esta
// janela só se conecta nele, do mesmo jeito que um navegador faria, só
// sem parecer navegador.

const PORT = process.env.PORT || 8091;
const SERVER_URL = `http://localhost:${PORT}`;
const CHECK_TIMEOUT_MS = 5000;
const CHECK_RETRY_DELAY_MS = 300;

function waitForServer(url, timeoutMs) {
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;
    (function attempt() {
      const req = http.get(url, res => {
        res.resume();
        resolve(true);
      });
      req.setTimeout(1000, () => req.destroy());
      req.on("error", () => {
        if (Date.now() >= deadline) {
          resolve(false);
        } else {
          setTimeout(attempt, CHECK_RETRY_DELAY_MS);
        }
      });
    })();
  });
}

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
  win.loadURL(SERVER_URL);
}

app.whenReady().then(async () => {
  const up = await waitForServer(SERVER_URL, CHECK_TIMEOUT_MS);
  if (!up) {
    dialog.showErrorBox(
      "disk-monitor não está respondendo",
      `Não consegui falar com o serviço em ${SERVER_URL} depois de ${CHECK_TIMEOUT_MS / 1000}s.\n\n` +
        "O serviço disk-monitor (systemd) provavelmente está parado. Verifique no terminal:\n\n" +
        "  sudo systemctl status disk-monitor\n" +
        "  sudo systemctl restart disk-monitor"
    );
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
