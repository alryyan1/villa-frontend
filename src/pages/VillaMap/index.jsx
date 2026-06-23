import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Drawer, Modal, Form, Select, DatePicker, Input, InputNumber, Button,
  Tag, Typography, Space, Alert, Table, Spin, Tooltip,
  Radio, App, Divider, Card, Empty, Descriptions, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, HomeOutlined,
  CalendarOutlined, UserOutlined, DollarOutlined,
  SearchOutlined, AimOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import client from '../../api/client';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  available:   { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'Available' },
  occupied:    { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', label: 'Occupied' },
  maintenance: { color: '#531dab', bg: '#f9f0ff', border: '#d3adf7', label: 'Maintenance' },
};
const UNCONFIGURED = { color: '#bfbfbf', bg: '#fafafa', border: '#d9d9d9', label: 'Not configured' };

const statusColors = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const payColors = { paid: 'green', partial: 'orange', unpaid: 'red' };
const payLabels = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };

// ─── Static map layout ────────────────────────────────────────────────────────
// null = visual gap/separator
const MAP = {
  seaShell: [101, 102, 103, 104, 105, 106, 107, null, 108, 109, 110, 111, 112, 113, 114],
  coralLeft: [145, 144, 143, 142, 141, 140, 139, 138],
  coralRight: [115, 116, 117, 118, 119, 120, 121, 122],
  gardenTopLeft: [146, 147, 148, 149, 150, 151, 152],
  gardenTopRight: [153, 154, 155, 156, 157, 158, 159, 160],
  gardenBottomLeft: [175, 174, 173, 172, 171, 170, 169],
  gardenBottomRight: [168, 167, 166, 165, 164, 163, 162, 161],
  pearlLeft: [137, 136],
  breezeLeft: [135, 134, 133, 132, 131],
  breezeRight: [130, 129, 128, 127, 126, 125],
  pearlRight: [124, 123],
};

// ─── VillaTile ────────────────────────────────────────────────────────────────
function VillaTile({ number, villa, highlight, dimmed, onClick }) {
  if (number === null) return <div style={{ width: 18, flexShrink: 0 }} />;
  const checkingIn = villa?.checking_in_today;

  const cfg = STATUS_CFG[villa?.status] ?? UNCONFIGURED;

  return (
    <Tooltip
      title={
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700 }}>{villa?.name ?? `#${number}`}</div>
          <div>Status: {cfg.label}</div>
          {villa?.checking_in_today && <div style={{ color: '#ffd666' }}>👤 Guest is currently inside</div>}
          {villa && <div>Contract: {villa.contract_active ? '✓ Active' : 'No active contract'}</div>}
          {villa?.owner?.name && <div>Owner: {villa.owner.name}</div>}
          {villa?.price_per_night > 0 && (
            <div>OMR {Number(villa.price_per_night).toLocaleString()}/night</div>
          )}
          {!villa && <div style={{ color: '#ff7875' }}>Not in database</div>}
        </div>
      }
      mouseEnterDelay={0.4}
    >
      <button
        onClick={() => villa && onClick(villa)}
        style={{
          width: 54,
          height: 50,
          margin: 2,
          border: `2px solid ${highlight ? '#1677ff' : cfg.border}`,
          borderRadius: 8,
          background: dimmed ? '#f5f5f5' : cfg.bg,
          color: dimmed ? '#d9d9d9' : cfg.color,
          cursor: villa ? 'pointer' : 'default',
          opacity: dimmed ? 0.28 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1,
          outline: highlight ? '3px solid rgba(22,119,255,0.35)' : 'none',
          boxShadow: highlight
            ? '0 0 0 3px rgba(22,119,255,0.25), 0 3px 10px rgba(0,0,0,0.18)'
            : '0 1px 3px rgba(0,0,0,0.08)',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {villa?.contract_active && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 3,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#52c41a',
            boxShadow: '0 0 0 1.5px #fff',
          }} />
        )}
        {checkingIn && (
          <UserOutlined style={{
            position: 'absolute',
            top: 3,
            left: 4,
            fontSize: 10,
            color: cfg.color,
            opacity: 0.85,
          }} />
        )}
        {number}
        {villa && (
          <span style={{
            display: 'block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: cfg.color,
            marginTop: 5,
          }} />
        )}
      </button>
    </Tooltip>
  );
}

// ─── Zone label ───────────────────────────────────────────────────────────────
function ZoneLabel({ label, color = '#595959' }) {
  return (
    <div style={{
      textAlign: 'center',
      fontWeight: 800,
      fontSize: 10,
      color,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '3px 6px',
      userSelect: 'none',
    }}>
      {label}
    </div>
  );
}

// ─── Section divider road ─────────────────────────────────────────────────────
function RoadDivider() {
  return (
    <div style={{
      fontSize: 10,
      color: '#aaa',
      letterSpacing: '0.05em',
      margin: '3px 0',
      textAlign: 'center',
      userSelect: 'none',
    }}>
      {'─'.repeat(30)} 14 M WIDE ROAD {'─'.repeat(30)}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VillaMap() {
  usePageTitle('Villa Map');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractOnly, setContractOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedVilla, setSelectedVilla] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [form] = Form.useForm();
  const [guestForm] = Form.useForm();
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const datePickerRef = useRef(null);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const navigate = useNavigate();

  // ── All villas (polled every 30s) ──────────────────────────────────────────
  const { data: villasData, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['villas-map'],
    queryFn: () => client.get('/villas', { params: { per_page: 999 } }).then(r => r.data.data),
    refetchInterval: 30_000,
  });

  // ── Bookings for the selected villa ───────────────────────────────────────
  const { data: villaBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['villa-bookings', selectedVilla?.id],
    queryFn: () =>
      client.get(`/villas/${selectedVilla.id}/bookings`, { params: { per_page: 50 } })
        .then(r => r.data.data),
    enabled: !!selectedVilla?.id && drawerOpen,
  });

  // ── Guests for booking form ───────────────────────────────────────────────
  const { data: guests } = useQuery({
    queryKey: ['guests-all'],
    queryFn: () => client.get('/guests', { params: { per_page: 999 } }).then(r => r.data.data),
    enabled: bookingModalOpen,
  });

  // ── Build number → villa lookup ───────────────────────────────────────────
  const villaByNumber = useMemo(() => {
    const map = {};
    (villasData || []).forEach(v => {
      const n = parseInt(v.name, 10);
      if (!isNaN(n)) map[n] = v;
    });
    return map;
  }, [villasData]);
  console.log('villaByNumber', villaByNumber);
  const searchNum = search.trim() ? parseInt(search.trim(), 10) : null;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = villasData || [];
    return {
      total:       all.length,
      available:   all.filter(v => v.status === 'available').length,
      occupied:    all.filter(v => v.status === 'occupied').length,
      maintenance: all.filter(v => v.status === 'maintenance').length,
      contractActive: all.filter(v => v.contract_active).length,
    };
  }, [villasData]);

  // ── Current & upcoming bookings (client-side filter) ─────────────────────
  const today = dayjs().startOf('day');

  const currentBooking = useMemo(() =>
    (villaBookings || []).find(b =>
      ['confirmed', 'pending'].includes(b.status) &&
      !dayjs(b.check_in).startOf('day').isAfter(today) &&
      !dayjs(b.check_out).startOf('day').isBefore(today),
    ), [villaBookings, today]);

  const upcomingBookings = useMemo(() =>
    (villaBookings || [])
      .filter(b => ['confirmed', 'pending'].includes(b.status) && dayjs(b.check_in).startOf('day').isAfter(today))
      .sort((a, b) => dayjs(a.check_in).diff(dayjs(b.check_in))),
    [villaBookings, today]);

  // ── Availability check ────────────────────────────────────────────────────
  const checkAvailability = async () => {
    const { dates } = form.getFieldsValue(['dates']);
    if (!selectedVilla || !dates?.[0] || !dates?.[1]) return;
    try {
      const res = await client.post('/bookings/check-availability', {
        villa_id: selectedVilla.id,
        check_in: dates[0].format('YYYY-MM-DD'),
        check_out: dates[1].format('YYYY-MM-DD'),
      });
      setAvailability(res.data.available);
    } catch { }
  };

  // ── Create booking ────────────────────────────────────────────────────────
  const createBooking = useMutation({
    mutationFn: vals => client.post('/bookings', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villa-bookings', selectedVilla?.id] });
      message.success('Booking created successfully.');
      setBookingModalOpen(false);
      form.resetFields();
      setAvailability(null);
    },
    onError: e => message.error(e.response?.data?.message || 'Failed to create booking.'),
  });

  const createGuest = useMutation({
    mutationFn: vals => client.post('/guests', vals),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['guests-all'] });
      form.setFieldValue('guest_id', res.data.id);
      message.success(`Guest "${res.data.name}" created.`);
      setGuestModalOpen(false);
      guestForm.resetFields();
    },
    onError: e => message.error(e.response?.data?.message || 'Failed to create guest.'),
  });

  const onBookingFinish = vals => {
    createBooking.mutate({
      villa_id: selectedVilla.id,
      guest_id: vals.guest_id,
      num_guests: vals.num_guests ?? 1,
      check_in: vals.dates[0].format('YYYY-MM-DD'),
      check_in_time: vals.check_in_time ?? null,
      check_out: vals.dates[1].format('YYYY-MM-DD'),
      status: vals.status ?? 'confirmed',
      notes: vals.notes,
    });
  };
  useEffect(() => {
    setContractOnly(true);
  },[])

  // ── Tile helper ───────────────────────────────────────────────────────────
  const tile = n => {
    if (n === null) return <div key="gap" style={{ width: 18 }} />;
    const villa = villaByNumber[n];
    const highlight = !!(searchNum && searchNum === n);
    const dimmed = (statusFilter !== 'all' && villa?.status !== statusFilter)
                || (contractOnly && villa && !villa.contract_active);
    return (
      <VillaTile
        key={n}
        number={n}
        villa={villa}
        highlight={highlight}
        dimmed={dimmed}
        onClick={v => { setSelectedVilla(v); setDrawerOpen(true); }}
      />
    );
  };

  const selectedCfg = STATUS_CFG[selectedVilla?.status] ?? UNCONFIGURED;

  // ── Inject toolbar into AppBar ────────────────────────────────────────────
  const { setToolbar, clearToolbar } = useHeaderToolbar();

  useEffect(() => {
    setToolbar(
      <Space size={10} style={{ width: '100%' }} wrap={false}>
        <Space><AimOutlined /><span style={{ fontWeight: 600 }}>Villa Map</span></Space>
        <Input
          placeholder="Search villa…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onPressEnter={() => {
            if (search) {
              const villa = villaByNumber[parseInt(search)];
              if (villa) {
                setSelectedVilla(villa);
                setDrawerOpen(true);
              }
            }
          }}
          allowClear
          size="small"
          style={{ width: 150 }}
        />
        <Radio.Group
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="all">All ({stats.total})</Radio.Button>
          <Radio.Button value="available" style={statusFilter !== 'available' ? { color: '#52c41a' } : {}}>
            Avail ({stats.available})
          </Radio.Button>
          <Radio.Button value="occupied" style={statusFilter !== 'occupied' ? { color: '#fa8c16' } : {}}>
            Occ ({stats.occupied})
          </Radio.Button>
          <Radio.Button value="maintenance" style={statusFilter !== 'maintenance' ? { color: '#ff4d4f' } : {}}>
            Maint ({stats.maintenance})
          </Radio.Button>
        </Radio.Group>
        <Button
          size="small"
          type={contractOnly ? 'primary' : 'default'}
          onClick={() => setContractOnly(v => !v)}
          style={contractOnly ? {} : { color: '#52c41a', borderColor: '#52c41a' }}
        >
          <span style={{
            display: 'inline-block', width: 8, height: 8,
            borderRadius: '50%', background: '#52c41a', marginRight: 5,
          }} />
          Active ({stats.contractActive})
        </Button>
        <Button
          size="small"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => qc.invalidateQueries({ queryKey: ['villas-map'] })}
        />
      </Space>
    );
    return () => clearToolbar();
  }, [search, statusFilter, contractOnly, stats, isFetching]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 420 }}>
        <Spin size="large" tip="Loading villa map…" />
      </div>
    );
  }

  const LEGEND = [
    { key: 'available',   dot: '#52c41a', desc: 'Available — no active booking today' },
    { key: 'occupied',    dot: '#cf1322', desc: 'Occupied — guest currently checked in' },
    { key: 'maintenance', dot: '#531dab', desc: 'Maintenance — manually set by staff' },
  ];

  return (
    <div style={{userSelect:'none'}}>
      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
        {LEGEND.map(({ key, dot, desc }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#595959' }}>
            <span style={{
              display: 'inline-block', width: 12, height: 12,
              borderRadius: '50%', background: dot, flexShrink: 0,
            }} />
            {desc}
          </div>
        ))}
      </div>

      {/* ── Map ── */}
      <Card style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 860, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <div style={{ minWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

            {/* Sea Shell */}
            <ZoneLabel label="⬆ IN / OUT ⬇  ·  Sea Shell  ·  ⬆ IN / OUT ⬇" color="#531dab" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {MAP.seaShell.map((n, i) =>
                n === null
                  ? <div key={`ss-gap-${i}`} style={{ width: 20 }} />
                  : tile(n)
              )}
            </div>

            <RoadDivider />

            {/* Middle: Coral | Garden | Coral */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>

              {/* Left Coral */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {MAP.coralLeft.map(n => <div key={n}>{tile(n)}</div>)}
                <ZoneLabel label="Coral" color="#874d00" />
              </div>

              {/* Garden section */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 1200 }}>
                {/* Garden top rows */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ZoneLabel label="Garden" color="#237804" />
                    <div style={{ display: 'flex' }}>{MAP.gardenTopLeft.map(n => tile(n))}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ZoneLabel label="Garden" color="#237804" />
                    <div style={{ display: 'flex' }}>{MAP.gardenTopRight.map(n => tile(n))}</div>
                  </div>
                </div>

                {/* Flex spacer with green strip centered inside */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                  <div style={{
                    width: '100%',
                    height: 44,
                    background: 'linear-gradient(135deg, #237804 0%, #52c41a 50%, #237804 100%)',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    padding: '0 24px',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.22)',
                  }}>
                    <Text style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: 3 }}>🌿 GARDEN AREA</Text>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.18)',
                      border: '2px solid rgba(255,255,255,0.4)',
                    }} />
                    <Text style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: 3 }}>GARDEN AREA 🌿</Text>
                  </div>
                </div>

                {/* Garden bottom rows */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex' }}>{MAP.gardenBottomLeft.map(n => tile(n))}</div>
                    <ZoneLabel label="Garden" color="#237804" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex' }}>{MAP.gardenBottomRight.map(n => tile(n))}</div>
                    <ZoneLabel label="Garden" color="#237804" />
                  </div>
                </div>

                {/* Bottom: Pearl | Breeze | gap | Breeze | Pearl */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'center' }}>

                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    {MAP.pearlLeft.map(n => <div key={n}>{tile(n)}</div>)}
                    <ZoneLabel label="Pearl" color="#d46b08" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex' }}>{MAP.breezeLeft.map(n => tile(n))}</div>
                    <ZoneLabel label="Breeze" color="#0958d9" />
                  </div>

                  <div style={{ width: 28 }} />

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex' }}>{MAP.breezeRight.map(n => tile(n))}</div>
                    <ZoneLabel label="Breeze" color="#0958d9" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    {MAP.pearlRight.map(n => <div key={n}>{tile(n)}</div>)}
                    <ZoneLabel label="Pearl" color="#d46b08" />
                  </div>

                </div>
              </div>


              {/* Right Coral */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {MAP.coralRight.map(n => <div key={n}>{tile(n)}</div>)}
                <ZoneLabel label="Coral" color="#874d00" />
              </div>
            </div>

            <RoadDivider />
          </div>


        </div>
      </Card>

      {/* ── Villa Detail Drawer ── */}
      <Drawer
        title={
          selectedVilla && (
            <Space>
              <HomeOutlined />
              <span style={{ fontWeight: 700 }}>{selectedVilla.name}</span>
              <Tag color={selectedCfg.color}>{selectedCfg.label}</Tag>
            </Space>
          )
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); }}
        width={690}
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setAvailability(null); setBookingModalOpen(true); }}
            >
              New Booking
            </Button>
            <Button
              icon={<HomeOutlined />}
              onClick={() => { setDrawerOpen(false); navigate('/villas'); }}
            >
              View Villa Profile
            </Button>
          </Space>
        }
      >
        {selectedVilla && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Villa" span={2}>{selectedVilla.name}</Descriptions.Item>
              <Descriptions.Item label="Owner">{selectedVilla.owner?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Category">{selectedVilla.category ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Price / Night">
                <Text strong>OMR {Number(selectedVilla.price_per_night).toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Contract">
                {selectedVilla.contract_active
                  ? <Tag color="green">✓ Active</Tag>
                  : <Tag color="default">No active contract</Tag>
                }
              </Descriptions.Item>
              {selectedVilla.notes && (
                <Descriptions.Item label="Notes" span={2}>{selectedVilla.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" style={{ margin: '12px 0' }}>Current Booking</Divider>

            {bookingsLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : currentBooking ? (
              <Card
                size="small"
                style={{ borderColor: '#fa8c16', background: '#fff7e6', marginBottom: 16 }}
              >
                <Row gutter={[12, 10]}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Guest</Text>
                    <div style={{ fontWeight: 600 }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      {currentBooking.guest?.name}
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Status</Text>
                    <div>
                      <Tag color={statusColors[currentBooking.status]} style={{ marginRight: 4 }}>
                        {currentBooking.status}
                      </Tag>
                      <Tag color={payColors[currentBooking.payment_status]}>
                        {payLabels[currentBooking.payment_status]}
                      </Tag>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Guests</Text>
                    <div>{currentBooking.num_guests ?? 1} person{(currentBooking.num_guests ?? 1) > 1 ? 's' : ''}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Check-in Time</Text>
                    <div>{currentBooking.check_in_time ?? '—'}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Check-in</Text>
                    <div><CalendarOutlined style={{ marginRight: 4 }} />{dayjs(currentBooking.check_in).format('DD MMM YYYY')}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Check-out</Text>
                    <div><CalendarOutlined style={{ marginRight: 4 }} />{dayjs(currentBooking.check_out).format('DD MMM YYYY')}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Nights</Text>
                    <div>{currentBooking.nights}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Total</Text>
                    <div>
                      <DollarOutlined style={{ marginRight: 4 }} />
                      OMR {Number(currentBooking.total_amount).toLocaleString()}
                    </div>
                  </Col>
                  {currentBooking.notes && (
                    <Col span={24}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Notes</Text>
                      <div>{currentBooking.notes}</div>
                    </Col>
                  )}
                </Row>
              </Card>
            ) : (
              <Empty
                description="No active booking"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: '8px 0 20px' }}
              />
            )}

            <Divider orientation="left" style={{ margin: '12px 0' }}>Upcoming Bookings</Divider>

            {bookingsLoading ? (
              <div style={{ textAlign: 'center' }}><Spin /></div>
            ) : upcomingBookings.length > 0 ? (
              <Table
                size="small"
                dataSource={upcomingBookings}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'Guest', dataIndex: ['guest', 'name'], ellipsis: true },
                  { title: 'Check-in', dataIndex: 'check_in', render: d => dayjs(d).format('DD MMM YY') },
                  { title: 'Check-out', dataIndex: 'check_out', render: d => dayjs(d).format('DD MMM YY') },
                  { title: 'Nights', dataIndex: 'nights', width: 60 },
                  {
                    title: 'Status', dataIndex: 'status', width: 85,
                    render: s => <Tag color={statusColors[s]} style={{ fontSize: 11, padding: '0 4px' }}>{s}</Tag>,
                  },
                ]}
              />
            ) : (
              <Empty description="No upcoming bookings" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </>
        )}
      </Drawer>

      {/* ── New Booking Modal ── */}
      <Modal
        title={<Space><PlusOutlined /><span>New Booking — {selectedVilla?.name}</span></Space>}
        open={bookingModalOpen}
        onCancel={() => { setBookingModalOpen(false); form.resetFields(); setAvailability(null); }}
        onOk={() => form.submit()}
        confirmLoading={createBooking.isPending}
        width={460}
        centered
        okText="Create Booking"
        styles={{ body: { paddingTop: 12, paddingBottom: 4 } }}
      >
        <Form form={form} layout="vertical" onFinish={onBookingFinish} size="small">
          <Form.Item name="guest_id" label="Guest" rules={[{ required: true, message: 'Select a guest' }]} style={{ marginBottom: 10 }}>
            <Select
              placeholder="Search guest…"
              showSearch
              optionFilterProp="children"
              onChange={() => setTimeout(() => setDatePickerOpen(true), 100)}
              dropdownRender={menu => (
                <>
                  {menu}
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ padding: '4px 8px 6px' }}>
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      size="small"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setGuestModalOpen(true)}
                    >
                      New Guest
                    </Button>
                  </div>
                </>
              )}
            >
              {(guests || []).map(g => (
                <Select.Option key={g.id} value={g.id}>
                  {g.name}{g.phone ? ` — ${g.phone}` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={10} style={{ marginBottom: 0 }}>
            <Col span={15}>
              <Form.Item name="dates" label="Dates" rules={[{ required: true, message: 'Select dates' }]} style={{ marginBottom: 10 }}>
                <RangePicker
                  ref={datePickerRef}
                  style={{ width: '100%' }}
                  placeholder={['Check-in', 'Check-out']}
                  open={datePickerOpen}
                  onOpenChange={setDatePickerOpen}
                  onChange={checkAvailability}
                />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="check_in_time" label="Check-in Time" style={{ marginBottom: 10 }}>
                <Select placeholder="Time" allowClear>
                  <Select.Option value="10:00">10:00 AM</Select.Option>
                  <Select.Option value="11:00">11:00 AM</Select.Option>
                  <Select.Option value="12:00">12:00 PM</Select.Option>
                  <Select.Option value="13:00">01:00 PM</Select.Option>
                  <Select.Option value="14:00">02:00 PM</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {availability === true && <Alert message="Available ✓" type="success" showIcon style={{ marginBottom: 10, padding: '4px 10px' }} />}
          {availability === false && <Alert message="Already booked for these dates — pick different dates." type="error" showIcon style={{ marginBottom: 10, padding: '4px 10px' }} />}

          <Row gutter={10}>
            <Col span={9}>
              <Form.Item name="num_guests" label="Guests" rules={[{ required: true }]} initialValue={1} style={{ marginBottom: 10 }}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={15}>
              <Form.Item name="status" label="Status" initialValue="confirmed" style={{ marginBottom: 10 }}>
                <Select>
                  <Select.Option value="confirmed">Confirmed</Select.Option>
                  <Select.Option value="pending">Pending</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes" style={{ marginBottom: 4 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick guest creation modal */}
      <Modal
        title={<Space><UserOutlined /><span>New Guest</span></Space>}
        open={guestModalOpen}
        onCancel={() => { setGuestModalOpen(false); guestForm.resetFields(); }}
        onOk={() => guestForm.submit()}
        confirmLoading={createGuest.isPending}
        width={400}
        centered
        okText="Create Guest"
      >
        <Form form={guestForm} layout="vertical" onFinish={vals => createGuest.mutate(vals)} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+968 ..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="id_number" label="Civil / National ID">
                <Input placeholder="ID number" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
