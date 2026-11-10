import * as faceapi from "@vladmandic/face-api";

// Reconhecimento facial 100% no navegador (Controle de Acesso do
// Gerenciador CAC — Decreto nº 11.615/2023, art. 38, §5º, III) — os
// modelos (TensorFlow.js via WebGL) rodam aqui, não no servidor. O
// backend só recebe/guarda/compara o descritor (128 números), nunca a
// imagem em si pra esse fim. Arquivos de modelo hospedados localmente em
// `public/face-models/` (copiados de `@vladmandic/face-api/model` — ver
// docs/MANUAL_TECNICO.md), nunca buscados de CDN de terceiro.
const MODEL_URL = "/face-models";

let modelsLoadedPromise = null;

export const loadFaceModels = () => {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }
  return modelsLoadedPromise;
};

// Recebe um <img>/<video>/<canvas> já carregado, devolve o descritor (128
// números, array simples pra JSON) do ÚNICO rosto detectado, ou null se
// nenhum rosto foi encontrado (nunca lança erro — quem chama decide o
// que fazer com "nenhum rosto").
export const computeFaceDescriptor = async (imageSource) => {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(imageSource, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
};
