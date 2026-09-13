import GetGlobalConfig from "./GetGlobalConfig";

const asEnabled = (value: unknown): boolean =>
  String(value || "enabled").toLowerCase() !== "disabled";

export interface GlobalChannelAvailability {
  whatsappBaileys: boolean;
  whatsappWuzapi: boolean;
  whatsappOfficial: boolean;
  facebook: boolean;
  instagram: boolean;
  webchat: boolean;
}

const GetGlobalChannelAvailability = async (): Promise<GlobalChannelAvailability> => {
  const config = await GetGlobalConfig(1);

  return {
    whatsappBaileys: asEnabled(config.channelWhatsappBaileysEnabled),
    whatsappWuzapi: asEnabled(config.channelWhatsappWuzapiEnabled),
    whatsappOfficial: asEnabled(config.channelWhatsappOfficialEnabled),
    facebook: asEnabled(config.channelFacebookEnabled),
    instagram: asEnabled(config.channelInstagramEnabled),
    webchat: asEnabled(config.channelWebchatEnabled)
  };
};

export default GetGlobalChannelAvailability;
