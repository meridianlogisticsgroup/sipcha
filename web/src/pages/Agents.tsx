import React from "react";
import { useTable } from "@refinedev/core";
import { Card, Table, Typography } from "antd";

export default function Agents() {
  const { tableQueryResult } = useTable({ resource: "agents" });
  const data = tableQueryResult?.data?.data ?? [];
  return (
    <Card>
      <Typography.Title level={3}>Agents</Typography.Title>
      <Table
        rowKey="id"
        dataSource={data}
        pagination={false}
        columns={[
          { title: "ID", dataIndex: "id" },
          { title: "Name", dataIndex: "name" },
          { title: "Role", dataIndex: "role" },
        ]}
      />
    </Card>
  );
}
