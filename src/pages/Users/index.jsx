import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Space,
  Popconfirm, Card, Row, Col, App, Switch, Checkbox, Divider, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import client from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';
import { ALL_PAGE_KEYS } from '../../config/navPages';

const { Text } = Typography;
const ALL_PAGE_VALUES = ALL_PAGE_KEYS.map((p) => p.key);

export default function Users() {
  usePageTitle('Users');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const { setToolbar, clearToolbar } = useHeaderToolbar();

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><SettingOutlined /><span style={{ fontWeight: 600 }}>User Management</span></Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add User
        </Button>
      </div>
    );
    return () => clearToolbar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    form.setFieldsValue({ ...record, password: '', permissions: record.permissions ?? ALL_PAGE_VALUES });
    setModalOpen(true);
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '-' },
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
        width={520}
      >
        <Form form={form} layout="vertical" size="small" onFinish={(v) => {
          if (!v.password) delete v.password;
          save.mutate(v);
        }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone" style={{ marginBottom: 10 }}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]} style={{ marginBottom: 10 }}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label={editing ? 'Password (blank = unchanged)' : 'Password'}
                rules={editing ? [] : [{ required: true, min: 8 }]}
                style={{ marginBottom: 10 }}
              >
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="is_active" label="Status" valuePropName="checked" initialValue={true} style={{ marginBottom: 4 }}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} orientation="left" orientationMargin={0}>
            <Text style={{ fontSize: 12 }} type="secondary">Visible Pages</Text>
          </Divider>
          {editing?.role === 'admin' ? (
            <Text type="secondary">Admins always have access to every page.</Text>
          ) : (
            <Form.Item name="permissions" initialValue={ALL_PAGE_VALUES} style={{ marginBottom: 0 }}>
              <Checkbox.Group style={{ width: '100%' }}>
                <Row gutter={[8, 4]}>
                  {ALL_PAGE_KEYS.map((p) => (
                    <Col span={8} key={p.key}>
                      <Checkbox value={p.key}>{p.label}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
