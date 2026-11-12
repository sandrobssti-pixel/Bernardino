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
let backendReadyPromise = null;

// Seleção de backend do TensorFlow.js feita explicitamente aqui, em vez
// de confiar na seleção automática do tfjs — bug real visto em
// produção (computador sem GPU/aceleração de hardware): a seleção
// automática tenta WebGL, falha ("WebGL is not supported on this
// device"), tenta WASM multi-thread (que exige cabeçalhos COOP/COEP
// pra SharedArrayBuffer, ausentes neste domínio) e trava com "bad
// memory" sem nunca cair pro CPU, que sempre funciona em qualquer
// navegador. Tenta, em ordem: WebGL (rápido) -> WASM single-thread
// (rápido, não exige COOP/COEP) -> CPU (mais lento, porém garantido).
const ensureBackend = () => {
  if (!backendReadyPromise) {
    backendReadyPromise = (async () => {
      const attempts = [
        () => faceapi.tf.setBackend("webgl"),
        () => {
          faceapi.tf.setThreadsCount(1);
          return faceapi.tf.setBackend("wasm");
        },
        () => faceapi.tf.setBackend("cpu"),
      ];
      for (const attempt of attempts) {
        try {
          const ok = await attempt();
          if (ok !== false) {
            await faceapi.tf.ready();
            return;
          }
        } catch (err) {
          // Esse backend falhou — tenta o próximo da lista.
        }
      }
      throw new Error(
        "Nenhum backend de reconhecimento facial disponível neste navegador."
      );
    })().catch((err) => {
      backendReadyPromise = null;
      throw err;
    });
  }
  return backendReadyPromise;
};

export const loadFaceModels = () => {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = ensureBackend()
      .then(() =>
        Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
      )
      .catch((err) => {
        modelsLoadedPromise = null;
        throw err;
      });
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
