const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// Papéis suportados por qualquer módulo do server-toolkit: "admin" (acesso
// completo) e "viewer" (só visualização — cada módulo decide, nas suas
// próprias rotas, o que exatamente "só visualização" bloqueia).
const ROLES = ["admin", "viewer"];

function createUserStore(dataDir) {
  const usersFile = path.join(dataDir, "users.json");

  function ensureDataDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }

  function readUsers() {
    ensureDataDir();
    if (!fs.existsSync(usersFile)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(usersFile, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // arquivo corrompido/parcial — mais seguro recomeçar vazio (o
      // bootstrap do .env recria o admin inicial) do que travar o login.
      return [];
    }
  }

  function writeUsers(users) {
    ensureDataDir();
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }

  function findByUsername(username) {
    return readUsers().find(
      u => u.username.toLowerCase() === String(username || "").toLowerCase()
    );
  }

  function listUsers() {
    // Nunca devolve o hash da senha pra fora deste arquivo.
    return readUsers().map(({ username, role, createdAt }) => ({
      username,
      role,
      createdAt
    }));
  }

  function countAdmins(users = readUsers()) {
    return users.filter(u => u.role === "admin").length;
  }

  function createUser({ username, password, role }) {
    const normalizedUsername = String(username || "").trim();
    if (normalizedUsername.length < 3) {
      throw new Error("Usuário precisa ter pelo menos 3 caracteres.");
    }
    if (!password || String(password).length < 6) {
      throw new Error("Senha precisa ter pelo menos 6 caracteres.");
    }
    if (!ROLES.includes(role)) {
      throw new Error(`Papel inválido: ${role}`);
    }

    const users = readUsers();
    if (findByUsername(normalizedUsername)) {
      throw new Error("Já existe um usuário com esse nome.");
    }

    const passwordHash = bcrypt.hashSync(String(password), 10);
    users.push({
      username: normalizedUsername,
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    });
    writeUsers(users);
    return { username: normalizedUsername, role };
  }

  function deleteUser(username) {
    const users = readUsers();
    const target = users.find(
      u => u.username.toLowerCase() === String(username || "").toLowerCase()
    );
    if (!target) {
      throw new Error("Usuário não encontrado.");
    }
    // Nunca deixa remover o último admin — sem isso dá pra trancar todo
    // mundo pra fora do painel sem nenhum jeito de voltar (sem acesso ao
    // disco pra editar o users.json na mão).
    if (target.role === "admin" && countAdmins(users) <= 1) {
      throw new Error("Não é possível remover o último administrador.");
    }
    const remaining = users.filter(
      u => u.username.toLowerCase() !== String(username || "").toLowerCase()
    );
    writeUsers(remaining);
  }

  function verifyPassword(username, password) {
    const user = findByUsername(username);
    if (!user) return null;
    const ok = bcrypt.compareSync(String(password || ""), user.passwordHash);
    return ok ? { username: user.username, role: user.role } : null;
  }

  // Compatibilidade com quem já rodava a versão antiga (usuário/senha
  // fixos no .env, sem tela de login): na primeira vez que sobe sem
  // nenhum usuário cadastrado, cria o admin inicial a partir do .env, pra
  // ninguém ficar trancado fora do próprio painel depois de atualizar.
  function migrateFromEnv({ username, password }) {
    const users = readUsers();
    if (users.length > 0) return false;
    if (!username || !password) return false;
    createUser({ username, password, role: "admin" });
    return true;
  }

  return {
    listUsers,
    createUser,
    deleteUser,
    verifyPassword,
    migrateFromEnv,
    countAdmins: () => countAdmins()
  };
}

module.exports = { createUserStore, ROLES };
