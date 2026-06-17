import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, Space, Typography,
  Popconfirm, Card, Row, Col, App, Tag, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import client from '../../api/client';
import { useAuth } from '../../store/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const roleColors = { admin: 'red', manager: 'orange', staff: 'blue' };
const roleLabels = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

export default function Users() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => client.get('/users').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/users/${editing.id}`, vals)
      : client.post('/users', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      message.success(editing ? 'User updated.' : 'User added.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); message.success('User deleted.'); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => client.put(`/users/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record, password: '' });
    setModalOpen(true);
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '-' },
    { title: 'Role', dataIndex: 'role', render: r => <Tag color={roleColors[r]}>{roleLabels[r]}</Tag> },
    {
      title: 'Status', dataIndex: 'is_active',
      render: (v, r) => (
        <Switch
          checked={v}
          onChange={(checked) => toggleActive.mutate({ id: r.id, is_active: checked })}
          disabled={r.id === currentUser?.id}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      ),
    },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {r.id !== currentUser?.id && (
            <Popconfirm title="Delete this user?" onConfirm={() => remove.mutate(r.id)} okText="Yes" cancelText="No">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><SettingOutlined /> User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add User
        </Button>
      </Row>

      <Card>
        <Table
          dataSource={data?.data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ total: data?.total, pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit User' : 'Add User'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={(v) => {
          if (!v.password) delete v.password;
          save.mutate(v);
        }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'Password (leave blank to keep current)' : 'Password'}
            rules={editing ? [] : [{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="staff">
            <Select>
              <Option value="admin">Admin</Option>
              <Option value="manager">Manager</Option>
              <Option value="staff">Staff</Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Status" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
