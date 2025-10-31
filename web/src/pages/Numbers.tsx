import React from "react";
import { useTable } from "@refinedev/core";
import { Card, Table, Typography } from "antd";

export default function Numbers() {
  const { tableQueryResult } = useTable({ resource: "numbers" });
  const data = tableQueryResult?.data?.data ?? [];
  return (
    <Card>
      <Typography.Title level={3}>Numbers</Typography.Title>
      <Table
        rowKey="id"
        dataSource={data}
        pagination={false}
        columns={[
          { title: "ID", dataIndex: "id" },
          { title: "E.164", dataIndex: "e164" },
          { title: "Label", dataIndex: "label" },
        ]}
      />
    </Card>
  );
}
