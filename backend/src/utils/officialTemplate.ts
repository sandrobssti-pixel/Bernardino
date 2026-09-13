import AppError from "../errors/AppError";

const toUpper = (value: unknown): string => String(value || "").toUpperCase();

const replaceIndexedPlaceholders = (
  template: string,
  values: string[] = []
): string =>
  String(template || "").replace(/\{\{(\d+)\}\}/g, (_, rawIndex) => {
    const index = Number(rawIndex) - 1;
    const value = values[index];

    if (value === undefined || value === null || value === "") {
      return `{{${rawIndex}}}`;
    }

    return String(value);
  });

export const getComponentPlaceholderMaxIndex = (
  components: any[] = [],
  targetType: string
): number => {
  const component = components.find(
    item => toUpper(item?.type) === toUpper(targetType)
  );
  const text = String(component?.text || "");
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];

  if (!matches.length) {
    return 0;
  }

  return matches.reduce((max, match) => {
    const current = Number(match?.[1] || 0);
    return Number.isFinite(current) && current > max ? current : max;
  }, 0);
};

const SUPPORTED_HEADER_MEDIA_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

export const getHeaderFormat = (components: any[] = []): string | null => {
  const headerComponent = components.find(
    component => toUpper(component?.type) === "HEADER"
  );

  const format = toUpper(headerComponent?.format);
  return format || null;
};

export const isMediaHeaderFormat = (format: string | null): boolean =>
  Boolean(format && SUPPORTED_HEADER_MEDIA_FORMATS.includes(format));

export const assertOfficialTemplateSupported = (components: any[] = []): void => {
  const headerFormat = getHeaderFormat(components);

  if (headerFormat && headerFormat !== "TEXT" && !isMediaHeaderFormat(headerFormat)) {
    throw new AppError(
      `Template com header do tipo ${headerFormat} ainda nao e suportado em campanhas oficiais.`,
      400
    );
  }

  const dynamicUrlButton = components
    .filter(component => toUpper(component?.type) === "BUTTONS")
    .some(component =>
      Array.isArray(component?.buttons) &&
      component.buttons.some(button =>
        toUpper(button?.type) === "URL" &&
        /\{\{\d+\}\}/.test(String(button?.url || ""))
      )
    );

  if (dynamicUrlButton) {
    throw new AppError(
      "Template com botao URL dinamico ainda nao e suportado em campanhas oficiais.",
      400
    );
  }
};

export const buildOfficialTemplateComponents = ({
  components = [],
  headerVariables = [],
  bodyVariables = [],
  headerMediaUrl
}: {
  components?: any[];
  headerVariables?: string[];
  bodyVariables?: string[];
  headerMediaUrl?: string;
}): Array<{
  type: "header" | "body";
  parameters: Array<{ type: "text" | "image" | "video" | "document"; text?: string; image?: { link: string }; video?: { link: string }; document?: { link: string } }>;
}> => {
  const payloadComponents: Array<{
    type: "header" | "body";
    parameters: Array<{ type: "text" | "image" | "video" | "document"; text?: string; image?: { link: string }; video?: { link: string }; document?: { link: string } }>;
  }> = [];

  const headerFormat = getHeaderFormat(components);

  if (isMediaHeaderFormat(headerFormat) && headerMediaUrl) {
    const mediaType = headerFormat!.toLowerCase() as "image" | "video" | "document";
    const mediaParameter =
      mediaType === "image"
        ? { type: "image" as const, image: { link: headerMediaUrl } }
        : mediaType === "video"
        ? { type: "video" as const, video: { link: headerMediaUrl } }
        : { type: "document" as const, document: { link: headerMediaUrl } };

    payloadComponents.push({
      type: "header",
      parameters: [mediaParameter]
    });
  } else {
    const headerCount = getComponentPlaceholderMaxIndex(components, "HEADER");
    if (headerCount > 0) {
      payloadComponents.push({
        type: "header",
        parameters: headerVariables.slice(0, headerCount).map(value => ({
          type: "text" as const,
          text: String(value ?? "")
        }))
      });
    }
  }

  const bodyCount = getComponentPlaceholderMaxIndex(components, "BODY");
  if (bodyCount > 0) {
    payloadComponents.push({
      type: "body",
      parameters: bodyVariables.slice(0, bodyCount).map(value => ({
        type: "text" as const,
        text: String(value ?? "")
      }))
    });
  }

  return payloadComponents;
};

export const buildOfficialTemplatePreview = ({
  templateName,
  components = [],
  headerVariables = [],
  bodyVariables = [],
  headerMediaUrl
}: {
  templateName: string;
  components?: any[];
  headerVariables?: string[];
  bodyVariables?: string[];
  headerMediaUrl?: string;
}): string => {
  const findTextComponent = (type: string, values: string[]): string => {
    const component = components.find(
      item => toUpper(item?.type) === toUpper(type)
    );

    return replaceIndexedPlaceholders(String(component?.text || ""), values).trim();
  };

  const headerFormat = getHeaderFormat(components);
  const headerText = isMediaHeaderFormat(headerFormat)
    ? headerMediaUrl
      ? `[${headerFormat}] ${headerMediaUrl}`
      : ""
    : findTextComponent("HEADER", headerVariables);
  const bodyText = findTextComponent("BODY", bodyVariables);
  const footerText = findTextComponent("FOOTER", []);
  const buttonLabels = components
    .filter(component => toUpper(component?.type) === "BUTTONS")
    .flatMap(component =>
      Array.isArray(component?.buttons)
        ? component.buttons
            .map(button => String(button?.text || "").trim())
            .filter(Boolean)
        : []
    );

  const parts = [headerText, bodyText, footerText].filter(Boolean);

  if (buttonLabels.length) {
    parts.push(`Botoes: ${buttonLabels.join(" | ")}`);
  }

  return [`[Template:${templateName}]`, ...parts].join("\n").trim();
};
