import forge from "node-forge";
import AppError from "../../errors/AppError";
import CompanyDigitalCertificate from "../../models/CompanyDigitalCertificate";
import CompanyCertificateAccessLog from "../../models/CompanyCertificateAccessLog";
import { encryptSecret, decryptSecret } from "../../utils/companyCertificateCrypto";

// Certificado digital A1 (.pfx/.p12) da ENTIDADE (um por empresa) —
// usado pra assinar digitalmente a Declaração de Filiação (Anexo B,
// Decreto 11.615/2023) e outros documentos oficiais. Pedido do
// cliente: "coloca um campo inserir certificado digital" — confirmado
// antes que o certificado é A1 (arquivo .pfx/.p12 com senha, diferente
// de A3/token físico, que não dá pra automatizar num servidor). Ver
// docs/MANUAL_TECNICO.md.

interface CertificateStatus {
  hasCertificate: boolean;
  fileName?: string;
  subjectName?: string;
  validUntil?: Date;
  uploadedAt?: Date;
}

// Valida a senha E extrai os metadados do certificado (CN, validade)
// na hora do upload — nunca aceita um .pfx/senha que nem abre, pra não
// descobrir isso só na hora de assinar um documento de verdade.
const parseCertificate = (
  fileBuffer: Buffer,
  password: string
): { subjectName: string; validUntil: Date } => {
  let p12Asn1;
  try {
    p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(fileBuffer.toString("binary")));
  } catch (err) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_INVALID_FILE");
  }

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch (err) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_WRONG_PASSWORD");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const certBag = certBags && certBags[0];
  if (!certBag || !certBag.cert) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_INVALID_FILE");
  }

  const cert = certBag.cert;
  const cn = cert.subject.getField("CN");
  return {
    subjectName: cn ? cn.value : cert.subject.attributes.map((a) => a.value).join(", "),
    validUntil: cert.validity.notAfter
  };
};

export const upload = async (
  companyId: number,
  fileBuffer: Buffer,
  password: string,
  fileName: string,
  userId: number
): Promise<CertificateStatus> => {
  if (!password) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_PASSWORD_REQUIRED");
  }

  const { subjectName, validUntil } = parseCertificate(fileBuffer, password);

  const [record] = await CompanyDigitalCertificate.findOrCreate({
    where: { companyId },
    defaults: {
      companyId,
      pfxEncrypted: "",
      passwordEncrypted: ""
    } as any
  });

  await record.update({
    pfxEncrypted: encryptSecret(fileBuffer.toString("base64")),
    passwordEncrypted: encryptSecret(password),
    fileName,
    subjectName,
    validUntil,
    uploadedByUserId: userId
  });

  return {
    hasCertificate: true,
    fileName: record.fileName,
    subjectName: record.subjectName,
    validUntil: record.validUntil,
    uploadedAt: record.updatedAt
  };
};

export const getStatus = async (companyId: number): Promise<CertificateStatus> => {
  const record = await CompanyDigitalCertificate.findOne({ where: { companyId } });
  if (!record) {
    return { hasCertificate: false };
  }
  return {
    hasCertificate: true,
    fileName: record.fileName,
    subjectName: record.subjectName,
    validUntil: record.validUntil,
    uploadedAt: record.updatedAt
  };
};

export const remove = async (companyId: number): Promise<void> => {
  const record = await CompanyDigitalCertificate.findOne({ where: { companyId } });
  if (!record) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_NOT_FOUND", 404);
  }
  await record.destroy();
};

// Única função que decifra o certificado/senha de verdade — usada pelo
// pipeline de assinatura (ainda não construído), nunca por um
// controller que devolveria isso numa resposta de API. Toda chamada
// grava uma linha de auditoria ANTES de devolver o valor (mesmo padrão
// de WeaponDispatchClientService.getGovPassword).
export const getForSigning = async (
  companyId: number,
  accessedByUserId: number,
  reason?: string
): Promise<{ pfxBuffer: Buffer; password: string }> => {
  const record = await CompanyDigitalCertificate.findOne({ where: { companyId } });
  if (!record) {
    throw new AppError("ERR_COMPANY_CERTIFICATE_NOT_FOUND", 404);
  }

  await CompanyCertificateAccessLog.create({
    companyId,
    accessedAt: new Date(),
    reason,
    accessedByUserId
  } as any);

  return {
    pfxBuffer: Buffer.from(decryptSecret(record.pfxEncrypted), "base64"),
    password: decryptSecret(record.passwordEncrypted)
  };
};
