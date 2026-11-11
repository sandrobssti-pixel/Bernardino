import crypto from "crypto";

// Criptografia simétrica (AES-256-GCM) só pro certificado digital A1
// (.pfx/.p12) e a senha dele, usados pra assinar digitalmente a
// Declaração de Filiação (Anexo B, Decreto 11.615/2023) em nome da
// entidade (CompanyDigitalCertificate) — pedido do cliente. Mesmo
// padrão já usado pra senha gov.br do Despachante Bélico (ver
// weaponDispatchCrypto.ts), com uma chave PRÓPRIA (nunca reaproveitar a
// mesma chave entre dois segredos diferentes) — essa aqui protege uma
// chave privada de verdade (o .pfx), ainda mais sensível que uma senha
// de login. Ver docs/MANUAL_TECNICO.md.
//
// Chave vem de `COMPANY_CERTIFICATE_ENCRYPTION_KEY` (variável de
// ambiente, nunca no código/git) — 32 bytes em base64 (gerar com
// `openssl rand -base64 32`). Sem essa variável configurada, qualquer
// tentativa de salvar/ler o certificado falha alto.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getKey = (): Buffer => {
  const raw = process.env.COMPANY_CERTIFICATE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "COMPANY_CERTIFICATE_ENCRYPTION_KEY não configurada — defina essa variável de ambiente (32 bytes em base64) antes de salvar/ler o certificado digital."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "COMPANY_CERTIFICATE_ENCRYPTION_KEY inválida — precisa decodificar (base64) pra exatamente 32 bytes."
    );
  }
  return key;
};

// Formato armazenado: "<iv>:<authTag>:<ciphertext>", cada parte em base64.
// Funciona pra qualquer string, inclusive binário já convertido pra
// base64 (o jeito que o .pfx em si é guardado — ver
// CompanyCertificateService.ts).
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
