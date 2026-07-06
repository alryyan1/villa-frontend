import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Progress, Row, Col, Statistic, Spin, Modal } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

export default function OccupancyReport() {
  usePageTitle('Occupancy Report');
  const [dates, setDates] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [helpOpen, setHelpOpen] = useState(false);

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
      <Row align="middle" gutter={8} style={{ marginBottom: 4 }}>
        <Col><Title level={4} style={{ margin: 0 }}>Occupancy Report</Title></Col>
        <Col>
          <Button
            type="text"
            size="small"
            icon={<QuestionCircleOutlined />}
            onClick={() => setHelpOpen(true)}
          >
            Explain this report
          </Button>
        </Col>
      </Row>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      <Modal
        title="About the Occupancy Report"
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Got it</Button>}
        width={560}
      >
        <Paragraph>
          This report shows how heavily each villa is booked over the selected date range, based on recorded bookings.
        </Paragraph>
        <Paragraph>
          <Text strong>Booked Nights:</Text> the number of nights the villa was actually booked within the selected period.
        </Paragraph>
        <Paragraph>
          <Text strong>Total Days:</Text> the total number of days in the selected period (from start date to end date).
        </Paragraph>
        <Paragraph>
          <Text strong>Bookings:</Text> the number of separate bookings made for this villa during the period.
        </Paragraph>
        <Paragraph>
          <Text strong>Occupancy Rate:</Text> calculated as Booked Nights ÷ Total Days × 100. The higher the rate, the more the villa was utilized.
          <br />
          <Text type="success">Green</Text> = occupancy above 70%, <Text type="warning">Orange</Text> = between 40% and 70%, <Text type="danger">Red</Text> = below 40%.
        </Paragraph>
        <Paragraph>
          <Text strong>Average Occupancy:</Text> the average occupancy rate across all villas for the selected period.
        </Paragraph>
      </Modal>

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
