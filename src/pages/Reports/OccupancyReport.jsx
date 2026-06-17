import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Progress, Row, Col, Statistic, Spin } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function OccupancyReport() {
  const [dates, setDates] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-occupancy', dates],
    queryFn: () => client.get('/reports/occupancy', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') },
    }).then(r => r.data),
    enabled: !!dates,
  });

  const avgOccupancy = data?.data?.length
    ? (data.data.reduce((s, r) => s + r.occupancy_rate, 0) / data.data.length).toFixed(1)
    : 0;

  const columns = [
    { title: 'Villa', dataIndex: 'name' },
    { title: 'Booked Nights', dataIndex: 'booked_nights' },
    { title: 'Total Days', dataIndex: 'total_days' },
    { title: 'Bookings', dataIndex: 'bookings_count' },
    {
      title: 'Occupancy Rate',
      dataIndex: 'occupancy_rate',
      render: v => <Progress percent={v} size="small" strokeColor={v > 70 ? '#52c41a' : v > 40 ? '#faad14' : '#ff4d4f'} />,
      sorter: (a, b) => a.occupancy_rate - b.occupancy_rate,
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div>
      <Title level={4}>Occupancy Report</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      {isLoading ? <Spin /> : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card><Statistic title="Average Occupancy" value={avgOccupancy} suffix="%" /></Card></Col>
            <Col span={8}><Card><Statistic title="Total Villas" value={data?.data?.length} /></Card></Col>
            <Col span={8}><Card><Statistic title="Total Booked Nights" value={data?.data?.reduce((s, r) => s + r.booked_nights, 0)} /></Card></Col>
          </Row>

          {data?.data?.length > 0 && (
            <Card title="Villa Occupancy" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="name" width={140} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="occupancy_rate" name="Occupancy Rate" fill="#1677ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <Table dataSource={data?.data} columns={columns} rowKey="id" pagination={false} size="small" />
          </Card>
        </>
      )}
    </div>
  );
}
