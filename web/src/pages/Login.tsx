import React from "react";
import axios from "axios";
import { Card, Form, Input, Button, Typography, Alert } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

const api = axios.create({ baseURL: "/api" });

export default function Login() {
  const [search] = useSearchParams();
  const company = search.get("company") || "";
  const nav = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values: any) => {
    setError(null); setLoading(true);
    try {
      const { data } = await api.post(`/auth/login?company=${encodeURIComponent(company)}`, {
        username: values.username,
        password: values.password,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("company", company);
      nav("/", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <Card style={{ maxWidth: 420, margin: "64px auto" }}>
        <Typography.Title level={4}>Company required</Typography.Title>
        <Typography.Paragraph>
          Append <code>?company=&lt;slug&gt;</code> to the URL.<br/>
          Example: <code>https://your-domain/login?company=acme</code>
        </Typography.Paragraph>
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: 420, margin: "64px auto" }}>
      <Typography.Title level={3} style={{ textAlign: "center" }}>
        Sign in · {company}
      </Typography.Title>
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" label="Username" rules={[{ required: true }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Sign in
        </Button>
      </Form>
      <Typography.Paragraph style={{ marginTop: 12, textAlign: "center" }}>
        Forgot password? Ask your link owner to reset via SMS.
      </Typography.Paragraph>
    </Card>
  );
}
