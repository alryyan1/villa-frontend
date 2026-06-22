import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Row, Col, Statistic, Spin, Progress } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const METHOD_META = {
  cash:          { label: 'Cash',          color: '#52c41a' },
  card:          { label: 'Card',          color: '#1677ff' },
  bank_transfer: { label: 'Bank Transfer', color: '#fa8c16' },
};

export default function PaymentMethodsReport() {
  const [dates, setDates] = useState([dayjs().startOf('year'), dayjs()]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-payment-methods', dates],
    queryFn: () => client.get('/reports/payment-methods', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') },
    }).then(r => r.data),
  });

  const rows     = data?.data || [];
  const total    = data?.total || 0;
  const pieData  = rows.map(r => ({
    name:  METHOD_META[r.method]?.label ?? r.method,
    value: r.total_collected,
    color: METHOD_META[r.method]?.color ?? '#8c8c8c',
  }));

  const columns = [
    {
      title: 'Payment Method',
      dataIndex: 'method',
      render: m => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: METHOD_META[m]?.color ?? '#8c8c8c', display: 'inline-block' }} />
          {METHOD_META[m]?.label ?? m}
        </span>
      ),
    },
    { title: 'Payments', dataIndex: 'payments_count', align: 'center' },
    { title: 'Bookings', dataIndex: 'bookings_count', align: 'center' },
    {
      title: 'Total Collected',
      dataIndex: 'total_collected',
      align: 'right',
      render: v => <strong>{Number(v).toLocaleString(undefined, { minimumFractionDigits: 3 })} OMR</strong>,
      sorter: (a, b) => a.total_collected - b.total_collected,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Share',
      dataIndex: 'percentage',
      align: 'center',
      render: (v, r) => (
        <div style={{ minWidth: 120 }}>
          <Progress
            percent={v}
            strokeColor={METHOD_META[r.method]?.color}
            size="small"
            format={p => `${p}%`}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}><DollarOutlined /> Payment Methods Report</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker value={dates} onChange={setDates} />
          </Col>
          <Col>
            <Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button>
          </Col>
        </Row>
      </Card>

      {isLoading ? <Spin size="large" style={{ display: 'block', textAlign: 'center', marginTop: 48 }} /> : (
        <>
          {/* Summary stat cards */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Collected"
                  value={Number(total).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                  suffix="OMR"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            {rows.map(r => (
              <Col span={6} key={r.method}>
                <Card>
                  <Statistic
                    title={METHOD_META[r.method]?.label ?? r.method}
                    value={Number(r.total_collected).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    suffix="OMR"
                    valueStyle={{ color: METHOD_META[r.method]?.color }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.payments_count} payment{r.payments_count !== 1 ? 's' : ''} · {r.percentage}%
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            {/* Pie chart */}
            {pieData.length > 0 && (
              <Col span={10}>
                <Card title="Distribution by Method" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 3 })} OMR`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            )}

            {/* Table */}
            <Col span={pieData.length > 0 ? 14 : 24}>
              <Card title="Breakdown">
                <Table
                  dataSource={rows}
                  columns={columns}
                  rowKey="method"
                  pagination={false}
                  size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="center">
                        <strong>{rows.reduce((s, r) => s + r.payments_count, 0)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="center">
                        <strong>{rows.reduce((s, r) => s + r.bookings_count, 0)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <strong>{Number(total).toLocaleString(undefined, { minimumFractionDigits: 3 })} OMR</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                    </Table.Summary.Row>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
