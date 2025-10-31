import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Tag,
  Card,
  Alert,
  Tooltip,
} from "antd";
import { PlusOutlined, ReloadOutlined, PhoneOutlined } from "@ant-design/icons";
import { api } from "../auth";

const { Title, Text, Paragraph } = Typography;

type Row = { username: string; roles: string[]; updated_at?: string; phone?: string };

const phoneE164 = (v: string) => /^\+?[1-9]\d{6,15}$/.test(v);

const AdminUsers: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const roles = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("roles") || "[]") as string[]; } catch { return []; }
  }, []);
  const isSuper = roles.includes("superadmin");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setRows((res.data || []).sort((a: Row, b: Row) => a.username.localeCompare(b.username)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    const values = await form.validateFields();
    try {
      // Superadmin provisions *regular* admins by default
      const payload = {
        username: values.username,
        password: values.password,
        phone: values.phone || undefined,
        roles: ["admin"],
      };
      await api.post("/admin/users", payload);
      message.success("Admin user created");
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || "Create failed");
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card bordered style={{ borderRadius: 12 }}>
        <Title level={3} style={{ margin: 0 }}>
          {isSuper ? "Admin Provisioning" : "Admins"}
        </Title>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          {isSuper ? (
            <>
              As <b>Super Admin</b>, your only responsibility is to create and manage admin users. Each admin should have a
              phone number for SMS-based 2FA and password reset.
            </>
          ) : (
            <>Manage admin users for this subaccount.</>
          )}
        </Paragraph>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div />
          <Space>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={load} />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              New Admin
            </Button>
          </Space>
        </div>

        <Table<Row>
          rowKey="username"
          loading={loading}
          dataSource={rows}
          bordered
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          sticky
          columns={[
            { title: "Username", dataIndex: "username", width: 220 },
            {
              title: "Phone",
              dataIndex: "phone",
              width: 220,
              render: (v: string | undefined) =>
                v ? (
                  <Space><PhoneOutlined /> <Text>{v}</Text></Space>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: "Roles",
              dataIndex: "roles",
              render: (roles: string[]) =>
                roles?.map((r) => (
                  <Tag key={r} color={r === "superadmin" ? "gold" : "blue"}>
                    {r}
                  </Tag>
                )),
            },
            { title: "Updated", dataIndex: "updated_at", width: 260 },
          ]}
        />

        {isSuper && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            message="Tip"
            description="Create regular admin users here. Super Admin is only for provisioning and should not be used for day-to-day operations."
            showIcon
          />
        )}
      </Card>

      <Modal
        title="Create Admin"
        open={open}
        onOk={onCreate}
        onCancel={() => setOpen(false)}
        okText="Create"
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="e.g. ops.lead" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone (E.164)"
            tooltip="Used later for SMS 2FA and password reset"
            rules={[
              {
                validator: (_, v) =>
                  !v || phoneE164(v) ? Promise.resolve() : Promise.reject(new Error("Use E.164 format, e.g. +15551234567")),
              },
            ]}
          >
            <Input placeholder="+15551234567" />
          </Form.Item>
          <Form.Item name="password" label="Temporary Password" rules={[{ required: true, min: 8 }]}>
            <Input.Password placeholder="Min 8 characters" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AdminUsers;
