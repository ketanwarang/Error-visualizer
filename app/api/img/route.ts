import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side image proxy. Shelf images often live on GCS/CDN hosts that
 * either block CORS or need a browser-like User-Agent — same reason the
 * Streamlit version fetched images server-side with requests.get().
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u || !/^https?:\/\//i.test(u)) {
    return new Response("Missing or invalid ?u= url", { status: 400 });
  }
  try {
    const upstream = await fetch(u, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      return new Response(`Upstream responded ${upstream.status}`, {
        status: 502,
      });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Fetch failed — URL may need VPN or auth", {
      status: 504,
    });
  }
}
