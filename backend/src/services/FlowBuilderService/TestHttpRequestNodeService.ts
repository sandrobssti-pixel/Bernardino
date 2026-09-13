import axios from "axios";
import https from "https";

import logger from "../../utils/logger";

type QueryParam = { key: string; value: string };
type ResponseVariable = { path?: string; variableName?: string; variable?: string };

interface TestHttpRequestPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  requestBody?: any;
  queryParams?: QueryParam[];
  responseVariables?: ResponseVariable[];
  timeout?: number;
  statusVariable?: string;
  successVariable?: string;
}

interface TestHttpRequestOptions {
  companyId: number;
  nodeData: TestHttpRequestPayload;
  variables?: Record<string, any>;
}

const getNestedValue = (source: any, path: string): any => {
  if (!source || !path) return undefined;

  return String(path)
    .split(".")
    .reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, source);
};

const applyFlowFilter = (raw: string, filter: string): string => {
  const f = filter.trim().toLowerCase();

  if (f === "date") {
    const cleaned = raw.trim();
    const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return cleaned;
  }

  if (f === "currency") {
    const num = parseFloat(String(raw).replace(",", "."));
    if (isNaN(num)) return raw;
    return `R$ ${num.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }

  if (f === "number") {
    const num = parseFloat(String(raw).replace(",", "."));
    if (isNaN(num)) return raw;
    return num.toLocaleString("pt-BR");
  }

  return raw;
};

const interpolateFlowString = (
  value: string,
  variables: Record<string, any>
): string => {
  if (!value || typeof value !== "string") return value;

  return value.replace(/\$\{([^}]+)\}/g, (match, rawKey) => {
    const parts = String(rawKey || "").trim().split("|");
    const key = parts[0].trim();
    const filter = parts[1] ? parts[1].trim() : "";

    const resolved = getNestedValue(variables, key);

    if (resolved === undefined || resolved === null) {
      return match;
    }

    const str = typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved);
    return filter ? applyFlowFilter(str, filter) : str;
  });
};

const interpolateFlowPayload = (
  payload: any,
  variables: Record<string, any>
): any => {
  if (typeof payload === "string") {
    return interpolateFlowString(payload, variables);
  }

  if (Array.isArray(payload)) {
    return payload.map(item => interpolateFlowPayload(item, variables));
  }

  if (payload && typeof payload === "object") {
    return Object.keys(payload).reduce((acc, key) => {
      acc[key] = interpolateFlowPayload(payload[key], variables);
      return acc;
    }, {} as Record<string, any>);
  }

  return payload;
};

const normalizeRequestBody = (
  requestBody: any,
  variables: Record<string, any>
): any => {
  if (requestBody === null || requestBody === undefined || requestBody === "") {
    return null;
  }

  if (typeof requestBody === "object") {
    return interpolateFlowPayload(requestBody, variables);
  }

  if (typeof requestBody !== "string") {
    return requestBody;
  }

  const interpolated = interpolateFlowString(requestBody, variables);
  const trimmed = interpolated.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (error: any) {
      logger.warn(
        `[FLOWBUILDER][TEST] Body JSON inválido em httpRequest; enviando como texto. err=${String(
          error?.message || error
        )}`
      );
      return interpolated;
    }
  }

  return interpolated;
};

const makeHttpRequest = async ({
  url,
  method,
  headers,
  body,
  queryParams,
  timeout,
  variables
}: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: QueryParam[];
  timeout?: number;
  variables: Record<string, any>;
}): Promise<{ data: any; status: number; headers: any; error?: boolean; resolvedUrl: string }> => {
  const interpolatedUrl = interpolateFlowString(String(url || "").trim(), variables);

  if (!interpolatedUrl) {
    return {
      data: { message: "Empty URL" },
      status: 400,
      headers: {},
      error: true,
      resolvedUrl: ""
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(interpolatedUrl);
  } catch (error) {
    logger.warn(`[FLOWBUILDER][TEST] URL inválida em httpRequest: ${interpolatedUrl}`);
    return {
      data: { message: "Invalid URL" },
      status: 400,
      headers: {},
      error: true,
      resolvedUrl: interpolatedUrl
    };
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    return {
      data: { message: "Unsupported protocol" },
      status: 400,
      headers: {},
      error: true,
      resolvedUrl: parsedUrl.toString()
    };
  }

  const processedHeaders = Object.entries(headers || {}).reduce(
    (acc, [key, value]) => {
      acc[key] = interpolateFlowString(String(value || ""), variables);
      return acc;
    },
    {} as Record<string, string>
  );

  (Array.isArray(queryParams) ? queryParams : []).forEach(item => {
    const key = String(item?.key || "").trim();
    if (!key) return;

    const value = interpolateFlowString(String(item?.value || ""), variables);
    parsedUrl.searchParams.set(key, value);
  });

  const resolvedUrl = parsedUrl.toString();
  const config: any = {
    url: resolvedUrl,
    method: String(method || "GET").toUpperCase(),
    headers: {
      "Content-Type": "application/json",
      ...processedHeaders
    },
    timeout: Math.min(Math.max(Number(timeout) || 10000, 1000), 45000),
    httpsAgent: new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === "production"
    }),
    validateStatus: () => true
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(config.method) && body !== null) {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers,
      error: response.status >= 400,
      resolvedUrl
    };
  } catch (error: any) {
    logger.error(
      `[FLOWBUILDER][TEST] Erro ao executar httpRequest (${config.method} ${config.url}): ${String(
        error?.message || error
      )}`
    );

    return {
      data: {
        message: String(error?.message || "Request failed")
      },
      status: Number(error?.response?.status || 500),
      headers: error?.response?.headers || {},
      error: true,
      resolvedUrl
    };
  }
};

const TestHttpRequestNodeService = async ({
  companyId,
  nodeData,
  variables = {}
}: TestHttpRequestOptions) => {
  const normalizedVariables =
    variables && typeof variables === "object" ? variables : {};

  const normalizedBody = normalizeRequestBody(
    nodeData?.requestBody,
    normalizedVariables
  );

  const response = await makeHttpRequest({
    url: nodeData?.url,
    method: nodeData?.method || "GET",
    headers: nodeData?.headers || {},
    body: normalizedBody,
    queryParams: nodeData?.queryParams || [],
    timeout: nodeData?.timeout || 10000,
    variables: normalizedVariables
  });

  const mappings = Array.isArray(nodeData?.responseVariables)
    ? nodeData.responseVariables
    : [];

  const mappedVariables = mappings.reduce((acc, item) => {
    const path = String(item?.path || "").trim();
    const variableName = String(item?.variableName || item?.variable || "").trim();

    if (!path || !variableName) return acc;

    const value = getNestedValue(response.data, path);
    if (value === undefined) return acc;

    acc[variableName] = value;
    return acc;
  }, {} as Record<string, any>);

  const statusVariable = String(nodeData?.statusVariable || "").trim();
  if (statusVariable) {
    mappedVariables[statusVariable] = response.status;
  }

  const successVariable = String(nodeData?.successVariable || "").trim();
  if (successVariable) {
    mappedVariables[successVariable] = !response.error;
  }

  logger.info(
    `[FLOWBUILDER][TEST] httpRequest testado (company=${companyId}, url=${String(
      nodeData?.url || ""
    )}, status=${response.status})`
  );

  return {
    request: {
      method: String(nodeData?.method || "GET").toUpperCase(),
      url: response.resolvedUrl,
      headers: Object.entries(nodeData?.headers || {}).reduce(
        (acc, [key, value]) => {
          acc[key] = interpolateFlowString(String(value || ""), normalizedVariables);
          return acc;
        },
        {} as Record<string, string>
      ),
      body: normalizedBody,
      timeout: Math.min(Math.max(Number(nodeData?.timeout) || 10000, 1000), 45000)
    },
    response: {
      status: response.status,
      headers: response.headers,
      data: response.data,
      success: !response.error
    },
    mappedVariables
  };
};

export default TestHttpRequestNodeService;
