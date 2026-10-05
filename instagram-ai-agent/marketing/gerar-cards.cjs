// CommonJS (o package.json do agente é "type": "module").
// Gera os cards de vendas em PNG (1080x1350) nos 3 idiomas.
// Uso: node marketing/gerar-cards.cjs  (precisa do "playwright" + Chromium).
const path = require("path");

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
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const names = { pt: "card-agente-ia-instagram-pt-BR.png", es: "card-agente-ia-instagram-es.png", en: "card-agente-ia-instagram-en-US.png" };
  for (const [lang, file] of Object.entries(names)) {
    await page.goto("file://" + path.join(__dirname, "card.html") + "?lang=" + lang);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, file) });
    console.log("gerado:", file);
  }
  await browser.close();
})();
