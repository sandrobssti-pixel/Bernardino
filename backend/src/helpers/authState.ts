import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  SignalDataSet
} from "baileys";
import Whatsapp from "../models/Whatsapp";
import { dynamicImport } from "../utils/dynamicImport";

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

// Mapeia cada tipo de chave Signal para o "bucket" que você persiste no DB.
// ATENÇÃO: use os mesmos nomes em get/set (consistência)!
const KEY_MAP: Partial<Record<keyof SignalDataTypeMap | "identity-key", string>> = {
  "pre-key": "preKeys",
  "identity-key": "identityKeys",
  session: "sessions",
  "sender-key": "senderKeys",
  "sender-key-memory": "senderKeyMemory",
  "app-state-sync-key": "appStateSyncKeys",
  "app-state-sync-version": "appStateVersions",
  "lid-mapping": "lidMappings",   // use "lidMapping" se já persistia assim
  "device-list": "deviceList",     // exigido no v7
  tctoken: "tcTokens"              // novo no v7 (required)
};
// A store de chaves do Baileys chama `keys.set()` várias vezes por mensagem
// (sessão Signal, sender-key, etc). Sem debounce, cada uma dessas chamadas
// serializava e regravava no Postgres o blob inteiro da sessão (centenas de
// KB), de forma síncrona e bloqueante — isso é o que causava o delay grande
// e o travamento da tela em conexões Baileys com tráfego intenso. Com o
// debounce, várias mudanças próximas no tempo viram uma única gravação.
const SAVE_DEBOUNCE_MS = 2000;

const authState = async (
  whatsapp: Whatsapp
): Promise<{ state: AuthenticationState; saveState: () => Promise<void> }> => {
  const { BufferJSON, initAuthCreds, proto } = await getBaileys();
  let creds: AuthenticationCreds;
  // buckets com sub-objetos indexados por id
  let keys: Record<string, Record<string, unknown>> = {};

  const saveState = async (): Promise<void> => {
    try {
      await whatsapp.update({
        session: JSON.stringify({ creds, keys }, BufferJSON.replacer, 0)
      });
    } catch (error) {
      console.log(error);
    }
  };

  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = (): void => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveState().catch(error => console.log(error));
    }, SAVE_DEBOUNCE_MS);
    // Não impede o processo de encerrar por causa desse timer pendente.
    (saveTimer as any)?.unref?.();
  };

  if (whatsapp.session && whatsapp.session !== null) {
    const result = JSON.parse(whatsapp.session, BufferJSON.reviver);
    creds = result.creds;
    keys = result.keys || {};
  } else {
    creds = initAuthCreds();
    keys = {};
  }

  return {
    state: {
      creds,
      keys: {
        // get precisa devolver um dicionário { id: valorTipado }
        get: (type, ids) => {
          const bucket = KEY_MAP[type as keyof typeof KEY_MAP];
          if (!bucket) return {};
          return ids.reduce((dict: any, id) => {
            let value = (keys[bucket] as any)?.[id];
            if (value) {
              if (type === "app-state-sync-key") {
                // garantir instanciação correta (v7 retirou fromObject em alguns builds)
                const AppState = (proto as any).Message?.AppStateSyncKeyData;
                if (AppState?.fromObject) value = AppState.fromObject(value);
                else if (AppState?.create) value = AppState.create(value);
              }
              dict[id] = value;
            }
            return dict;
          }, {} as Record<string, unknown>);
        },
        // set agora exige SignalDataSet
        set: async (data: SignalDataSet) => {
          // data é do tipo:
          // {
          //   "pre-key"?: { [id: string]: KeyPair },
          //   session?: { [id: string]: SignalProtocolAddress[] | ... },
          //   ...
          // }
          for (const k in data) {
            const bucket = KEY_MAP[k as keyof typeof KEY_MAP];
            if (!bucket) continue;
            keys[bucket] = keys[bucket] || {};
            // mescla o mapa recebido no bucket correspondente
            Object.assign(keys[bucket], (data as any)[k]);
          }
          // A atualização em memória acima já é imediata (é o que o Baileys
          // realmente precisa para continuar processando); a persistência em
          // disco é apenas para sobreviver a um restart, então pode ser
          // agrupada em vez de travar cada mensagem numa gravação síncrona.
          scheduleSave();
        }
      }
    },
    saveState
  };
};
export default authState;
