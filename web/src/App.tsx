import React from "react";
import { Refine, Authenticated, ErrorComponent } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntdApp } from "antd";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Numbers from "./pages/Numbers";
import SipDomains from "./pages/SipDomains";
import AdminUsers from "./pages/AdminUsers";
import { isAuthed } from "./auth";
import Sidebar from "./components/Sidebar";
import RequireNotSuper from "./components/RequireNotSuper";

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  isAuthed() ? <>{children}</> : <Navigate to={"/login" + window.location.search} />;

const App: React.FC = () => {
  return (
    <ConfigProvider theme={RefineThemes.Blue}>
      <AntdApp>
        <Refine
          notificationProvider={notificationProvider}
          options={{ syncWithLocation: true }}
          resources={[
            { name: "dashboard", list: "/" },
            { name: "numbers", list: "/numbers" },
            { name: "sip-domains", list: "/sip-domains" },
            { name: "admin-users", list: "/admin-users" },
          ]}
          Layout={({ children }) => <ThemedLayoutV2 Sider={() => <Sidebar />}>{children}</ThemedLayoutV2>}
        >
          <Routes>
            <Route
              path="/"
              element={
                <Authenticated fallback={<Navigate to={"/login" + window.location.search} />}>
                  <Protected>
                    <RequireNotSuper><Dashboard /></RequireNotSuper>
                  </Protected>
                </Authenticated>
              }
            />
            <Route
              path="/numbers"
              element={
                <Protected>
                  <RequireNotSuper><Numbers /></RequireNotSuper>
                </Protected>
              }
            />
            <Route
              path="/sip-domains"
              element={
                <Protected>
                  <RequireNotSuper><SipDomains /></RequireNotSuper>
                </Protected>
              }
            />
            <Route
              path="/admin-users"
              element={
                <Protected>
                  <AdminUsers />
                </Protected>
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
