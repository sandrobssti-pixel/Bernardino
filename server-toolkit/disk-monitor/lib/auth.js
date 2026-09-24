// Autenticação básica HTTP — esse painel roda limpeza de disco, então
// nunca pode ficar acessível sem senha. Combine com acesso só via VPN/túnel
// SSH (não expor a porta direto na internet) — ver README.md.
function basicAuth(username, password) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const [scheme, encoded] = header.split(" ");

    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const separatorIndex = decoded.indexOf(":");
      const user = decoded.slice(0, separatorIndex);
      const pass = decoded.slice(separatorIndex + 1);

      if (user === username && pass === password) {
        return next();
      }
    }

    res.set("WWW-Authenticate", 'Basic realm="vps-monitor"');
    return res.status(401).send("Autenticação necessária.");
  };
}

module.exports = { basicAuth };
