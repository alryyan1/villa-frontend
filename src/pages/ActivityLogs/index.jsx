import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Typography, Row, Col, DatePicker, Input, Button, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function ActivityLogs() {
  const [dates, setDates]   = useState(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', dates, search],
    queryFn: () => client.get('/activity-logs', {
      params: {
        action: search || undefined,
        from:   dates?.[0]?.format('YYYY-MM-DD'),
        to:     dates?.[1]?.format('YYYY-MM-DD'),
      },
    }).then(r => r.data),
  });

  const columns = [
    { title: '#', dataIndex: 'id', width: 70 },
    { title: 'User', dataIndex: ['user', 'name'], render: v => v || 'System' },
    { title: 'Action', dataIndex: 'action', render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Type', dataIndex: 'model_type', render: v => v || '-' },
    { title: 'ID', dataIndex: 'model_id', width: 80, render: v => v || '-' },
    { title: 'IP Address', dataIndex: 'ip_address', render: v => v || '-' },
    { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <div>
      <Title level={4}><FileTextOutlined /> Activity Log</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col>
            <Input
              placeholder="Search by action..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Search</Button></Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={data?.data}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ total: data?.total, pageSize: 50 }}
          size="small"
        />
      </Card>
    </div>
  );
}
