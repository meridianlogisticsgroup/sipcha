import { Refine, useTable } from "@refinedev/core";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"; // ⬅ add Navigate
import React from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const dataProvider = {
  getList: async ({ resource }: any) => {
    try {
      const res = await api.get(`/${resource}`, { headers: authHeader() });
      // handle both array and `{data:..., total:...}`
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const total = Array.isArray(res.data) ? data.length : res.data?.total ?? data.length;
      return { data, total };
    } catch (err: any) {
      // on 401, return empty list so Refine doesn't explode
      if (err?.response?.status === 401) return { data: [], total: 0 };
      throw err;
    }
  },
} as any;

function Agents() {
  const { tableQueryResult } = useTable({ resource: "agents" });
  const items = tableQueryResult.data?.data ?? [];
  return (
    <div style={{ padding: 16 }}>
      <h1>Agents</h1>
      <table>
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>{items.map((a: any) => <tr key={a.id}><td>{a.id}</td><td>{a.name}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Login() {
  const [to, setTo] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  const nav = useNavigate();

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/auth/request", { to });
    setSent(true);
  }
  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    const { token } = (await api.post("/auth/verify", { to, code })).data;
    localStorage.setItem("token", token);
    nav("/", { replace: true });
  }

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h1>Login</h1>
      {!sent ? (
        <form onSubmit={onStart}>
          <input placeholder="+1..." value={to} onChange={(e)=>setTo(e.target.value)} style={{ width:"100%" }} />
          <button style={{ marginTop: 12 }}>Send Code</button>
        </form>
      ) : (
        <form onSubmit={onVerify}>
          <input placeholder="123456" value={code} onChange={(e)=>setCode(e.target.value)} style={{ width:"100%" }} />
          <button style={{ marginTop: 12 }}>Verify</button>
        </form>
      )}
    </div>
  );
}

// ⬇️ Hard guard: don't render children if no token
function Guard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Refine dataProvider={dataProvider}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Agents /></Guard>} />
          {/* SPA fallback (optional, nice for deep links):
          <Route path="*" element={<Navigate to="/" replace />} /> */}
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
