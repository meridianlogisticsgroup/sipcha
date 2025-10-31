import React, { useEffect, useState } from "react";
import { Table, Typography, Tag, Space } from "antd";
import { api } from "../auth";

const { Title } = Typography;

type Num = {
  sid: string;
  phone_number: string;
  friendly_name?: string;
  voice_url?: string;
  sms_url?: string;
};

const Numbers: React.FC = () => {
  const [rows, setRows] = useState<Num[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/twilio/numbers");
        setRows(res.data.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Title level={3}>Numbers</Title>
      <Table
        rowKey="sid"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Number", dataIndex: "phone_number" },
          { title: "Name", dataIndex: "friendly_name" },
          {
            title: "Voice URL",
            dataIndex: "voice_url",
            render: (v: string) => (v ? <Tag>{v}</Tag> : <span style={{ color: "#999" }}>—</span>),
          },
          {
            title: "SMS URL",
            dataIndex: "sms_url",
            render: (v: string) => (v ? <Tag>{v}</Tag> : <span style={{ color: "#999" }}>—</span>),
          },
        ]}
      />
    </Space>
  );
};

export default Numbers;
