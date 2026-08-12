import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Statistic, Table, Tag, Typography, Empty } from 'antd';
import { HomeOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;

const statusColors = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const statusLabels = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };

export default function OwnerDashboard() {
  usePageTitle('Owner Dashboard');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => client.get('/owner/dashboard').then(r => r.data),
  });

  const columns = [
    { title: 'Villa', dataIndex: ['villa', 'name'] },
    { title: 'Guest', dataIndex: ['guest', 'name'], render: v => v ?? '—' },
    { title: 'Check-in', dataIndex: 'check_in', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Check-out', dataIndex: 'check_out', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s] ?? s}</Tag> },
  ];

  if (!isLoading && !data?.villas_count) {
    return (
      <div>
        <Title level={4}>Dashboard</Title>
        <Empty description="No villas are linked to your account yet. Contact the management team." />
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>Dashboard</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="My Villas" value={data?.villas_count ?? 0} prefix={<HomeOutlined />} valueStyle={{ color: '#1677ff' }} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Active Villas" value={data?.active_villas ?? 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} loading={isLoading} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Pending Bookings" value={data?.pending_bookings ?? 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#d4b106' }} loading={isLoading} />
          </Card>
        </Col>
      </Row>

      <Card title="Upcoming Bookings">
        <Table
          dataSource={data?.upcoming_bookings ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={false}
          onRow={() => ({ onClick: () => navigate('/owner/bookings'), style: { cursor: 'pointer' } })}
        />
      </Card>
    </div>
  );
}
