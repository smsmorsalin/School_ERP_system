/**
 * Tiny fetch wrapper for the School ERP API.
 *
 * - Access token is kept in memory only (never localStorage), which limits
 *   the impact of XSS.
 * - Refresh token lives in an HttpOnly cookie managed by the server.
 * - A single-flight refresh avoids a stampede when several calls 401 at once.
 */
const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};
export const getAccessToken = () => accessToken;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function extractMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (Array.isArray(data.errors) && data.errors.length) return data.errors.join(" ");
  if (data.detail) return data.detail;
  if (data.non_field_errors) return [].concat(data.non_field_errors).join(" ");
  if (typeof data === "object") {
    const first = Object.entries(data).find(([, v]) => v);
    if (first) {
      const [key, value] = first;
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return key === "detail" ? text : `${key}: ${text}`;
    }
  }
  return fallback;
}

const isAuthPath = (path) =>
  path.includes("/accounts/auth/login/") ||
  path.includes("/accounts/auth/refresh/") ||
  path.includes("/accounts/auth/logout/");

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function runRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/accounts/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        setAccessToken(null);
        throw new ApiError(
          extractMessage(data, "Session expired."),
          res.status,
          data
        );
      }
      setAccessToken(data.access);
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    retry = true,
    signal,
  } = options;

  const finalHeaders = { Accept: "application/json", ...headers };
  let payload = body;

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
      null
    );
  }

  if (res.status === 204) return null;

  const data = await parseResponse(res);

  if (res.status === 401 && retry && !isAuthPath(path)) {
    try {
      await runRefresh();
    } catch {
      setAccessToken(null);
      window.dispatchEvent(new Event("school-erp:session-expired"));
      throw new ApiError("Your session has expired. Please sign in again.", 401, data);
    }
    return apiFetch(path, { ...options, retry: false });
  }

  if (!res.ok) {
    const message = extractMessage(data, `Request failed (${res.status}).`);
    throw new ApiError(message, res.status, data);
  }

  return data;
}

export const api = {
  get: (path, params, options = {}) => {
    let url = path;
    if (params && Object.keys(params).length) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          query.append(key, value);
        }
      });
      const qs = query.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }
    return apiFetch(url, { ...options, method: "GET" });
  },
  post: (path, body, options = {}) =>
    apiFetch(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) =>
    apiFetch(path, { ...options, method: "PATCH", body }),
  put: (path, body, options = {}) =>
    apiFetch(path, { ...options, method: "PUT", body }),
  delete: (path, options = {}) =>
    apiFetch(path, { ...options, method: "DELETE" }),
};

export { API_BASE };
