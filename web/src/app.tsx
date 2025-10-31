import { Refine, useTable } from "@refinedev/core";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import React from "react";
import axios from "axios";

/** Simple API client that targets the path-routed backend */
const api = axios.create({ baseURL: "/api" });

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Minimal Refine data provider with getList only (enough to render a table) */
const dataProvider = {
  getList: async ({ resource }: any) => {
    const res = await api.get(`/${resource}`, { headers: authHeader() });
    return { data: res.data, total: res.data.length ?? 0 };
  },
} as any;

/** Auth helpers */
async function requestCode(to: string) {
  await api.post("/auth/request", { to });
}
async function verifyCode(to: string, code: string) {
  const res = await api.post("/auth/verify", { to, code });
  return res.data;
}

function Agents() {
  const { tableQueryResult } = useTable({ resource: "agents" });
  const items = tableQueryResult.data?.data ?? [];
  return (
    <div style={{ padding: 16 }}>
      <h1>Agents</h1>
      <table>
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
          {items.map((a: any) => (
            <tr key={a.id}><td>{a.id}</td><td>{a.name}</td></tr>
          ))}
        </tbody>
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
    await requestCode(to);
    setSent(true);
  }
  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    const { token } = await verifyCode(to, code);
    localStorage.setItem("token", token);
    nav("/");
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

function Guard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const nav = useNavigate();
  React.useEffect(() => { if (!token) nav("/login"); }, [token]);
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Refine dataProvider={dataProvider}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Agents /></Guard>} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
