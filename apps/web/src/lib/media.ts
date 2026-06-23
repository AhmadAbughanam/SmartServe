const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (!url.startsWith("/")) return url;
  return `${API_BASE}${url}`;
}
