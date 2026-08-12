import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography, Card, Empty } from 'antd';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;

const statusColors = { available: 'green', occupied: 'orange', maintenance: 'red', blocked: '#000000' };
const statusLabels = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance', blocked: 'Blocked' };

export default function OwnerMyVillas() {
  usePageTitle('My Villas');

  const { data, isLoading } = useQuery({
    queryKey: ['owner-villas'],
    queryFn: () => client.get('/owner/villas').then(r => r.data),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Category', dataIndex: 'category', render: v => v ?? '—' },
    { title: 'Rooms', dataIndex: 'num_rooms', width: 90 },
    {
      title: 'Price / Night',
      dataIndex: 'price_per_night',
      render: v => `OMR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s] ?? s}</Tag> },
    { title: 'Contract Active', dataIndex: 'contract_active', render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
  ];

  return (
    <div>
      <Title level={4}>My Villas</Title>
      <Card>
        <Table
          dataSource={data ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="No villas are linked to your account." /> }}
        />
      </Card>
    </div>
  );
}
