const BASE = (import.meta as any).env?.VITE_API_URL || "";

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  return localStorage.getItem("redland_token");
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem("redland_token", t);
  else localStorage.removeItem("redland_token");
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  const tok = getToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      if (!path.includes("/auth/")) window.location.href = "/login";
    }
    throw new ApiError(res.status, (body && body.error) || res.statusText, body);
  }
  return body as T;
}

export const fmtMoney = (cents: number | string | bigint | null | undefined) => {
  if (cents === null || cents === undefined) return "—";
  const n = typeof cents === "string" ? Number(cents) : typeof cents === "bigint" ? Number(cents) : cents;
  const dollars = n / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
