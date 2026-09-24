const path = require("path");

// Quando empacotado com `pkg` (executável único), `__dirname` aponta pro
// snapshot somente-leitura dentro do binário — dado real (histórico,
// configuração) e a pasta `public/` (servida como estático) precisam
// ficar ao LADO do executável no disco, não dentro dele. Rodando com
// `node server.js` direto (sem empacotar), cai no caminho normal do
// projeto.
const baseDir = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");

module.exports = {
  baseDir,
  dataDir: path.join(baseDir, "data"),
  publicDir: path.join(baseDir, "public")
};
