import React from "react";
import { useList } from "@refinedev/core";
import { Card, Statistic, Row, Col, Space, Typography } from "antd";

export default function Dashboard() {
  const { data: agents } = useList({ resource: "agents" });
  const { data: numbers } = useList({ resource: "numbers" });

  const agentCount = agents?.total ?? agents?.data?.length ?? 0;
  const numberCount = numbers?.total ?? numbers?.data?.length ?? 0;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Overview
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Agents" value={agentCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Phone Numbers" value={numberCount} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
