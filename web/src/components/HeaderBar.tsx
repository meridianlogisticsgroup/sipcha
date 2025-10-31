import React, { useEffect, useState } from "react";
import { Layout, Space, Switch, Avatar, Typography, Dropdown } from "antd";
import { MoonOutlined, SunOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { api } from "../auth";
import { logout } from "../auth";

const { Header } = Layout;
const { Text } = Typography;

const initials = (name?: string) =>
  (name || "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

const HeaderBar: React.FC<{ mode: "light" | "dark"; onModeChange: (m: "light" | "dark") => void }> = ({
  mode,
  onModeChange,
}) => {
  const [me, setMe] = useState<{ username: string; subaccount_name: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/me");
        setMe(res.data);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 16,
        padding: "0 16px",
      }}
    >
      <Space size="middle">
        <Space style={{ marginRight: 12 }}>
          <SunOutlined />
          <Switch
            checked={mode === "dark"}
            onChange={(checked) => onModeChange(checked ? "dark" : "light")}
          />
          <MoonOutlined />
        </Space>

        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "user", icon: <UserOutlined />, label: me?.username || "User" },
              { type: "divider" as const },
              {
                key: "logout",
                icon: <LogoutOutlined />,
                label: "Logout",
                onClick: () => {
                  logout();
                  window.location.href = "/login" + window.location.search;
                },
              },
            ],
          }}
        >
          <Space style={{ cursor: "pointer" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {me ? me.subaccount_name : ""}
            </Text>
            <Avatar size="small">{initials(me?.username)}</Avatar>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default HeaderBar;
