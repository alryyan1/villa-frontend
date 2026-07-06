import { useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Drawer, Modal, Form, Select, DatePicker, Input, InputNumber, Button,
  Tag, Typography, Space, Alert, Spin, Tooltip, Dropdown,
  Radio, App, Divider, Card, Empty, Row, Col, Avatar, Badge,
} from 'antd';
import type { InputRef, MenuProps } from 'antd';
import {
  PlusOutlined, ReloadOutlined, HomeOutlined,
  CalendarOutlined, UserOutlined, DollarOutlined,
  SearchOutlined, AimOutlined, EyeOutlined,
  ToolOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoginOutlined, LogoutOutlined, WhatsAppOutlined,
  ClockCircleOutlined, TeamOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { playSuccessChime } from '../../utils/sounds';
import client from '../../api/client';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import CountryCodeSelect from '../../components/CountryCodeSelect';
import { DEFAULT_PHONE_COUNTRY_CODE } from '../../data/countryDialCodes';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Domain types ──────────────────────────────────────────────────────────
type VillaStatus = 'available' | 'occupied' | 'maintenance';
type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';
type PaymentMethod = 'cash' | 'card' | 'bank_transfer';

interface Owner {
  id: number;
  name: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
}

interface Villa {
  id: number;
  name: string;
  status: VillaStatus;
  category?: string | null;
  num_rooms?: number | null;
  price_per_night: number | string;
  notes?: string | null;
  contract_active?: boolean;
  contract_end_date?: string | null;
  checking_in_today?: boolean;
  awaiting_arrival?: boolean;
  owner?: Owner | null;
  active_booking_id?: number | null;
  active_booking_checked_in?: boolean;
  active_booking_checked_out?: boolean;
  active_booking_guest?: string | null;
  active_booking_payment?: PaymentStatus | null;
  active_booking_check_in?: string | null;
  active_booking_check_out?: string | null;
  monthly_bookings_count?: number;
}

interface Guest {
  id: number;
  name: string;
  phone?: string | null;
}

interface Booking {
  id: number;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  check_in_time?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  nights: number;
  total_amount: number | string;
  payment_status: PaymentStatus;
  notes?: string | null;
  num_guests?: number | null;
  guest?: Guest | null;
}

interface BookingFormValues {
  guest_id: number;
  dates: [Dayjs, Dayjs];
  check_in_time?: string;
  num_guests?: number;
  status?: 'confirmed' | 'pending';
  notes?: string;
  price_per_night: number;
}

interface GuestFormValues {
  name: string;
  phone?: string;
  country_code?: string;
  id_number?: string;
}

interface QuickPayFormValues {
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

interface CreateBookingPayload {
  villa_id: number;
  guest_id: number;
  num_guests: number;
  check_in: string;
  check_in_time: string | null;
  check_out: string;
  status: 'confirmed' | 'pending';
  notes?: string;
  price_per_night: number;
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

interface BookingConflict {
  id: number;
  guest_name: string | null;
  check_in: string;
  check_out: string;
  status: BookingStatus;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<VillaStatus, { color: string; bg: string; border: string; label: string }> = {
  available: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'Available' },
  occupied: { color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', label: 'Occupied' },
  maintenance: { color: '#531dab', bg: '#f9f0ff', border: '#d3adf7', label: 'Maintenance' },
};
const UNCONFIGURED = { color: '#bfbfbf', bg: '#fafafa', border: '#d9d9d9', label: 'Not configured' };

const statusColors: Record<BookingStatus, string> = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const payColors: Record<PaymentStatus, string> = { paid: 'green', partial: 'orange', unpaid: 'red' };
const payLabels: Record<PaymentStatus, string> = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };

// ─── Guest avatar helpers ──────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#cf1322', '#d4380d', '#d46b08', '#08979c', '#1d39c4', '#531dab', '#c41d7f'];
function guestInitials(name?: string | null): string {
  const parts = (name ?? '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}
function guestAvatarColor(name?: string | null): string {
  const s = name ?? '?';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// ─── Contract status dot ──────────────────────────────────────────────────────
function contractDotColor(villa?: Villa): string {
  if (!villa?.contract_end_date) return '#bfbfbf';
  const daysLeft = dayjs(villa.contract_end_date).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (daysLeft < 0) return '#cf1322';
  if (daysLeft < 30) return '#faad14';
  return '#52c41a';
}

// ─── Static map layout ────────────────────────────────────────────────────────
// null = visual gap/separator
const MAP: Record<string, Array<number | null>> = {
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
interface VillaTileProps {
  number: number | null;
  villa?: Villa;
  highlight: boolean;
  dimmed: boolean;
  selected: boolean;
  showBookingBadge: boolean;
  onClick: (villa: Villa) => void;
}

function VillaTile({ number, villa, highlight, dimmed, selected, showBookingBadge, onClick }: VillaTileProps) {
  if (number === null) return <div style={{ width: 18, flexShrink: 0 }} />;
  const checkingIn = villa?.checking_in_today;
  const awaitingArrival = villa?.awaiting_arrival;
  const focused = highlight || selected;
  // console.log('VillaTile', 'number', number, 'villa', villa, 'highlight', highlight, 'dimmed', dimmed, 'checkingIn', checkingIn, 'awaitingArrival', awaitingArrival);
  const cfg = (villa?.status ? STATUS_CFG[villa.status] : undefined) ?? UNCONFIGURED;

  // Stay progress: 0 on check-in day, 1 once check-out day is reached.
  let stayProgress: number | null = null;
  if (villa?.status === 'occupied' && villa.active_booking_check_in && villa.active_booking_check_out) {
    const checkIn = dayjs(villa.active_booking_check_in).startOf('day');
    const checkOut = dayjs(villa.active_booking_check_out).startOf('day');
    const now = dayjs().startOf('day');
    const totalNights = checkOut.diff(checkIn, 'day');
    if (totalNights > 0) {
      const elapsed = now.diff(checkIn, 'day');
      stayProgress = Math.min(1, Math.max(0, elapsed / totalNights));
    }
  }

  return (

    <Badge
      count={showBookingBadge ? (villa?.monthly_bookings_count ?? 0) : 0}
      size="small"
      offset={[-6, 6]}
      color="#1677ff"
      title="Bookings this month"
    >
    <button
      onClick={() => villa && onClick(villa)}
      style={{
        width: 54,
        height: 50,
        margin: 2,
        border: `2px solid ${focused ? '#1677ff' : awaitingArrival ? '#fa8c16' : cfg.border}`,
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
        outline: focused ? '3px solid rgba(22,119,255,0.35)' : 'none',
        boxShadow: focused
          ? '0 0 0 3px rgba(22,119,255,0.25), 0 3px 10px rgba(0,0,0,0.18)'
          : '0 1px 3px rgba(0,0,0,0.08)',
        animation: awaitingArrival ? 'heartbeat 1.6s ease-in-out infinite' : undefined,
        transition: 'all 0.15s ease',
        flexShrink: 0,
        position: 'relative',
      }}
    >
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
          background: contractDotColor(villa),
          marginTop: 5,
        }} />
      )}
      {stayProgress !== null && (
        <Tooltip title={`Stay progress: ${Math.round(stayProgress * 100)}%`}>
          <span style={{
            position: 'absolute',
            left: 3,
            right: 3,
            bottom: 3,
            height: 3,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <span style={{
              display: 'block',
              height: '100%',
              width: `${stayProgress * 100}%`,
              borderRadius: 2,
              background: stayProgress >= 1 ? '#cf1322' : '#fa8c16',
              transition: 'width 0.3s ease',
            }} />
          </span>
        </Tooltip>
      )}
    </button>
    </Badge>
  );
}

// ─── Zone label ───────────────────────────────────────────────────────────────
interface ZoneLabelProps {
  label: string;
  color?: string;
}

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
  const [statusFilter, setStatusFilter] = useState<'all' | VillaStatus>('all');
  const [contractOnly, setContractOnly] = useState(false);
  const [showBookingBadge, setShowBookingBadge] = useState(() => localStorage.getItem('villaMap.showBookingBadge') !== 'false');
  const [search, setSearch] = useState('');
  const [asOfRange, setAsOfRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [form] = Form.useForm<BookingFormValues>();
  const [guestForm] = Form.useForm<GuestFormValues>();
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const datePickerRef = useRef<any>(null);
  const guestNameRef = useRef<InputRef>(null);
  const priceFieldRef = useRef<any>(null);
  const qc = useQueryClient();

  const { message } = App.useApp();
  const navigate = useNavigate();

  const asOfStartStr = asOfRange[0].format('YYYY-MM-DD');
  const asOfEndStr = asOfRange[1].format('YYYY-MM-DD');
  const isSingleDay = asOfRange[0].isSame(asOfRange[1], 'day');
  const isToday = isSingleDay && asOfRange[0].isSame(dayjs(), 'day');

  // ── All villas (polled every 30s when viewing today) ──────────────────────
  const { data: villasData, isLoading, isFetching } = useQuery<Villa[]>({
    queryKey: ['villas-map', asOfStartStr, asOfEndStr],
    queryFn: () => client.get('/villas', { params: { per_page: 999, as_of_start: asOfStartStr, as_of_end: asOfEndStr } }).then((r: any) => r.data.data),
    refetchInterval: isToday ? 30_000 : false,
  });

  // alert(selectedVilla.name,'selectedVilla.id')
  // ── Bookings for the selected villa ───────────────────────────────────────
  const { data: villaBookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['villa-bookings', selectedVilla?.id],
    queryFn: () =>
      client.get(`/villas/${selectedVilla?.id}/bookings`, { params: { per_page: 50 } })
        .then((r: any) => r.data.data),
    enabled: !!selectedVilla?.id && drawerOpen,
  });

  // ── Guests for booking form ───────────────────────────────────────────────
  const { data: guests } = useQuery<Guest[]>({
    queryKey: ['guests-all'],
    queryFn: () => client.get('/guests').then((r: any) => r.data),
    enabled: bookingModalOpen,
  });

  // ── Build number → villa lookup ───────────────────────────────────────────
  const villaByNumber = useMemo(() => {
    const map: Record<number, Villa> = {};
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
    const active = all.filter(v => v.contract_active);
    return {
      total: all.length,
      available: active.filter(v => v.status === 'available').length,
      occupied: active.filter(v => v.status === 'occupied').length,
      maintenance: active.filter(v => v.status === 'maintenance').length,
      contractActive: active.length,
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

  const lastBooking = useMemo(() =>
    (villaBookings || [])
      .filter(b => !['cancelled'].includes(b.status) && dayjs(b.check_out).startOf('day').isBefore(today))
      .sort((a, b) => dayjs(b.check_out).diff(dayjs(a.check_out)))[0] ?? null,
    [villaBookings, today]);

  const upcomingBookings = useMemo(() =>
    (villaBookings || [])
      .filter(b => ['confirmed', 'pending'].includes(b.status) && dayjs(b.check_in).startOf('day').isAfter(today))
      .sort((a, b) => dayjs(a.check_in).diff(dayjs(b.check_in))),
    [villaBookings, today]);

  // ── Availability check ────────────────────────────────────────────────────
  const checkAvailability = async () => {
    const { dates } = form.getFieldsValue(['dates']);
    if (!selectedVilla || !dates?.[0] || !dates?.[1]) return;
    setAvailability(null);
    setConflicts([]);
    setCheckingAvailability(true);
    try {
      const res = await client.post('/bookings/check-availability', {
        villa_id: selectedVilla.id,
        check_in: dates[0].format('YYYY-MM-DD'),
        check_out: dates[1].format('YYYY-MM-DD'),
      });
      setAvailability(res.data.available);
      setConflicts(res.data.conflicts ?? []);
      if (res.data.available) {
        setTimeout(() => { priceFieldRef.current?.focus(); priceFieldRef.current?.select?.(); }, 50);
      }
    } catch { }
    finally {
      setCheckingAvailability(false);
    }
  };

  // ── Create booking ────────────────────────────────────────────────────────
  const createBooking = useMutation({
    mutationFn: (vals: CreateBookingPayload) => client.post('/bookings', vals),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villa-bookings', selectedVilla?.id] });
      playSuccessChime();
      setBookingModalOpen(false);

      form.resetFields();
      setAvailability(null); setConflicts([]);
      setWaModal({ open: true, owner: null, tenant: null });
      setTimeout(() => {
        const wa = res.data?.whatsapp ?? {};
        const unknown: WaStatus = { sent: false, error: 'No status returned' };
        setWaModal({ open: true, owner: wa.owner ?? unknown, tenant: wa.tenant ?? unknown });
      }, 1000);
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create booking.'),
  });

  const createGuest = useMutation({
    mutationFn: (vals: GuestFormValues) => client.post('/guests', vals),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['guests-all'] });
      form.setFieldValue('guest_id', res.data.id);
      message.success(`Guest "${res.data.name}" created.`);
      setGuestModalOpen(false);
      //open checkin checkout calendar
      setDatePickerOpen(true);

      guestForm.resetFields();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create guest.'),
  });

  // ── Context-menu mutations ────────────────────────────────────────────────
  const [quickPayVilla, setQuickPayVilla] = useState<Villa | null>(null);
  const [quickPayForm] = Form.useForm<QuickPayFormValues>();

  const updateVillaStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: VillaStatus }) => client.put(`/villas/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['villas-map'] }); message.success('Villa status updated.'); },
    onError: () => message.error('Failed to update villa status.'),
  });

  const ctxConfirmArrival = useMutation({
    mutationFn: (id: number) => client.post(`/bookings/${id}/confirm-arrival`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villa-bookings', selectedVilla?.id] });
      message.success('Arrival confirmed.');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to confirm arrival.'),
  });

  const ctxConfirmDeparture = useMutation({
    mutationFn: (id: number) => client.post(`/bookings/${id}/confirm-departure`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      qc.invalidateQueries({ queryKey: ['villa-bookings', selectedVilla?.id] });
      message.success('Departure confirmed.');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to confirm departure.'),
  });

  const quickPay = useMutation({
    mutationFn: ({ bookingId, vals }: { bookingId: number; vals: QuickPayFormValues }) => client.post(`/bookings/${bookingId}/payments`, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villas-map'] });
      message.success('Payment recorded.');
      setQuickPayVilla(null);
      quickPayForm.resetFields();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to record payment.'),
  });

  type MenuItem = NonNullable<MenuProps['items']>[number];

  const buildMenuItems = (villa: Villa | null): MenuItem[] => {
    if (!villa) return [];
    const items: MenuItem[] = [
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
          onClick: () => { setSelectedVilla(villa); form.resetFields(); form.setFieldValue('price_per_night', Number(villa.price_per_night)); setBookingNights(0); setAvailability(null); setConflicts([]); setBookingModalOpen(true); }
        },
        {
          key: 'maint', icon: <ToolOutlined />, label: 'Set to Maintenance', danger: true,
          onClick: () => updateVillaStatus.mutate({ id: villa.id, status: 'maintenance' })
        },
      );
    }

    if (villa.status === 'occupied') {
      if (!villa.active_booking_checked_in) {
        items.push({
          key: 'checkin', icon: <LoginOutlined style={{ color: '#52c41a' }} />, label: 'Confirm Arrival',
          onClick: () => villa.active_booking_id && ctxConfirmArrival.mutate(villa.active_booking_id)
        });
      }
      if (villa.active_booking_checked_in && !villa.active_booking_checked_out) {
        items.push({
          key: 'checkout', icon: <LogoutOutlined style={{ color: '#cf1322' }} />, label: 'Confirm Departure',
          onClick: () => villa.active_booking_id && ctxConfirmDeparture.mutate(villa.active_booking_id)
        });
      }
      items.push({
        key: 'pay', icon: <DollarOutlined style={{ color: '#fa8c16' }} />, label: 'Add Payment',
        onClick: () => setQuickPayVilla(villa)
      });
    }

    if (villa.status === 'maintenance') {
      items.push(
        {
          key: 'avail', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, label: 'Mark as Available',
          onClick: () => updateVillaStatus.mutate({ id: villa.id, status: 'available' })
        },
      );
    }

    return items;
  };

  const [bookingNights, setBookingNights] = useState(0);
  const [bookingPrice, setBookingPrice] = useState(0);
  const [waModal, setWaModal] = useState<WaModalState>({ open: false, owner: null, tenant: null });

  const onBookingFinish = (vals: BookingFormValues) => {
    if (!selectedVilla) return;
    createBooking.mutate({
      villa_id: selectedVilla.id,
      guest_id: vals.guest_id,
      num_guests: vals.num_guests ?? 1,
      check_in: vals.dates[0].format('YYYY-MM-DD'),
      check_in_time: vals.check_in_time ?? null,
      check_out: vals.dates[1].format('YYYY-MM-DD'),
      status: vals.status ?? 'confirmed',
      notes: vals.notes,
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
  }, [])

  const toggleBookingBadge = () => {
    setShowBookingBadge(v => {
      const next = !v;
      localStorage.setItem('villaMap.showBookingBadge', String(next));
      return next;
    });
  };

  // ── Tile helper ───────────────────────────────────────────────────────────
  const tile = (n: number | null): ReactNode => {
    if (n === null) return <div key="gap" style={{ width: 18 }} />;
    const villa = villaByNumber[n];
    const highlight = !!(searchNum && searchNum === n);
    const selected = !!(villa && selectedVilla?.id === villa.id);
    const dimmed = (statusFilter !== 'all' && villa?.status !== statusFilter)
      || (contractOnly && villa && !villa.contract_active) || false;
    return (
      <Dropdown
        key={n}
        trigger={['contextMenu']}
        menu={{ items: buildMenuItems(villa ?? null) }}
        disabled={!villa}
      >
        <span>
          <VillaTile
            number={n}
            villa={villa}
            highlight={highlight}
            dimmed={dimmed}
            selected={selected}
            showBookingBadge={showBookingBadge}
            onClick={v => {
              // alert(`VillaTile clicked ${v.contract_active}`);
              if (v.contract_active === false) {
                message.warning('Villa does not have an active contract. Cannot create booking.');
                return;
              }
              console.log('VillaTile clicked', v);
              setSelectedVilla(v);
              setDrawerOpen(true);
              form.resetFields();
              form.setFieldValue('price_per_night', Number(v.price_per_night));
              setBookingNights(0);
              setAvailability(null); setConflicts([]);
              if (v.status === 'maintenance') {
                message.warning('Villa is under maintenance. Cannot create booking.');
                setBookingModalOpen(false);
                return;
              }
              setBookingModalOpen(v?.status != 'occupied');
              // setOpenGuestModal(true);
              //open guest modal if villa is not occupied
              if (v?.status !== 'occupied') {
                setGuestModalOpen(true);
              }
            }}
          />
        </span>
      </Dropdown>
    );
  };

  const selectedCfg = (selectedVilla?.status ? STATUS_CFG[selectedVilla.status] : undefined) ?? UNCONFIGURED;

  // ── Inject toolbar into AppBar ────────────────────────────────────────────
  const { setToolbar, clearToolbar } = useHeaderToolbar() as unknown as {
    setToolbar: (node: ReactNode) => void;
    clearToolbar: () => void;
  };

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
                setAvailability(null); setConflicts([]);
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
        <RangePicker
          size="small"
          value={asOfRange}
          onChange={dates => dates?.[0] && dates?.[1] && setAsOfRange([dates[0], dates[1]])}
          format="DD MMM YYYY"
          allowClear={false}
          placeholder={['Check-in', 'Check-out']}
          style={{ width: 230 }}
          renderExtraFooter={() => (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <Button size="small" type="link" onClick={() => setAsOfRange([dayjs(), dayjs()])}>Today</Button>
            </div>
          )}
        />
        <Button
          size="small"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => qc.invalidateQueries({ queryKey: ['villas-map'] })}
        />
      </Space>
    );
    return () => clearToolbar();
  }, [search, statusFilter, contractOnly, stats, isFetching, asOfRange, asOfStartStr, asOfEndStr]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 420 }}>
        <Spin size="large" tip="Loading villa map…" />
      </div>
    );
  }

  const rangeLabel = isSingleDay ? asOfRange[0].format('DD MMM') : `${asOfRange[0].format('DD MMM')} → ${asOfRange[1].format('DD MMM')}`;

  const LEGEND = [
    { key: 'available', dot: '#52c41a', desc: `Available — free for ${isToday ? 'today' : rangeLabel}` },
    { key: 'occupied', dot: '#cf1322', desc: `Occupied — a booking overlaps ${isToday ? 'today' : rangeLabel}` },
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
              Viewing map for <strong>{isSingleDay ? asOfRange[0].format('dddd, DD MMM YYYY') : `${asOfRange[0].format('DD MMM YYYY')} → ${asOfRange[1].format('DD MMM YYYY')}`}</strong>
              {asOfRange[1].isBefore(dayjs(), 'day') ? ' — historical view' : asOfRange[0].isAfter(dayjs(), 'day') ? ' — future view' : ' — spans today'}
              . <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setAsOfRange([dayjs(), dayjs()])}>Back to today</Button>
            </span>
          }
        />
      )}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 10, flexWrap: 'wrap' }}>
        {LEGEND.map(({ key, dot, desc }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#595959' }}>
            <span style={{
              display: 'inline-block', width: 12, height: 12,
              borderRadius: '50%', background: dot, flexShrink: 0,
            }} />
            {desc}
          </div>
        ))}
        <Space style={{ marginLeft: 'auto' }}>
          <Tooltip title="Show a badge with the bookings count per villa for the current month">
            <Button
              size="small"
              type={showBookingBadge ? 'primary' : 'default'}
              icon={<CalendarOutlined />}
              onClick={toggleBookingBadge}
            >
              Monthly Bookings
            </Button>
          </Tooltip>
          <Tooltip title="What do the colors, dots and badges mean?">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => setLegendModalOpen(true)}
            >
              What do the tiles mean?
            </Button>
          </Tooltip>
        </Space>
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
              Owner:
              <Button
                size="small"
                icon={<UserOutlined />}
                onClick={() => setOwnerModalOpen(true)}
                style={{ fontSize: 11, height: 22, padding: '0 7px' }}
              >
                {selectedVilla.owner?.name ?? 'No Owner'}
              </Button>
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
              disabled={selectedVilla?.status === 'maintenance'}
              title={selectedVilla?.status === 'maintenance' ? 'Villa is under maintenance' : undefined}
              onClick={() => { form.resetFields(); form.setFieldValue('price_per_night', Number(selectedVilla?.price_per_night)); setBookingNights(0); setAvailability(null); setConflicts([]); setBookingModalOpen(true); }}
            >
              New Booking
            </Button>
            <Button
              icon={<CalendarOutlined />}
              onClick={() => { setDrawerOpen(false); navigate('/bookings', { state: { filterVillaId: selectedVilla?.id } }); }}
            >
              View Bookings
            </Button>
            <Button
              icon={<HomeOutlined />}
              onClick={() => { setDrawerOpen(false); navigate('/villas', { state: { editVillaId: selectedVilla?.id } }); }}
            >
              View Villa Profile
            </Button>
          </Space>
        }
      >
        {selectedVilla && (
          <>
            {/* ── Villa overview ── */}
            {/* <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', marginBottom: 8, background: '#fafafa',
              borderRadius: 8, border: `1px solid ${selectedCfg.border}`,
              borderLeft: `3px solid ${selectedCfg.color}`,
            }}>
              <div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {selectedVilla.category ?? '—'}
                    {selectedVilla.num_rooms ? ` · ${selectedVilla.num_rooms} rooms` : ''}
                    {' · '}
                  </Text>
                  <Tag color={selectedVilla.contract_active ? 'green' : 'default'} style={{ margin: 0, fontSize: 10, padding: '0 5px' }}>
                    {selectedVilla.contract_active ? '✓ Active' : 'Inactive'}
                  </Tag>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>/ night</Text>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1677ff', lineHeight: 1.2 }}>
                  OMR {Number(selectedVilla.price_per_night).toLocaleString()}
                </div>
              </div>
            </div> */}
            {selectedVilla.notes && (
              <div style={{ fontSize: 11, color: '#8c8c8c', padding: '0 2px', marginBottom: 10 }}>
                {selectedVilla.notes}
              </div>
            )}

            <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0', fontSize: 11, color: '#8c8c8c', fontWeight: 700 }}>
              Current Booking
            </Divider>

            {bookingsLoading ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
            ) : currentBooking ? (
              <div style={{
                border: `1px solid ${currentBooking.checked_in_at ? '#b7eb8f' : '#fa8c16'}`,
                background: currentBooking.checked_in_at ? '#f6ffed' : '#fffcf0',
                borderRadius: 8, padding: '10px 12px', marginBottom: 10,
              }}>
                {/* Guest inside banner */}
                {currentBooking.checked_in_at && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fff', border: '1px solid #b7eb8f',
                    borderRadius: 8, padding: '7px 10px', marginBottom: 10,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: '#f6ffed', border: '2px solid #52c41a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <UserOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#389e0d', fontWeight: 700 }}>Guest is Inside</Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        Arrived {dayjs(currentBooking.checked_in_at).format('ddd DD MMM · HH:mm')}
                      </Text>
                    </div>
                    {currentBooking.checked_out_at && (
                      <div style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: 11, color: '#cf1322', fontWeight: 600, display: 'block' }}>Departed</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(currentBooking.checked_out_at).format('HH:mm')}
                        </Text>
                      </div>
                    )}
                  </div>
                )}

                {/* Guest + status row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      <UserOutlined style={{ marginRight: 5, color: '#1677ff' }} />
                      {currentBooking.guest?.name}
                    </Text>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: '#f0f5ff', border: '1px solid #adc6ff',
                      borderRadius: 20, padding: '1px 7px',
                    }}>
                      <UserOutlined style={{ fontSize: 12, color: '#1677ff' }} />
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#1677ff' }}>{currentBooking.num_guests ?? 1}</Text>
                    </div>
                  </div>
                  <Space size={4}>
                    <Tag color={statusColors[currentBooking.status]} style={{ margin: 0, fontSize: 11 }}>{currentBooking.status}</Tag>
                    <Tag color={payColors[currentBooking.payment_status]} style={{ margin: 0, fontSize: 11 }}>{payLabels[currentBooking.payment_status]}</Tag>
                  </Space>
                </div>

                {/* Date range */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.7)', borderRadius: 8,
                  padding: '7px 10px', marginBottom: 8,
                  border: '1px solid rgba(0,0,0,0.06)',
                }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Check-in</Text>
                    <Text strong style={{ fontSize: 13 }}>{dayjs(currentBooking.check_in).format('DD MMM YYYY')}</Text>
                    {currentBooking.check_in_time && (
                      <Text style={{ fontSize: 10, color: '#1677ff', display: 'block' }}>@ {currentBooking.check_in_time}</Text>
                    )}
                    {currentBooking.checked_in_at && (
                      <Tooltip title={`Arrived ${dayjs(currentBooking.checked_in_at).format('HH:mm')}`}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                      </Tooltip>
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
                    <Text style={{ fontSize: 12, fontWeight: 700, color: '#1677ff' }}>
                      {currentBooking.nights}n
                    </Text>
                    <div style={{ height: 2, background: 'linear-gradient(90deg,#1677ff30,#1677ff,#1677ff30)', borderRadius: 2, margin: '3px 0' }} />
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Check-out</Text>
                    <Text strong style={{ fontSize: 13 }}>{dayjs(currentBooking.check_out).format('DD MMM YYYY')}</Text>
                    {currentBooking.checked_out_at && (
                      <Tooltip title={`Departed ${dayjs(currentBooking.checked_out_at).format('HH:mm')}`}>
                        <CheckCircleOutlined style={{ color: '#cf1322', fontSize: 12 }} />
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Financial */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontWeight: 700, fontSize: 15, color: '#4a3000' }}>
                    <DollarOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
                    OMR {Number(currentBooking.total_amount).toLocaleString()}
                  </Text>
                  {currentBooking.notes && (
                    <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentBooking.notes}
                    </Text>
                  )}
                </div>

                {/* Check-in / Check-out actions */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                  <Button
                    size="small"
                    icon={<LoginOutlined />}
                    loading={ctxConfirmArrival.isPending}
                    disabled={!!currentBooking.checked_in_at}
                    onClick={() => ctxConfirmArrival.mutate(currentBooking.id)}
                    style={{ flex: 1, ...(currentBooking.checked_in_at ? {} : { background: '#52c41a', borderColor: '#52c41a', color: '#fff' }) }}
                  >
                    Check In
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<LogoutOutlined />}
                    loading={ctxConfirmDeparture.isPending}
                    disabled={!currentBooking.checked_in_at || !!currentBooking.checked_out_at}
                    onClick={() => ctxConfirmDeparture.mutate(currentBooking.id)}
                    style={{ flex: 1 }}
                  >
                    Check Out
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Empty description="No active booking" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '4px 0 8px', padding: 0 }} />
                {lastBooking && (
                  <div style={{
                    border: '1px solid #e8e8e8', borderRadius: 8,
                    padding: '10px 12px', background: '#fafafa',
                    borderLeft: '3px solid #d9d9d9',
                  }}>
                    <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 8 }}>
                      Last Booking
                    </Text>

                    {/* Guest + status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 14 }}>
                          <UserOutlined style={{ marginRight: 5, color: '#8c8c8c' }} />
                          {lastBooking.guest?.name}
                        </Text>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: '#f5f5f5', border: '1px solid #d9d9d9',
                          borderRadius: 20, padding: '1px 7px',
                        }}>
                          <UserOutlined style={{ fontSize: 11, color: '#8c8c8c' }} />
                          <Text style={{ fontSize: 12, fontWeight: 700, color: '#8c8c8c' }}>{lastBooking.num_guests ?? 1}</Text>
                        </div>
                      </div>
                      <Space size={4}>
                        <Tag color={statusColors[lastBooking.status]} style={{ margin: 0, fontSize: 11 }}>{lastBooking.status}</Tag>
                        <Tag color={payColors[lastBooking.payment_status]} style={{ margin: 0, fontSize: 11 }}>{payLabels[lastBooking.payment_status]}</Tag>
                      </Space>
                    </div>

                    {/* Date range */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      background: '#fff', borderRadius: 8,
                      padding: '7px 10px', marginBottom: 8,
                      border: '1px solid #f0f0f0',
                    }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Check-in</Text>
                        <Text strong style={{ fontSize: 13 }}>{dayjs(lastBooking.check_in).format('DD MMM YYYY')}</Text>
                        {lastBooking.check_in_time && (
                          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>@ {lastBooking.check_in_time}</Text>
                        )}
                        {lastBooking.checked_in_at && (
                          <Tooltip title={`Arrived ${dayjs(lastBooking.checked_in_at).format('HH:mm')}`}>
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                          </Tooltip>
                        )}
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
                        <Text style={{ fontSize: 12, fontWeight: 700, color: '#8c8c8c' }}>{lastBooking.nights}n</Text>
                        <div style={{ height: 2, background: '#e8e8e8', borderRadius: 2, margin: '3px 0' }} />
                      </div>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Check-out</Text>
                        <Text strong style={{ fontSize: 13 }}>{dayjs(lastBooking.check_out).format('DD MMM YYYY')}</Text>
                        {lastBooking.checked_out_at && (
                          <Tooltip title={`Departed ${dayjs(lastBooking.checked_out_at).format('HH:mm')}`}>
                            <CheckCircleOutlined style={{ color: '#cf1322', fontSize: 12 }} />
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Financial */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: 700, fontSize: 14, color: '#595959' }}>
                        <DollarOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                        OMR {Number(lastBooking.total_amount).toLocaleString()}
                      </Text>
                      {lastBooking.notes && (
                        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lastBooking.notes}
                        </Text>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Upcoming Bookings ── */}
            <Divider orientation="left" orientationMargin={0} style={{ margin: '8px 0', fontSize: 11, color: '#8c8c8c', fontWeight: 700 }}>
              Upcoming Bookings
            </Divider>

            {bookingsLoading ? (
              <div style={{ textAlign: 'center' }}><Spin /></div>
            ) : upcomingBookings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {upcomingBookings.map((b, idx) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 7,
                      background: idx === 0 ? '#f0f5ff' : '#fafafa',
                      border: `1px solid ${idx === 0 ? '#adc6ff' : '#f0f0f0'}`,
                      borderLeft: `3px solid ${b.status === 'confirmed' ? '#52c41a' : '#fa8c16'}`,
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 14 }}>
                        <UserOutlined style={{ marginRight: 5, color: '#1677ff', fontSize: 12 }} />
                        {b.guest?.name}
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#434343' }}>
                          <CalendarOutlined style={{ color: '#1677ff' }} />
                          {dayjs(b.check_in).format('DD MMM')} → {dayjs(b.check_out).format('DD MMM YYYY')}
                        </span>
                        <Tag color="blue" style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{b.nights}n</Tag>
                        {(b.num_guests ?? 1) > 1 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#595959' }}>
                            <TeamOutlined /> {b.num_guests}
                          </span>
                        )}
                      </div>
                    </div>
                    <Tag color={statusColors[b.status]} style={{ margin: 0, fontSize: 12, flexShrink: 0 }}>{b.status}</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No upcoming bookings" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '4px 0' }} />
            )}
          </>
        )}
      </Drawer>

      {/* ── New Booking Modal ── */}
      <Modal
        title={
          <Space size={8}>
            <PlusOutlined />
            <span>New Booking — {selectedVilla?.name}</span>
            {selectedVilla && (
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                {selectedVilla.category ?? '—'}
                {selectedVilla.num_rooms ? ` · ${selectedVilla.num_rooms} rooms` : ''}
                {' · OMR '}{Number(selectedVilla.price_per_night).toLocaleString(undefined, { minimumFractionDigits: 3 })}/night
              </Text>
            )}
          </Space>
        }
        open={bookingModalOpen}
        onCancel={() => { setBookingModalOpen(false); form.resetFields(); setAvailability(null); setConflicts([]); setCheckingAvailability(false); }}
        onOk={() => form.submit()}
        confirmLoading={createBooking.isPending}
        width={700}
        centered
        okText="Create Booking"
        okButtonProps={{ icon: <PlusOutlined />, disabled: availability === false || checkingAvailability, loading: checkingAvailability }}
        styles={{ body: { paddingTop: 12, paddingBottom: 0 } }}
      >
        <Form form={form} layout="vertical" onFinish={onBookingFinish} size="small">
          <Row gutter={10}>
            <Col span={14}>
              <Form.Item name="guest_id" label="Guest" rules={[{ required: true, message: 'Select a guest' }]} style={{ marginBottom: 8 }}>
                <Select
                  placeholder="Search guest by name or phone…"
                  showSearch
                  optionFilterProp="children"
                  suffixIcon={<UserOutlined />}
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
            </Col>
            <Col span={4}>
              <Form.Item name="num_guests" label="Guests" rules={[{ required: true }]} initialValue={1} style={{ marginBottom: 8 }}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Status" initialValue="confirmed" style={{ marginBottom: 8 }}>
                <Select>
                  <Select.Option value="confirmed">
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#52c41a', marginRight: 7 }} />
                    Confirmed
                  </Select.Option>
                  <Select.Option value="pending">
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#fa8c16', marginRight: 7 }} />
                    Pending
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={10}>
            <Col span={10}>
              <Form.Item
                name="dates"
                label="Dates"
                rules={[{ required: true, message: 'Select dates' }]}
                style={{ marginBottom: 8 }}
                extra={bookingNights > 0 ? `${bookingNights} night${bookingNights > 1 ? 's' : ''}` : undefined}
              >
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
            <Col span={5}>
              <Form.Item name="check_in_time" label="Check-in Time" style={{ marginBottom: 8 }}>
                <Select placeholder="Time" allowClear suffixIcon={<ClockCircleOutlined />}>
                  <Select.Option value="10:00">10:00 AM</Select.Option>
                  <Select.Option value="11:00">11:00 AM</Select.Option>
                  <Select.Option value="12:00">12:00 PM</Select.Option>
                  <Select.Option value="13:00">01:00 PM</Select.Option>
                  <Select.Option value="14:00">02:00 PM</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="price_per_night"
                label="Price / Night"
                rules={[
                  { required: true, message: 'Required' },
                  { type: 'number', min: 0.001, message: '> 0' },
                ]}
                style={{ marginBottom: 8 }}
              >
                <InputNumber
                  ref={priceFieldRef}
                  min={0.001}
                  step={0.5}
                  style={{ width: '100%' }}
                  onFocus={e => e.target.select()}
                  onChange={v => setBookingPrice(Number(v) || 0)}
                />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item label="Total" style={{ marginBottom: 8 }}>
                <div style={{
                  padding: '0 10px', border: '1px solid #ffe7ba', borderRadius: 6,
                  background: '#fffbf0', height: 24, display: 'flex', alignItems: 'center',
                }}>
                  {bookingNights > 0 ? (
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#874d00' }}>
                      OMR {((bookingPrice || form.getFieldValue('price_per_night') || 0) * bookingNights).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    </span>
                  ) : (
                    <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          {checkingAvailability && (
            <Alert
              message={<Space size={8}><Spin size="small" />Checking availability…</Space>}
              type="info"
              style={{ marginBottom: 8, padding: '4px 10px' }}
            />
          )}
          {!checkingAvailability && availability === true && <Alert message="Villa is available for these dates" type="success" showIcon style={{ marginBottom: 8, padding: '4px 10px' }} />}
          {!checkingAvailability && availability === false && (
            <div style={{ marginBottom: 8 }}>
              <Alert
                type="error"
                showIcon
                style={{ padding: '6px 10px', marginBottom: conflicts.length > 0 ? 6 : 0 }}
                message="Already booked for these dates — pick different dates."
              />
              {conflicts.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginBottom: 6,
                    background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8,
                  }}
                >
                  <Avatar
                    size={38}
                    style={{ background: guestAvatarColor(c.guest_name), fontWeight: 700, flexShrink: 0 }}
                  >
                    {guestInitials(c.guest_name)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#820014' }}>
                        {c.guest_name ?? 'Unknown guest'}
                      </span>
                      <Text type="secondary" style={{ fontSize: 11 }}>#{c.id}</Text>
                      <Tag color={statusColors[c.status]} style={{ margin: 0 }}>{c.status}</Tag>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <CalendarOutlined style={{ color: '#cf1322' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#5c0011' }}>
                        {dayjs(c.check_in).format('DD MMM')} → {dayjs(c.check_out).format('DD MMM YYYY')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Form.Item name="notes" label="Notes" style={{ marginBottom: 4 }}>
            <Input.TextArea rows={1} placeholder="Optional notes about this booking…" />
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
        afterOpenChange={open => { if (open) guestNameRef.current?.focus(); }}
      >
        <Form form={guestForm} layout="vertical" onFinish={vals => createGuest.mutate(vals)} style={{ marginTop: 12 }}
          onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input
              ref={guestNameRef}
              placeholder="Full name"
              onPressEnter={() => document.getElementById('guest-phone')?.focus()}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="country_code" label="Code" initialValue={DEFAULT_PHONE_COUNTRY_CODE}>
                <CountryCodeSelect style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="phone" label="Phone">
                <Input
                  id="guest-phone"
                  onPressEnter={() => document.getElementById('guest-id')?.focus()}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Form.Item name="id_number" label="Civil / National ID">
              <Input
                id="guest-id"
                placeholder="ID number"
                onPressEnter={() => guestForm.submit()}
              />
            </Form.Item>
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
            { key: 'owner', label: 'Owner', status: waModal.owner },
            { key: 'tenant', label: 'Guest', status: waModal.tenant },
          ] as Array<{ key: string; label: string; status: WaStatus | null }>).map(({ key, label, status }) => {
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 8,
                borderRadius: 8,
                background: status === null ? '#fafafa'
                  : status.sent ? '#f6ffed'
                    : '#fff2f0',
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
                    {status === null && <Text type="secondary" style={{ fontWeight: 400, marginLeft: 6, fontSize: 12 }}>sending…</Text>}
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
            <Tag color={quickPayVilla.active_booking_payment === 'paid' ? 'green' : quickPayVilla.active_booking_payment === 'partial' ? 'orange' : 'red'}>
              {quickPayVilla.active_booking_payment ?? '—'}
            </Tag>
          </div>
        )}
        <Form
          form={quickPayForm}
          layout="vertical"
          onFinish={vals => quickPayVilla?.active_booking_id && quickPay.mutate({ bookingId: quickPayVilla.active_booking_id, vals })}
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
                  { value: 'cash', label: 'Cash' },
                  { value: 'card', label: 'Card' },
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

      {/* ── Owner Info Modal ── */}
      <Modal
        open={ownerModalOpen}
        onCancel={() => setOwnerModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setOwnerModalOpen(false)}>Close</Button>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => { setOwnerModalOpen(false); setDrawerOpen(false); navigate('/owners', { state: { editOwnerId: selectedVilla?.owner?.id } }); }}
            >
              Go to Owners
            </Button>
          </Space>
        }
        title={<Space><UserOutlined /><span>Owner Details</span></Space>}
        width={360}
        centered
      >
        {selectedVilla?.owner ? (
          <div style={{ paddingTop: 8 }}>
            {([
              { label: 'Name', value: selectedVilla.owner.name },
              { label: 'Phone', value: selectedVilla.owner.phone },
              {
                label: 'WhatsApp', value: selectedVilla.owner.whatsapp_number,
                render: (v: string) => <a href={`https://wa.me/${v}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}><WhatsAppOutlined style={{ marginRight: 4 }} />{v}</a>
              },
              { label: 'Email', value: selectedVilla.owner.email },
            ] as Array<{ label: string; value?: string | null; render?: (v: string) => ReactNode }>).map(({ label, value, render }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 0', borderBottom: '1px solid #f0f0f0',
              }}>
                <Text type="secondary" style={{ width: 80, flexShrink: 0, fontSize: 12 }}>{label}</Text>
                <Text style={{ fontSize: 13 }}>
                  {value ? (render ? render(value) : value) : <span style={{ color: '#bfbfbf' }}>—</span>}
                </Text>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '24px 0' }}>No owner assigned</div>
        )}
      </Modal>

      {/* ── Legend / Help Modal ── */}
      <Modal
        open={legendModalOpen}
        onCancel={() => setLegendModalOpen(false)}
        footer={<Button type="primary" onClick={() => setLegendModalOpen(false)}>Got it</Button>}
        title={<Space><InfoCircleOutlined /><span>Villa Tile Legend</span></Space>}
        width={540}
        centered
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingTop: 8 }}>
          {/* Sketch */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <Badge count={7} size="small" offset={[-6, 6]} color="#1677ff">
              <div style={{
                width: 54, height: 50, border: '2px solid #b7eb8f', borderRadius: 8,
                background: '#f6ffed', color: '#52c41a', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                <UserOutlined style={{ position: 'absolute', top: 3, left: 4, fontSize: 10, color: '#52c41a', opacity: 0.85 }} />
                101
                <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#faad14', marginTop: 5 }} />
                <span style={{ position: 'absolute', left: 3, right: 3, bottom: 3, height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: '60%', borderRadius: 2, background: '#fa8c16' }} />
                </span>
              </div>
            </Badge>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>Sample tile</Text>
          </div>

          {/* Explanations */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div>
              <Text strong style={{ fontSize: 12 }}>Tile color / border — villa status</Text>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {LEGEND.map(({ key, dot, desc }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    {desc}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#bfbfbf', flexShrink: 0 }} />
                  Not configured — villa has no status set
                </div>
              </div>
            </div>

            <div>
              <Text strong style={{ fontSize: 12 }}><UserOutlined style={{ marginRight: 5 }} />Person icon (top-left)</Text>
              <div style={{ color: '#595959', marginTop: 2 }}>Guest is checking in today</div>
            </div>

            <div>
              <Text strong style={{ fontSize: 12 }}>Pulsing border</Text>
              <div style={{ color: '#595959', marginTop: 2 }}>Check-in date is today but the guest hasn't arrived yet</div>
            </div>

            <div>
              <Text strong style={{ fontSize: 12 }}>Center dot — contract status</Text>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#52c41a', flexShrink: 0 }} />
                  More than 30 days left on the contract
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#faad14', flexShrink: 0 }} />
                  Contract expires within 30 days
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#cf1322', flexShrink: 0 }} />
                  Contract has expired
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#595959' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#bfbfbf', flexShrink: 0 }} />
                  No contract dates set
                </div>
              </div>
            </div>

            <div>
              <Text strong style={{ fontSize: 12 }}>Blue number badge (top-right)</Text>
              <div style={{ color: '#595959', marginTop: 2 }}>
                Bookings created for this villa in the current month — toggle on/off with the "Monthly Bookings" button
              </div>
            </div>

            <div>
              <Text strong style={{ fontSize: 12 }}>Bottom progress bar</Text>
              <div style={{ color: '#595959', marginTop: 2 }}>Stay progress — how far along the current booking is between check-in and check-out</div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
