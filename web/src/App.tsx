import React from "react";
import { Refine } from "@refinedev/core";
import { notificationProvider, RefineThemes, ThemedLayoutV2 } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntdApp, theme as antdTheme, Button } from "antd";
import { Authenticated, ErrorComponent } from "@refinedev/core";
import { Outlet, Route, Routes, Navigate, useNavigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { isAuthed, logout } from "./auth";

const TitleBar: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px"}}>
      <div style={{fontWeight:700}}>SIPCHA Admin</div>
      {isAuthed() && (
        <Button
          onClick={() => { logout(); navigate("/login" + window.location.search); }}
          size="small"
        >
          Logout
        </Button>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider theme={RefineThemes.Blue}>
      <AntdApp>
        <Refine
          notificationProvider={notificationProvider}
          Layout={({ children }) => (
            <ThemedLayoutV2 Title={() => <TitleBar />}>{children}</ThemedLayoutV2>
          )}
          resources={[{ name: "dashboard", list: "/"}]}
          options={{ syncWithLocation: true }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <Authenticated fallback={<Navigate to={"/login" + window.location.search} />}>
                  <Dashboard />
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
