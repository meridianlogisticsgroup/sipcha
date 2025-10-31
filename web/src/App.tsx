import React from "react";
import { BrowserRouter, Routes, Route, Link, Outlet, Navigate } from "react-router-dom";
import { Refine, DataProvider } from "@refinedev/core";
import { ThemedLayoutV2, ThemedSiderV2, ThemedHeaderV2 } from "@refinedev/antd";
import { ConfigProvider, theme } from "antd";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Numbers from "./pages/Numbers";
import "antd/dist/reset.css";

type Row = Record<string, any>;
const store: Record<string, Row[]> = {
  agents: [
    { id: "agent_1", name: "Alice", role: "Admin" },
    { id: "agent_2", name: "Bob", role: "Agent" },
  ],
  numbers: [
    { id: "num_1", e164: "+1 438-799-6683", label: "Main Line" },
    { id: "num_2", e164: "+1 604-555-0101", label: "Support" },
  ],
};

const memoryProvider: DataProvider = {
  getList: async ({ resource }) => {
    const data = store[resource] ?? [];
    return { data, total: data.length };
  },
  getOne: async ({ resource, id }) => {
    const item = (store[resource] ?? []).find((r) => String(r.id) === String(id));
    if (!item) throw new Error("Not found");
    return { data: item };
  },
  create: async ({ resource, variables }) => {
    const newItem = { id: crypto.randomUUID(), ...variables };
    store[resource] = [...(store[resource] ?? []), newItem];
    return { data: newItem };
  },
  update: async ({ resource, id, variables }) => {
    const list = store[resource] ?? [];
    const idx = list.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) throw new Error("Not found");
    const updated = { ...list[idx], ...variables };
    store[resource] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
    return { data: updated };
  },
  deleteOne: async ({ resource, id }) => {
    const list = store[resource] ?? [];
    const idx = list.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) throw new Error("Not found");
    const [removed] = list.splice(idx, 1);
    store[resource] = list;
    return { data: removed };
  },
  getApiUrl: () => "",
  custom: async () => ({ data: [] }),
  createMany: async () => ({ data: [] }),
  deleteMany: async () => ({ data: [] }),
  updateMany: async () => ({ data: [] }),
};

function Shell() {
  return (
    <ThemedLayoutV2
      Sider={() => <ThemedSiderV2 Title={() => <Link to="/">Sipcha</Link>} />}
      Header={() => <ThemedHeaderV2 sticky />}
    >
      <Outlet />
    </ThemedLayoutV2>
  );
}

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { borderRadius: 10 } }}>
      <BrowserRouter>
        <Refine
          dataProvider={memoryProvider}
          resources={[
            { name: "dashboard", list: "/" },
            { name: "agents", list: "/agents" },
            { name: "numbers", list: "/numbers" },
          ]}
        >
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Dashboard />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/numbers" element={<Numbers />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Refine>
      </BrowserRouter>
    </ConfigProvider>
  );
}
