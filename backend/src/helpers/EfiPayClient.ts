import https from "https";
import axios from "axios";

// Certificado EFI é obrigatório em toda chamada (mTLS), inclusive na
// autenticação. Decodificamos o base64 armazenado na Company em memória,
// sem gravar em disco.
export const buildEfiHttpsAgent = (
  certificateBase64: string,
  passphrase = ""
): https.Agent => {
  const buffer = Buffer.from(String(certificateBase64 || ""), "base64");

  if (!buffer.length) {
    throw new Error("Certificado EFI ausente ou inválido.");
  }

  const looksLikePem = buffer.slice(0, 40).toString("utf8").includes("BEGIN");

  if (looksLikePem) {
    const text = buffer.toString("utf8");
    const cert = text.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
    )?.[0];
    const key = text.match(
      /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/
    )?.[0];

    if (!cert || !key) {
      throw new Error("Certificado EFI em formato PEM inválido.");
    }

    return new https.Agent({ cert, key });
  }

  return new https.Agent({ pfx: buffer, passphrase: passphrase || undefined });
};

export const getEfiBaseUrl = (sandbox: boolean): string =>
  sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br";

export const getEfiAccessToken = async (params: {
  clientId: string;
  clientSecret: string;
  certificateBase64: string;
  passphrase?: string;
  sandbox: boolean;
}): Promise<string> => {
  const httpsAgent = buildEfiHttpsAgent(params.certificateBase64, params.passphrase);
  const basicAuth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString(
    "base64"
  );
  const baseUrl = getEfiBaseUrl(params.sandbox);

  const { data } = await axios.post(
    `${baseUrl}/oauth/token`,
    { grant_type: "client_credentials" },
    {
      httpsAgent,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json"
      }
    }
  );

  return data.access_token as string;
};

export const extractEfiErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (data?.mensagem) return String(data.mensagem);
  if (data?.detail) return String(data.detail);
  if (Array.isArray(data?.violacoes) && data.violacoes.length > 0) {
    const first = data.violacoes[0];
    return String(first?.razao || first?.propriedade || "erro na EFI");
  }
  return String(data?.message || error?.message || "erro desconhecido");
};
