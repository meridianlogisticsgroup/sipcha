import React from "react";
import { Layout, Menu, Typography } from "antd";
import { Link, useLocation } from "react-router-dom";
import {
  PhoneOutlined,
  CloudServerOutlined,
  TeamOutlined,
  DashboardOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const Sidebar: React.FC<{
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  isSuper: boolean;
}> = ({ collapsed, onCollapse, isSuper }) => {
  const { pathname } = useLocation();
  const selected = [pathname === "/" ? "/dashboard" : pathname];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={240}
      collapsedWidth={64}
      breakpoint="lg"
    >
      <div style={{ color: "white", padding: 16, fontWeight: 800, letterSpacing: 0.5 }}>
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
