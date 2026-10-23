import crypto from "crypto";
import logger from "./logger";

// Criptografia simétrica (AES-256-GCM) pra API key de cada Assistente IA
// (Prompt.apiKey) — v2.3.196, pedido do cliente depois de comparar com um
// app próprio dele que já cifra essas chaves. Mesmo algoritmo/formato já
// usado em weaponDispatchCrypto.ts (senha do gov.br), mas arquivo/chave de
// ambiente SEPARADOS de propósito — são segredos de categorias diferentes,
// um vazamento de um não deveria comprometer o outro.
//
// ⚠️ Diferente do weaponDispatchCrypto.ts (que recusa funcionar sem a
// variável de ambiente configurada — correto lá, é senha de terceiro com
// exigência de auditoria): aqui, se `PROMPT_API_KEY_ENCRYPTION_KEY` não
// estiver configurada, as funções abaixo NÃO cifram (mantêm texto puro,
// só avisam no log) — decisão deliberada pra não quebrar o atendimento
// via IA de um cliente ativo em produção se o deploy acontecer antes da
// variável de ambiente ser configurada no servidor. Cifrar sozinho só
// passa a valer depois que a variável existir — ver instrução de deploy
// em docs/MANUAL_TECNICO.md.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let warnedMissingKey = false;

const getKey = (): Buffer | null => {
  const raw = process.env.PROMPT_API_KEY_ENCRYPTION_KEY;
  if (!raw) {
    if (!warnedMissingKey) {
      logger.warn(
        "PROMPT_API_KEY_ENCRYPTION_KEY não configurada — a API key de cada Assistente IA está sendo salva em TEXTO PURO no banco. Configure essa variável (32 bytes em base64, gerar com `openssl rand -base64 32`) pra cifrar."
      );
      warnedMissingKey = true;
    }
    return null;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    logger.error(
      "PROMPT_API_KEY_ENCRYPTION_KEY inválida — precisa decodificar (base64) pra exatamente 32 bytes. Ignorando, API key NÃO será cifrada."
    );
    return null;
  }
  return key;
};

// Reconhece o formato "<iv>:<authTag>:<ciphertext>" (cada parte em
// base64, iv de 12 bytes, authTag de 16 bytes) pra diferenciar um valor
// já cifrado de uma API key de verdade em texto puro — nenhuma API key
// real (OpenAI/Gemini/Anthropic/DeepSeek/Groq) tem esse formato exato,
// então o risco de falso positivo é desprezível.
export const isEncryptedApiKey = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  try {
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
};

export const encryptApiKey = (plainText: string): string => {
  if (!plainText || isEncryptedApiKey(plainText)) return plainText;
  const key = getKey();
  if (!key) return plainText;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
};

export const decryptApiKey = (stored: string): string => {
  if (!isEncryptedApiKey(stored)) return stored;
  const key = getKey();
  // Chave não configurada (ou inválida) mas o valor já está cifrado — não
  // tem como decifrar; devolve como está (o chamador vai falhar ao tentar
  // usar como API key de verdade, o que é o comportamento certo: melhor
  // falhar alto do que inventar uma chave errada).
  if (!key) return stored;

  try {
    const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final()
    ]);
    return plaintext.toString("utf8");
  } catch (err) {
    logger.error({ err }, "Falha ao decifrar API key de Assistente IA — chave de ambiente pode estar errada.");
    return stored;
  }
};
