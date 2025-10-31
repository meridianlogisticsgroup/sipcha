import axios from "axios";

// Prefer same-origin reverse proxy (/api)
// Overridable with VITE_API_URL or window.__API_URL__
const API_URL: string =
  (import.meta as any).env?.VITE_API_URL ||
  (window as any).__API_URL__ ||
  "/api";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export function getSubaccountFromURL(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("subaccount");
}

export async function login(subaccount: string, username: string, password: string) {
  // works for both FriendlyName and SID
  const res = await api.post(`/auth/login?subaccount=${encodeURIComponent(subaccount)}`, { username, password });
  const { access_token } = res.data;
  localStorage.setItem("token", access_token);
  localStorage.setItem("subaccount", subaccount);
  return res.data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("subaccount");
}

export function isAuthed() {
  return !!localStorage.getItem("token");
}
