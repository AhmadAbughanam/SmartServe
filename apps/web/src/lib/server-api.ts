import "server-only";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export async function serverGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Server API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}
