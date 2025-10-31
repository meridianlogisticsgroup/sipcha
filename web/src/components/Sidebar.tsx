import React, { useEffect, useState } from "react";
import { Layout, Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import { PhoneOutlined, CloudServerOutlined, TeamOutlined, DashboardOutlined } from "@ant-design/icons";
import { api } from "../auth";

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const { pathname } = useLocation();
  const selected = [pathname === "/" ? "/dashboard" : pathname];
  const [roles, setRoles] = useState<string[] | null>(null);
  const isSuper = roles?.includes("superadmin");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/me");
        setRoles(r.data?.roles || []);
      } catch {
        setRoles([]);
      }
    })();
  }, []);

  return (
    <Sider width={232} breakpoint="lg" collapsedWidth={64}>
      <div style={{ color: "white", padding: 16, fontWeight: 700 }}>SIPCHA</div>
      <Menu theme="dark" mode="inline" selectedKeys={selected}>
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
        {/* Superadmin and regular admins both see Admin Users, but only superadmin can use it (API-guarded). */}
        <Menu.Item key="/admin-users" icon={<TeamOutlined />}>
          <Link to="/admin-users">Admin Users</Link>
        </Menu.Item>
      </Menu>
    </Sider>
  );
};

export default Sidebar;
