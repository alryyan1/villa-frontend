import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Space,
  Popconfirm, Card, Row, Col, App, Badge,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { TextArea } = Input;

export default function Guests() {
  usePageTitle('Guests');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { setToolbar, clearToolbar } = useHeaderToolbar();

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><UserOutlined /><span style={{ fontWeight: 600 }}>Guest Management</span></Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add Guest
        </Button>
      </div>
    );
    return () => clearToolbar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['guests', search],
    queryFn: () => client.get('/guests', { params: { search } }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/guests/${editing.id}`, vals)
      : client.post('/guests', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      message.success(editing ? 'Guest updated.' : 'Guest added.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/guests/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); message.success('Guest deleted.'); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '-' },
    { title: 'ID / Passport', dataIndex: 'id_number', render: v => v || '-' },
    { title: 'Nationality', dataIndex: 'nationality', render: v => v || '-' },
    { title: 'Bookings', dataIndex: 'bookings_count', render: v => <Badge count={v} color="blue" showZero /> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this guest?" onConfirm={() => remove.mutate(r.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Input.Search
          placeholder="Search by name, phone, or ID..."
          onSearch={setSearch}
          onChange={e => !e.target.value && setSearch('')}
          style={{ marginBottom: 16, maxWidth: 360 }}
          allowClear
        />
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 700 }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Guest' : 'Add Guest'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="id_number" label="ID / Passport Number">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="nationality" label="Nationality">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
