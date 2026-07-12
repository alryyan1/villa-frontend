import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, DatePicker, Button, Typography, Select, Row, Col, Statistic, Tag } from 'antd';
import { HomeOutlined, CalendarOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const statusColors = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const statusLabels = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };

export default function OwnerBookingsReport() {
  usePageTitle('Owner Bookings Report');
  const navigate = useNavigate();
  const [dates, setDates] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [villaFilter, setVillaFilter] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-owner-bookings', dates],
    queryFn: () => client.get('/reports/owner-bookings', {
      params: { from: dates[0].format('YYYY-MM-DD'), to: dates[1].format('YYYY-MM-DD') },
    }).then(r => r.data),
  });

  const rows = (data?.data || []).filter(b =>
    (!villaFilter || b.villa_id === villaFilter) &&
    (!ownerFilter || b.villa?.owner_id === ownerFilter)
  );
  const villaOptions = Array.from(
    new Map((data?.data || []).map(b => [b.villa_id, b.villa?.name])).entries()
  );
  const ownerOptions = Array.from(
    new Map((data?.data || []).map(b => [b.villa?.owner_id, b.villa?.owner?.name])).entries()
  ).filter(([id]) => id != null);

  const totalValue = rows.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const columns = [
    { title: 'Booking ID', dataIndex: 'id', width: 90, render: id => `#${id}` },
    { title: 'Villa', dataIndex: ['villa', 'name'] },
    { title: 'Owner', dataIndex: ['villa', 'owner', 'name'], render: v => v ?? '—' },
    { title: 'Guest', dataIndex: ['guest', 'name'], render: v => v ?? '—' },
    {
      title: 'Check-in',
      dataIndex: 'check_in',
      render: v => dayjs(v).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.check_in).unix() - dayjs(b.check_in).unix(),
      defaultSortOrder: 'descend',
    },
    { title: 'Check-out', dataIndex: 'check_out', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Nights', dataIndex: 'nights', width: 80 },
    {
      title: 'Amount',
      dataIndex: 'total_amount',
      render: v => `OMR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}`,
      sorter: (a, b) => Number(a.total_amount) - Number(b.total_amount),
    },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s] ?? s}</Tag> },
    { title: 'Booked By', dataIndex: ['user', 'name'], render: v => v ?? '—' },
    { title: 'Notes', dataIndex: 'notes', render: v => v || '—', ellipsis: true },
  ];

  return (
    <div>
      <Title level={4}>Owner Bookings Report</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col><RangePicker value={dates} onChange={setDates} /></Col>
          <Col>
            <Select
              value={villaFilter}
              onChange={setVillaFilter}
              placeholder="All villas"
              allowClear
              style={{ width: 200 }}
            >
              {villaOptions.map(([id, name]) => <Option key={id} value={id}>{name}</Option>)}
            </Select>
          </Col>
          <Col>
            <Select
              value={ownerFilter}
              onChange={setOwnerFilter}
              placeholder="All owners"
              allowClear
              style={{ width: 200 }}
            >
              {ownerOptions.map(([id, name]) => <Option key={id} value={id}>{name ?? '—'}</Option>)}
            </Select>
          </Col>
          <Col><Button type="primary" onClick={refetch} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Owner Bookings" value={data?.totals?.bookings_count ?? 0} prefix={<HomeOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Total Nights" value={data?.totals?.total_nights ?? 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Total Value"
              value={totalValue.toLocaleString(undefined, { minimumFractionDigits: 3 })}
              prefix={<DollarOutlined />}
              suffix="OMR"
              valueStyle={{ color: '#d4b106' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={r => ({
            onClick: () => navigate('/bookings', { state: { highlightBookingId: r.id } }),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
}
