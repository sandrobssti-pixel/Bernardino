import crypto from "crypto";

// Criptografia simétrica (AES-256-GCM) só pra senha do gov.br do cliente do
// Despachante Bélico (WeaponDispatchClient.govBrPasswordEncrypted) — pedido
// explícito do cliente: nunca guardar essa senha em texto puro (era assim
// no Notion hoje, campo "SENHA GOV"), e toda LEITURA do valor decifrado
// precisa ficar registrada em auditoria (ver WeaponDispatchGovPasswordAccessLog
// e WeaponDispatchClientService.getGovPassword — nunca descriptografar fora
// dali). Ver docs/MANUAL_TECNICO.md.
//
// Chave vem de `WEAPON_DISPATCH_ENCRYPTION_KEY` (variável de ambiente,
// nunca no código/git) — 32 bytes em base64 (gerar com
// `openssl rand -base64 32`). Sem essa variável configurada, qualquer
// tentativa de salvar/ler a senha falha alto (nunca grava em texto puro
// como "melhor que nada").
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getKey = (): Buffer => {
  const raw = process.env.WEAPON_DISPATCH_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "WEAPON_DISPATCH_ENCRYPTION_KEY não configurada — defina essa variável de ambiente (32 bytes em base64) antes de salvar/ler senha do gov.br."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "WEAPON_DISPATCH_ENCRYPTION_KEY inválida — precisa decodificar (base64) pra exatamente 32 bytes."
    );
  }
  return key;
};

// Formato armazenado: "<iv>:<authTag>:<ciphertext>", cada parte em base64.
export const encryptSecret = (plainText: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
};

export const decryptSecret = (stored: string): string => {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Valor criptografado em formato inesperado.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
};
