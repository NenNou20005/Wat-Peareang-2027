import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleApiRequest } from "./server/api";
import { getOrGenerateRequestId, logger } from "./server/logger";
import { closePgPool } from "./db/index";

// Graceful process shutdown listeners
if (typeof process !== "undefined" && process.on) {
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}, gracefully terminating database pool...`);
    try {
      await closePgPool();
    } catch {
      // ignore
    }
  };

  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function applySecurityHeaders(headers: Headers, requestId: string): void {
  if (!headers.has("X-Request-ID")) headers.set("X-Request-ID", requestId);
  if (!headers.has("X-Content-Type-Options")) headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("X-Frame-Options")) headers.set("X-Frame-Options", "SAMEORIGIN");
  if (!headers.has("X-XSS-Protection")) headers.set("X-XSS-Protection", "1; mode=block");
  if (!headers.has("Referrer-Policy"))
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  requestId: string,
): Promise<Response> {
  if (response.status < 500) {
    applySecurityHeaders(response.headers, requestId);
    return response;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    applySecurityHeaders(response.headers, requestId);
    return response;
  }

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) {
    applySecurityHeaders(response.headers, requestId);
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  applySecurityHeaders(headers, requestId);
  return new Response(renderErrorPage(), {
    status: 500,
    headers,
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = getOrGenerateRequestId(request);
    try {
      // Check for API endpoints first
      const apiResponse = await handleApiRequest(request);
      if (apiResponse) {
        return apiResponse;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, requestId);
    } catch (error) {
      console.error(error);
      const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
      applySecurityHeaders(headers, requestId);
      return new Response(renderErrorPage(), {
        status: 500,
        headers,
      });
    }
  },
};
