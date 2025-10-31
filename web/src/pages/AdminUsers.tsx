import React, { useEffect, useState } from "react";
import { Table, Typography, Button, Modal, Form, Input, Space, message, Tag } from "antd";
import { api } from "../auth";

const { Title } = Typography;

type Row = { username: string; roles: string[]; updated_at?: string };

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
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Title level={3} style={{ margin: 0 }}>
          Admin Users
        </Title>
        <Button type="primary" onClick={() => setOpen(true)}>
          New Admin
        </Button>
      </Space>

      <Table
        rowKey="username"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: "Username", dataIndex: "username" },
          {
            title: "Roles",
            dataIndex: "roles",
            render: (roles: string[]) => roles?.map((r) => <Tag key={r}>{r}</Tag>),
          },
          { title: "Updated", dataIndex: "updated_at" },
        ]}
      />

      <Modal title="Create Admin User" open={open} onOk={onCreate} onCancel={() => setOpen(false)}>
        <Form layout="vertical" form={form}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password /></Form.Item>
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
