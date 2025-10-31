import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Space, Skeleton } from "antd";
import { api } from "../auth";

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [me, setMe] = useState<{ subaccount_name: string; username: string; roles: string[] } | null>(null);
  const [counts, setCounts] = useState({ numbers: 0, domains: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await api.get("/me");
        setMe(meRes.data);
        const roles = meRes.data?.roles || [];
        if (!roles.includes("superadmin")) {
          const [n, d] = await Promise.all([api.get("/twilio/numbers"), api.get("/twilio/sip/domains")]);
          setCounts({ numbers: (n.data.items || []).length, domains: (d.data.items || []).length });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;

  const isSuper = me?.roles?.includes("superadmin");

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Title level={3} style={{ marginBottom: 0 }}>
        {isSuper ? "Welcome, Super Admin" : "Dashboard"}
      </Title>
      <Text type="secondary">
        {me ? (
          <>
            Signed in as <b>{me.username}</b> · Subaccount: <b>{me.subaccount_name}</b>
          </>
        ) : (
          "Loading…"
        )}
      </Text>

      {isSuper ? (
        <Card>
          <Title level={4} style={{ marginTop: 0 }}>Admin Provisioning</Title>
          <Text>Use the “Admin Provisioning” panel in the left menu to create regular admin accounts.</Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card bordered><Statistic title="Phone Numbers" value={counts.numbers} /></Card>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Card bordered><Statistic title="SIP Domains" value={counts.domains} /></Card>
          </Col>
        </Row>
      )}
    </Space>
  );
};

export default Dashboard;
