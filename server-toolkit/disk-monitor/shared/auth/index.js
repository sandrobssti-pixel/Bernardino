const cookieSession = require("cookie-session");
const { createUserStore, ROLES } = require("./userStore");

// Sistema de login (admin / usuário limitado) reaproveitável por
// qualquer módulo do server-toolkit. Cada módulo:
//   1. chama `createAuthSystem({ dataDir, sessionSecret, envBootstrap })`
//   2. `app.use(auth.sessionMiddleware)`
//   3. `app.use("/api", auth.router)` — expõe /api/login, /api/logout,
//      /api/me, e (só admin) /api/users
//   4. usa `auth.requireAuth` / `auth.requireRole("admin")` nas próprias
//      rotas que precisam de login/permissão.
function createAuthSystem({ dataDir, sessionSecret, envBootstrap }) {
  const users = createUserStore(dataDir);

  if (envBootstrap?.username && envBootstrap?.password) {
    users.migrateFromEnv(envBootstrap);
  }

  const sessionMiddleware = cookieSession({
    name: "toolkit-session",
    secret: sessionSecret,
    maxAge: 12 * 60 * 60 * 1000, // 12h — painel de operação, não precisa durar dias
    httpOnly: true,
    sameSite: "lax"
  });

  function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    return res.status(401).json({ error: "ERR_NOT_AUTHENTICATED" });
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (!req.session?.user) {
        return res.status(401).json({ error: "ERR_NOT_AUTHENTICATED" });
      }
      if (req.session.user.role !== role) {
        return res.status(403).json({ error: "ERR_FORBIDDEN" });
      }
      return next();
    };
  }

  const express = require("express");
  const router = express.Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body || {};
    const user = users.verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({ error: "ERR_INVALID_CREDENTIALS" });
    }
    req.session.user = user;
    res.json(user);
  });

  router.post("/logout", (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json(req.session.user);
  });

  router.get("/users", requireRole("admin"), (req, res) => {
    res.json(users.listUsers());
  });

  router.post("/users", requireRole("admin"), (req, res) => {
    try {
      const { username, password, role } = req.body || {};
      const created = users.createUser({ username, password, role });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete("/users/:username", requireRole("admin"), (req, res) => {
    try {
      // Ninguém remove a própria conta logada por aqui — evita o operador
      // se trancar fora do painel no meio de uma sessão.
      if (
        req.params.username.toLowerCase() ===
        req.session.user.username.toLowerCase()
      ) {
        return res
          .status(400)
          .json({ error: "Não é possível remover o usuário logado no momento." });
      }
      users.deleteUser(req.params.username);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return {
    sessionMiddleware,
    requireAuth,
    requireRole,
    router,
    users
  };
}

module.exports = { createAuthSystem, ROLES };
