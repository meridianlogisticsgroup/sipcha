import axios from "axios";

// In nginx the API is on the same host; change via VITE_API_URL if needed
const API_URL =
  (import.meta as any).env?.VITE_API_URL ||
  window.__API_URL__ ||
  `${window.location.origin.replace(/:\d+$/, ":8000")}`;

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
  const res = await api.post(`/auth/login?subaccount=${encodeURIComponent(subaccount)}`, { username, password });
  const { access_token } = res.data;
  localStorage.setItem("token", access_token);
  localStorage.setItem("subaccount", subaccount);
  return res.data;
}

export function logout() { localStorage.removeItem("token"); localStorage.removeItem("subaccount"); }
export function isAuthed() { return !!localStorage.getItem("token"); }
