import MetaConnection from "../../models/MetaConnection";
import Whatsapp from "../../models/Whatsapp";

const buildSessionMarker = (metaConnectionId: number, channel: string): string =>
  `meta_connection:${metaConnectionId}:${channel}`;

const parseRuntimeMetadata = (metadata: Record<string, any> | null | undefined) => {
  const current = metadata && typeof metadata === "object" ? metadata : {};
  const runtime = current.__runtime && typeof current.__runtime === "object"
    ? current.__runtime
    : {};

  return { current, runtime };
};

const buildShadowName = (connection: MetaConnection, channel: string): string => {
  if (connection.channel === channel) {
    return connection.name;
  }

  return `${connection.name} (${channel === "facebook" ? "Facebook" : "Instagram"})`;
};

const buildShadowPayload = (
  connection: MetaConnection,
  channel: "facebook" | "instagram"
) => {
  const remoteId =
    channel === "facebook"
      ? String(connection.pageId || "").trim()
      : String(connection.instagramBusinessAccountId || "").trim();

  if (!remoteId || connection.isActive === false) {
    return null;
  }

  return {
    companyId: connection.companyId,
    name: buildShadowName(connection, channel),
    session: buildSessionMarker(connection.id, channel),
    status: connection.status || "DISCONNECTED",
    isDefault: false,
    channel,
    token: connection.verifyToken,
    facebookUserId: connection.appId || null,
    facebookUserToken: connection.pageAccessToken || null,
    facebookPageUserId: remoteId,
    tokenMeta: connection.appId || null,
    // Agente de IA da conexão Meta (ver facebookMessageListener/metaAiAgent).
    promptId: connection.promptId || null
  };
};

const ensureShadowConnection = async (
  connection: MetaConnection,
  channel: "facebook" | "instagram",
  runtime: Record<string, any>
) => {
  const payload = buildShadowPayload(connection, channel);
  const key = `${channel}WhatsappId`;
  const currentId = Number(runtime[key] || 0) || null;

  if (!payload) {
    if (currentId) {
      const shadow = await Whatsapp.findOne({
        where: {
          id: currentId,
          companyId: connection.companyId
        }
      });
      if (shadow) await shadow.destroy();
    }
    runtime[key] = null;
    return;
  }

  let shadow = currentId
    ? await Whatsapp.findOne({
        where: {
          id: currentId,
          companyId: connection.companyId
        }
      })
    : null;

  if (!shadow) {
    shadow = await Whatsapp.findOne({
      where: {
        companyId: connection.companyId,
        session: buildSessionMarker(connection.id, channel)
      }
    });
  }

  if (shadow) {
    await shadow.update(payload);
  } else {
    shadow = await Whatsapp.create(payload as any);
  }

  runtime[key] = shadow.id;
};

const persistRuntimeMetadata = async (
  connection: MetaConnection,
  current: Record<string, any>,
  runtime: Record<string, any>
) => {
  await connection.update({
    metadata: {
      ...current,
      __runtime: runtime
    }
  });
};

const SyncMetaConnectionRuntimeService = async (
  connection: MetaConnection
): Promise<MetaConnection> => {
  const { current, runtime } = parseRuntimeMetadata(connection.metadata as any);

  if (connection.channel === "facebook") {
    await ensureShadowConnection(connection, "facebook", runtime);
    await ensureShadowConnection(
      {
        ...connection,
        instagramBusinessAccountId: ""
      } as MetaConnection,
      "instagram",
      runtime
    );
  } else if (connection.channel === "instagram") {
    await ensureShadowConnection(connection, "instagram", runtime);
    await ensureShadowConnection(
      {
        ...connection,
        pageId: ""
      } as MetaConnection,
      "facebook",
      runtime
    );
  } else {
    await ensureShadowConnection(connection, "facebook", runtime);
    await ensureShadowConnection(connection, "instagram", runtime);
  }

  await persistRuntimeMetadata(connection, current, runtime);
  return connection;
};

export const RemoveMetaConnectionRuntimeService = async (
  connection: MetaConnection
): Promise<void> => {
  const { current, runtime } = parseRuntimeMetadata(connection.metadata as any);
  const runtimeIds = [runtime.facebookWhatsappId, runtime.instagramWhatsappId]
    .map(value => Number(value || 0))
    .filter(Boolean);

  if (runtimeIds.length > 0) {
    await Whatsapp.destroy({
      where: {
        companyId: connection.companyId,
        id: runtimeIds
      }
    });
  }

  const cleanedMetadata = { ...current };
  delete cleanedMetadata.__runtime;
  await connection.update({ metadata: cleanedMetadata });
};

export default SyncMetaConnectionRuntimeService;
