export type ClientMeta = {
  ip: string | null;
  userAgent: string | null;
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  ipLat: number | null;
  ipLng: number | null;
};

type HeaderReader = { get(name: string): string | null };

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  try {
    return decodeURIComponent(trimmed.replace(/\+/g, " ")).trim() || null;
  } catch {
    return trimmed;
  }
}

function parseCoord(value: string | null): number | null {
  const decoded = decodeHeader(value);
  if (!decoded) return null;
  const n = Number.parseFloat(decoded);
  return Number.isFinite(n) ? n : null;
}

export function emptyClientMeta(): ClientMeta {
  return {
    ip: null,
    userAgent: null,
    ipCity: null,
    ipRegion: null,
    ipCountry: null,
    ipLat: null,
    ipLng: null,
  };
}

/** IP + coarse geo from Vercel / Cloudflare request headers. City-level, not GPS. */
export function clientMetaFromHeaders(h: HeaderReader): ClientMeta {
  const forwarded = h.get("x-forwarded-for") || h.get("x-vercel-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    null;

  return {
    ip: ip || null,
    userAgent: h.get("user-agent"),
    ipCity: decodeHeader(h.get("x-vercel-ip-city") || h.get("cf-ipcity")),
    ipRegion: decodeHeader(
      h.get("x-vercel-ip-country-region") || h.get("cf-region-code") || h.get("cf-region"),
    ),
    ipCountry: decodeHeader(h.get("x-vercel-ip-country") || h.get("cf-ipcountry")),
    ipLat: parseCoord(h.get("x-vercel-ip-latitude") || h.get("cf-iplatitude")),
    ipLng: parseCoord(h.get("x-vercel-ip-longitude") || h.get("cf-iplongitude")),
  };
}

export function clientMetaFromRequest(request: Request): ClientMeta {
  return clientMetaFromHeaders(request.headers);
}
