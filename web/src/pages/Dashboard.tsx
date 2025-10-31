import React from "react";
import { Card, Typography } from "antd";

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const sub = localStorage.getItem("subaccount") || "unknown";
  return (
    <Card>
      <Title level={3}>Dashboard</Title>
      <Text>Authenticated. Subaccount: <b>{sub}</b></Text>
      <div style={{height: 8}} />
      <Text type="secondary">
        Add pages that call your FastAPI endpoints to manage SIP domains, credentials, numbers, etc.
      </Text>
    </Card>
  );
};

export default Dashboard;
