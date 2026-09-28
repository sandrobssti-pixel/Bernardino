const path = require("path");

// Mesmo padrão do disk-monitor: empacotado com `pkg`, `__dirname` cai
// dentro do snapshot somente-leitura do binário — dado real (config,
// usuários) e a pasta `public/` (servida como estático) precisam ficar ao
// LADO do executável no disco. Rodando com `node server.js` direto, cai no
// caminho normal do projeto.
const baseDir = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");

module.exports = {
  baseDir,
  dataDir: path.join(baseDir, "data"),
  publicDir: path.join(baseDir, "public")
};
