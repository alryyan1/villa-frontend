import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Row, Col, Tag, Spin, Avatar, Badge } from 'antd';
import { TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
const roleLabels = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

export default function UserPerformance() {
  const [dates, setDates] = useState([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-user-performance', dates],
    queryFn: () => client.get('/reports/user-performance', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') },
    }).then(r => r.data),
  });

  const columns = [
    {
      title: 'Rank', dataIndex: 'rank', width: 80,
      render: (rank) => (
        <div style={{ textAlign: 'center' }}>
          {rank <= 3
            ? <TrophyOutlined style={{ fontSize: 20, color: rankColors[rank - 1] }} />
            : <Text type="secondary">{rank}</Text>}
        </div>
      ),
    },
    {
      title: 'User', dataIndex: 'name',
      render: (name, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar style={{ background: '#1677ff' }}>{name?.[0]?.toUpperCase()}</Avatar>
          <div>
            <div>{name}</div>
            <Tag size="small">{roleLabels[r.role]}</Tag>
          </div>
        </div>
      ),
    },
    { title: 'Bookings', dataIndex: 'total_bookings', render: v => <Badge count={v} color="blue" showZero /> },
    { title: 'Cancellations', dataIndex: 'cancelled_bookings', render: v => <Badge count={v} color="red" showZero /> },
    {
      title: 'Revenue',
      dataIndex: 'total_revenue',
      render: v => <Text strong style={{ color: '#52c41a' }}>OMR {Number(v || 0).toLocaleString()}</Text>,
      sorter: (a, b) => (a.total_revenue || 0) - (b.total_revenue || 0),
    },
  ];

  const chartData = (data?.data || []).map(u => ({
    name:     u.name,
    Bookings: u.total_bookings,
    Revenue:  Number(u.total_revenue || 0),
  }));

  return (
    <div>
      <Title level={4}><UserOutlined /> User Performance</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      {isLoading ? <Spin /> : (
        <>
          {chartData.length > 0 && (
            <Card title="User Performance Comparison" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="Bookings" fill="#1677ff" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="Revenue" fill="#52c41a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card title="User Rankings">
            <Table dataSource={data?.data} columns={columns} rowKey="id" pagination={false} size="small" />
          </Card>
        </>
      )}
    </div>
  );
}
