import React, { useEffect, useMemo, useState } from "react";
import { Refine, Authenticated, ErrorComponent } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntdApp, theme, Skeleton } from "antd";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Numbers from "./pages/Numbers";
import SipDomains from "./pages/SipDomains";
import AdminUsers from "./pages/AdminUsers";

import Sidebar from "./components/Sidebar";
import HeaderBar from "./components/HeaderBar";
import { api } from "./auth";

type Me = { username: string; roles: string[]; subaccount_name: string };

const App: React.FC = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem("token")) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/me");
        setMe(res.data);
        localStorage.setItem("roles", JSON.stringify(res.data.roles || []));
      } catch {
        // ignore errors; show layout anyway so user can log out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isSuper = useMemo(() => {
    const roles = me?.roles || JSON.parse(localStorage.getItem("roles") || "[]");
    return roles.includes("superadmin");
  }, [me]);

  const resources = useMemo(() => {
    if (isSuper) return [{ name: "admin-users", list: "/admin-users" }];
    return [
      { name: "dashboard", list: "/" },
      { name: "numbers", list: "/numbers" },
      { name: "sip-domains", list: "/sip-domains" },
      { name: "admin-users", list: "/admin-users" },
    ];
  }, [isSuper]);

  return (
    <ConfigProvider
      theme={{
        algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          ...RefineThemes.Blue.token,
          borderRadius: 12,
        },
      }}
    >
      <AntdApp>
        <Refine
          notificationProvider={notificationProvider}
          options={{ syncWithLocation: true }}
          resources={resources}
          Layout={({ children }) =>
            loading ? (
              <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : (
              <ThemedLayoutV2
                // these ALWAYS render
                Sider={() => (
                  <Sidebar
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    isSuper={isSuper}
                  />
                )}
                Header={() => (
                  <HeaderBar
                    mode={mode}
                    onModeChange={(m) => {
                      localStorage.setItem("theme", m);
                      setMode(m);
                    }}
                    collapsed={collapsed}
                    onToggleSider={() => setCollapsed((c) => !c)}
                  />
                )}
                Title={() => null}
              >
                {children}
              </ThemedLayoutV2>
            )
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <Authenticated fallback={<Navigate to={"/login" + window.location.search} />}>
                  {isSuper ? <Navigate to="/admin-users" replace /> : <Dashboard />}
                </Authenticated>
              }
            />
            <Route
              path="/numbers"
              element={
                <Authenticated>
                  <Numbers />
                </Authenticated>
              }
            />
            <Route
              path="/sip-domains"
              element={
                <Authenticated>
                  <SipDomains />
                </Authenticated>
              }
            />
            <Route
              path="/admin-users"
              element={
                <Authenticated>
                  <AdminUsers />
                </Authenticated>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<ErrorComponent />} />
          </Routes>
          <Outlet />
        </Refine>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
