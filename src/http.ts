import type { IncomingHttpHeaders } from "node:http";

export function getLaddroApiKey(headers: IncomingHttpHeaders, envApiKey = "") {
  const headerKey = getHeaderValue(headers["x-api-key"]);
  if (headerKey) {
    return headerKey;
  }

  const authorization = getHeaderValue(headers.authorization);
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  return envApiKey;
}

export function normalizePath(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.replace(/\/+$/, "");
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
