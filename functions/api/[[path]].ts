interface PagesFunctionContext {
  request: Request;
  env: {
    REPLIT_API_ORIGIN?: string;
  };
}

const bodylessMethods = new Set(["GET", "HEAD"]);

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getApiOrigin(value: string | undefined): URL {
  if (!value) {
    throw new Error("REPLIT_API_ORIGIN is not configured");
  }

  const origin = new URL(value);
  if (!["http:", "https:"].includes(origin.protocol) || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("REPLIT_API_ORIGIN must be an origin URL without a path");
  }

  return origin;
}

export async function onRequest({
  request,
  env,
}: PagesFunctionContext): Promise<Response> {
  let targetUrl: URL;

  try {
    const apiOrigin = getApiOrigin(env.REPLIT_API_ORIGIN);
    const incomingUrl = new URL(request.url);
    targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API proxy configuration";
    return jsonError(message, 500);
  }

  const headers = new Headers(request.headers);
  const incomingUrl = new URL(request.url);

  // The upstream Express app uses these headers when constructing the
  // public Clerk proxy URL. Always replace client-provided values.
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.slice(0, -1));

  // Fetch recalculates this header for the upstream request.
  headers.delete("content-length");
  headers.delete("host");

  try {
    const upstreamResponse = await fetch(
      new Request(targetUrl, {
        method: request.method,
        headers,
        body: bodylessMethods.has(request.method) ? undefined : request.body,
        redirect: "manual",
      }),
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  } catch {
    return jsonError("Unable to reach the configured API origin", 502);
  }
}