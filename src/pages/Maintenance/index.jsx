import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, App, Badge, Button, Card, Col, Divider, Empty,
  Input, Modal, Progress, Row, Select, Space, Spin, Statistic,
  Table, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, BuildOutlined,
  CheckCircleOutlined, ClockCircleOutlined, HomeOutlined,
  QuestionCircleOutlined, ReloadOutlined, ToolOutlined,
  UserOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { Text } = Typography;

const statusColor = { available: 'green', occupied: 'error', maintenance: 'purple' };
const statusLabel = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance' };

function gapColor(hours) {
  if (hours === null) return null;
  if (hours < 24) return '#ff4d4f';
  if (hours < 48) return '#fa8c16';
  return '#52c41a';
}

function gapBg(hours) {
  if (hours === null) return '#fafafa';
  if (hours < 24) return '#fff1f0';
  if (hours < 48) return '#fff7e6';
  return '#f6ffed';
}

// ── Shared label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <Text
      type="secondary"
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.6px',
        textTransform: 'uppercase', display: 'block', marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

// ── Mark-cleaned modal ────────────────────────────────────────────────────────

function CleaningModal({ open, villaName, onConfirm, onCancel, isLoading }) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes.trim() || null);
    setNotes('');
  };

  const handleCancel = () => {
    setNotes('');
    onCancel();
  };

  return (
    <Modal
      title={
        <span>
          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
          Mark as Cleaned — <strong>{villaName}</strong>
        </span>
      }
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>Cancel</Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={isLoading}
          onClick={handleConfirm}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          Confirm Cleaned
        </Button>,
      ]}
      width={440}
      destroyOnClose
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Optional — add notes about what was done (linens, AC, damage, supplies needed…)
      </Text>
      <Input.TextArea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="e.g. Changed all linens, AC filter cleaned, reported cracked mirror in bathroom…"
        rows={3}
        autoFocus
      />
    </Modal>
  );
}

// ── Turnover Card ─────────────────────────────────────────────────────────────

function TurnoverCard({ item, cleaningLog, onStatusChange, onMarkCleaned, onUnclean, isUpdating, isUncleaning }) {
  const { villa, last_checkout, next_checkin, gap_hours, is_urgent } = item;
  const accentColor = is_urgent ? '#ff4d4f' : gap_hours !== null && gap_hours < 48 ? '#fa8c16' : '#1677ff';
  const guestArrived = !!next_checkin?.checked_in_at;

  return (
    <Card
      size="small"
      style={{
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 8,
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{ body: { padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' } }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={6}>
            <HomeOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{villa.name}</span>
            {villa.num_rooms ? (
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{villa.num_rooms} rooms</Text>
            ) : null}
          </Space>
          <Tag color={statusColor[villa.status]} style={{ margin: 0, fontSize: 11 }}>
            {statusLabel[villa.status]}
          </Tag>
        </div>
      }
    >
      {/* ── Last checkout ── */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>Last Checkout</SectionLabel>
        {last_checkout ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{
              width: 26, height: 26, background: '#f6ffed', borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowDownOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Text strong style={{ fontSize: 13 }}>{last_checkout.guest_name}</Text>
                {last_checkout.checked_out_at && (
                  <Tooltip title="Departure confirmed">
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                  </Tooltip>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(last_checkout.check_out).format('ddd, DD MMM YYYY')}
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>No recent checkout</Text>
        )}
      </div>

      {/* ── Gap indicator ── */}
      {gap_hours !== null && (
        <div style={{
          background: gapBg(gap_hours),
          border: `1px solid ${gapColor(gap_hours)}40`,
          borderRadius: 8, padding: '10px 12px', margin: '0 0 12px', textAlign: 'center',
        }}>
          <Space style={{ marginBottom: 6 }}>
            <ClockCircleOutlined style={{ color: gapColor(gap_hours) }} />
            <Text style={{ color: gapColor(gap_hours), fontWeight: 700, fontSize: 16 }}>{gap_hours}h</Text>
            <Text style={{ color: gapColor(gap_hours), fontSize: 12 }}>preparation window</Text>
            {is_urgent && <WarningOutlined style={{ color: '#ff4d4f' }} />}
          </Space>
          <Progress
            percent={Math.min(100, Math.round((gap_hours / 48) * 100))}
            strokeColor={gapColor(gap_hours)}
            trailColor="#e8e8e8"
            showInfo={false}
            size={['100%', 5]}
            style={{ display: 'block' }}
          />
          {is_urgent && (
            <Text style={{ fontSize: 10, color: '#ff4d4f', fontWeight: 700, letterSpacing: '0.4px' }}>
              URGENT — IMMEDIATE ACTION REQUIRED
            </Text>
          )}
        </div>
      )}

      {/* ── Next check-in ── */}
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>Next Check-in</SectionLabel>
        {next_checkin ? (() => {
          return (
            <>
              {guestArrived && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#f6ffed', border: '1px solid #b7eb8f',
                  borderRadius: 6, padding: '5px 10px', marginBottom: 8,
                }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text style={{ fontSize: 12, color: '#389e0d', fontWeight: 600 }}>Guest already arrived</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    · {dayjs(next_checkin.checked_in_at).format('HH:mm')}
                  </Text>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 26, height: 26,
                  background: guestArrived ? '#f6ffed' : '#e6f4ff',
                  borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ArrowUpOutlined style={{ color: guestArrived ? '#52c41a' : '#1677ff', fontSize: 12 }} />
                </div>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{next_checkin.guest_name}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(next_checkin.check_in).format('ddd, DD MMM YYYY')}
                      {next_checkin.check_in_time ? ` · ${next_checkin.check_in_time}` : ''}
                    </Text>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#f0f5ff', border: '1px solid #adc6ff',
                    borderRadius: 20, padding: '3px 10px', marginTop: 4,
                  }}>
                    <UserOutlined style={{ fontSize: 18, color: '#1677ff' }} />
                    <Text style={{ fontSize: 15, fontWeight: 700, color: '#1677ff', lineHeight: 1 }}>
                      {next_checkin.num_guests}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      guest{next_checkin.num_guests > 1 ? 's' : ''}
                    </Text>
                  </div>
                </div>
              </div>
            </>
          );
        })() : (
          <Text type="secondary" style={{ fontSize: 12 }}>No upcoming check-in within 7 days</Text>
        )}
      </div>

      {/* ── Cleaning status ── */}
      <div style={{ flex: 1, marginBottom: 12 }}>
        <SectionLabel>Cleaning Status</SectionLabel>
        {cleaningLog ? (
          <div style={{
            background: '#f6ffed', border: '1px solid #b7eb8f',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Space align="start">
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18, marginTop: 1 }} />
                <div>
                  <Text style={{ fontSize: 13, color: '#389e0d', fontWeight: 700 }}>Cleaned</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(cleaningLog.cleaned_at).format('ddd DD MMM · HH:mm')}
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      by <strong>{cleaningLog.user_name}</strong>
                    </Text>
                  </div>
                </div>
              </Space>
              <Tooltip title="Undo — remove this cleaning record">
                <Button
                  type="link"
                  size="small"
                  danger
                  style={{ padding: 0, fontSize: 11 }}
                  onClick={() => onUnclean(cleaningLog.id)}
                  loading={isUncleaning}
                >
                  Undo
                </Button>
              </Tooltip>
            </div>
            {cleaningLog.notes && (
              <div style={{
                marginTop: 8, padding: '6px 10px',
                background: '#d9f7be', borderRadius: 6,
              }}>
                <Text style={{ fontSize: 12, color: '#237804' }}>
                  "{cleaningLog.notes}"
                </Text>
              </div>
            )}
          </div>
        ) : guestArrived ? (
          <div style={{
            background: '#f0f0f0', border: '1px solid #d9d9d9',
            borderRadius: 8, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>No cleaning record — guest already inside</Text>
          </div>
        ) : (
          <div style={{
            background: '#fffbe6', border: '1px solid #ffe58f',
            borderRadius: 8, padding: '8px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <Text style={{ fontSize: 12, color: '#ad6800', fontWeight: 600 }}>Not yet cleaned</Text>
            </Space>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => onMarkCleaned(item)}
              style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
            >
              Mark Cleaned
            </Button>
          </div>
        )}
      </div>

      {/* ── Action ── */}
      <Divider style={{ margin: '0 0 12px' }} />
      {villa.status === 'maintenance' ? (
        <Button
          size="small"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={isUpdating}
          onClick={() => onStatusChange(villa.id, 'available')}
          block
        >
          Mark as Available
        </Button>
      ) : (
        <Tooltip title={guestArrived ? 'Guest is already inside — cannot set to maintenance' : undefined}>
          <Button
            size="small"
            danger
            icon={<ToolOutlined />}
            loading={isUpdating}
            disabled={guestArrived}
            onClick={() => onStatusChange(villa.id, 'maintenance')}
            block
          >
            Set to Maintenance
          </Button>
        </Tooltip>
      )}
    </Card>
  );
}

// ── Turnover Board ────────────────────────────────────────────────────────────

function TurnoverBoard() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [cleanModal, setCleanModal] = useState(null); // { villa_id, villa_name, booking_id }

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['maintenance-turnover'],
    queryFn: () => client.get('/maintenance/turnover').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: cleaningLogs = {} } = useQuery({
    queryKey: ['cleaning-logs-recent'],
    queryFn: () => client.get('/maintenance/cleaning-logs/recent').then(r => r.data),
    refetchInterval: 30_000,
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

  const logCleaning = useMutation({
    mutationFn: ({ villa_id, booking_id, notes }) =>
      client.post('/maintenance/cleaning-logs', { villa_id, booking_id, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cleaning-logs-recent'] });
      setCleanModal(null);
      message.success('Villa marked as cleaned.');
    },
    onError: () => message.error('Failed to save cleaning record.'),
  });

  const unlogCleaning = useMutation({
    mutationFn: (id) => client.delete(`/maintenance/cleaning-logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cleaning-logs-recent'] });
      message.success('Cleaning record removed.');
    },
    onError: () => message.error('Failed to remove cleaning record.'),
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">Loading turnover data…</Text>
        </div>
      </div>
    );
  }

  const all     = data || [];
  const urgent  = all.filter(i => i.is_urgent);
  const warning = all.filter(i => !i.is_urgent && i.gap_hours !== null && i.gap_hours < 48);
  const normal  = all.filter(i => !i.is_urgent && !(i.gap_hours !== null && i.gap_hours < 48));

  const cleanedCount = all.filter(i => !!cleaningLogs[String(i.villa.id)]).length;

  if (!all.length) {
    return (
      <Empty
        image={<CheckCircleOutlined style={{ fontSize: 56, color: '#52c41a' }} />}
        imageStyle={{ height: 64 }}
        description={
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>All Clear</Text>
            <Text type="secondary">No turnover activity in the next 7 days</Text>
          </div>
        }
        style={{ padding: 48 }}
      />
    );
  }

  const handleMarkCleaned = (item) => {
    const bookingId = item.next_checkin?.id ?? item.last_checkout?.id ?? null;
    setCleanModal({ villa_id: item.villa.id, villa_name: item.villa.name, booking_id: bookingId });
  };

  const CardGrid = ({ items }) => (
    <Row gutter={[16, 16]}>
      {items.map(item => (
        <Col key={item.villa.id} xs={24} sm={12} lg={8}>
          <TurnoverCard
            item={item}
            cleaningLog={cleaningLogs[String(item.villa.id)] || null}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            onMarkCleaned={handleMarkCleaned}
            onUnclean={(id) => unlogCleaning.mutate(id)}
            isUpdating={updateStatus.isPending}
            isUncleaning={unlogCleaning.isPending}
          />
        </Col>
      ))}
    </Row>
  );

  return (
    <div>
      {/* Summary stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Villas',       value: all.length,       color: '#1677ff', bg: '#e6f4ff',  icon: <HomeOutlined /> },
          { title: 'Urgent (<24h)',       value: urgent.length,    color: urgent.length  ? '#ff4d4f' : '#8c8c8c', bg: urgent.length  ? '#fff1f0' : '#fafafa', icon: <WarningOutlined /> },
          { title: 'Cleaned',            value: `${cleanedCount}/${all.length}`, color: cleanedCount === all.length ? '#52c41a' : '#fa8c16', bg: cleanedCount === all.length ? '#f6ffed' : '#fff7e6', icon: <CheckCircleOutlined /> },
          { title: 'Needs Attention',    value: warning.length,   color: warning.length ? '#fa8c16' : '#8c8c8c', bg: warning.length ? '#fff7e6' : '#fafafa', icon: <ClockCircleOutlined /> },
        ].map(s => (
          <Col key={s.title} xs={12} sm={6}>
            <Card size="small" style={{ background: s.bg, border: 'none', textAlign: 'center' }} styles={{ body: { padding: '12px 8px' } }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>{s.title}</span>}
                value={s.value}
                valueStyle={{ color: s.color, fontSize: 20 }}
                prefix={s.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Refresh row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {dataUpdatedAt && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Updated {dayjs(dataUpdatedAt).format('HH:mm')}
          </Text>
        )}
        <Button size="small" icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* Urgent */}
      {urgent.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 14, borderRadius: 8 }}
            message={
              <span>
                <strong>Urgent Turnovers</strong> — less than 24 hours to prepare
                <Badge count={urgent.length} color="red" style={{ marginLeft: 8 }} />
              </span>
            }
          />
          <CardGrid items={urgent} />
        </div>
      )}

      {/* Warning */}
      {warning.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ClockCircleOutlined style={{ color: '#fa8c16' }} />
            <Text strong style={{ color: '#fa8c16' }}>Plan Ahead — 24 to 48 hours</Text>
            <Badge count={warning.length} color="orange" />
          </div>
          <CardGrid items={warning} />
        </div>
      )}

      {/* Normal */}
      {normal.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ color: '#52c41a' }}>Comfortable — more than 48 hours</Text>
            <Badge count={normal.length} color="green" />
          </div>
          <CardGrid items={normal} />
        </div>
      )}

      {/* Cleaning modal */}
      <CleaningModal
        open={!!cleanModal}
        villaName={cleanModal?.villa_name ?? ''}
        isLoading={logCleaning.isPending}
        onConfirm={(notes) =>
          logCleaning.mutate({
            villa_id:   cleanModal.villa_id,
            booking_id: cleanModal.booking_id,
            notes,
          })
        }
        onCancel={() => setCleanModal(null)}
      />
    </div>
  );
}

// ── Villa Status Board ────────────────────────────────────────────────────────

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

  const all = data || [];
  const counts = {
    available:   all.filter(v => v.status === 'available').length,
    occupied:    all.filter(v => v.status === 'occupied').length,
    maintenance: all.filter(v => v.status === 'maintenance').length,
  };

  const columns = [
    {
      title: 'Villa',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      defaultSortOrder: 'ascend',
      render: v => <Text strong>{v}</Text>,
    },
    {
      title: 'Rooms',
      dataIndex: 'num_rooms',
      width: 80,
      align: 'center',
      render: v => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: s => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
      filters: [
        { text: 'Available',   value: 'available' },
        { text: 'Occupied',    value: 'occupied' },
        { text: 'Maintenance', value: 'maintenance' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Change Status',
      key: 'action',
      width: 190,
      render: (_, r) => (
        <Select
          size="small"
          value={r.status}
          style={{ width: 170 }}
          disabled={r.status === 'occupied' || updateStatus.isPending}
          onChange={val => updateStatus.mutate({ id: r.id, status: val })}
          options={[
            { value: 'available',   label: '✅  Available' },
            { value: 'maintenance', label: '🔧  Maintenance' },
            { value: 'occupied',    label: '🔴  Occupied (auto)', disabled: true },
          ]}
        />
      ),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      render: v => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Available',   count: counts.available,   bg: '#f6ffed' },
          { label: 'Occupied',    count: counts.occupied,    bg: '#fff1f0' },
          { label: 'Maintenance', count: counts.maintenance, bg: '#f9f0ff' },
        ].map(s => (
          <Col key={s.label} xs={8}>
            <Card size="small" style={{ background: s.bg, border: 'none', textAlign: 'center' }} styles={{ body: { padding: '10px 8px' } }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>{s.label}</span>}
                value={s.count}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 620 }}
        onRow={record => ({
          style: {
            background:
              record.status === 'maintenance' ? '#fdf5ff' :
              record.status === 'occupied'    ? '#fff8f8' :
              undefined,
          },
        })}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Maintenance() {
  usePageTitle('Maintenance');
  const [helpOpen, setHelpOpen] = useState(false);
  const { setToolbar, clearToolbar } = useHeaderToolbar();

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <BuildOutlined />
          <span style={{ fontWeight: 600 }}>Maintenance</span>
        </Space>
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
        title={
          <span>
            <QuestionCircleOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            About the Maintenance Page
          </span>
        }
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Got it</Button>}
        width={580}
      >
        <Typography>
          <Typography.Paragraph>
            A dedicated workspace for the <strong>maintenance and housekeeping team</strong> to track
            villa turnovers, log cleaning, and control villa availability — without needing access to
            bookings or financial data.
          </Typography.Paragraph>

          <Typography.Title level={5}>Turnover Board</Typography.Title>
          <Typography.Paragraph>
            Shows every managed villa with a recent checkout or an upcoming check-in. Each card shows
            who left, how many hours are available to prepare, who arrives next, and the current
            cleaning status.
          </Typography.Paragraph>
          <Typography.Paragraph>Urgency is color-coded:</Typography.Paragraph>
          <ul style={{ marginBottom: 12 }}>
            <li><Tag color="red">Red</Tag> Less than 24 hours — prioritize immediately</li>
            <li><Tag color="orange">Orange</Tag> 24–48 hours — plan ahead</li>
            <li><Tag color="green">Green</Tag> More than 48 hours — comfortable window</li>
          </ul>

          <Typography.Title level={5}>Cleaning Status</Typography.Title>
          <Typography.Paragraph>
            Each card has a <strong>Cleaning Status</strong> section. Tap <strong>Mark Cleaned</strong> after
            finishing the villa — you can optionally add notes (linens changed, AC filter cleaned,
            damage found, supplies needed). The record shows who logged it and when. Use <strong>Undo</strong> to
            remove a log made by mistake. The summary bar shows how many villas out of the total have
            been cleaned today.
          </Typography.Paragraph>

          <Typography.Title level={5}>Villa Status</Typography.Title>
          <Typography.Paragraph>
            A full table of all managed villas to switch between{' '}
            <Tag color="green">Available</Tag> and <Tag color="purple">Maintenance</Tag>.
            The <Tag color="error">Occupied</Tag> status is read-only — set automatically by active bookings.
          </Typography.Paragraph>
        </Typography>
      </Modal>
    </div>
  );
}
