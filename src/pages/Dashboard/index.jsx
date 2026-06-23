import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin } from 'antd';
import { HomeOutlined, CalendarOutlined, DollarOutlined, RiseOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import client from '../../api/client';
import dayjs from 'dayjs';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title, Text } = Typography;

const statusColors = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const statusLabels = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => client.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const recentCols = [
    { title: 'Villa', dataIndex: ['villa', 'name'], key: 'villa' },
    { title: 'Guest', dataIndex: ['guest', 'name'], key: 'guest' },
    { title: 'Check In', dataIndex: 'check_in', key: 'check_in', render: d => dayjs(d).format('YYYY-MM-DD') },
    { title: 'Check Out', dataIndex: 'check_out', key: 'check_out', render: d => dayjs(d).format('YYYY-MM-DD') },
    { title: 'Total', dataIndex: 'total_amount', key: 'total', render: v => `OMR ${Number(v).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
  ];

  const chartData = (data?.revenue_chart || []).map(r => ({
    month: r.month,
    Revenue: Number(r.total),
  }));

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Villas" value={data?.total_villas} prefix={<HomeOutlined />} valueStyle={{ color: '#1677ff' }} />
            <div style={{ marginTop: 4 }}>
              <Text style={{ color: '#52c41a', fontWeight: 600 }}>✓ Active contracts: {data?.active_contracts}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>Available: {data?.available_villas} | Occupied: {data?.occupied_villas}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Current Bookings" value={data?.current_bookings} prefix={<CalendarOutlined />} valueStyle={{ color: '#52c41a' }} />
            <Text type="secondary">Upcoming (7 days): {data?.upcoming_bookings}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Monthly Revenue" value={Number(data?.monthly_revenue).toLocaleString()} prefix={<DollarOutlined />} suffix="OMR" valueStyle={{ color: '#faad14' }} />
            <Text type="secondary">Bookings this month: {data?.monthly_bookings}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Occupancy Rate" value={data?.occupancy_rate} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: data?.occupancy_rate > 70 ? '#52c41a' : '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Checking In Today" size="small">
            {data?.checking_in_today?.length === 0
              ? <Text type="secondary">No check-ins today</Text>
              : data?.checking_in_today?.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Text>{b.guest?.name}</Text>
                  <Text type="secondary">{b.villa?.name}</Text>
                </div>
              ))
            }
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Checking Out Today" size="small">
            {data?.checking_out_today?.length === 0
              ? <Text type="secondary">No check-outs today</Text>
              : data?.checking_out_today?.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Text>{b.guest?.name}</Text>
                  <Text type="secondary">{b.villa?.name}</Text>
                </div>
              ))
            }
          </Card>
        </Col>
      </Row>

      {chartData.length > 0 && (
        <Card title="Revenue — Last 6 Months" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={v => `OMR ${Number(v).toLocaleString()}`} />
              <Bar dataKey="Revenue" fill="#1677ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Recent Bookings" style={{ marginTop: 16 }}>
        <Table
          dataSource={data?.recent_bookings}
          columns={recentCols}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
}
