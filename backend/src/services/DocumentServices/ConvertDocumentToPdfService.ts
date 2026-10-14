// src/services/DocumentServices/ConvertDocumentToPdfService.ts
//
// Converte Word/Excel/PowerPoint/OpenDocument pra PDF usando LibreOffice
// headless (instalado no Dockerfile), pra permitir visualização real desses
// tipos na caixa de "Visualizar" do chat — sem mandar o documento pra um
// serviço externo (Google Docs Viewer / Microsoft Office Viewer), decisão
// explícita do cliente por questão de privacidade/compliance.
//
// Resultado fica em cache (pasta "_previews" dentro da pasta da empresa) —
// conversão só roda uma vez por arquivo original.

import { exec } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const CONVERTIBLE_EXTENSIONS = [
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".rtf"
];

export const isConvertibleToPdf = (fileName: string): boolean => {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.includes(ext);
};

const CONVERT_TIMEOUT_MS = 45000;

// Perfil de usuário isolado por chamada: o soffice trava se duas instâncias
// tentarem usar o mesmo perfil ao mesmo tempo ("soffice already running") —
// comum quando dois atendentes clicam em "Visualizar" perto um do outro.
const runSoffice = (sourcePath: string, outDir: string): Promise<void> => {
  const profileDir = path.join(
    "/tmp",
    `lo-profile-${crypto.randomBytes(8).toString("hex")}`
  );
  const cmd =
    `soffice --headless --norestore --nolockcheck -env:UserInstallation=file://${profileDir} ` +
    `--convert-to pdf --outdir "${outDir}" "${sourcePath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: CONVERT_TIMEOUT_MS }, (error, _stdout, stderr) => {
      fs.rm(profileDir, { recursive: true, force: true }, () => {});
      if (error) {
        reject(
          new Error(
            `Falha ao converter documento via LibreOffice: ${stderr || error.message}`
          )
        );
        return;
      }
      resolve();
    });
  });
};

const ConvertDocumentToPdfService = async (
  sourcePath: string,
  previewDir: string
): Promise<string> => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error("Arquivo original não encontrado no servidor.");
  }

  if (!isConvertibleToPdf(sourcePath)) {
    throw new Error("Tipo de arquivo não suportado pra conversão.");
  }

  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const outputPath = path.join(previewDir, `${baseName}.pdf`);

  // Cache: já convertido antes, não roda o LibreOffice de novo.
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  await runSoffice(sourcePath, previewDir);

  if (!fs.existsSync(outputPath)) {
    throw new Error("Conversão não gerou o PDF esperado.");
  }

  return outputPath;
};

export default ConvertDocumentToPdfService;
