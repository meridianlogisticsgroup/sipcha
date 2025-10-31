import React, { useEffect, useState } from "react";
import { Table, Typography, Button, Modal, Form, Input, Space, message, Tag, Card } from "antd";
import { api } from "../auth";

const { Title, Paragraph } = Typography;

type Row = { username: string; roles: string[]; updated_at?: string; phone?: string };

const AdminUsers: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setRows(res.data || []);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    const values = await form.validateFields();
    try {
      await api.post("/admin/users", values);
      message.success("Admin user created");
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Create failed");
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Title level={3} style={{ margin: 0 }}>Admin Provisioning</Title>
      <Card>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          As <b>Super Admin</b>, your only responsibility is to create and manage admin users.
          Each admin must have a phone number for SMS-based 2FA and password reset.
        </Paragraph>
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
          <div />
          <Button type="primary" onClick={() => setOpen(true)}>New Admin</Button>
        </Space>
        <Table
          rowKey="username"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "Username", dataIndex: "username" },
            { title: "Phone", dataIndex: "phone", render: (v) => v || <span style={{color:"#999"}}>—</span> },
            {
              title: "Roles",
              dataIndex: "roles",
              render: (roles: string[]) => (roles?.length ? roles.map((r) => <Tag key={r}>{r}</Tag>) : <span style={{color:"#999"}}>—</span>),
            },
            { title: "Updated", dataIndex: "updated_at" },
          ]}
        />
      </Card>

      <Modal title="Create Admin User" open={open} onOk={onCreate} onCancel={() => setOpen(false)}>
        <Form layout="vertical" form={form}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item
            name="phone"
            label="Phone (E.164)"
            tooltip="e.g. +16045551234"
            rules={[
              { required: true, message: "Phone is required for SMS 2FA/reset" },
              { pattern: /^\+[1-9]\d{6,14}$/, message: "Must be E.164 format, e.g. +16045551234" },
            ]}
          >
            <Input placeholder="+16045551234" />
          </Form.Item>
          <Form.Item name="roles" label="Roles (comma separated)" tooltip="default: admin">
            <Input placeholder="admin" onBlur={(e) => {
              const v = e.target.value?.trim();
              form.setFieldsValue({ roles: v });
            }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AdminUsers;
