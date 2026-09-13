import logger from "../../utils/logger";

const unwrapInteractivePayload = (payload: any): any => {
  let current = payload;

  for (let i = 0; i < 6; i += 1) {
    if (!current || typeof current !== "object") break;

    const next =
      current?.deviceSentMessage?.message ||
      current?.ephemeralMessage?.message ||
      current?.viewOnceMessage?.message ||
      current?.viewOnceMessageV2?.message ||
      current?.viewOnceMessageV2Extension?.message ||
      current?.documentWithCaptionMessage?.message ||
      current?.editedMessage?.message ||
      current?.message ||
      current?.Message;

    if (!next || next === current) break;
    current = next;
  }

  return current || payload;
};

const firstString = (...candidates: any[]): string => {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
};

const parseJsonSafe = (value: any): any => {
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const PIX_BUTTON_NAMES = ["review_and_pay", "cta_copy", "copy_code", "copy", "payment_info"];

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  CNPJ: "CNPJ",
  CPF: "CPF",
  PHONE: "Celular",
  EMAIL: "E-mail",
  EVP: "Chave Aleatória"
};

// O card oficial do WhatsApp exibe o número sem o prefixo "+55". O valor
// completo continua sendo usado no COPY:: (botão de copiar).
const formatPixKeyForDisplay = (keyType: string, key: string): string =>
  keyType === "PHONE" ? key.replace(/^\+55/, "") : key;

// O webhook do WuzAPI serializa o protobuf do Go com encoding/json puro, que não
// respeita os nomes camelCase do WhatsApp para campos "oneof": o array de botões
// chega aninhado em InteractiveMessage.NativeFlowMessage (maiúsculo) em vez de
// nativeFlowMessage direto, e o campo do botão é buttonParamsJSON (maiúsculo).
// O Baileys (protobufjs) não tem esse problema, então aceitamos os dois formatos.
const getButtonParamsJson = (button: any): any =>
  button?.buttonParamsJson ?? button?.buttonParamsJSON;

const getNativeFlowButtons = (interactiveMessage: any): any[] => {
  const direct = interactiveMessage?.nativeFlowMessage?.buttons;
  if (Array.isArray(direct) && direct.length) return direct;

  const wrapped = interactiveMessage?.InteractiveMessage?.NativeFlowMessage?.buttons;
  if (Array.isArray(wrapped) && wrapped.length) return wrapped;

  return [];
};

// Botão nativo "payment_info": usado no fluxo de "Solicitar pagamento" do
// WhatsApp, que pode embutir uma chave Pix estática dentro de payment_settings.
const extractPixStaticCode = (button: any): { key: string; keyType: string; merchantName: string } | null => {
  const parsed = parseJsonSafe(getButtonParamsJson(button));
  const settings = Array.isArray(parsed?.payment_settings) ? parsed.payment_settings : [];
  const pixSetting = settings.find((setting: any) => setting?.type === "pix_static_code")
    ?.pix_static_code;

  const key = firstString(pixSetting?.key);
  if (!key) return null;

  return {
    key,
    keyType: firstString(pixSetting?.key_type),
    merchantName: firstString(pixSetting?.merchant_name)
  };
};

const extractInteractiveCopyCode = (button: any): string => {
  if (!button || typeof button !== "object") return "";

  const pixStatic = extractPixStaticCode(button);
  if (pixStatic) return pixStatic.key;

  const parsed = parseJsonSafe(getButtonParamsJson(button));
  return firstString(
    parsed?.copy_code,
    parsed?.copyCode,
    parsed?.code,
    parsed?.pix_key,
    parsed?.pixKey,
    parsed?.value
  );
};

const extractInteractiveButtonLabel = (button: any): string => {
  if (!button || typeof button !== "object") return "";

  const parsed = parseJsonSafe(getButtonParamsJson(button));
  const rows = Array.isArray(parsed?.sections)
    ? parsed.sections
        .flatMap((section: any) => section?.rows || [])
        .map((row: any) => {
          const title = firstString(row?.title);
          const description = firstString(row?.description);
          return description ? `${title} - ${description}` : title;
        })
        .filter(Boolean)
    : [];

  const parsedLabel = firstString(
    parsed?.display_text,
    parsed?.displayText,
    parsed?.title,
    parsed?.text,
    parsed?.button_text,
    parsed?.cta_display_name,
    parsed?.name
  );

  if (rows.length > 0) {
    return [parsedLabel, ...rows].filter(Boolean).join(" | ");
  }

  return (
    parsedLabel ||
    firstString(
      button?.buttonText?.displayText,
      button?.text,
      button?.title,
      button?.name
    )
  );
};

const formatInteractiveMessageBody = (interactiveMessage: any): string => {
  if (!interactiveMessage || typeof interactiveMessage !== "object") return "";

  let header = firstString(interactiveMessage?.header?.title);
  let body = firstString(interactiveMessage?.body?.text);
  const footer = firstString(interactiveMessage?.footer?.text);
  const buttons = getNativeFlowButtons(interactiveMessage);
  const buttonLines = buttons
    .map((button: any) => extractInteractiveButtonLabel(button))
    .filter(Boolean);

  const pixButton = buttons.find(
    (button: any) =>
      PIX_BUTTON_NAMES.includes(button?.name) || Boolean(extractInteractiveCopyCode(button))
  );
  const copyCode = extractInteractiveCopyCode(pixButton);
  const isPix = Boolean(pixButton);

  if (isPix && !body) {
    const pixStatic = extractPixStaticCode(pixButton);
    if (pixStatic) {
      if (!header) header = pixStatic.merchantName;
      const keyTypeLabel = PIX_KEY_TYPE_LABELS[pixStatic.keyType] || pixStatic.keyType;
      const displayKey = formatPixKeyForDisplay(pixStatic.keyType, pixStatic.key);
      body = keyTypeLabel ? `${keyTypeLabel}: ${displayKey}` : displayKey;
    }
  }

  const prefix = isPix
    ? "[PIX]"
    : buttonLines.length > 0
      ? "[BOTOES]"
      : "[INTERATIVA]";

  const parts = [prefix];
  if (header) parts.push(`*${header}*`);
  else if (isPix) parts.push("*Chave Pix*");
  if (body) parts.push(body);
  if (footer) parts.push(footer);
  if (buttonLines.length > 0 && !isPix) parts.push(buttonLines.join("\n"));
  if (copyCode) parts.push(`COPY::${copyCode}`);

  if (isPix && !copyCode) {
    logger.warn(
      `#### [WuzAPI] Mensagem PIX sem copy_code reconhecido, payload bruto: ${JSON.stringify(
        interactiveMessage
      )}`
    );
  } else if (prefix === "[INTERATIVA]" && !header && !body && !footer) {
    logger.warn(
      `#### [WuzAPI] Interactive message não reconhecida, payload bruto: ${JSON.stringify(
        interactiveMessage
      )}`
    );
  }

  return parts.filter(Boolean).join("\n\n").trim();
};

const extractInteractiveResponseText = (payload: any): string => {
  const root = unwrapInteractivePayload(payload);

  const selectedText = firstString(
    root?.buttonsResponseMessage?.selectedDisplayText,
    root?.listResponseMessage?.title,
    root?.listResponseMessage?.description,
    root?.templateButtonReplyMessage?.selectedDisplayText
  );
  if (selectedText) return selectedText;

  const selectedId = firstString(
    root?.listResponseMessage?.singleSelectReply?.selectedRowId,
    root?.buttonsResponseMessage?.selectedButtonId,
    root?.templateButtonReplyMessage?.selectedId
  );
  if (selectedId) return selectedId;

  const nativeFlow = parseJsonSafe(
    root?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  );
  if (nativeFlow) {
    const label = firstString(
      nativeFlow?.title,
      nativeFlow?.button_text,
      nativeFlow?.display_text,
      nativeFlow?.displayText,
      nativeFlow?.text,
      nativeFlow?.selected_option?.title,
      nativeFlow?.selectedOption?.title,
      nativeFlow?.selected_option?.description,
      nativeFlow?.selectedOption?.description,
      nativeFlow?.id,
      nativeFlow?.selected_option?.id,
      nativeFlow?.selectedOption?.id
    );
    if (label) return label;
  }

  const interactiveBody = formatInteractiveMessageBody(root?.interactiveMessage);
  if (interactiveBody) return interactiveBody;

  return firstString(root?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson);
};

export const extractInteractiveMessageBody = (payload: any): string => {
  const root = unwrapInteractivePayload(payload);

  if (root?.buttonsMessage?.contentText) {
    const buttonLabels = Array.isArray(root?.buttonsMessage?.buttons)
      ? root.buttonsMessage.buttons
          .map((button: any) => firstString(button?.buttonText?.displayText))
          .filter(Boolean)
      : [];
    return [
      "[BUTTON]",
      "",
      root.buttonsMessage.contentText ? `*${String(root.buttonsMessage.contentText).trim()}*` : "",
      "",
      ...buttonLabels.map((label: string) => `- ${label}`)
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (root?.listMessage) {
    const lines: string[] = ["[LIST]", ""];
    const title = firstString(root?.listMessage?.title);
    const description = firstString(root?.listMessage?.description);
    const footer = firstString(root?.listMessage?.footerText);

    if (title) lines.push(`*${title}*`);
    if (description) lines.push(`*${description}*`, "");
    if (footer) lines.push(footer, "");

    for (const section of root?.listMessage?.sections || []) {
      const sectionTitle = firstString(section?.title);
      if (sectionTitle) lines.push(`*${sectionTitle}*`);

      for (const row of section?.rows || []) {
        const rowTitle = firstString(row?.title);
        const rowDescription = firstString(row?.description);
        if (rowTitle || rowDescription) {
          lines.push(rowDescription ? `${rowTitle} - ${rowDescription}` : rowTitle);
        }
      }

      lines.push("");
    }

    return lines.join("\n").trim();
  }

  return (
    extractInteractiveResponseText(root) ||
    formatInteractiveMessageBody(root?.interactiveMessage)
  );
};

export const hasInteractiveMessageBody = (payload: any): boolean =>
  Boolean(extractInteractiveMessageBody(payload));

export interface IInteractiveCardOption {
  id: string;
  label: string;
  description: string;
}

export interface IInteractiveCard {
  title: string;
  body: string;
  footer: string;
  options: IInteractiveCardOption[];
}

const pushNativeFlowButtonOptions = (button: any, options: IInteractiveCardOption[]): void => {
  const params = parseJsonSafe(getButtonParamsJson(button));

  const label = firstString(
    params?.display_text,
    params?.displayText,
    params?.title,
    params?.text,
    params?.button_text,
    params?.cta_display_name,
    params?.name,
    button?.buttonText?.displayText,
    button?.text,
    button?.title,
    button?.name
  );
  const url = firstString(params?.url, params?.merchant_url);
  if (label) {
    options.push({
      id: firstString(params?.id, params?.reply?.id, url, label),
      label,
      description: url
    });
  }

  const sections = Array.isArray(params?.sections) ? params.sections : [];
  for (const section of sections) {
    for (const row of section?.rows || []) {
      const rowLabel = firstString(row?.title);
      if (!rowLabel) continue;
      options.push({
        id: firstString(row?.id, row?.rowId, rowLabel),
        label: rowLabel,
        description: firstString(section?.title, row?.description)
      });
    }
  }
};

// Normaliza os formatos interativos recebidos via WuzAPI (buttonsMessage,
// listMessage e interactiveMessage/nativeFlowMessage) em uma estrutura única
// que o frontend consegue renderizar como botões clicáveis, sem precisar
// reimplementar a tolerância a casing/oneof do encoding/json do Go.
export const extractInteractiveCard = (payload: any): IInteractiveCard | null => {
  const root = unwrapInteractivePayload(payload);
  if (!root || typeof root !== "object") return null;

  const options: IInteractiveCardOption[] = [];
  let title = "";
  let body = "";
  let footer = "";

  if (root?.buttonsMessage) {
    const item = root.buttonsMessage;
    title = firstString(item?.title);
    body = firstString(item?.contentText);
    footer = firstString(item?.footerText);
    for (const button of item?.buttons || []) {
      const label = firstString(button?.buttonText?.displayText, button?.displayText);
      if (!label) continue;
      options.push({
        id: firstString(button?.buttonId, button?.id, label),
        label,
        description: ""
      });
    }
  } else if (root?.listMessage) {
    const item = root.listMessage;
    title = firstString(item?.title);
    body = firstString(item?.description);
    footer = firstString(item?.footerText);
    for (const section of item?.sections || []) {
      for (const row of section?.rows || []) {
        const label = firstString(row?.title);
        if (!label) continue;
        options.push({
          id: firstString(row?.rowId, row?.id, label),
          label,
          description: firstString(section?.title, row?.description)
        });
      }
    }
  } else {
    const item = root?.interactiveMessage || root?.InteractiveMessage;
    if (!item) return null;
    title = firstString(item?.header?.title, item?.Header?.Title);
    body = firstString(item?.body?.text, item?.Body?.Text);
    footer = firstString(item?.footer?.text, item?.Footer?.Text);
    for (const button of getNativeFlowButtons(item)) {
      pushNativeFlowButtonOptions(button, options);
    }
  }

  const uniqueOptions = options.filter(
    (option, index, all) =>
      option.id && all.findIndex(candidate => candidate.id === option.id) === index
  );

  if (!uniqueOptions.length) return null;

  return { title, body, footer, options: uniqueOptions };
};
