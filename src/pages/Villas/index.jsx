import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, InputNumber,
  Tag, Space, Card, Row, Col, App, Tooltip, DatePicker, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, HomeOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocation } from 'react-router-dom';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { Option } = Select;
const { TextArea } = Input;

const statusColors = { available: 'green', occupied: 'orange', maintenance: 'red' };
const statusLabels = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance' };

const VILLA_TYPES = [
  { value: 'Seashell', label: 'Seashell — Unique living experience', defaultRooms: 3, color: '#531dab' },
  { value: 'Coral', label: 'Coral — Invigorate your senses', defaultRooms: 4, color: '#874d00' },
  { value: 'Garden', label: 'Garden — One step away from nature', defaultRooms: 2, color: '#237804' },
  { value: 'Breeze', label: 'Breeze — Sea views at your doorstep', defaultRooms: 2, color: '#0958d9' },
  { value: 'Pearl', label: 'Pearl — Ultimate in luxury beachfront', defaultRooms: 2, color: '#d46b08' },
];

const categoryColor = Object.fromEntries(VILLA_TYPES.map(t => [t.value, t.color]));

const contractStatus = (endDate) => {
  if (!endDate) return null;
  const daysLeft = dayjs(endDate).diff(dayjs(), 'day');
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'near';
  return 'ok';
};

export default function Villas() {
  usePageTitle('Villas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [contractActive, setContractActive] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { setToolbar, clearToolbar } = useHeaderToolbar();
  const location = useLocation();

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><HomeOutlined /><span style={{ fontWeight: 600 }}>Villa Management</span></Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          Add Villa
        </Button>
      </div>
    );
    return () => clearToolbar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['villas', search, typeFilter, contractActive],
    queryFn: () => client.get('/villas', {
      params: { search, per_page: 999, ...(contractActive && { contract_active: true }), ...(typeFilter && { category: typeFilter }) },
    }).then(r => r.data),
  });

  const { data: owners } = useQuery({
    queryKey: ['owners-all'],
    queryFn: () => client.get('/owners').then(r => r.data),
  });

  const formatVillaPayload = (vals) => ({
    ...vals,
    contract_start_date: vals.contract_start_date ? dayjs(vals.contract_start_date).format('YYYY-MM-DD') : null,
    contract_end_date: vals.contract_end_date ? dayjs(vals.contract_end_date).format('YYYY-MM-DD') : null,
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/villas/${editing.id}`, formatVillaPayload(vals))
      : client.post('/villas', formatVillaPayload(vals)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas'] });
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      message.success(editing ? 'Villa updated.' : 'Villa added.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/villas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['villas'] }); message.success('Villa deleted.'); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const handleCategoryChange = (val) => {
    const type = VILLA_TYPES.find(t => t.value === val);
    if (type) form.setFieldValue('num_rooms', type.defaultRooms);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      owner_id: record.owner?.id,
      contract_start_date: record.contract_start_date ? dayjs(record.contract_start_date) : null,
      contract_end_date: record.contract_end_date ? dayjs(record.contract_end_date) : null,
      contract_monthly_value: record.contract_monthly_value ?? null,
    });
    setModalOpen(true);
  };

  // Auto-open edit dialog when navigated from Villa Map
  useEffect(() => {
    const editId = location.state?.editVillaId;
    if (!editId || !data?.data) return;
    const villa = data.data.find(v => v.id === editId);
    if (villa) openEdit(villa);
  }, [data, location.state?.editVillaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    // { title: '#', dataIndex: 'id', width: 60 },

    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Owner', dataIndex: ['owner', 'name'] },
    {
      title: 'Type', dataIndex: 'category',
      render: v => v
        ? <Tag color={categoryColor[v] ?? 'default'}>{v}</Tag>
        : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    { title: 'Price/Night', dataIndex: 'price_per_night', render: v => `OMR ${Number(v).toLocaleString()}`, sorter: (a, b) => a.price_per_night - b.price_per_night },
    {
      width: 200,
      title: 'Contract Period', key: 'contract_period',
      render: (_, r) => {
        if (!r.contract_start_date || !r.contract_end_date) return '—';
        const status = contractStatus(r.contract_end_date);
        const text = `${dayjs(r.contract_start_date).format('DD MMM YY')} → ${dayjs(r.contract_end_date).format('DD MMM YY')}`;
        const daysLeft = dayjs(r.contract_end_date).diff(dayjs(), 'day');
        if (status === 'expired') {
          return (
            <Tooltip title="Contract expired">
              <span style={{ color: '#cf1322', fontWeight: 500 }}>{text}</span>
            </Tooltip>
          );
        }
        if (status === 'near') {
          return (
            <Tooltip title={`Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <WarningOutlined style={{ color: '#faad14', animation: 'pulse 1.2s ease-in-out infinite' }} />
                <span style={{ color: '#d46b08', fontWeight: 500 }}>{text}</span>
              </span>
            </Tooltip>
          );
        }
        return text;
      },
    },
    {
      title: 'C.Value', dataIndex: 'contract_monthly_value',
      render: v => v ? `OMR ${Number(v).toLocaleString()}` : '—',
    },

    { title: 'Rooms', dataIndex: 'num_rooms', width: 70, render: v => v ?? 2, sorter: (a, b) => (a.num_rooms ?? 2) - (b.num_rooms ?? 2) },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />

        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>

        <Row gutter={2} style={{ marginBottom: 2 }} align="middle">
          <Col>
            <Input.Search
              placeholder="Search by name or owner..."
              onSearch={v => setSearch(v)}
              onChange={e => { if (!e.target.value) setSearch(''); }}
              style={{ width: 280 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="All Types"
              allowClear
              style={{ width: 140 }}
              value={typeFilter}
              onChange={v => setTypeFilter(v ?? null)}
            >
              {VILLA_TYPES.map(t => (
                <Option key={t.value} value={t.value}>
                  <Tag color={t.color} style={{ marginRight: 4 }}>{t.value}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Space>
              <Switch
                checked={contractActive}
                onChange={v => setContractActive(v)}
                size="small"
              />
              <span style={{ fontSize: 13 }}>Active Contract</span>
            </Space>
          </Col>
          <Col>
            {data?.data ? `${data.data.length} villas` : ''}
          </Col>

        </Row>
        <Table
          size="small"
          dataSource={data?.data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Villa' : 'Add Villa'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={540}
      >
        <Form form={form} layout="vertical" size="small" onFinish={(v) => save.mutate(v)} style={{ paddingTop: 4 }}>
          <Row gutter={12}>
            <Col span={13}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <Input placeholder="e.g. 101/01/RHRS" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="category" label="Type" style={{ marginBottom: 10 }}>
                <Select placeholder="Type" allowClear onChange={handleCategoryChange}>
                  {VILLA_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      <Tag color={t.color} style={{ marginRight: 4 }}>{t.value}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="num_rooms" label="Rooms" initialValue={2} style={{ marginBottom: 10 }}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="owner_id" label="Owner" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <Select placeholder="Select owner" showSearch optionFilterProp="children">
                  {owners?.map(o => <Option key={o.id} value={o.id}>{o.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="price_per_night" label="Price / Night " rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <InputNumber onFocus={(e) => {
                  e.target.select();
                }} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="status" label="Status" initialValue="available" style={{ marginBottom: 10 }}>
                <Select>
                  <Option value="available">Available</Option>
                  <Option value="maintenance">Maintenance</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="contract_start_date" label="Start Date" style={{ marginBottom: 10 }}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contract_end_date" label="End Date" style={{ marginBottom: 10 }}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contract_monthly_value" label="Monthly Value (OMR)" style={{ marginBottom: 10 }}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes" style={{ marginBottom: 0 }}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
