/*
 * Carimba o service-worker.js do build com um identificador único a cada
 * deploy, forçando o navegador a detectar a atualização automaticamente
 * (sem precisar de ctrl+F5 ou relogar).
 */
const fs = require("fs");
const path = require("path");

const swPath = path.join(__dirname, "..", "build", "service-worker.js");

if (!fs.existsSync(swPath)) {
	console.warn("[stamp-sw] build/service-worker.js não encontrado, pulando.");
	process.exit(0);
}

const buildId = new Date().toISOString();
const stamp = `\n// build: ${buildId}\n`;

fs.appendFileSync(swPath, stamp);
console.log(`[stamp-sw] service-worker.js carimbado com build ${buildId}`);
