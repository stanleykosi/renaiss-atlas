import { NextResponse } from "next/server";

import {
  createRenaissOSClient,
  headersForProxy,
  RenaissOsClientError,
  RenaissOsRateLimitError
} from "@/lib/renaiss-os/client";
import { matchRenaissOsProxyPath } from "@/lib/renaiss-os/proxy-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProxyRouteContext = {
  params: Promise<{ path: string[] }>;
};

function errorResponse(error: unknown) {
  if (error instanceof RenaissOsRateLimitError) {
    return NextResponse.json(
      {
        error: "Renaiss OS API rate limit is active.",
        retryAfterSeconds: error.retryAfterSeconds
      },
      {
        status: 429,
        headers: headersForProxy({
          rateLimit: error.rateLimit,
          cacheStatus: "bypass"
        })
      }
    );
  }

  if (error instanceof RenaissOsClientError) {
    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: error.status,
        headers: headersForProxy({
          rateLimit: error.rateLimit,
          cacheStatus: "bypass"
        })
      }
    );
  }

  return NextResponse.json({ error: "Renaiss OS proxy request failed." }, { status: 502 });
}

function streamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "text/event-stream");
  headers.set("Cache-Control", "no-store");

  for (const name of ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    const value = upstream.headers.get(name);
    if (value != null) headers.set(name, value);
  }

  return headers;
}

export async function GET(request: Request, context: ProxyRouteContext) {
  const { path } = await context.params;
  const match = matchRenaissOsProxyPath(path);
  if (match == null) {
    return NextResponse.json({ error: "Unsupported Renaiss OS proxy route." }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const client = createRenaissOSClient();

  try {
    if (match.stream) {
      const upstream = await client.fetchStream(match.remotePath, searchParams);
      if (!upstream.ok) {
        return NextResponse.json({ error: "Renaiss OS stream failed." }, { status: upstream.status });
      }
      return new Response(upstream.body, {
        status: upstream.status,
        headers: streamHeaders(upstream)
      });
    }

    const result = await client.getJson(match.remotePath, match.schema, {
      searchParams,
      cacheTtlSeconds: match.cacheTtlSeconds
    });

    return NextResponse.json(result.data, {
      headers: headersForProxy(result)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
