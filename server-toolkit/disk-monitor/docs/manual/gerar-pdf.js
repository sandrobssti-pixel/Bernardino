// Gera docs/Manual-Disk-Monitor.pdf a partir de docs/manual/manual.html.
// Uso: node docs/manual/gerar-pdf.js   (precisa do pacote "playwright"
// instalado — local ou global — e de um Chromium).
const path = require("path");
const { version } = require("../../lib/version");

const loadPlaywright = () => {
  try {
    return require("playwright");
  } catch {
    const globalRoot = require("child_process").execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, "playwright"));
  }
};

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.join(__dirname, "manual.html"), { waitUntil: "load" });
  const out = path.join(__dirname, "..", "Manual-Disk-Monitor.pdf");
  await page.pdf({
    path: out,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-size:7.5pt;color:#64748b;width:100%;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">
      <span>Disk Monitor v${version} — Confianza Technologies</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "16mm", bottom: "18mm", left: "0", right: "0" }
  });
  await browser.close();
  console.log("PDF gerado:", out);
})();
