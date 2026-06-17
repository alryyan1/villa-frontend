import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Row, Col, Spin, Tag } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function VillaPerformance() {
  const [dates, setDates] = useState([dayjs().startOf('year'), dayjs()]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-villa-performance', dates],
    queryFn: () => client.get('/reports/villa-performance', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') },
    }).then(r => r.data),
  });

  const columns = [
    { title: 'Rank', render: (_, __, i) => i + 1, width: 70 },
    { title: 'Villa', dataIndex: 'name' },
    { title: 'Owner', dataIndex: ['owner', 'name'] },
    { title: 'Bookings', dataIndex: 'total_bookings' },
    { title: 'Cancellations', dataIndex: 'cancelled_bookings', render: v => <Tag color="red">{v}</Tag> },
    { title: 'Nights', dataIndex: 'total_nights' },
    { title: 'Revenue', dataIndex: 'total_revenue', render: v => `OMR ${Number(v || 0).toLocaleString()}`, sorter: (a, b) => a.total_revenue - b.total_revenue },
  ];

  const chartData = (data?.data || []).slice(0, 10).map(v => ({
    name:    v.name,
    Revenue: Number(v.total_revenue || 0),
  }));

  return (
    <div>
      <Title level={4}>Villa Performance</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      {isLoading ? <Spin /> : (
        <>
          {chartData.length > 0 && (
            <Card title="Top 10 Villas by Revenue" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={140} />
                  <Tooltip formatter={v => `OMR ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="Revenue" fill="#1677ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card>
            <Table dataSource={data?.data} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />
          </Card>
        </>
      )}
    </div>
  );
}
