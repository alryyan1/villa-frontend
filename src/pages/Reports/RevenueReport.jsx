import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Select, Row, Col, Statistic, Spin } from 'antd';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default function RevenueReport() {
  usePageTitle('Revenue Report');
  const [dates, setDates]     = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [groupBy, setGroupBy] = useState('month');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-revenue', dates, groupBy],
    queryFn: () => client.get('/reports/revenue', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD'), group_by: groupBy },
    }).then(r => r.data),
  });

  const columns = [
    { title: 'Period', dataIndex: 'period' },
    { title: 'Bookings', dataIndex: 'bookings_count' },
    { title: 'Nights', dataIndex: 'total_nights' },
    { title: 'Revenue', dataIndex: 'total_revenue', render: v => `OMR ${Number(v).toLocaleString()}`, sorter: (a, b) => a.total_revenue - b.total_revenue },
    { title: 'Collected', dataIndex: 'total_paid', render: v => `OMR ${Number(v).toLocaleString()}` },
  ];

  const chartData = (data?.data || []).map(r => ({
    period:    r.period,
    Revenue:   Number(r.total_revenue),
    Collected: Number(r.total_paid),
  }));

  return (
    <div>
      <Title level={4}>Revenue Report</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col>
            <Select value={groupBy} onChange={setGroupBy} style={{ width: 120 }}>
              <Option value="day">Daily</Option>
              <Option value="month">Monthly</Option>
              <Option value="year">Yearly</Option>
            </Select>
          </Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      {isLoading ? <Spin /> : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card><Statistic title="Total Revenue" value={Number(data?.totals?.total_revenue || 0).toLocaleString()} suffix="OMR" valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={8}><Card><Statistic title="Total Collected" value={Number(data?.totals?.total_paid || 0).toLocaleString()} suffix="OMR" valueStyle={{ color: '#1677ff' }} /></Card></Col>
            <Col span={8}><Card><Statistic title="Total Bookings" value={data?.totals?.bookings_count || 0} /></Card></Col>
          </Row>

          {chartData.length > 0 && (
            <Card title="Revenue Over Time" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={v => `OMR ${Number(v).toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Revenue" stroke="#1677ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Collected" stroke="#52c41a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <Table dataSource={data?.data} columns={columns} rowKey="period" pagination={false} size="small" />
          </Card>
        </>
      )}
    </div>
  );
}
