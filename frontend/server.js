const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const axios = require("axios");

const app = express();
const buildDir = path.join(__dirname, "build");
const indexPath = path.join(buildDir, "index.html");

const DEFAULT_APP_NAME = process.env.REACT_APP_APP_NAME || "Whaticket";
const SETTINGS_TOKEN = process.env.ENV_TOKEN || "wtV";
const SETTINGS_TIMEOUT_MS = 3000;
const APP_NAME_CACHE_TTL_MS = 60 * 1000;

let cachedAppName = DEFAULT_APP_NAME;
let cachedAt = 0;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const withMetaTitle = (html, appName) => {
  const safeTitle = escapeHtml(appName);
  let updatedHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

  if (/<meta\s+property=["']og:title["']/i.test(updatedHtml)) {
    updatedHtml = updatedHtml.replace(
      /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    );
  } else {
    updatedHtml = updatedHtml.replace(
      /<\/head>/i,
      `  <meta property="og:title" content="${safeTitle}" />\n</head>`
    );
  }

  if (/<meta\s+name=["']twitter:title["']/i.test(updatedHtml)) {
    updatedHtml = updatedHtml.replace(
      /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`
    );
  } else {
    updatedHtml = updatedHtml.replace(
      /<\/head>/i,
      `  <meta name="twitter:title" content="${safeTitle}" />\n</head>`
    );
  }

  return updatedHtml;
};

const getPublicAppName = async () => {
  const now = Date.now();
  if (cachedAppName && now - cachedAt < APP_NAME_CACHE_TTL_MS) {
    return cachedAppName;
  }

  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  if (!backendUrl) {
    return cachedAppName || DEFAULT_APP_NAME;
  }

  try {
    const response = await axios.get(`${backendUrl}/public-settings/appName`, {
      params: { token: SETTINGS_TOKEN },
      timeout: SETTINGS_TIMEOUT_MS
    });

    const appName = String(response?.data || "").trim() || DEFAULT_APP_NAME;
    cachedAppName = appName;
    cachedAt = now;
    return appName;
  } catch (_) {
    return cachedAppName || DEFAULT_APP_NAME;
  }
};

app.use(express.static(buildDir));
app.get("/*", function (req, res) {
  (async () => {
    try {
      const [html, appName] = await Promise.all([
        fs.readFile(indexPath, "utf8"),
        getPublicAppName()
      ]);

      return res.status(200).send(withMetaTitle(html, appName));
    } catch (_) {
      return res.sendFile(indexPath);
    }
  })();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Frontend on http://localhost:" + port));
