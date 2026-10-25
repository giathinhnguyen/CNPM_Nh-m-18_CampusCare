export const TOKEN_KEY = "brewlite_access_token";
export const SESSION_EXPIRED = "brewlite:session-expired";

export function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function expireSession(token: string) {
  // A delayed response from an old session must not clear a new login.
  if (localStorage.getItem(TOKEN_KEY) !== token) return;
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED));
}

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || tokenExpiresAt(token) <= Date.now()) {
    if (token) expireSession(token);
    else window.dispatchEvent(new Event(SESSION_EXPIRED));
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) expireSession(token);
  return response;
}
