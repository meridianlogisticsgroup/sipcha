import React, { useMemo, useState } from "react";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { login, getSubaccountFromURL } from "../auth";

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const subaccount = useMemo(() => getSubaccountFromURL(), []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFinish = async (values: any) => {
    setErr(null);
    if (!subaccount) {
      setErr("Missing ?subaccount=friendlyName in URL.");
      return;
    }
    setLoading(true);
    try {
      await login(subaccount, values.username, values.password);
      window.location.href = "/" + window.location.search;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Login failed";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "70vh", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 420, borderRadius: 12 }}>
        <Title level={3} style={{ marginBottom: 8 }}>Admin Login</Title>
        <Text type="secondary">
          {subaccount ? `Subaccount: ${subaccount}` : "Provide ?subaccount=YourSubaccountName in the URL"}
        </Text>
        <div style={{ height: 12 }} />
        {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 12 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} disabled={!subaccount}>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
