import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Space, Typography,
  Popconfirm, Card, Row, Col, App, Badge, Upload, Alert,
  Popover, Tag, Spin, Select,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UploadOutlined, CopyOutlined, HomeOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { Text } = Typography;
const { TextArea } = Input;

const villaStatusColor = { available: 'green', occupied: 'orange', maintenance: 'red' };

function VillasPopover({ owner }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ['owner-villas', owner.id],
    queryFn: () => client.get(`/owners/${owner.id}`).then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  });

  const content = isFetching ? (
    <div style={{ padding: '12px 0', textAlign: 'center' }}><Spin size="small" /></div>
  ) : (
    <div style={{ minWidth: 220, maxWidth: 300 }}>
      {(data?.villas ?? []).length === 0 ? (
        <Text type="secondary">No villas assigned.</Text>
      ) : (
        (data.villas).map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div>
              <div
                style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#1677ff' }}
                onClick={() => { setOpen(false); navigate('/villas', { state: { editVillaId: v.id } }); }}
              >
                <HomeOutlined style={{ marginRight: 5 }} />{v.name}
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {v.num_rooms ? `${v.num_rooms} rooms` : ''}
                {v.num_rooms && v.price_per_night ? ' · ' : ''}
                {v.price_per_night ? `${Number(v.price_per_night).toLocaleString()} OMR/night` : ''}
              </div>
            </div>
            <Tag color={villaStatusColor[v.status] ?? 'default'} style={{ marginLeft: 8, flexShrink: 0 }}>
              {v.status}
            </Tag>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Popover
      title={`${owner.name}'s Villas`}
      content={content}
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="left"
    >
      <Badge
        count={owner.villas_count}
        color="blue"
        showZero
        style={{ cursor: owner.villas_count > 0 ? 'pointer' : 'default' }}
      />
    </Popover>
  );
}

export default function Owners() {
  usePageTitle('Owners');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterVilla, setFilterVilla] = useState(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { setToolbar, clearToolbar } = useHeaderToolbar();
  const location = useLocation();

  const { data: villasData } = useQuery({
    queryKey: ['villas-all'],
    queryFn: () => client.get('/villas', { params: { per_page: 999 } }).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['owners', search, filterVilla],
    queryFn: () => client.get('/owners', { params: { search, villa_id: filterVilla ?? undefined } }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/owners/${editing.id}`, vals)
      : client.post('/owners', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owners'] });
      qc.invalidateQueries({ queryKey: ['owners-all'] });
      message.success(editing ? 'Owner updated.' : 'Owner added.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/owners/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owners'] }); message.success('Owner deleted.'); },
    onError: (e) => message.error(e.response?.data?.message || 'Cannot delete owner with villas.'),
  });

  const copyPhones = useMutation({
    mutationFn: () => client.post('/owners/copy-phones-to-whatsapp'),
    onSuccess: (res) => {
      message.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['owners'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed.'),
  });

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><TeamOutlined /><span style={{ fontWeight: 600 }}>Owner Management</span></Space>
        <Space size="small">
          <Button size="small" icon={<UploadOutlined />} onClick={() => { setImportResult(null); setImportOpen(true); }}>
            Import Excel
          </Button>
          <Popconfirm
            title="Copy all phone numbers to WhatsApp?"
            description="Fill WhatsApp number for owners who have a phone but no WhatsApp set."
            onConfirm={() => copyPhones.mutate()}
            okText="Yes, copy"
            cancelText="Cancel"
          >
            <Button size="small" icon={<CopyOutlined />} loading={copyPhones.isPending}>
              Copy Phones → WhatsApp
            </Button>
          </Popconfirm>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Add Owner
          </Button>
        </Space>
      </div>
    );
    return () => clearToolbar();
  }, [copyPhones.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const importMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return client.post('/import/owners', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      setImportResult(res.data);
      qc.invalidateQueries({ queryKey: ['owners'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Import failed.'),
  });

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  useEffect(() => {
    const editId = location.state?.editOwnerId;
    if (!editId || !data) return;
    const owner = data.find(o => o.id === editId);
    if (owner) openEdit(owner);
  }, [data, location.state?.editOwnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '-' },
    {
      title: 'WhatsApp', dataIndex: 'whatsapp_number',
      render: v => v
        ? <a href={`https://wa.me/${v}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}>{v}</a>
        : '-',
    },
    { title: 'Email', dataIndex: 'email', render: v => v || '-' },
    { title: 'Villas', dataIndex: 'villas_count', width: 80, render: (_, r) => <VillasPopover owner={r} /> },
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
      <Card size="small" styles={{ body: { padding: 12 } }}>
        <Space style={{ marginBottom: 8 }} size="small" wrap>
          <Input.Search
            placeholder="Search by name or phone..."
            onSearch={v => setSearch(v)}
            onChange={e => { if (!e.target.value) setSearch(''); }}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Filter by villa"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 180 }}
            value={filterVilla}
            onChange={v => setFilterVilla(v ?? null)}
            options={(villasData ?? []).map(v => ({ value: v.id, label: v.name }))}
          />
        </Space>
        <Table
          size="small"
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 700 }}
        />
      </Card>

      <Modal
        title="Import Owners from Excel"
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportResult(null); }}
        footer={null}
        width={500}
      >
        <p style={{ marginBottom: 16, color: '#555' }}>
          Expected columns: <strong>A</strong> Villa No, <strong>B</strong> Owner Name,{' '}
          <strong>C</strong> Contact Number, <strong>D</strong> Contract Type (Monthly/Weekly/Daily)
        </p>
        {importResult && (
          <Alert
            type={importResult.skipped > 0 ? 'warning' : 'success'}
            message={importResult.message}
            description={importResult.errors?.length > 0 ? importResult.errors.join('\n') : undefined}
            style={{ marginBottom: 16, whiteSpace: 'pre-line' }}
            showIcon
          />
        )}
        <Upload.Dragger
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={(file) => { importMutation.mutate(file); return false; }}
          disabled={importMutation.isPending}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 32 }} /></p>
          <p className="ant-upload-text">
            {importMutation.isPending ? 'Importing...' : 'Click or drag Excel file here to upload'}
          </p>
          <p className="ant-upload-hint">Supports .xlsx and .xls files</p>
        </Upload.Dragger>
      </Modal>

      <Modal
        title={editing ? 'Edit Owner' : 'Add Owner'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" size="small" onFinish={(v) => save.mutate(v)}>
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
              <Form.Item name="whatsapp_number" label="WhatsApp Number" style={{ marginBottom: 10 }}>
                <Input placeholder="966xxxxxxxxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email' }]} style={{ marginBottom: 10 }}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Address" style={{ marginBottom: 10 }}>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes" style={{ marginBottom: 0 }}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
