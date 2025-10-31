import React, { useEffect, useState } from "react";
import { Table, Typography } from "antd";
import { api } from "../auth";

const { Title } = Typography;

type Domain = { sid: string; domain_name: string; friendly_name?: string };

const SipDomains: React.FC = () => {
  const [rows, setRows] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/twilio/sip/domains");
        setRows(res.data.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Title level={3}>SIP Domains</Title>
      <Table
        rowKey="sid"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Friendly Name", dataIndex: "friendly_name" },
          { title: "Domain", dataIndex: "domain_name" },
          { title: "SID", dataIndex: "sid" },
        ]}
      />
    </>
  );
};

export default SipDomains;
