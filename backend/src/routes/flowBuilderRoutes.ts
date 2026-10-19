import express from "express";
import isAuth from "../middleware/isAuth";
import EnsureFlowbuilderAccess from "../middleware/EnsureFlowbuilderAccess";

import multer from "multer";
import uploadConfig from "../config/uploadExt";

import * as FlowBuilderController from "../controllers/FlowBuilderController";
import FlowExportController from "../controllers/FlowExportController";
import FlowImportController from "../controllers/FlowImportController";

// NOVO: Importação para o controller de documentos que vamos criar.
import * as DocumentController from "../controllers/DocumentController";

const upload = multer(uploadConfig);
const uploadMemory = multer();

const flowBuilder = express.Router();

// `EnsureFlowbuilderAccess` (add-on por plano, Plan.useFlowbuilder) trava
// só essas rotas de GERENCIAR fluxo — nunca a execução de um fluxo já
// configurado, que não passa por aqui (ver comentário no middleware).
flowBuilder.post("/flowbuilder", isAuth, EnsureFlowbuilderAccess, FlowBuilderController.createFlow);
flowBuilder.put("/flowbuilder", isAuth, EnsureFlowbuilderAccess, FlowBuilderController.updateFlow);
flowBuilder.patch(
  "/flowbuilder/:idFlow/active",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.updateFlowActive
);

flowBuilder.delete(
  "/flowbuilder/:idFlow",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.deleteFlow
);

flowBuilder.get("/flowbuilder", isAuth, EnsureFlowbuilderAccess, FlowBuilderController.myFlows);
flowBuilder.get("/flowbuilder/:idFlow", isAuth, EnsureFlowbuilderAccess, FlowBuilderController.flowOne);

flowBuilder.get(
  "/flowbuilder/export/:id",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowExportController
);

flowBuilder.post(
  "/flowbuilder/import",
  isAuth,
  EnsureFlowbuilderAccess,
  uploadMemory.single("file"),
  FlowImportController
);

flowBuilder.post(
  "/flowbuilder/flow",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.FlowDataUpdate
);

flowBuilder.post(
  "/flowbuilder/http-request/test",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.testHttpRequest
);

flowBuilder.post(
  "/flowbuilder/duplicate",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.FlowDuplicate
);

flowBuilder.get(
  "/flowbuilder/flow/:idFlow",
  isAuth,
  EnsureFlowbuilderAccess,
  FlowBuilderController.FlowDataGetOne
);

flowBuilder.post(
  "/flowbuilder/img",
  isAuth,
  EnsureFlowbuilderAccess,
  upload.array("medias"),
  FlowBuilderController.FlowUploadImg
);

flowBuilder.post(
  "/flowbuilder/audio",
  isAuth,
  EnsureFlowbuilderAccess,
  upload.array("medias"),
  FlowBuilderController.FlowUploadAudio
);

flowBuilder.post(
  "/flowbuilder/content",
  isAuth,
  EnsureFlowbuilderAccess,
  upload.array("medias"),
  FlowBuilderController.FlowUploadAll
);

// ------------------- NOVA ROTA ADICIONADA -------------------
// Rota dedicada e limpa para receber e enviar documentos. NÃO travada por
// EnsureFlowbuilderAccess de propósito: envio de documento pode ser usado
// por um fluxo já em execução (ver ressalva no middleware), não é uma
// ação de "gerenciar" fluxo.
flowBuilder.post(
  "/flow/send-document",      // Endpoint específico
  isAuth,                     // Middleware de autenticação
  upload.single("document"),  // Espera um único arquivo chamado "document"
  DocumentController.send     // Chama a função 'send' do nosso novo controller
);
// -------------------------------------------------------------

export default flowBuilder;
