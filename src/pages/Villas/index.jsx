import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, InputNumber, Switch, Segmented,
  Tag, Space, Typography, Popconfirm, Card, Row, Col, App, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, CheckCircleFilled } from '@ant-design/icons';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const statusColors = { available: 'green', occupied: 'orange', maintenance: 'red' };
const statusLabels = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance' };

const VILLA_TYPES = [
  { value: 'Seashell', label: 'Seashell — Unique living experience',     defaultRooms: 3, color: '#531dab' },
  { value: 'Coral',    label: 'Coral — Invigorate your senses',           defaultRooms: 4, color: '#874d00' },
  { value: 'Garden',   label: 'Garden — One step away from nature',       defaultRooms: 2, color: '#237804' },
  { value: 'Breeze',   label: 'Breeze — Sea views at your doorstep',      defaultRooms: 2, color: '#0958d9' },
  { value: 'Pearl',    label: 'Pearl — Ultimate in luxury beachfront',    defaultRooms: 2, color: '#d46b08' },
];

const categoryColor = Object.fromEntries(VILLA_TYPES.map(t => [t.value, t.color]));

export default function Villas() {
  usePageTitle('Villas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [managedFilter, setManagedFilter] = useState('all');
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const managedParam = managedFilter === 'managed' ? 1 : managedFilter === 'unmanaged' ? 0 : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['villas', search, page, managedFilter],
    queryFn: () => client.get('/villas', { params: { search, page, is_managed: managedParam } }).then(r => r.data),
  });

  const { data: villaStats } = useQuery({
    queryKey: ['villas-stats'],
    queryFn: () => client.get('/villas/stats').then(r => r.data),
  });

  const { data: owners } = useQuery({
    queryKey: ['owners-all'],
    queryFn: () => client.get('/owners', { params: { per_page: 200 } }).then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/villas/${editing.id}`, vals)
      : client.post('/villas', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas'] });
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villas-stats'] });
      message.success(editing ? 'Villa updated.' : 'Villa added.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/villas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['villas'] }); qc.invalidateQueries({ queryKey: ['villas-stats'] }); message.success('Villa deleted.'); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const handleCategoryChange = (val) => {
    const type = VILLA_TYPES.find(t => t.value === val);
    if (type) form.setFieldValue('num_rooms', type.defaultRooms);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record, owner_id: record.owner?.id, is_managed: record.is_managed ?? false });
    setModalOpen(true);
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    {
      title: 'Contract', dataIndex: 'is_managed', width: 80, align: 'center',
      render: v => v
        ? <Tooltip title="Managed contract"><CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} /></Tooltip>
        : <span style={{ color: '#d9d9d9', fontSize: 18 }}>—</span>,
    },
    { title: 'Villa Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: 'Type', dataIndex: 'category',
      render: v => v
        ? <Tag color={categoryColor[v] ?? 'default'}>{v}</Tag>
        : <span style={{ color: '#bfbfbf' }}>—</span>,
      filters: VILLA_TYPES.map(t => ({ text: t.value, value: t.value })),
      onFilter: (val, record) => record.category === val,
    },
    { title: 'Rooms', dataIndex: 'num_rooms', width: 70, render: v => v ?? 2, sorter: (a, b) => (a.num_rooms ?? 2) - (b.num_rooms ?? 2) },
    { title: 'Owner', dataIndex: ['owner', 'name'] },
    { title: 'Price/Night', dataIndex: 'price_per_night', render: v => `OMR ${Number(v).toLocaleString()}`, sorter: (a, b) => a.price_per_night - b.price_per_night },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this villa?" onConfirm={() => remove.mutate(r.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><HomeOutlined /> Villa Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add Villa
        </Button>
      </Row>

      <Card>
        <Row gutter={12} style={{ marginBottom: 16 }} align="middle">
          <Col>
            <Input.Search
              placeholder="Search by name..."
              onSearch={v => { setSearch(v); setPage(1); }}
              onChange={e => { if (!e.target.value) { setSearch(''); setPage(1); } }}
              style={{ width: 280 }}
              allowClear
            />
          </Col>
          <Col>
            <Segmented
              value={managedFilter}
              onChange={v => { setManagedFilter(v); setPage(1); }}
              options={[
                { label: `All Villas${villaStats ? ` (${villaStats.total})` : ''}`, value: 'all' },
                { label: `✓ With Contract${villaStats ? ` (${villaStats.managed})` : ''}`, value: 'managed' },
                { label: `No Contract${villaStats ? ` (${villaStats.unmanaged})` : ''}`, value: 'unmanaged' },
              ]}
            />
          </Col>
        </Row>
        <Table
          dataSource={data?.data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: data?.total,
            pageSize: 20,
            onChange: (p) => setPage(p),
            showTotal: (t) => `Total ${t} villas`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Villa' : 'Add Villa'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={620}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Villa Number / Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. 101/01/RHRS" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="Villa Type">
                <Select placeholder="Select type" allowClear onChange={handleCategoryChange}>
                  {VILLA_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      <Tag color={t.color} style={{ marginRight: 6 }}>{t.value}</Tag>
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>{t.defaultRooms} rooms</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="num_rooms" label="Rooms" initialValue={2}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="owner_id" label="Owner" rules={[{ required: true }]}>
                <Select placeholder="Select owner" showSearch optionFilterProp="children">
                  {owners?.map(o => <Option key={o.id} value={o.id}>{o.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price_per_night" label="Price per Night (OMR)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="available">
                <Select>
                  <Option value="available">Available</Option>
                  <Option value="occupied">Occupied</Option>
                  <Option value="maintenance">Maintenance</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_managed" label="Management Contract" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
