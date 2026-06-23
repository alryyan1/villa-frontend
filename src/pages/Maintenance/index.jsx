import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Row, Col, Tag, Typography, Tabs, Table, Select,
  App, Spin, Empty, Badge, Tooltip, Button, Modal,
  Space,
} from 'antd';
import {
  BuildOutlined, ArrowDownOutlined, ArrowUpOutlined,
  ClockCircleOutlined, UserOutlined, HomeOutlined, WarningOutlined,
  CheckCircleOutlined, ToolOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { Text } = Typography;

const statusColor  = { available: 'green', occupied: 'error', maintenance: 'purple' };
const statusLabel  = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance' };

function gapColor(hours) {
  if (hours === null) return null;
  if (hours < 24)  return '#ff4d4f';
  if (hours < 48)  return '#fa8c16';
  return '#52c41a';
}

function gapLabel(hours) {
  if (hours === null) return null;
  if (hours < 24)  return `⚠️ ${hours}h — URGENT`;
  if (hours < 48)  return `${hours}h gap`;
  return `${hours}h gap`;
}

// ── Turnover Board ───────────────────────────────────────────────────────────

function TurnoverCard({ item, onStatusChange, isUpdating }) {
  const { villa, last_checkout, next_checkin, gap_hours, is_urgent } = item;

  const borderColor = is_urgent ? '#ff4d4f' : gap_hours !== null && gap_hours < 48 ? '#fa8c16' : '#d9d9d9';

  return (
    <Card
      size="small"
      style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: 0 }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontWeight: 700 }}>
            <HomeOutlined style={{ marginRight: 6, color: '#1677ff' }} />
            {villa.name}
            {villa.num_rooms ? <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({villa.num_rooms} rooms)</Text> : null}
          </span>
          <Tag color={statusColor[villa.status]}>{statusLabel[villa.status]}</Tag>
        </div>
      }
    >
      {/* Checkout row */}
      <div style={{ marginBottom: 8 }}>
        {last_checkout ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            <div>
              <Text strong style={{ fontSize: 13 }}>{last_checkout.guest_name}</Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                checked out {dayjs(last_checkout.check_out).format('DD MMM')}
              </Text>
              {last_checkout.checked_out_at && (
                <Tooltip title="Departure confirmed">
                  <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 6 }} />
                </Tooltip>
              )}
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>No recent checkout</Text>
        )}
      </div>

      {/* Gap indicator */}
      {gap_hours !== null && (
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '4px 0', background: '#fafafa', borderRadius: 6 }}>
          <ClockCircleOutlined style={{ color: gapColor(gap_hours), marginRight: 4 }} />
          <Text style={{ color: gapColor(gap_hours), fontWeight: 600, fontSize: 13 }}>
            {gapLabel(gap_hours)}
          </Text>
          {is_urgent && <WarningOutlined style={{ color: '#ff4d4f', marginLeft: 6 }} />}
        </div>
      )}

      {/* Checkin row */}
      <div style={{ marginTop: 8 }}>
        {next_checkin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <div>
              <Text strong style={{ fontSize: 13 }}>{next_checkin.guest_name}</Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                arrives {dayjs(next_checkin.check_in).format('DD MMM')}
                {next_checkin.check_in_time ? ` @ ${next_checkin.check_in_time}` : ''}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {next_checkin.num_guests} guest{next_checkin.num_guests > 1 ? 's' : ''}
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>No upcoming check-in (7 days)</Text>
        )}
      </div>

      {/* Quick maintenance toggle */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
        {villa.status === 'maintenance' ? (
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={isUpdating}
            onClick={() => onStatusChange(villa.id, 'available')}
            style={{ width: '100%' }}
          >
            Mark as Available
          </Button>
        ) : (
          <Button
            size="small"
            danger
            icon={<ToolOutlined />}
            loading={isUpdating}
            onClick={() => onStatusChange(villa.id, 'maintenance')}
            style={{ width: '100%' }}
          >
            Set to Maintenance
          </Button>
        )}
      </div>
    </Card>
  );
}

function TurnoverBoard() {
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-turnover'],
    queryFn: () => client.get('/maintenance/turnover').then(r => r.data),
    refetchInterval: 60_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => client.put(`/villas/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-turnover'] });
      qc.invalidateQueries({ queryKey: ['villas-status'] });
      message.success('Villa status updated.');
    },
    onError: () => message.error('Failed to update status.'),
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  const urgent    = (data || []).filter(i => i.is_urgent);
  const normal    = (data || []).filter(i => !i.is_urgent);

  if (!data?.length) {
    return <Empty description="No turnover activity in the next 7 days" style={{ padding: 48 }} />;
  }

  return (
    <div>
      {urgent.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
            <Text strong style={{ color: '#ff4d4f' }}>Urgent — Less than 24h to prepare</Text>
            <Badge count={urgent.length} color="red" />
          </div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {urgent.map(item => (
              <Col key={item.villa.id} xs={24} sm={12} lg={8}>
                <TurnoverCard
                  item={item}
                  onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                  isUpdating={updateStatus.isPending}
                />
              </Col>
            ))}
          </Row>
        </>
      )}

      {normal.length > 0 && (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Upcoming turnovers</Text>
          <Row gutter={[16, 16]}>
            {normal.map(item => (
              <Col key={item.villa.id} xs={24} sm={12} lg={8}>
                <TurnoverCard
                  item={item}
                  onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                  isUpdating={updateStatus.isPending}
                />
              </Col>
            ))}
          </Row>
        </>
      )}
    </div>
  );
}

// ── Villa Status Board ───────────────────────────────────────────────────────

function StatusBoard() {
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['villas-status'],
    queryFn: () => client.get('/villas', { params: { contract_active: 1, per_page: 200 } }).then(r => r.data.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => client.put(`/villas/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-status'] });
      qc.invalidateQueries({ queryKey: ['maintenance-turnover'] });
      message.success('Status updated.');
    },
    onError: () => message.error('Failed to update status.'),
  });

  const columns = [
    { title: 'Villa', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), defaultSortOrder: 'ascend' },
    { title: 'Rooms', dataIndex: 'num_rooms', width: 80, render: v => v ?? '—' },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: (s) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
      filters: [
        { text: 'Available',   value: 'available' },
        { text: 'Occupied',    value: 'occupied' },
        { text: 'Maintenance', value: 'maintenance' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Set Status', key: 'action', width: 200,
      render: (_, r) => (
        <Select
          size="small"
          value={r.status === 'occupied' ? 'occupied' : r.status}
          style={{ width: 160 }}
          disabled={r.status === 'occupied' || updateStatus.isPending}
          onChange={(val) => updateStatus.mutate({ id: r.id, status: val })}
          options={[
            { value: 'available',   label: '✅ Available' },
            { value: 'maintenance', label: '🔧 Maintenance' },
            { value: 'occupied',    label: '🔴 Occupied', disabled: true },
          ]}
        />
      ),
    },
    { title: 'Notes', dataIndex: 'notes', render: v => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—' },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      size="small"
      pagination={false}
      scroll={{ x: 600 }}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Maintenance() {
  usePageTitle('Maintenance');
  const [helpOpen, setHelpOpen] = useState(false);
  const { setToolbar, clearToolbar } = useHeaderToolbar();

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><BuildOutlined /><span style={{ fontWeight: 600 }}>Maintenance</span></Space>
        <Tooltip title="About this page">
          <Button shape="circle" size="small" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)} />
        </Tooltip>
      </div>
    );
    return () => clearToolbar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    {
      key: 'turnover',
      label: <span><ClockCircleOutlined /> Turnover Board</span>,
      children: <TurnoverBoard />,
    },
    {
      key: 'status',
      label: <span><BuildOutlined /> Villa Status</span>,
      children: <StatusBoard />,
    },
  ];

  return (
    <div>
      <Card>
        <Tabs items={tabs} />
      </Card>

      <Modal
        title={<span><QuestionCircleOutlined style={{ marginRight: 8, color: '#1677ff' }} />About the Maintenance Page</span>}
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Got it</Button>}
        width={560}
      >
        <Typography>
          <Typography.Paragraph>
            A dedicated workspace for the <strong>maintenance and housekeeping team</strong> to track villa turnovers and control villa availability — without needing access to bookings or financial data.
          </Typography.Paragraph>

          <Typography.Title level={5}>Turnover Board</Typography.Title>
          <Typography.Paragraph>
            Shows every managed villa with a guest who checked out in the last 3 days <strong>or</strong> an upcoming check-in within the next 7 days. Each card displays who left, how many hours are available to prepare, and who arrives next.
          </Typography.Paragraph>
          <Typography.Paragraph>
            Urgency is color-coded:
          </Typography.Paragraph>
          <ul style={{ marginBottom: 12 }}>
            <li><Tag color="red">Red</Tag> Less than 24 hours — prioritize immediately</li>
            <li><Tag color="orange">Orange</Tag> 24 – 48 hours — plan ahead</li>
            <li><Tag color="green">Green</Tag> More than 48 hours — comfortable window</li>
          </ul>
          <Typography.Paragraph>
            Each card has a quick button to mark the villa as <strong>Under Maintenance</strong> or back to <strong>Available</strong>.
          </Typography.Paragraph>

          <Typography.Title level={5}>Villa Status</Typography.Title>
          <Typography.Paragraph>
            A full table of all managed villas with an inline selector to switch between <Tag color="green">Available</Tag> and <Tag color="red">Maintenance</Tag>. The <Tag color="orange">Occupied</Tag> status is read-only — it is set automatically by active bookings.
          </Typography.Paragraph>
        </Typography>
      </Modal>
    </div>
  );
}
