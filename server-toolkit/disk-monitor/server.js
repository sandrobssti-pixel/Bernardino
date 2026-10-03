const path = require("path");
const { baseDir, publicDir } = require("./lib/paths");

// Carrega o .env de ao lado do executável/projeto, nunca do cwd de onde
// o processo foi chamado — assim funciona igual rodando com `node
// server.js` dentro da pasta ou rodando o binário empacotado de
// qualquer diretório (ex.: chamado pelo systemd).
require("dotenv").config({ path: path.join(baseDir, ".env") });

const express = require("express");
const cron = require("node-cron");
const multer = require("multer");

const { readDiskUsage } = require("./lib/diskUsage");
const { readDiskTopology } = require("./lib/diskTopology");
const { checkDiskHealth } = require("./lib/diskHealth");
const { previewPartition, startPartitionExecution, getPartitionJobStatus, CONFIRM_PHRASE } = require("./lib/diskPartition");
const { listMountablePartitions, previewMount, executeMount } = require("./lib/diskMount");
const { scanCleanupCategories, executeCleanupCategories } = require("./lib/diskCleanupScan");
const { findMirrorCandidates, buildMirrorRunbook } = require("./lib/raidMirror");
const { createFileManager } = require("./lib/fileManager");
const { createSynologyClient } = require("./lib/synologyApi");
const { runCleanup } = require("./lib/cleanup");
const { getConfig, updateConfig } = require("./lib/configStore");
const {
  readAllDisks,
  readCpuLoad,
  readMemory,
  readTopProcesses
} = require("./lib/systemStats");
const {
  appendReading,
  getHistory,
  appendAction,
  getActions,
  appendCpuReading,
  getCpuHistory,
  appendMemReading,
  getMemHistory,
  appendDisksReading,
  getDisksHistory
} = require("./lib/historyStore");
const { ensureMachineProfile, getMachineProfile } = require("./lib/machineProfile");
const { version } = require("./lib/version");
const { createAuthSystem } = require("toolkit-auth");
const { dataDir } = require("./lib/paths");

const PORT = process.env.PORT || 8091;
// Sem MOUNT_PATH configurado, usa a raiz de cada sistema: "/" no
// Linux, unidade do sistema (normalmente "C:") no Windows.
const MOUNT_PATH =
  process.env.MOUNT_PATH ||
  (process.platform === "win32" ? `${process.env.SystemDrive || "C:"}\\` : "/");
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error(
    "SESSION_SECRET não definido no .env — configure antes de rodar (ver .env.example)."
  );
  process.exit(1);
}

// Compatibilidade com quem já rodava a versão antiga (usuário/senha fixos
// no .env, sem tela de login): se ainda não existe nenhum usuário
// cadastrado, DASHBOARD_USER/DASHBOARD_PASSWORD viram o admin inicial —
// depois disso o gerenciamento passa a ser todo pela tela de Usuários.
const auth = createAuthSystem({
  dataDir,
  sessionSecret: SESSION_SECRET,
  envBootstrap: {
    username: process.env.DASHBOARD_USER,
    password: process.env.DASHBOARD_PASSWORD
  }
});

// Painel do NAS (opcional) — sem NAS_ROOTS configurado no .env, fica
// `null` e a seção de arquivos/discos do NAS simplesmente não aparece no
// painel; o resto do disk-monitor funciona normalmente. Pensado pra isso
// já vir "de fábrica" em qualquer servidor novo — só liga configurando
// as variáveis, sem precisar instalar nada a mais.
const fileManager = process.env.NAS_ROOTS ? createFileManager(process.env.NAS_ROOTS) : null;
const NAS_MAX_UPLOAD_MB = Number(process.env.NAS_MAX_UPLOAD_MB || 2048);

// Integração com a API do Synology DSM (discos/desligamento) — também
// opcional e independente do navegador de arquivos acima.
const synologyClient = createSynologyClient({
  host: process.env.DSM_HOST,
  port: Number(process.env.DSM_PORT || 5001),
  useHttps: process.env.DSM_HTTPS !== "false",
  user: process.env.DSM_USER,
  password: process.env.DSM_PASSWORD,
  // Um Synology na rede local praticamente sempre usa certificado
  // autoassinado por padrão (poucos clientes configuram um certificado
  // de verdade pro IP interno do NAS) — por isso aceita autoassinado
  // por padrão aqui, e só recusa se o cliente explicitamente marcar
  // DSM_ALLOW_SELF_SIGNED=false (caso tenha um certificado válido).
  allowSelfSigned: process.env.DSM_ALLOW_SELF_SIGNED !== "false",
  deviceId: process.env.DSM_DEVICE_ID
});

const app = express();
app.use(express.json());
app.use(auth.sessionMiddleware);
app.use("/api", auth.router);
app.use(express.static(publicDir));

let cleanupRunning = false;

// Só uma limpeza por vez — evita duas execuções concorrentes (uma
// automática batendo com um clique manual) brigando pelos mesmos
// recursos do Docker.
async function triggerCleanup(trigger) {
  if (cleanupRunning) {
    return { skipped: true, reason: "já tem uma limpeza em andamento" };
  }
  cleanupRunning = true;
  try {
    const before = await readDiskUsage(MOUNT_PATH);
    const config = getConfig();
    const result = runCleanup(config, before);
    const after = await readDiskUsage(MOUNT_PATH);

    const freedBytes = Math.max(0, before.usedBytes - after.usedBytes);

    const action = {
      timestamp: new Date().toISOString(),
      trigger,
      percentBefore: before.percent,
      percentAfter: after.percent,
      freedMB: Math.round(freedBytes / 1024 / 1024),
      steps: result.steps
    };
    appendAction(action);
    return action;
  } finally {
    cleanupRunning = false;
  }
}

// Roda na mesma amostragem periódica do disco monitorado (mesmo cron,
// mesmo intervalo configurável) — CPU, RAM e a lista de todos os discos
// detectados não entram na decisão de limpeza automática (só o disco
// monitorado por MOUNT_PATH aciona isso), são só pra alimentar os
// gráficos de histórico do painel.
async function sampleSystemStats() {
  const [cpu, mem, disks] = await Promise.all([
    readCpuLoad(),
    readMemory(),
    readAllDisks()
  ]);
  appendCpuReading(cpu);
  appendMemReading(mem);
  appendDisksReading(disks);
}

// Janela "ao vivo" de CPU/RAM pro painel — em memória, nunca em disco:
// amostra a cada 5s (independente do intervalo de checagem do disco, que é
// configurável e normalmente bem mais espaçado). Guarda só os últimos ~10
// minutos, o suficiente pra um gráfico de tempo real de verdade sem virar
// um banco de série histórica.
const LIVE_SAMPLE_INTERVAL_MS = 5000;
const LIVE_MAX_POINTS = 120;
const liveCpuHistory = [];
const liveMemHistory = [];

async function sampleLiveStats() {
  const [cpu, mem] = await Promise.all([readCpuLoad(), readMemory()]);
  liveCpuHistory.push(cpu);
  liveMemHistory.push(mem);
  if (liveCpuHistory.length > LIVE_MAX_POINTS) liveCpuHistory.shift();
  if (liveMemHistory.length > LIVE_MAX_POINTS) liveMemHistory.shift();
}

sampleLiveStats().catch(err => console.error("Falha na amostragem inicial ao vivo:", err));
setInterval(() => {
  sampleLiveStats().catch(err => console.error("Falha ao amostrar CPU/RAM ao vivo:", err));
}, LIVE_SAMPLE_INTERVAL_MS);

async function checkDiskAndMaybeClean() {
  const reading = await readDiskUsage(MOUNT_PATH);
  appendReading(reading);

  await sampleSystemStats().catch(err =>
    console.error("Falha ao amostrar CPU/RAM/discos:", err)
  );

  const config = getConfig();
  if (config.autoCleanupEnabled && reading.percent >= config.thresholdPercent) {
    await triggerCleanup("auto");
  }
}

app.get("/api/status", auth.requireAuth, async (req, res) => {
  const config = getConfig();
  const history = getHistory();
  const current = history[history.length - 1] || (await readDiskUsage(MOUNT_PATH));

  const cpuHistory = getCpuHistory();
  const memHistory = getMemHistory();
  const disksHistory = getDisksHistory();

  // Discos e CPU/RAM "agora": se ainda não rodou nenhuma amostragem (painel
  // recém-instalado), lê na hora em vez de esperar o próximo tick do cron.
  const disks = disksHistory.length
    ? disksHistory[disksHistory.length - 1].disks
    : (await readAllDisks()).map(d => ({ mount: d.mount, percent: d.percent }));
  const cpuCurrent = cpuHistory[cpuHistory.length - 1] || (await readCpuLoad());
  const memCurrent = memHistory[memHistory.length - 1] || (await readMemory());

  res.json({
    current,
    history,
    disks,
    disksHistory,
    cpuCurrent,
    cpuHistory,
    memCurrent,
    memHistory,
    actions: getActions(),
    config,
    cleanupRunning,
    version
  });
});

// CPU/RAM em tempo real (janela ao vivo em memória, amostrada a cada 5s —
// ver sampleLiveStats acima) + discos sempre lidos na hora, com bytes
// completos (precisão total pro card de cada disco, não só o percentual).
app.get("/api/live", auth.requireAuth, async (req, res) => {
  const disks = await readAllDisks();
  res.json({
    cpuHistory: liveCpuHistory,
    memHistory: liveMemHistory,
    disks
  });
});

// Perfil da máquina (hardware/SO) — varrido uma vez só, na instalação (ver
// ensureMachineProfile mais abaixo), não muda a cada request.
app.get("/api/machine-profile", auth.requireAuth, (req, res) => {
  res.json({ profile: getMachineProfile() });
});

// Discos físicos agrupados com suas partições, mais USB e compartilhamentos
// de rede separados (ver lib/diskTopology.js) — sempre lido na hora (não
// entra no histórico, é caro demais pra amostrar a cada poucos segundos).
app.get("/api/disk-topology", auth.requireAuth, async (req, res) => {
  try {
    const topology = await readDiskTopology(MOUNT_PATH);
    res.json(topology);
  } catch (err) {
    console.error("[disk-monitor] Falha ao ler topologia de discos:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Diagnóstico sob demanda de UM disco físico (SMART + log do kernel) —
// só leitura, nunca corrige nada sozinho (ver lib/diskHealth.js).
app.get("/api/disk-health", auth.requireAuth, (req, res) => {
  if (!req.query.device) {
    return res.status(400).json({ error: "Parâmetro 'device' obrigatório." });
  }
  try {
    const report = checkDiskHealth(req.query.device);
    res.json(report);
  } catch (err) {
    console.error("[disk-monitor] Falha ao verificar saúde do disco:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Particionar/formatar disco inteiro — dividido em três etapas visíveis
// e independentes (delete/create/format, ver lib/diskPartition.js), cada
// uma com seu próprio botão na tela. `preview` só monta o texto dos
// comandos daquela etapa (nunca executa nada); `execute` reconfere a
// elegibilidade de novo. A confirmação pesada (caminho do disco + frase,
// igual ao desligamento do NAS) só é exigida na etapa "delete" — a única
// de verdade irreversível (apagar dado existente); "create"/"format" só
// mexem num disco que a própria etapa "delete" já deixou vazio.
const PARTITION_PHASES = new Set(["delete", "create", "format"]);
const GB_BYTES = 1024 ** 3;

// "120,  " (query, separado por vírgula) ou [120] (body, array) — GB por
// partição, EXCETO a última (que sempre fica com o resto do disco). Um
// valor inválido/vazio em qualquer posição derruba o array inteiro —
// describeScheme() então cai sozinho no modo de divisão igual, nunca
// tenta adivinhar o que o técnico quis dizer com um valor faltando.
function parseCustomSizesBytes(raw) {
  if (raw == null || raw === "") return undefined;
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  const bytes = list.map(v => Number(v) * GB_BYTES);
  return bytes.every(b => Number.isFinite(b) && b > 0) ? bytes : undefined;
}

app.get("/api/disk-partition/preview", auth.requireRole("admin"), async (req, res) => {
  if (!req.query.device) {
    return res.status(400).json({ error: "Parâmetro 'device' obrigatório." });
  }
  const phase = PARTITION_PHASES.has(req.query.phase) ? req.query.phase : "delete";
  const customSizesBytes = parseCustomSizesBytes(req.query.customSizesGB);
  try {
    const preview = await previewPartition(req.query.device, req.query.scheme, req.query.fsType, phase, req.query.partitionCount, customSizesBytes);
    res.json({ ...preview, confirmPhrase: CONFIRM_PHRASE });
  } catch (err) {
    console.error("[disk-monitor] Falha ao montar prévia de particionamento:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/disk-partition/execute", auth.requireRole("admin"), async (req, res) => {
  const { device, scheme, fsType, phase, partitionCount, customSizesGB, confirmDevice, confirmPhrase } = req.body || {};
  if (!device) {
    return res.status(400).json({ error: "Parâmetro 'device' obrigatório." });
  }
  const normalizedPhase = PARTITION_PHASES.has(phase) ? phase : "delete";
  const customSizesBytes = parseCustomSizesBytes(customSizesGB);
  // Só a etapa que apaga dado existente pede a confirmação em duas
  // camadas — criar partição num disco já vazio ou formatar uma partição
  // recém-criada não tem nada de usuário pra perder.
  if (normalizedPhase === "delete") {
    if (confirmDevice !== device) {
      return res.status(400).json({ error: "O caminho do disco digitado não confere." });
    }
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return res.status(400).json({ error: `Confirmação inválida — digite exatamente "${CONFIRM_PHRASE}".` });
    }
  }
  try {
    console.log(
      `[disk-monitor] Etapa "${normalizedPhase}" de particionamento de "${device}" disparada por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    const { jobId, totalSteps } = await startPartitionExecution(device, scheme, fsType, normalizedPhase, partitionCount, customSizesBytes);
    res.json({ jobId, totalSteps });
  } catch (err) {
    console.error("[disk-monitor] Falha ao iniciar etapa de particionamento:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Progresso da formatação em andamento — o painel consulta isso a cada
// poucos segundos pra mostrar a barra de % (ver lib/diskPartition.js).
app.get("/api/disk-partition/execute/status", auth.requireRole("admin"), (req, res) => {
  const job = getPartitionJobStatus(req.query.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job não encontrado (pode já ter expirado)." });
  }
  res.json(job);
});

// Montar uma partição existente (ex.: HD extra plugado sem ponto de
// montagem) e, se pedido, deixar persistente no /etc/fstab — ver
// lib/diskMount.js pras camadas de proteção (só /mnt ou /media, backup
// do fstab, nunca duplica entrada).
app.get("/api/disk-mount/list", auth.requireRole("admin"), async (req, res) => {
  try {
    const partitions = await listMountablePartitions();
    res.json({ partitions });
  } catch (err) {
    console.error("[disk-monitor] Falha ao listar partições sem montar:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/disk-mount/preview", auth.requireRole("admin"), async (req, res) => {
  if (!req.query.device || !req.query.mountPoint) {
    return res.status(400).json({ error: "Parâmetros 'device' e 'mountPoint' obrigatórios." });
  }
  try {
    const preview = await previewMount(req.query.device, req.query.mountPoint);
    res.json(preview);
  } catch (err) {
    console.error("[disk-monitor] Falha ao montar prévia de montagem de disco:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/disk-mount/execute", auth.requireRole("admin"), async (req, res) => {
  const { device, mountPoint, persist } = req.body || {};
  if (!device || !mountPoint) {
    return res.status(400).json({ error: "Parâmetros 'device' e 'mountPoint' obrigatórios." });
  }
  try {
    console.log(
      `[disk-monitor] Montagem de "${device}" em "${mountPoint}" disparada por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    const result = await executeMount(device, mountPoint, !!persist);
    res.json(result);
  } catch (err) {
    console.error("[disk-monitor] Falha ao montar disco:", err.message, err.log || "");
    res.status(500).json({ error: err.message, log: err.log || [] });
  }
});

// Varredura de limpeza avançada por categorias (cache, temporários,
// lixeira, pacotes antigos) — ver lib/diskCleanupScan.js pro porquê de
// deliberadamente NÃO incluir "executáveis sem uso" nem "desfragmentação".
app.get("/api/disk-cleanup-scan", auth.requireRole("admin"), async (req, res) => {
  try {
    const result = await scanCleanupCategories();
    res.json(result);
  } catch (err) {
    console.error("[disk-monitor] Falha na varredura de limpeza:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/disk-cleanup-scan/execute", auth.requireRole("admin"), async (req, res) => {
  const { categoryIds } = req.body || {};
  if (!Array.isArray(categoryIds) || !categoryIds.length) {
    return res.status(400).json({ error: "Selecione ao menos uma categoria pra limpar." });
  }
  try {
    console.log(
      `[disk-monitor] Limpeza avançada (${categoryIds.join(", ")}) disparada por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    const result = await executeCleanupCategories(categoryIds);
    res.json(result);
  } catch (err) {
    console.error("[disk-monitor] Falha na limpeza avançada:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Espelhamento RAID1 do disco do SISTEMA — só leitura e geração de texto,
// NUNCA executa nada (ver lib/raidMirror.js pro porquê: é a única ação
// deste painel que não vira botão automático, por risco de deixar o
// servidor sem conseguir ligar).
app.get("/api/raid-mirror/candidates", auth.requireRole("admin"), async (req, res) => {
  try {
    const result = await findMirrorCandidates(MOUNT_PATH);
    res.json(result);
  } catch (err) {
    console.error("[disk-monitor] Falha ao buscar candidatos a espelhamento:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/raid-mirror/runbook", auth.requireRole("admin"), async (req, res) => {
  if (!req.query.targetDevice) {
    return res.status(400).json({ error: "Parâmetro 'targetDevice' obrigatório." });
  }
  try {
    const runbook = await buildMirrorRunbook(req.query.targetDevice, MOUNT_PATH);
    res.json(runbook);
  } catch (err) {
    console.error("[disk-monitor] Falha ao gerar roteiro de espelhamento:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lista de processos é sempre lida na hora (nunca fica em cache/histórico)
// — é o que dá o efeito de "tempo real" pedido pelo cliente.
app.get("/api/processes", auth.requireAuth, async (req, res) => {
  const processes = await readTopProcesses(15);
  res.json({ processes });
});

// ---------- Painel do NAS (arquivos + Synology DSM) ----------
// Tudo abaixo é opcional — sem NAS_ROOTS no .env, os endpoints respondem
// 501 e a seção correspondente do painel fica escondida no frontend.

app.get("/api/nas/roots", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado (ver .env.example)." });
  }
  res.json({ roots: fileManager.listRoots(), dsmConfigured: !!synologyClient });
});

app.get("/api/nas/browse", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
  try {
    const entries = fileManager.listDir(req.query.root, req.query.path || "");
    res.json({ entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Visualizador também baixa — só upload (escrita) e desligamento são
// exclusivos de admin, mesma regra de permissão já usada no resto do painel.
app.get("/api/nas/download", auth.requireAuth, (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
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
const nasUpload = multer({
  limits: { fileSize: NAS_MAX_UPLOAD_MB * 1024 * 1024 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const dest = fileManager.resolveUploadDestination(req.body.root, req.body.path || "");
        cb(null, dest);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => cb(null, path.basename(file.originalname))
  })
});

app.post("/api/nas/upload", auth.requireRole("admin"), (req, res) => {
  if (!fileManager) {
    return res.status(501).json({ error: "Painel do NAS não configurado." });
  }
  nasUpload.single("file")(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });
    res.status(201).json({ ok: true, name: req.file.filename, sizeBytes: req.file.size });
  });
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
    console.error("[disk-monitor] Falha ao ler discos do DSM:", err.message);
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
      `[disk-monitor] Desligamento do NAS disparado por "${req.session.user.username}" em ${new Date().toISOString()}`
    );
    await synologyClient.shutdown();
    res.json({ ok: true });
  } catch (err) {
    console.error("[disk-monitor] Falha ao desligar o NAS via DSM:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Usuário "viewer" só acompanha o painel — mudar configuração e disparar
// limpeza manual é exclusivo de "admin" (decisão do cliente).
app.post("/api/config", auth.requireRole("admin"), (req, res) => {
  const allowedKeys = [
    "thresholdPercent",
    "checkIntervalMinutes",
    "autoCleanupEnabled",
    "dockerLogMaxSizeMB",
    "tmpFilesOlderThanDays",
    "systemLogsOlderThanDays"
  ];
  const partial = {};
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) partial[key] = req.body[key];
  }
  const config = updateConfig(partial);
  res.json(config);
});

app.post("/api/cleanup", auth.requireRole("admin"), async (req, res) => {
  const result = await triggerCleanup("manual");
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`disk-monitor v${version} rodando em http://localhost:${PORT}`);
  // Estado do NAS/DSM sempre visível no log de boot — se algum dia isso
  // "sumir" sem ninguém mexer, aparece aqui na hora (journalctl -u
  // disk-monitor), sem precisar caçar manualmente dentro do .env.
  console.log(
    `[disk-monitor] Painel do NAS: ${fileManager ? "ATIVO" : "inativo (NAS_ROOTS não configurado)"} | ` +
    `Synology DSM: ${synologyClient ? "ATIVO" : "inativo (DSM_HOST/DSM_USER/DSM_PASSWORD não configurados)"}`
  );
});

// Roda a primeira leitura já na subida (não espera o primeiro tick do
// cron) pra o painel não abrir vazio.
checkDiskAndMaybeClean().catch(err =>
  console.error("Falha na checagem inicial de disco:", err)
);

// Varredura de hardware/SO — só roda de verdade na primeira vez (ver
// ensureMachineProfile), então é barato chamar sempre na subida.
ensureMachineProfile().catch(err =>
  console.error("Falha na varredura de hardware/SO:", err)
);

// Reagenda a cada minuto e decide, olhando o config atual, se já passou o
// intervalo configurado — assim dá pra mudar `checkIntervalMinutes` pelo
// painel sem precisar reiniciar o processo pra ele valer.
let lastCheckAt = Date.now();
cron.schedule("* * * * *", () => {
  const config = getConfig();
  const intervalMs = Math.max(1, config.checkIntervalMinutes) * 60 * 1000;
  if (Date.now() - lastCheckAt >= intervalMs) {
    lastCheckAt = Date.now();
    checkDiskAndMaybeClean().catch(err =>
      console.error("Falha na checagem periódica de disco:", err)
    );
  }
});
