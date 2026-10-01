const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Varredura de limpeza "avançada" — só em categorias SEGURAS e bem
// conhecidas (cache, temporários, lixeira, pacotes antigos de gerenciador
// de pacotes). Deliberadamente NÃO faz:
// - "achar executáveis sem uso há muito tempo" — binário do sistema pode
//   ficar meses sem rodar e ainda ser essencial; apagar errado quebra o
//   SO do cliente. Isso nunca vai ser oferecido aqui.
// - "desfragmentação" — conceito obsoleto em SSD (desgasta à toa) e nem
//   existe no Linux/macOS modernos do jeito que existia no Windows antigo.
//
// Cada categoria sabe escanear (só leitura, soma tamanho) e limpar (ação
// explícita, sempre por escolha do usuário, nunca automática).

const platform = process.platform;
const isLinux = platform === "linux";
const isMac = platform === "darwin";
const isWindows = platform === "win32";

function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// Soma recursiva de tamanho — nunca segue symlink (evita contar em dobro
// ou cair num loop), e ignora silenciosamente o que sumiu/sem permissão
// entre o momento de listar e o de ler (comum em pastas de cache vivas).
function dirSize(dirPath) {
  let sizeBytes = 0;
  let itemCount = 0;
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          sizeBytes += fs.statSync(full).size;
          itemCount++;
        }
      } catch {
        // ignora — arquivo mudou/sumiu entre o readdir e o stat
      }
    }
  }
  return { sizeBytes, itemCount };
}

function removeContents(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return;
  }
  for (const name of entries) {
    fs.rmSync(path.join(dirPath, name), { recursive: true, force: true });
  }
}

function tempDirs() {
  if (isWindows) {
    return [process.env.TEMP, process.env.TMP].filter((p, i, arr) => p && arr.indexOf(p) === i);
  }
  const dirs = ["/tmp"];
  if (isMac) dirs.push("/private/var/tmp");
  return dirs;
}

function trashDirs() {
  if (isLinux) return [path.join(os.homedir(), ".local/share/Trash/files")];
  if (isMac) return [path.join(os.homedir(), ".Trash")];
  return []; // Windows: Lixeira usa IDs de usuário/API própria — não implementado ainda
}

function browserCacheDirs() {
  if (isLinux) {
    return [
      path.join(os.homedir(), ".cache/google-chrome"),
      path.join(os.homedir(), ".cache/chromium"),
      path.join(os.homedir(), ".cache/mozilla/firefox") // só o cache — NUNCA .mozilla/firefox (ali fica o perfil de verdade: senhas, favoritos)
    ];
  }
  if (isMac) {
    return [
      path.join(os.homedir(), "Library/Caches/Google/Chrome"),
      path.join(os.homedir(), "Library/Caches/Firefox")
    ];
  }
  if (isWindows && process.env.LOCALAPPDATA) {
    return [
      path.join(process.env.LOCALAPPDATA, "Google/Chrome/User Data/Default/Cache"),
      path.join(process.env.LOCALAPPDATA, "Microsoft/Edge/User Data/Default/Cache")
    ];
  }
  return [];
}

function packageCacheDirs() {
  if (isLinux) return ["/var/cache/apt/archives"];
  if (isMac) return [path.join(os.homedir(), "Library/Caches/Homebrew")];
  return []; // Windows não tem um cache de gerenciador de pacotes universal
}

// Revisões antigas de Snap (Linux) — o snapd mantém a versão anterior de
// cada app instalado pra permitir rollback; com o tempo isso acumula
// bastante espaço em pacotes que o usuário nunca mais vai usar.
function oldSnapRevisions() {
  if (!isLinux) return [];
  let out;
  try {
    out = execFileSync("snap", ["list", "--all"], { encoding: "utf8" });
  } catch {
    return [];
  }
  const items = [];
  const lines = out.split("\n").slice(1).filter(Boolean);
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6) continue;
    const [name, , rev, , , ...noteParts] = cols;
    const notes = noteParts.join(" ");
    if (!notes.includes("disabled")) continue;
    const snapFile = `/var/lib/snapd/snaps/${name}_${rev}.snap`;
    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(snapFile).size;
    } catch {
      // arquivo pode não existir mais — mantém na lista com tamanho 0
    }
    items.push({ name, rev, sizeBytes, path: snapFile });
  }
  return items;
}

function scanDirGroup(dirs) {
  const existing = dirs.filter(pathExists);
  let sizeBytes = 0;
  let itemCount = 0;
  for (const d of existing) {
    const r = dirSize(d);
    sizeBytes += r.sizeBytes;
    itemCount += r.itemCount;
  }
  return { sizeBytes, itemCount, paths: existing };
}

async function scanCleanupCategories() {
  const categories = [];

  const temp = scanDirGroup(tempDirs());
  categories.push({
    id: "tempFiles",
    sizeBytes: temp.sizeBytes,
    itemCount: temp.itemCount,
    supported: temp.paths.length > 0 || tempDirs().length > 0,
    paths: temp.paths
  });

  const trash = scanDirGroup(trashDirs());
  categories.push({
    id: "trash",
    sizeBytes: trash.sizeBytes,
    itemCount: trash.itemCount,
    supported: !isWindows,
    paths: trash.paths
  });

  const browserCache = scanDirGroup(browserCacheDirs());
  categories.push({
    id: "browserCache",
    sizeBytes: browserCache.sizeBytes,
    itemCount: browserCache.itemCount,
    supported: true,
    paths: browserCache.paths
  });

  const packageCache = scanDirGroup(packageCacheDirs());
  categories.push({
    id: "packageCache",
    sizeBytes: packageCache.sizeBytes,
    itemCount: packageCache.itemCount,
    supported: isLinux || isMac,
    paths: packageCache.paths
  });

  const oldSnaps = oldSnapRevisions();
  categories.push({
    id: "oldPackages",
    sizeBytes: oldSnaps.reduce((sum, i) => sum + i.sizeBytes, 0),
    itemCount: oldSnaps.length,
    supported: isLinux,
    items: oldSnaps
  });

  return { platform, categories };
}

// Execução real — cada categoria tratada isoladamente: falha numa não
// impede as outras de rodar. Sempre por seleção explícita (categoryIds),
// nunca "limpa tudo" implícito.
async function executeCleanupCategories(categoryIds) {
  const log = [];
  const ids = new Set(categoryIds || []);

  if (ids.has("tempFiles")) {
    for (const dir of tempDirs().filter(pathExists)) {
      try {
        removeContents(dir);
        log.push({ category: "tempFiles", target: dir, ok: true });
      } catch (err) {
        log.push({ category: "tempFiles", target: dir, ok: false, error: String(err.message || err) });
      }
    }
  }

  if (ids.has("trash")) {
    for (const dir of trashDirs().filter(pathExists)) {
      try {
        removeContents(dir);
        log.push({ category: "trash", target: dir, ok: true });
      } catch (err) {
        log.push({ category: "trash", target: dir, ok: false, error: String(err.message || err) });
      }
    }
  }

  if (ids.has("browserCache")) {
    for (const dir of browserCacheDirs().filter(pathExists)) {
      try {
        removeContents(dir);
        log.push({ category: "browserCache", target: dir, ok: true });
      } catch (err) {
        log.push({ category: "browserCache", target: dir, ok: false, error: String(err.message || err) });
      }
    }
  }

  if (ids.has("packageCache")) {
    try {
      if (isLinux) {
        execFileSync("apt-get", ["clean"], { timeout: 30000 });
        log.push({ category: "packageCache", target: "apt-get clean", ok: true });
      } else if (isMac) {
        for (const dir of packageCacheDirs().filter(pathExists)) {
          removeContents(dir);
        }
        log.push({ category: "packageCache", target: "Homebrew cache", ok: true });
      }
    } catch (err) {
      log.push({ category: "packageCache", target: "limpeza de cache de pacotes", ok: false, error: String(err.message || err) });
    }
  }

  if (ids.has("oldPackages") && isLinux) {
    for (const item of oldSnapRevisions()) {
      try {
        execFileSync("snap", ["remove", item.name, `--revision=${item.rev}`], { timeout: 30000 });
        log.push({ category: "oldPackages", target: `${item.name} (rev ${item.rev})`, ok: true });
      } catch (err) {
        log.push({ category: "oldPackages", target: `${item.name} (rev ${item.rev})`, ok: false, error: String(err.message || err) });
      }
    }
  }

  const freedBytes = log
    .filter(l => l.ok)
    .reduce((sum) => sum, 0); // tamanho exato pós-fato é recalculado via novo scan, não aqui

  return { ok: true, log, freedBytes };
}

module.exports = { scanCleanupCategories, executeCleanupCategories };
