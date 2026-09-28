const fs = require("fs");
const path = require("path");

// Regra de ouro deste arquivo: o navegador NUNCA sai das pastas listadas em
// NAS_ROOTS (.env) — nem por "..", nem por link simbólico apontando pra
// fora, nem por caminho absoluto disfarçado. Toda função aqui resolve o
// caminho real (fs.realpathSync, que segue e resolve symlinks) e confirma
// que ele continua dentro da raiz antes de ler/gravar qualquer coisa.

// NAS_ROOTS="Backups:/mnt/nas-backup,Seafile:/mnt/nas-seafile"
function parseRoots(envValue) {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const sepIndex = entry.indexOf(":");
      if (sepIndex === -1) {
        throw new Error(`NAS_ROOTS inválido: "${entry}" (esperado "Rótulo:/caminho")`);
      }
      const label = entry.slice(0, sepIndex).trim();
      const rootPath = entry.slice(sepIndex + 1).trim();
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return { key, label, rootPath: path.resolve(rootPath) };
    });
}

function createFileManager(rootsEnvValue) {
  const roots = parseRoots(rootsEnvValue);
  const rootsByKey = new Map(roots.map(r => [r.key, r]));

  function listRoots() {
    return roots.map(r => ({
      key: r.key,
      label: r.label,
      // Se a pasta não está montada (NAS caiu, por exemplo), avisa em vez
      // de deixar o navegador de arquivos quebrar em silêncio.
      mounted: fs.existsSync(r.rootPath)
    }));
  }

  // Resolve `relativePath` dentro da raiz `rootKey` e garante — depois de
  // resolver ".."/symlinks de verdade — que o resultado continua dentro
  // dela. Nunca confia só na string do caminho (fácil de disfarçar); usa
  // o caminho real no disco.
  function resolveSafePath(rootKey, relativePath) {
    const root = rootsByKey.get(rootKey);
    if (!root) throw new Error("Pasta raiz desconhecida.");
    if (!fs.existsSync(root.rootPath)) {
      throw new Error(`${root.label} não está montada no momento.`);
    }

    const cleanRelative = String(relativePath || "").replace(/^[/\\]+/, "");
    const candidate = path.resolve(root.rootPath, cleanRelative);

    const realRoot = fs.realpathSync(root.rootPath);
    // O próprio arquivo/pasta final pode ainda não existir (ex.: destino
    // de upload) — resolve o real path do pai, que sempre já existe.
    const parent = fs.existsSync(candidate) ? candidate : path.dirname(candidate);
    const realParent = fs.realpathSync(parent);

    const withinRoot =
      realParent === realRoot || realParent.startsWith(realRoot + path.sep);
    if (!withinRoot) {
      throw new Error("Caminho fora da pasta permitida.");
    }

    return candidate;
  }

  function listDir(rootKey, relativePath) {
    const absPath = resolveSafePath(rootKey, relativePath);
    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) throw new Error("Não é uma pasta.");

    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    return entries
      .map(entry => {
        const entryPath = path.join(absPath, entry.name);
        let entryStat;
        try {
          entryStat = fs.statSync(entryPath);
        } catch {
          return null; // link quebrado, permissão negada, etc. — pula
        }
        return {
          name: entry.name,
          isDir: entryStat.isDirectory(),
          sizeBytes: entryStat.isDirectory() ? null : entryStat.size,
          modifiedAt: entryStat.mtime.toISOString()
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function getFileForDownload(rootKey, relativePath) {
    const absPath = resolveSafePath(rootKey, relativePath);
    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) return absPath;
    throw new Error("Não é possível baixar uma pasta inteira.");
  }

  // Usado pelo multer pra decidir onde salvar o upload — mesma validação
  // de caminho seguro, nunca escreve fora da raiz escolhida.
  function resolveUploadDestination(rootKey, relativePath) {
    const destDir = resolveSafePath(rootKey, relativePath);
    const stat = fs.existsSync(destDir) ? fs.statSync(destDir) : null;
    if (!stat || !stat.isDirectory()) {
      throw new Error("Pasta de destino do upload não existe.");
    }
    return destDir;
  }

  return {
    listRoots,
    listDir,
    getFileForDownload,
    resolveUploadDestination
  };
}

module.exports = { createFileManager, parseRoots };
