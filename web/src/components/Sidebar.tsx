import React, { useMemo } from "react";
import { Layout, Menu, Typography } from "antd";
import { Link, useLocation } from "react-router-dom";
import {
  PhoneOutlined,
  CloudServerOutlined,
  TeamOutlined,
  DashboardOutlined,
  CrownOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const { pathname } = useLocation();
  const selected = [pathname === "/" ? "/dashboard" : pathname];
  const roles: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("roles") || "[]"); } catch { return []; }
  }, []);
  const isSuper = roles.includes("superadmin");

  return (
    <Sider width={240} breakpoint="lg" collapsedWidth={64}>
      <div style={{ color: "white", padding: 16, fontWeight: 800, letterSpacing: 0.5, display: "flex", gap: 8, alignItems: "center" }}>
        <CrownOutlined style={{ fontSize: 18 }} />
        <Typography.Text style={{ color: "white", fontWeight: 800 }}>SIPCHA</Typography.Text>
      </div>
      <Menu theme="dark" mode="inline" selectedKeys={selected} style={{ borderRight: 0 }}>
        {!isSuper && (
          <>
            <Menu.Item key="/dashboard" icon={<DashboardOutlined />}>
              <Link to="/">Dashboard</Link>
            </Menu.Item>
            <Menu.Item key="/numbers" icon={<PhoneOutlined />}>
              <Link to="/numbers">Numbers</Link>
            </Menu.Item>
            <Menu.Item key="/sip-domains" icon={<CloudServerOutlined />}>
              <Link to="/sip-domains">SIP Domains</Link>
            </Menu.Item>
          </>
        )}
        <Menu.Item key="/admin-users" icon={<TeamOutlined />}>
          <Link to="/admin-users">{isSuper ? "Admin Provisioning" : "Admins"}</Link>
        </Menu.Item>
      </Menu>
    </Sider>
  );
};

export default Sidebar;
