const path = require("path");
const fs = require("fs");
const { baseDir, publicDir } = require("./lib/paths");

// Carrega o .env de ao lado do executável/projeto — mesmo padrão do
// disk-monitor (funciona rodando com `node server.js` ou empacotado).
require("dotenv").config({ path: path.join(baseDir, ".env") });

const express = require("express");
const multer = require("multer");

const { createFileManager } = require("./lib/fileManager");
const { createSynologyClient } = require("./lib/synologyApi");
const { version } = require("./lib/version");
const { createAuthSystem } = require("toolkit-auth");
const { dataDir } = require("./lib/paths");

const PORT = process.env.PORT || 8092;
const SESSION_SECRET = process.env.SESSION_SECRET;
const MAX_UPLOAD_MB = Number(process.env.NAS_MAX_UPLOAD_MB || 2048);

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET não definido no .env — configure antes de rodar (ver .env.example)."
  );
  process.exit(1);
}

if (!process.env.NAS_ROOTS) {
  console.error(
    'NAS_ROOTS não definido no .env — configure as pastas permitidas (ex.: NAS_ROOTS="Backups:/mnt/nas-backup,Seafile:/mnt/nas-seafile").'
  );
  process.exit(1);
}

const fileManager = createFileManager(process.env.NAS_ROOTS);

// Opcional — sem DSM_HOST/DSM_USER/DSM_PASSWORD no .env, fica `null` e a
// aba de discos/desligamento simplesmente não aparece no painel (o
// navegador de arquivos continua funcionando normalmente).
const synologyClient = createSynologyClient({
  host: process.env.DSM_HOST,
  port: Number(process.env.DSM_PORT || 5001),
  useHttps: process.env.DSM_HTTPS !== "false",
  user: process.env.DSM_USER,
  password: process.env.DSM_PASSWORD,
  allowSelfSigned: process.env.DSM_ALLOW_SELF_SIGNED === "true"
});

const auth = createAuthSystem({
  dataDir,
  sessionSecret: SESSION_SECRET,
  envBootstrap: {
    username: process.env.DASHBOARD_USER,
    password: process.env.DASHBOARD_PASSWORD
  }
});

const app = express();
app.use(express.json());
app.use(auth.sessionMiddleware);
app.use("/api", auth.router);
app.use(express.static(publicDir));

app.get("/api/roots", auth.requireAuth, (req, res) => {
  res.json({ roots: fileManager.listRoots(), version, dsmConfigured: !!synologyClient });
});

// Discos/RAID do próprio Synology, via API do DSM — só aparece se
// DSM_HOST/DSM_USER/DSM_PASSWORD estiverem configurados no .env.
app.get("/api/nas/disks", auth.requireAuth, async (req, res) => {
  if (!synologyClient) {
    return res.status(501).json({ error: "Integração com o DSM não configurada (ver .env.example)." });
  }
  try {
    const disks = await synologyClient.getDisks();
    res.json({ disks });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Desliga o NAS de verdade — ação física, irreversível remotamente sem
// Wake-on-LAN configurado. Duas travas: admin-only (já garantido pelo
// requireRole) e uma frase de confirmação exata mandada pelo cliente,
// nunca só o clique do botão.
app.post("/api/nas/shutdown", auth.requireRole("admin"), async (req, res) => {
  if (!synologyClient) {
    return res.status(501).json({ error: "Integração com o DSM não configurada (ver .env.example)." });
  }
  if (req.body?.confirm !== "DESLIGAR") {
    return res.status(400).json({ error: 'Confirmação inválida — digite exatamente "DESLIGAR".' });
  }
  try {
    console.log(
      `[nas-panel] Desligamento do NAS disparado por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    await synologyClient.shutdown();
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/browse", auth.requireAuth, (req, res) => {
  try {
    const entries = fileManager.listDir(req.query.root, req.query.path || "");
    res.json({ entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Visualizador também baixa — só upload (escrita) é exclusivo de admin,
// mesma regra de permissão já usada no disk-monitor.
app.get("/api/download", auth.requireAuth, (req, res) => {
  try {
    const filePath = fileManager.getFileForDownload(req.query.root, req.query.path);
    res.download(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A pasta de destino é resolvida (com a mesma validação de path seguro)
// nesta função do multer, chamada antes de gravar qualquer byte — nunca
// escreve fora de uma raiz permitida. O formulário do frontend manda
// `root`/`path` como campos ANTES do campo do arquivo, pra já estarem em
// `req.body` quando o multer decide o destino.
const upload = multer({
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const dest = fileManager.resolveUploadDestination(req.body.root, req.body.path || "");
        cb(null, dest);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      // Nome original, sem nenhuma parte de caminho embutida (evita
      // escapar da pasta de destino via nome de arquivo tipo "../../x").
      cb(null, path.basename(file.originalname));
    }
  })
});

app.post("/api/upload", auth.requireRole("admin"), (req, res) => {
  upload.single("file")(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    res.status(201).json({ ok: true, name: req.file.filename, sizeBytes: req.file.size });
  });
});

app.listen(PORT, () => {
  console.log(`nas-panel v${version} rodando em http://localhost:${PORT}`);
});
