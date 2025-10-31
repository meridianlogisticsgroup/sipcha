import React, { useEffect, useState } from "react";
import { Layout, Space, Switch, Avatar, Typography, Dropdown, Button } from "antd";
import {
  MoonOutlined,
  SunOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { api, logout } from "../auth";

const { Header } = Layout;
const { Text } = Typography;

const initials = (name?: string) =>
  (name || "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

const HeaderBar: React.FC<{
  mode: "light" | "dark";
  onModeChange: (m: "light" | "dark") => void;
  collapsed: boolean;
  onToggleSider: () => void;
}> = ({ mode, onModeChange, collapsed, onToggleSider }) => {
  const [me, setMe] = useState<{ username: string; subaccount_name: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/me");
        setMe(res.data);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        gap: 16,
      }}
    >
      <Space>
        <Button
          type="text"
          aria-label="Toggle menu"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleSider}
        />
        <Text strong style={{ letterSpacing: 0.3 }}>SIPCHA Admin</Text>
      </Space>

      <Space size="middle">
        <Space>
          <SunOutlined />
          <Switch checked={mode === "dark"} onChange={(c) => onModeChange(c ? "dark" : "light")} />
          <MoonOutlined />
        </Space>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "user", icon: <UserOutlined />, label: me?.username || "User" },
              { type: "divider" },
              { key: "logout", icon: <LogoutOutlined />, label: "Logout", onClick: () => { logout(); window.location.href = "/login" + window.location.search; } },
            ],
          }}
        >
          <Space style={{ cursor: "pointer" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{me ? me.subaccount_name : ""}</Text>
            <Avatar size="small">{initials(me?.username)}</Avatar>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default HeaderBar;
