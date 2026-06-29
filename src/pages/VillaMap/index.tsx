import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import {
  Drawer, Modal, Form, Select, DatePicker, Input, InputNumber, Button,
  Tag, Typography, Space, Alert, Table, Spin, Tooltip, Dropdown,
  Radio, App, Divider, Card, Empty, Descriptions, Row, Col,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, HomeOutlined,
  CalendarOutlined, UserOutlined, DollarOutlined,
  SearchOutlined, AimOutlined, EyeOutlined,
  ToolOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoginOutlined, LogoutOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { playSuccessChime } from '../../utils/sounds';
import client from '../../api/client';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Domain types ─────────────────────────────────────────────────────────────
type VillaStatus   = 'available' | 'occupied' | 'maintenance';
type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';

interface Owner {
  name: string;
  whatsapp?: string;
}

interface Villa {
  id: number;
  name: string;
  status: VillaStatus;
  price_per_night: number | string;
  category?: string;
  notes?: string;
  contract_active: boolean;
  checking_in_today?: boolean;
  active_booking_id?: number;
  active_booking_checked_in?: boolean;
  active_booking_checked_out?: boolean;
  active_booking_guest?: string;
  active_booking_payment?: PaymentStatus;
  owner?: Owner;
}

interface BookingGuest {
  id: number;
  name: string;
  phone?: string;
}

interface Booking {
  id: number;
  guest?: BookingGuest;
  status: BookingStatus;
  payment_status: PaymentStatus;
  check_in: string;
  check_out: string;
  check_in_time?: string;
  nights: number;
  total_amount: number;
  num_guests?: number;
  notes?: string;
}

interface GuestOption {
  id: number;
  name: string;
  phone?: string;
}

interface StatusConfig {
  color: string;
  bg: string;
  border: string;
  label: string;
}

interface WaStatus {
  sent: boolean;
  error?: string;
}

interface WaModalState {
  open: boolean;
  owner: WaStatus | null;
  tenant: WaStatus | null;
}

interface BookingFormValues {
  guest_id: number;
  num_guests?: number;
  dates: [Dayjs, Dayjs];
  check_in_time?: string;
  status?: BookingStatus;
  notes?: string;
  price_per_night: number;
}

interface GuestFormValues {
  name: string;
  phone?: string;
  id_number?: string;
}

interface QuickPayFormValues {
  amount: number;
  method: string;
  notes?: string;
}

interface VillaTileProps {
  number: number | null;
  villa?: Villa;
  highlight: boolean;
  dimmed: boolean;
  onClick: (villa: Villa) => void;
}

interface ZoneLabelProps {
  label: string;
  color?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<VillaStatus, StatusConfig> = {
  available:   { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'Available' },
  occupied:    { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', label: 'Occupied' },
  maintenance: { color: '#531dab', bg: '#f9f0ff', border: '#d3adf7', label: 'Maintenance' },
};
const UNCONFIGURED: StatusConfig = { color: '#bfbfbf', bg: '#fafafa', border: '#d9d9d9', label: 'Not configured' };

const statusColors: Record<BookingStatus, string> = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const payColors:    Record<PaymentStatus, string>  = { paid: 'green', partial: 'orange', unpaid: 'red' };
const payLabels:    Record<PaymentStatus, string>  = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };

// ─── Static map layout ────────────────────────────────────────────────────────
const MAP: Record<string, (number | null)[]> = {
  seaShell:         [101, 102, 103, 104, 105, 106, 107, null, 108, 109, 110, 111, 112, 113, 114],
  coralLeft:        [145, 144, 143, 142, 141, 140, 139, 138],
  coralRight:       [115, 116, 117, 118, 119, 120, 121, 122],
  gardenTopLeft:    [146, 147, 148, 149, 150, 151, 152],
  gardenTopRight:   [153, 154, 155, 156, 157, 158, 159, 160],
  gardenBottomLeft: [175, 174, 173, 172, 171, 170, 169],
  gardenBottomRight:[168, 167, 166, 165, 164, 163, 162, 161],
  pearlLeft:        [137, 136],
  breezeLeft:       [135, 134, 133, 132, 131],
  breezeRight:      [130, 129, 128, 127, 126, 125],
  pearlRight:       [124, 123],
};

// ─── VillaTile ────────────────────────────────────────────────────────────────
function VillaTile({ number, villa, highlight, dimmed, onClick }: VillaTileProps) {
  if (number === null) return <div style={{ width: 18, flexShrink: 0 }} />;
  const checkingIn = villa?.checking_in_today;
  const cfg: StatusConfig = villa ? (STATUS_CFG[villa.status] ?? UNCONFIGURED) : UNCONFIGURED;

  return (
    <Tooltip
      title={
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700 }}>{villa?.name ?? `#${number}`}</div>
          <div>Status: {cfg.label}</div>
          {villa?.checking_in_today && <div style={{ color: '#ffd666' }}>👤 Guest is currently inside</div>}
          {villa && <div>Contract: {villa.contract_active ? '✓ Active' : 'No active contract'}</div>}
          {villa?.owner?.name && <div>Owner: {villa.owner.name}</div>}
          {villa?.price_per_night && Number(villa.price_per_night) > 0 && (
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
function ZoneLabel({ label, color = '#595959' }: ZoneLabelProps) {
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
  const [contractOnly, setContractOnly]   = useState(false);
  const [search, setSearch]               = useState('');
  const [asOf, setAsOf]                   = useState<Dayjs>(dayjs());
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [availability, setAvailability]   = useState<boolean | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [form]      = Form.useForm<BookingFormValues>();
  const [guestForm] = Form.useForm<GuestFormValues>();
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const datePickerRef = useRef(null);
  const qc            = useQueryClient();
  const { message }   = App.useApp();
  const navigate      = useNavigate();

  const asOfStr = asOf.format('YYYY-MM-DD');
  const isToday = asOf.isSame(dayjs(), 'day');

  // ── All villas (polled every 30s when viewing today) ──────────────────────
  const { data: villasData, isLoading, isFetching } = useQuery<Villa[]>({
    queryKey: ['villas-map', asOfStr],
    queryFn: () => client.get('/villas', { params: { per_page: 999, as_of: asOfStr } }).then((r: { data: { data: Villa[] } }) => r.data.data),
    refetchInterval: isToday ? 30_000 : false,
  });

  // ── Bookings for the selected villa ───────────────────────────────────────
  const { data: villaBookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['villa-bookings', selectedVilla?.id],
    queryFn: () =>
      client.get(`/villas/${selectedVilla!.id}/bookings`, { params: { per_page: 50 } })
        .then((r: { data: { data: Booking[] } }) => r.data.data),
    enabled: !!selectedVilla?.id && drawerOpen,
  });

  // ── Guests for booking form ───────────────────────────────────────────────
  const { data: guests } = useQuery<GuestOption[]>({
    queryKey: ['guests-all'],
    queryFn: () => client.get('/guests', { params: { per_page: 999 } }).then((r: { data: { data: GuestOption[] } }) => r.data.data),
    enabled: bookingModalOpen,
  });

  // ── Build number → villa lookup ───────────────────────────────────────────
  const villaByNumber = useMemo<Record<number, Villa>>(() => {
    const map: Record<number, Villa> = {};
    (villasData ?? []).forEach(v => {
      const n = parseInt(v.name, 10);
      if (!isNaN(n)) map[n] = v;
    });
    return map;
  }, [villasData]);
  console.log('villaByNumber', villaByNumber);
  const searchNum = search.trim() ? parseInt(search.trim(), 10) : null;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = villasData ?? [];
    return {
      total:          all.length,
      available:      all.filter(v => v.status === 'available').length,
      occupied:       all.filter(v => v.status === 'occupied').length,
      maintenance:    all.filter(v => v.status === 'maintenance').length,
      contractActive: all.filter(v => v.contract_active).length,
    };
  }, [villasData]);

  // ── Current & upcoming bookings (client-side filter) ─────────────────────
  const today = dayjs().startOf('day');

  const currentBooking = useMemo(() =>
    (villaBookings ?? []).find(b =>
      (['confirmed', 'pending'] as BookingStatus[]).includes(b.status) &&
      !dayjs(b.check_in).startOf('day').isAfter(today) &&
      !dayjs(b.check_out).startOf('day').isBefore(today),
    ), [villaBookings, today]);

  const upcomingBookings = useMemo(() =>
    (villaBookings ?? [])
      .filter(b =>
        (['confirmed', 'pending'] as BookingStatus[]).includes(b.status) &&
        dayjs(b.check_in).startOf('day').isAfter(today),
      )
      .sort((a, b) => dayjs(a.check_in).diff(dayjs(b.check_in))),
    [villaBookings, today]);

  // ── Availability check ────────────────────────────────────────────────────
  const checkAvailability = async () => {
    const { dates } = form.getFieldsValue(['dates']);
    if (!selectedVilla || !dates?.[0] || !dates?.[1]) return;
    try {
      const res = await client.post('/bookings/check-availability', {
        villa_id:  selectedVilla.id,
        check_in:  dates[0].format('YYYY-MM-DD'),
        check_out: dates[1].format('YYYY-MM-DD'),
      });
      setAvailability(res.data.available);
    } catch { }
  };

  // ── Create booking ────────────────────────────────────────────────────────
  const createBooking = useMutation({
    mutationFn: (vals: Record<string, unknown>) => client.post('/bookings', vals),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villa-bookings', selectedVilla?.id] });
      playSuccessChime();
      setBookingModalOpen(false);
      form.resetFields();
      setAvailability(null);
      setWaModal({ open: true, owner: null, tenant: null });
      setTimeout(() => {
        const wa = res.data?.whatsapp ?? {};
        setWaModal({ open: true, owner: wa.owner ?? null, tenant: wa.tenant ?? null });
      }, 1000);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create booking.'),
  });

  const createGuest = useMutation({
    mutationFn: (vals: GuestFormValues) => client.post('/guests', vals),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['guests-all'] });
      form.setFieldValue('guest_id', res.data.id);
      message.success(`Guest "${res.data.name}" created.`);
      setGuestModalOpen(false);
      guestForm.resetFields();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create guest.'),
  });

  // ── Context-menu mutations ────────────────────────────────────────────────
  const [quickPayVilla, setQuickPayVilla] = useState<Villa | null>(null);
  const [quickPayForm] = Form.useForm<QuickPayFormValues>();

  const updateVillaStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      client.put(`/villas/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map', asOfStr] });
      message.success('Villa status updated.');
    },
    onError: () => message.error('Failed to update villa status.'),
  });

  const ctxConfirmArrival = useMutation({
    mutationFn: (id: number) => client.post(`/bookings/${id}/confirm-arrival`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map', asOfStr] });
      message.success('Arrival confirmed.');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to confirm arrival.'),
  });

  const ctxConfirmDeparture = useMutation({
    mutationFn: (id: number) => client.post(`/bookings/${id}/confirm-departure`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map', asOfStr] });
      message.success('Departure confirmed.');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to confirm departure.'),
  });

  const quickPay = useMutation({
    mutationFn: ({ bookingId, vals }: { bookingId: number; vals: QuickPayFormValues }) =>
      client.post(`/bookings/${bookingId}/payments`, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map', asOfStr] });
      message.success('Payment recorded.');
      setQuickPayVilla(null);
      quickPayForm.resetFields();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to record payment.'),
  });

  const buildMenuItems = (villa: Villa | undefined): MenuProps['items'] => {
    if (!villa) return [];
    const items: MenuProps['items'] = [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'View Details',
        onClick: () => { setSelectedVilla(villa); setDrawerOpen(true); },
      },
      { type: 'divider' },
    ];

    if (villa.status === 'available') {
      items.push(
        {
          key: 'book', icon: <PlusOutlined />, label: 'New Booking',
          onClick: () => {
            setSelectedVilla(villa);
            form.resetFields();
            form.setFieldValue('price_per_night', Number(villa.price_per_night));
            setBookingNights(0);
            setAvailability(null);
            setBookingModalOpen(true);
          },
        },
        {
          key: 'maint', icon: <ToolOutlined />, label: 'Set to Maintenance', danger: true,
          onClick: () => updateVillaStatus.mutate({ id: villa.id, status: 'maintenance' }),
        },
      );
    }

    if (villa.status === 'occupied') {
      if (!villa.active_booking_checked_in) {
        items.push({
          key: 'checkin',
          icon: <LoginOutlined style={{ color: '#52c41a' }} />,
          label: 'Confirm Arrival',
          onClick: () => { if (villa.active_booking_id) ctxConfirmArrival.mutate(villa.active_booking_id); },
        });
      }
      if (villa.active_booking_checked_in && !villa.active_booking_checked_out) {
        items.push({
          key: 'checkout',
          icon: <LogoutOutlined style={{ color: '#cf1322' }} />,
          label: 'Confirm Departure',
          onClick: () => { if (villa.active_booking_id) ctxConfirmDeparture.mutate(villa.active_booking_id); },
        });
      }
      items.push({
        key: 'pay', icon: <DollarOutlined style={{ color: '#fa8c16' }} />, label: 'Add Payment',
        onClick: () => setQuickPayVilla(villa),
      });
    }

    if (villa.status === 'maintenance') {
      items.push(
        {
          key: 'avail', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, label: 'Mark as Available',
          onClick: () => updateVillaStatus.mutate({ id: villa.id, status: 'available' }),
        },
        {
          key: 'book', icon: <PlusOutlined />, label: 'New Booking',
          onClick: () => {
            setSelectedVilla(villa);
            form.resetFields();
            form.setFieldValue('price_per_night', Number(villa.price_per_night));
            setBookingNights(0);
            setAvailability(null);
            setBookingModalOpen(true);
          },
        },
      );
    }

    return items;
  };

  const [bookingNights, setBookingNights] = useState(0);
  const [bookingPrice, setBookingPrice]   = useState(0);
  const [waModal, setWaModal] = useState<WaModalState>({ open: false, owner: null, tenant: null });

  const onBookingFinish = (vals: BookingFormValues) => {
    createBooking.mutate({
      villa_id:        selectedVilla!.id,
      guest_id:        vals.guest_id,
      num_guests:      vals.num_guests ?? 1,
      check_in:        vals.dates[0].format('YYYY-MM-DD'),
      check_in_time:   vals.check_in_time ?? null,
      check_out:       vals.dates[1].format('YYYY-MM-DD'),
      status:          vals.status ?? 'confirmed',
      notes:           vals.notes,
      price_per_night: vals.price_per_night,
    });
  };

  const handleDatesChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates?.[0] && dates?.[1]) {
      setBookingNights(dates[1].diff(dates[0], 'day'));
    } else {
      setBookingNights(0);
    }
    checkAvailability();
  };

  useEffect(() => {
    setContractOnly(true);
  }, []);

  // ── Tile helper ───────────────────────────────────────────────────────────
  const tile = (n: number | null): ReactNode => {
    if (n === null) return <div key="gap" style={{ width: 18 }} />;
    const villa   = villaByNumber[n];
    const highlight = !!(searchNum && searchNum === n);
    const dimmed    = !!((statusFilter !== 'all' && villa?.status !== statusFilter)
                      || (contractOnly && villa && !villa.contract_active));
    return (
      <Dropdown
        key={n}
        trigger={['contextMenu']}
        menu={{ items: buildMenuItems(villa) }}
        disabled={!villa}
      >
        <span>
          <VillaTile
            number={n}
            villa={villa}
            highlight={highlight}
            dimmed={dimmed}
            onClick={v => {
              setSelectedVilla(v);
              setDrawerOpen(true);
              form.resetFields();
              form.setFieldValue('price_per_night', Number(v.price_per_night));
              setBookingNights(0);
              setAvailability(null);
              setBookingModalOpen(true);
            }}
          />
        </span>
      </Dropdown>
    );
  };

  const selectedCfg: StatusConfig = selectedVilla
    ? (STATUS_CFG[selectedVilla.status] ?? UNCONFIGURED)
    : UNCONFIGURED;

  // ── Inject toolbar into AppBar ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { setToolbar, clearToolbar } = useHeaderToolbar() as any;

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
                form.resetFields();
                form.setFieldValue('price_per_night', Number(villa.price_per_night));
                setBookingNights(0);
                setAvailability(null);
                setBookingModalOpen(true);
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
        <DatePicker
          size="small"
          value={asOf}
          onChange={d => d && setAsOf(d)}
          format="DD MMM YYYY"
          allowClear={false}
          style={{ width: 130 }}
          renderExtraFooter={() => (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <Button size="small" type="link" onClick={() => setAsOf(dayjs())}>Today</Button>
            </div>
          )}
        />
        <Button
          size="small"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => qc.invalidateQueries({ queryKey: ['villas-map', asOfStr] })}
        />
      </Space>
    );
    return () => clearToolbar();
  }, [search, statusFilter, contractOnly, stats, isFetching, asOf, asOfStr]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 420 }}>
        <Spin size="large" tip="Loading villa map…" />
      </div>
    );
  }

  const LEGEND = [
    { key: 'available',   dot: '#52c41a', desc: `Available — no active booking on ${isToday ? 'today' : asOf.format('DD MMM')}` },
    { key: 'occupied',    dot: '#cf1322', desc: `Occupied — booking spans ${isToday ? 'today' : asOf.format('DD MMM')}` },
    { key: 'maintenance', dot: '#531dab', desc: 'Maintenance — manually set by staff' },
  ];

  return (
    <div style={{ userSelect: 'none' }}>
      {/* ── Non-today banner ── */}
      {!isToday && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 10 }}
          message={
            <span>
              Viewing map for <strong>{asOf.format('dddd, DD MMM YYYY')}</strong>
              {asOf.isBefore(dayjs(), 'day') ? ' — historical view' : ' — future view'}
              . <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setAsOf(dayjs())}>Back to today</Button>
            </span>
          }
        />
      )}

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
                  : tile(n),
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

                {/* Garden strip */}
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
        onClose={() => setDrawerOpen(false)}
        width={690}
        styles={{ body: { paddingBottom: 80 } }}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldValue('price_per_night', Number(selectedVilla?.price_per_night));
                setBookingNights(0);
                setAvailability(null);
                setBookingModalOpen(true);
              }}
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
        {console.log('selectedVilla', selectedVilla)}
        {selectedVilla && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Villa" span={2}>{selectedVilla.name}</Descriptions.Item>
              <Descriptions.Item label="Owner">{selectedVilla.owner?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="phone">{selectedVilla.owner?.whatsapp ?? '—'}</Descriptions.Item>
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
              <Card size="small" style={{ borderColor: '#fa8c16', background: '#fff7e6', marginBottom: 16 }}>
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
              <Table<Booking>
                size="small"
                dataSource={upcomingBookings}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'Guest', dataIndex: ['guest', 'name'], ellipsis: true },
                  { title: 'Check-in',  dataIndex: 'check_in',  render: (d: string) => dayjs(d).format('DD MMM YY') },
                  { title: 'Check-out', dataIndex: 'check_out', render: (d: string) => dayjs(d).format('DD MMM YY') },
                  { title: 'Nights', dataIndex: 'nights', width: 60 },
                  {
                    title: 'Status', dataIndex: 'status', width: 85,
                    render: (s: BookingStatus) => (
                      <Tag color={statusColors[s]} style={{ fontSize: 11, padding: '0 4px' }}>{s}</Tag>
                    ),
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
              {(guests ?? []).map(g => (
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
                  onChange={handleDatesChange}
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

          {availability === true  && <Alert message="Available ✓" type="success" showIcon style={{ marginBottom: 10, padding: '4px 10px' }} />}
          {availability === false && <Alert message="Already booked for these dates — pick different dates." type="error" showIcon style={{ marginBottom: 10, padding: '4px 10px' }} />}

          <Row gutter={10} align="bottom">
            <Col span={12}>
              <Form.Item
                name="price_per_night"
                label="Price / Night (OMR)"
                rules={[
                  { required: true, message: 'Required' },
                  { type: 'number', min: 0.001, message: 'Price must be greater than zero' },
                ]}
                style={{ marginBottom: 10 }}
              >
                <InputNumber
                  min={0.001}
                  step={0.5}
                  style={{ width: '100%' }}
                  onChange={v => setBookingPrice(v ?? 0)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Total" style={{ marginBottom: 10 }}>
                <div style={{
                  padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6,
                  background: '#fafafa', fontWeight: 700, fontSize: 14, color: '#4a3000',
                  lineHeight: '30px',
                }}>
                  {bookingNights > 0
                    ? `OMR ${((bookingPrice || form.getFieldValue('price_per_night') || 0) * bookingNights).toLocaleString(undefined, { minimumFractionDigits: 3 })}`
                    : <span style={{ color: '#bbb', fontWeight: 400 }}>select dates</span>
                  }
                </div>
              </Form.Item>
            </Col>
          </Row>

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

      {/* ── Quick guest creation modal ── */}
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
        <Form
          form={guestForm}
          layout="vertical"
          onFinish={vals => createGuest.mutate(vals)}
          style={{ marginTop: 12 }}
          onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input
              autoFocus
              placeholder="Full name"
              onPressEnter={() => document.getElementById('guest-phone')?.focus()}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input
                  id="guest-phone"
                  placeholder="+968 ..."
                  onPressEnter={() => document.getElementById('guest-id')?.focus()}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="id_number" label="Civil / National ID">
                <Input
                  id="guest-id"
                  placeholder="ID number"
                  onPressEnter={() => guestForm.submit()}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── WhatsApp Status Modal ── */}
      <Modal
        open={waModal.open}
        centered
        width={360}
        closable={waModal.owner !== null || waModal.tenant !== null}
        onCancel={() => setWaModal({ open: false, owner: null, tenant: null })}
        footer={
          (waModal.owner !== null || waModal.tenant !== null) ? (
            <Button type="primary" onClick={() => setWaModal({ open: false, owner: null, tenant: null })}>
              Done
            </Button>
          ) : null
        }
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Booking Created</span>
          </Space>
        }
      >
        <div style={{ padding: '12px 0 4px' }}>
          <div style={{ fontWeight: 600, marginBottom: 14, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
            <WhatsAppOutlined style={{ color: '#25D366' }} /> WhatsApp Notifications
          </div>
          {([
            { key: 'owner'  as const, label: 'Owner' },
            { key: 'tenant' as const, label: 'Tenant' },
          ]).map(({ key, label }) => {
            const status = waModal[key];
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 8,
                borderRadius: 8,
                background: status === null ? '#fafafa' : status.sent ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${status === null ? '#f0f0f0' : status.sent ? '#b7eb8f' : '#ffccc7'}`,
              }}>
                {status === null
                  ? <Spin size="small" />
                  : status.sent
                    ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {label}
                    {status === null && (
                      <Text type="secondary" style={{ fontWeight: 400, marginLeft: 6, fontSize: 12 }}>sending…</Text>
                    )}
                  </div>
                  {status !== null && (
                    <div style={{ fontSize: 12, color: status.sent ? '#52c41a' : '#ff4d4f', marginTop: 1 }}>
                      {status.sent ? 'Message sent successfully' : (status.error ?? 'Failed to send')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ── Quick Pay Modal ── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#fa8c16' }} />
            <span>Add Payment — {quickPayVilla?.name}</span>
          </Space>
        }
        open={!!quickPayVilla}
        onCancel={() => { setQuickPayVilla(null); quickPayForm.resetFields(); }}
        onOk={() => quickPayForm.submit()}
        confirmLoading={quickPay.isPending}
        width={380}
      >
        {quickPayVilla && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
            <span style={{ color: '#8c8c8c' }}>Guest: </span>
            <strong>{quickPayVilla.active_booking_guest ?? '—'}</strong>
            <span style={{ marginLeft: 16, color: '#8c8c8c' }}>Payment: </span>
            <Tag color={
              quickPayVilla.active_booking_payment === 'paid'    ? 'green'
              : quickPayVilla.active_booking_payment === 'partial' ? 'orange'
              : 'red'
            }>
              {quickPayVilla.active_booking_payment ?? '—'}
            </Tag>
          </div>
        )}
        <Form
          form={quickPayForm}
          layout="vertical"
          onFinish={vals => {
            if (quickPayVilla?.active_booking_id) {
              quickPay.mutate({ bookingId: quickPayVilla.active_booking_id, vals });
            }
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (OMR)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="method" label="Method" initialValue="cash" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'cash',          label: 'Cash' },
                  { value: 'card',          label: 'Card' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input placeholder="Optional note" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
