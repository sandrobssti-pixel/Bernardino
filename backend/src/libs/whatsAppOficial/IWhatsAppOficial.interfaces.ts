export interface ISendMessageOficial {
  type:
    | "text"
    | "reaction"
    | "audio"
    | "document"
    | "image"
    | "sticker"
    | "video"
    | "location"
    | "contacts"
    | "interactive"
    | "template";
  to: string;
  fileName?: string;
  quotedId?: string;
  body_text?: IMetaMessageText;
  body_reaction?: IMetaMessageReaction;
  body_video?: IMetaMessageVideo;
  body_document?: IMetaMessageDocument;
  body_image?: IMetaMessageImage;
  body_contacts?: IMetaMessageContacts;
  body_interactive?: IMetaMessageinteractive;
  body_template?: IMetaMessageTemplate;
}

export interface IMetaMessageText {
  preview_url?: string;
  body: string;
}

export interface IMetaMessageReaction {
  message_id: string;
  emoji: string;
}

export interface IMetaMessageVideo {
  caption?: string;
}

export interface IMetaMessageDocument {
  caption?: string;
}

export interface IMetaMessageImage {
  caption?: string;
}

export interface IMetaMessageinteractive {
  type: "button" | "list";
  header?: { type: "text" | "image"; text?: string; image?: { id: string } };
  body?: { text: string };
  footer?: { text: string };
  action: {
    sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
    buttons?: Array<{ type: "reply"; reply: { id: string; title: string } }>;
  };
}

export interface IMetaMessageContacts {
  emails?: Array<{ email?: string; type?: string }>;
  name?: {
    formatted_name?: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{ phone?: string; type?: string; wa_id?: number | string }>;
}

export interface IMetaMessageTemplate {
  name: string;
  language: {
    code: string;
  };
  components?: IMetaMessageTemplateComponents[];
}

export interface IMetaMessageTemplateComponents {
  type: "header" | "body" | "footer" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: IMetaMessageTemplateComponentsParameters[];
}

export interface IMetaMessageTemplateComponentsParameters {
  type: "location" | "currency" | "date_time" | "text" | "payload" | "url" | "image" | "video" | "document";
  text?: string;
  url?: string;
  payload?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string };
}

export interface IReturnMessageMeta {
  idMessageWhatsApp?: string[];
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status: string }>;
}

export interface ICreateConnectionWhatsAppOficialCompany {
  companyId: string;
  companyName: string;
}

export interface ICreateConnectionWhatsAppOficialWhatsApp {
  token_mult100: string;
  phone_number_id: string;
  waba_id: string;
  send_token: string;
  business_id: string;
  phone_number: string;
  idEmpresaMult100: number;
}

export interface ICreateConnectionWhatsAppOficial {
  email: string;
  company: ICreateConnectionWhatsAppOficialCompany;
  whatsApp: ICreateConnectionWhatsAppOficialWhatsApp;
}

export interface IUpdateonnectionWhatsAppOficialWhatsApp {
  token_mult100?: string;
  phone_number_id?: string;
  waba_id?: string;
  send_token?: string;
  business_id?: string;
  phone_number?: string;
}

export interface IRegisterWhatsAppOficialResult {
  success?: boolean;
}

export interface IResultTemplates {
  data?: Array<{
    id: string;
    name: string;
    status?: string;
    category?: string;
    language?: string;
    components?: any[];
  }>;
}
