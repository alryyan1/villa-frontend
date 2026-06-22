import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Space, Typography,
  Popconfirm, Card, Row, Col, App, Badge, Upload, Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, UploadOutlined, CopyOutlined } from '@ant-design/icons';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;
const { TextArea } = Input;

export default function Owners() {
  usePageTitle('Owners');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['owners', search, page, perPage],
    queryFn: () => client.get('/owners', { params: { search, page, per_page: perPage } }).then(r => r.data),
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

  const columns = [
    { title: '#', dataIndex: 'id', width: 60, sorter: (a, b) => a.id - b.id },
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), defaultSortOrder: 'ascend' },
    { title: 'Phone', dataIndex: 'phone', render: v => v || '-' },
    {
      title: 'WhatsApp', dataIndex: 'whatsapp_number',
      render: v => v
        ? <a href={`https://wa.me/${v}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}>{v}</a>
        : '-',
    },
    { title: 'Email', dataIndex: 'email', render: v => v || '-' },
    { title: 'Villas', dataIndex: 'villas_count', width: 80, sorter: (a, b) => a.villas_count - b.villas_count, render: v => <Badge count={v} color="blue" showZero /> },
    {
      title: 'Actions', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this owner?" onConfirm={() => remove.mutate(r.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><TeamOutlined /> Owner Management</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => { setImportResult(null); setImportOpen(true); }}>
            Import Excel
          </Button>
          <Popconfirm
            title="Copy all phone numbers to WhatsApp?"
            description="This will fill WhatsApp number for owners who have a phone but no WhatsApp set."
            onConfirm={() => copyPhones.mutate()}
            okText="Yes, copy"
            cancelText="Cancel"
          >
            <Button icon={<CopyOutlined />} loading={copyPhones.isPending}>
              Copy Phones → WhatsApp
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Add Owner
          </Button>
        </Space>
      </Row>

      <Card>
        <Input.Search
          placeholder="Search by name or phone..."
          onSearch={v => { setSearch(v); setPage(1); }}
          onChange={e => { if (!e.target.value) { setSearch(''); setPage(1); } }}
          style={{ marginBottom: 16, maxWidth: 320 }}
          allowClear
        />
        <Table
          dataSource={data?.data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            total: data?.total,
            pageSize: perPage,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} owners`,
            onChange: (p, size) => { setPage(p); setPerPage(size); },
            onShowSizeChange: (_, size) => { setPage(1); setPerPage(size); },
          }}
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
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="whatsapp_number" label="WhatsApp Number">
                <Input placeholder="966xxxxxxxxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Address">
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
