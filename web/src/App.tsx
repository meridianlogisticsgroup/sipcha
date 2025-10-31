import React, { useEffect, useMemo, useState } from "react";
import { Refine, Authenticated, ErrorComponent } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntdApp, theme, Skeleton, Grid } from "antd";
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

  // --- Responsive Sider state ---
  const screens = Grid.useBreakpoint();
  const belowLg = !screens.lg; // lg ~= 992px
  const [collapsed, setCollapsed] = useState<boolean>(belowLg);

  useEffect(() => {
    // auto-collapse when viewport drops below lg; expand back when >= lg
    setCollapsed(belowLg);
  }, [belowLg]);

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
        // ignore
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

  const RootElement = isSuper ? <Navigate to="/admin-users" replace /> : <Dashboard />;

  return (
    <ConfigProvider
      theme={{
        algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: RefineThemes.Blue.token.colorPrimary, borderRadius: 12 },
        components: { Card: { padding: 16, borderRadiusLG: 16 } },
      }}
    >
      <AntdApp>
        <Refine
          notificationProvider={notificationProvider}
          options={{ syncWithLocation: true }}
          resources={resources}
          Layout={({ children }) =>
            loading ? (
              <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
            ) : (
              <ThemedLayoutV2
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
                    collapsed={collapsed}
                    onModeChange={(m) => {
                      localStorage.setItem("theme", m);
                      setMode(m);
                    }}
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
                  {RootElement}
                </Authenticated>
              }
            />
            <Route path="/numbers" element={<Authenticated><Numbers /></Authenticated>} />
            <Route path="/sip-domains" element={<Authenticated><SipDomains /></Authenticated>} />
            <Route path="/admin-users" element={<Authenticated><AdminUsers /></Authenticated>} />
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
