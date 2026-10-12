const fs = require("fs");
const net = require("net");

// Status de rede do NAS (somente leitura — não executa nada no NAS):
// descobre o(s) IP(s) do NAS (DSM_HOST do .env + servidor das montagens
// SMB/NFS das pastas de NAS_ROOTS) e testa se respondem por TCP.

const PROBE_TIMEOUT_MS = 2500;

// Linhas de /proc/mounts: "<origem> <ponto> <tipo> <opções> 0 0". Espaços
// no ponto de montagem vêm escapados como \040.
function parseMountSources(mountsText) {
  const result = [];
  for (const line of String(mountsText || "").split("\n")) {
    const parts = line.split(" ");
    if (parts.length < 3) continue;
    const source = parts[0];
    const mountPoint = parts[1].replace(/\\040/g, " ");
    const fsType = parts[2];
    let host = null;
    let protocol = null;
    if (fsType === "cifs" || fsType === "smb3") {
      const m = source.match(/^\/\/([^/]+)\//);
      if (m) { host = m[1]; protocol = "SMB"; }
    } else if (fsType.startsWith("nfs")) {
      const m = source.match(/^\[?([^\]]+?)\]?:\//);
      if (m) { host = m[1]; protocol = "NFS"; }
    }
    // Só o host — nunca usuário/senha (nem existem em /proc/mounts, mas
    // descarta qualquer "user@" por garantia).
    if (host) host = host.replace(/^.*@/, "");
    if (host && /^[A-Za-z0-9.:_-]+$/.test(host)) {
      result.push({ host, protocol, mountPoint });
    }
  }
  return result;
}

function probe(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise(resolve => {
    const started = Date.now();
    let done = false;
    const socket = net.connect({ host, port });
    const finish = online => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ online, latencyMs: online ? Date.now() - started : null });
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}

function createNasStatus({ fileManager, dsmHost, dsmPort, mountsPath = "/proc/mounts" }) {
  function getMountSources() {
    if (!fileManager) return [];
    let text;
    try {
      text = fs.readFileSync(mountsPath, "utf8");
    } catch {
      return []; // fora do Linux não existe /proc/mounts
    }
    const roots = fileManager.listRoots();
    const rootPaths = fileManager.rootPaths ? fileManager.rootPaths() : [];
    return parseMountSources(text)
      .map(m => {
        const root = rootPaths.find(r => r.rootPath === m.mountPoint);
        const label = root ? (roots.find(x => x.key === root.key) || {}).label : null;
        return label ? { ...m, label } : null;
      })
      .filter(Boolean);
  }

  function isConfigured() {
    return !!dsmHost || !!fileManager;
  }

  async function getStatus() {
    // IP -> { ip, sources: [...], ports: Set }
    const byIp = new Map();
    const add = (ip, source, port) => {
      if (!byIp.has(ip)) byIp.set(ip, { ip, sources: [], ports: new Set() });
      const entry = byIp.get(ip);
      if (!entry.sources.includes(source)) entry.sources.push(source);
      entry.ports.add(port);
    };
    if (dsmHost) add(dsmHost, "DSM", dsmPort);
    for (const m of getMountSources()) {
      add(m.host, `${m.label} (${m.protocol})`, m.protocol === "NFS" ? 2049 : 445);
    }
    const checkedAt = new Date().toISOString();
    const nas = await Promise.all([...byIp.values()].map(async e => {
      // Online se QUALQUER uma das portas esperadas responde.
      const results = await Promise.all([...e.ports].map(p => probe(e.ip, p)));
      const ok = results.filter(r => r.online);
      return {
        ip: e.ip,
        sources: e.sources,
        online: ok.length > 0,
        latencyMs: ok.length ? Math.min(...ok.map(r => r.latencyMs)) : null,
        checkedAt
      };
    }));
    return { nas, checkedAt };
  }

  return { getStatus, isConfigured };
}

module.exports = { createNasStatus, parseMountSources, probe };
