import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, DatePicker,
  Tag, Space, Typography, Popconfirm, Card, Row, Col, App,
  Tabs, Alert, Descriptions, InputNumber, Divider,
  Tooltip, Spin, Steps, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined,
  DollarOutlined, UnorderedListOutlined, LoginOutlined, LogoutOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WhatsAppOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocation } from 'react-router-dom';
import { playSuccessChime } from '../../utils/sounds';
import client from '../../api/client';
import BookingCalendar from './CalendarView';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useHeaderToolbar } from '../../store/HeaderToolbarContext';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const statusColors  = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const statusLabels  = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };
const payColors     = { paid: 'green', partial: 'gold', unpaid: 'red' };
const payLabels     = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };
const methodLabels  = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer' };
const methodOptions = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function Bookings() {
  usePageTitle('Bookings');
  const [modalOpen, setModalOpen]       = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [actionRow, setActionRow]       = useState(null);
  const [editing, setEditing]           = useState(null);
  const [selected, setSelected]         = useState(null);
  const [availability, setAvailability] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [selectedVillaRooms, setSelectedVillaRooms] = useState(null);
  const [filterGuest, setFilterGuest]   = useState(null);
  const [filterVilla, setFilterVilla]   = useState(null);
  const [filterDates, setFilterDates]   = useState(null);
  const [waModal, setWaModal] = useState({ open: false, owner: null, tenant: null, user: null });
  const [form] = Form.useForm();
  const isOwnerBooking = Form.useWatch('is_owner', form);
  const [payForm] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { setToolbar, clearToolbar } = useHeaderToolbar();
  const location = useLocation();

  useEffect(() => {
    const villaId = location.state?.filterVillaId;
    if (villaId) setFilterVilla(villaId);
  }, [location.state?.filterVillaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    const bookingId = location.state?.highlightBookingId;
    if (bookingId) setHighlightId(bookingId);
  }, [location.state?.highlightBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setToolbar(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Space><CalendarOutlined /><span style={{ fontWeight: 600 }}>Booking Management</span></Space>
        {/* <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setAvailability(null); setConflicts([]); setModalOpen(true); }}>
          New Booking
        </Button> */}
      </div>
    );
    return () => clearToolbar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({  
    queryKey: ['bookings', filterGuest, filterVilla, filterDates],
    queryFn: () => client.get('/bookings', {
      params: {
        ...(filterGuest  ? { guest_id: filterGuest } : {}),
        ...(filterVilla  ? { villa_id: filterVilla } : {}),
        ...(filterDates?.[0] ? { from: filterDates[0].format('YYYY-MM-DD') } : {}),
        ...(filterDates?.[1] ? { to:   filterDates[1].format('YYYY-MM-DD') } : {}),
      },
    }).then(r => r.data),
  });

  useEffect(() => {
    if (!highlightId || !data?.data) return;
    const row = document.querySelector(`[data-row-key="${highlightId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightId, data]);

  const { data: villas } = useQuery({
    queryKey: ['villas-all'],
    queryFn: () => client.get('/villas', { params: { per_page: 200, contract_active: 1 } }).then(r => r.data.data),
  });

  const { data: guests } = useQuery({
    queryKey: ['guests-all'],
    queryFn: () => client.get('/guests').then(r => r.data),
  });

  const [progressToken, setProgressToken] = useState(null);
  const [progressStage, setProgressStage] = useState(null);

  useEffect(() => {
    if (!progressToken) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await client.get(`/bookings/progress/${progressToken}`);
        if (!cancelled) setProgressStage(res.data?.stage ?? null);
      } catch { /* ignore transient poll failures */ }
    };
    poll();
    const interval = setInterval(poll, 700);
    return () => { cancelled = true; clearInterval(interval); };
  }, [progressToken]);

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/bookings/${editing.id}`, vals)
      : client.post('/bookings', vals),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      if (!editing) playSuccessChime();
      message.success(editing ? 'Booking updated.' : 'Booking created.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      setAvailability(null); setConflicts([]);
      setProgressToken(null);
      setProgressStage(null);

      if (!editing) {
        setWaModal({ open: true, owner: null, tenant: null, user: null });
        setTimeout(() => {
          const wa = res.data?.whatsapp ?? {};
          const unknown = { sent: false, error: 'No status returned' };
          setWaModal({ open: true, owner: wa.owner ?? unknown, tenant: wa.tenant ?? unknown, user: wa.user ?? unknown });
        }, 1000);
      }
    },
    onError: (e) => {
      setProgressToken(null);
      setProgressStage(null);
      message.error(e.response?.data?.message || 'An error occurred.');
    },
  });

  const remove = useMutation({
    mutationFn: (id) => client.delete(`/bookings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Booking deleted.'); },
  });

  const addPayment = useMutation({
    mutationFn: (vals) => client.post(`/bookings/${selected?.id}/payments`, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-detail', selected?.id] });
      message.success('Payment recorded.');
      payForm.resetFields();
      setPayModalOpen(false);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const deletePayment = useMutation({
    mutationFn: (paymentId) => client.delete(`/bookings/${selected?.id}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-detail', selected?.id] });
      message.success('Payment deleted.');
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const confirmBooking = useMutation({
    mutationFn: (id) => client.post(`/bookings/${id}/confirm`).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      message.success('Booking confirmed.');
      setActionRow(null);
      if (res.notified) {
        setWaModal({ open: true, owner: null, tenant: null, user: null });
        setTimeout(() => {
          const wa = res.whatsapp ?? {};
          const unknown = { sent: false, error: 'No status returned' };
          setWaModal({ open: true, owner: wa.owner ?? unknown, tenant: wa.tenant ?? unknown, user: wa.user ?? unknown });
        }, 1000);
      }
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed to confirm booking.'),
  });

  const confirmArrival = useMutation({
    mutationFn: (id) => client.post(`/bookings/${id}/confirm-arrival`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Check-in confirmed.'); setActionRow(null); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const confirmDeparture = useMutation({
    mutationFn: (id) => client.post(`/bookings/${id}/confirm-departure`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Check-out confirmed.'); setActionRow(null); },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const sendCheckoutReminder = useMutation({
    mutationFn: (id) => client.post(`/bookings/${id}/send-checkout-reminder`).then(r => r.data),
    onSuccess: (res) => {
      if (res.sent) message.success('Checkout reminder sent.');
      else message.error(res.error || 'Failed to send reminder.');
      setActionRow(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
  });

  const { data: bookingDetail } = useQuery({
    queryKey: ['booking-detail', selected?.id],
    queryFn: () => client.get(`/bookings/${selected.id}`).then(r => r.data),
    enabled: !!selected?.id && detailOpen,
  });

  const checkAvailability = async () => {
    const { villa_id, dates } = form.getFieldsValue(['villa_id', 'dates']);
    if (!villa_id || !dates?.[0] || !dates?.[1]) return;
    try {
      const res = await client.post('/bookings/check-availability', {
        villa_id,
        check_in:   dates[0].format('YYYY-MM-DD'),
        check_out:  dates[1].format('YYYY-MM-DD'),
        booking_id: editing?.id,
      });
      setAvailability(res.data.available);
      setConflicts(res.data.conflicts ?? []);
    } catch {}
  };

  const handleVillaChange = (villaId) => {
    const v = villas?.find(x => x.id === villaId);
    setSelectedVillaRooms(v?.num_rooms ?? null);
    checkAvailability();
  };

  const openEdit = (record) => {
    setEditing(record);
    setSelectedVillaRooms(record.villa?.num_rooms ?? null);
    form.setFieldsValue({
      villa_id:      record.villa_id,
      guest_id:      record.guest_id,
      num_guests:    record.num_guests ?? 1,
      dates:         [dayjs(record.check_in), dayjs(record.check_out)],
      check_in_time: record.check_in_time ?? undefined,
      status:        record.status,
      notes:         record.notes,
    });
    setAvailability(null); setConflicts([]);
    setModalOpen(true);
  };

  const onFormFinish = (vals) => {
    const payload = {
      villa_id:      vals.villa_id,
      guest_id:      vals.guest_id,
      num_guests:    vals.num_guests ?? 1,
      check_in:      vals.dates[0].format('YYYY-MM-DD'),
      check_in_time: vals.check_in_time ?? null,
      check_out:     vals.dates[1].format('YYYY-MM-DD'),
      status:        vals.status ?? 'confirmed',
      notes:         vals.notes,
    };
    if (!editing) {
      payload.is_owner = !!vals.is_owner;
      if (!vals.is_owner && vals.advance_amount) {
        payload.advance_amount = vals.advance_amount;
        payload.advance_method = vals.advance_method ?? 'cash';
      }
    }
    if (!editing) {
      const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      setProgressStage(null);
      setProgressToken(token);
      payload.progress_token = token;
    }
    save.mutate(payload);
  };

  const remaining = selected
    ? Number(selected.total_amount) - Number(selected.paid_amount)
    : 0;

  const openConfirmation = (b) => {
    const fmt  = d => dayjs(d).format('MMMM D, YYYY');
    const omr  = v => `OMR ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 3 })}`;
    const rem  = Number(b.total_amount) - Number(b.paid_amount);
    const meth = { cash: 'Cash', card: 'Card (Visa/MC)', bank_transfer: 'Bank Transfer' };
    const band = Array(10).fill('Al Seef &nbsp;&nbsp;·&nbsp;&nbsp;').join('');

    const termsAr = `
      <div class="terms-title">الأحكام والشروط</div>

      <h3>Check-in &amp; Check-out</h3>
      <p>وقت الدخول: تبدأ عملية تسجيل الدخول واستلام الفيلا من الساعة <strong>1:00 ظهراً</strong> وحتى الساعة <strong>2:00 ظهراً</strong>.</p>
      <p>وقت المغادرة: يجب الالتزام بتسجيل الخروج النهائي وتسليم المفاتيح في تمام الساعة <strong>10:00 صباحاً</strong> كحد أقصى.</p>
      <p class="warn">تنويه هام: أي تأخير في إخلاء الفيلا عن الوقت المحدد (10:00 صباحاً) يتسبب تلقائياً في تعطيل جدول التعقيم والصيانة للحجوزات التالية، ويترتب عليه خصم مالي مباشر من مبلغ التأمين.</p>

      <h3>مبلغ التأمين</h3>
      <p>يتم دفع تأمين مسترد قبل الدخول للفيلا وقدره <strong>50 ريال عماني</strong>.</p>

      <h3>نظافة الفيلا</h3>
      <p>يجب تسليم الفيلا نظيفة كما تم استلامها، حيث إن عدم الالتزام بالنظافة العامة سيؤدي إلى خصم مبلغ من التأمين.</p>

      <h3>رمال الشاطئ</h3>
      <p>حرصاً على نظافة الفيلا وراحتكم، يُرجى التكرم بغسل الأرجل وإزالة رمال الشاطئ تماماً قبل الدخول.</p>

      <h3>الأثاث</h3>
      <p>يمنع منعاً باتاً تحريك أو نقل الأثاث من مكانه المخصص.</p>

      <h3>النفايات</h3>
      <p>يرجى وضع النفايات في الأكياس المخصصة لها، ويمكنكم طلب أكياس إضافية من مكتب الإدارة عند الحاجة.</p>

      <h3>الملابس المبللة</h3>
      <p>يرجى تجنب الجلوس بملابس السباحة المبللة على أثاث الفيلا الداخلي بعد العودة من الشاطئ.</p>

      <h3>بند إخلاء المسؤولية القانونية التام (Liability &amp; Safety Disclaimer)</h3>
      <p class="bullet"><strong>إخلاء مسؤولية الحوادث والإصابات:</strong> تخلي إدارة مجمع فلل السيف السكنية مسؤوليتها القانونية والتامة عن أي حوادث، إصابات شخصية، حالات غرق (لا قدر الله)، أو أي عارض صحي قد يحدث للمستأجر أو مرافقيه أو زواره طوال فترة الإقامة داخل الفيلا، أو عند استخدام المرافق التابعة للمجمع، أو الشاطئ المحاذي.</p>
      <p class="bullet"><strong>مسؤولية الأطفال والمرافقين:</strong> يتحمل المستأجر الرئيسي المسؤولية القانونية والمدنية الكاملة عن سلامته وسلامة جميع الأفراد المرافقين له والزوار، ويلتزم التزاماً تاماً بمراقبة الأطفال مراقبة لصيقة ودائمة طوال فترة تواجدهم في الفيلا أو عند اقترابهم من الشاطئ والمرافق المفتوحة.</p>
      <p class="bullet"><strong>المفقودات والثمينات:</strong> إدارة المجمع غير مسؤولة إطلاقاً عن فقدان، سرقة، أو تلف أي مقتنيات شخصية، مجوهرات، أموال، أو أجهزة خاصة بالضيوف داخل الفيلا أثناء فترة الإقامة أو بعد المغادرة.</p>

      <h3>الإقرار والموافقة القانونية (Booking Confirmation &amp; Acceptance)</h3>
      <div class="accept">إن إتمامكم لعملية دفع المبالغ المستحقة (سواء العربون أو كامل المبلغ) وتأكيد الحجز، يُعد بمثابة توقيع إلكتروني، وموافقة نهائية قطعية وتعهداً تاماً منكم بالالتزام بكافة الشروط، الأحكام، والسياسات المذكورة في هذه الوثيقة، وتحملكم المسؤولية القانونية والمالية المترتبة على أي مخالفة لبنودها.</div>

      <div class="close">نتمنى لكم إقامة مريحة ورحلة سعيدة في فلل السيف</div>
    `;

    const paymentsRows = (b.payments || []).map(p => `
      <tr>
        <td>${p.payment_date ?? '—'}</td>
        <td>${omr(p.amount)}</td>
        <td>${meth[p.method] ?? p.method}</td>
        <td>${p.user?.name ?? '—'}</td>
        <td>${p.notes ?? '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Booking Confirmation #${b.id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:8mm}
  body{font-family:Arial,sans-serif;font-size:10px;color:#222;background:#fff}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  .page{width:100%;margin:0;border:none}
  /* header */
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 14px 6px}
  .logo{font-family:Georgia,serif;font-size:22px;font-weight:700;letter-spacing:0.18em;color:#4a3000}
  .logo-sub{font-size:8px;letter-spacing:0.22em;color:#8B6914;margin-top:2px}
  .logo-dots{display:flex;gap:4px;margin-top:4px}
  .logo-dot{width:10px;height:10px;border-radius:50%}
  .ttl{text-align:right}
  .ttl h1{font-size:17px;font-weight:700;color:#222}
  .ttl h1 span{color:#c00}
  .ttl p{font-size:8px;color:#666;max-width:300px;margin-top:3px;text-align:right}
  /* band */
  .band{background:#C9A96E;padding:3px 12px;font-size:8.5px;color:#fff;font-weight:600;letter-spacing:0.06em;white-space:nowrap;overflow:hidden}
  /* two-col */
  .body{display:flex;border-bottom:1px solid #ddd}
  .lcol{flex:1;padding:8px 14px;border-right:1px solid #ddd}
  .rcol{width:230px;padding:8px 14px}
  .f{display:flex;margin-bottom:5px;align-items:baseline}
  .fl{width:140px;color:#555;flex-shrink:0;font-size:9px}
  .fv{font-weight:600}
  .fvbox{border:1px solid #bbb;padding:1px 9px;text-align:center;min-width:60px;display:inline-block}
  /* policy */
  .policy{padding:5px 14px;background:#fafafa;border-bottom:1px solid #ddd;font-size:8.5px}
  /* dates */
  .dates{display:flex;gap:28px;padding:8px 14px;border-bottom:1px solid #ddd;align-items:flex-end}
  .db label{font-size:7.5px;text-transform:uppercase;letter-spacing:0.07em;color:#666;display:block;margin-bottom:3px}
  .db .dv{font-size:12px;font-weight:700;border:1px solid #aaa;padding:4px 14px;display:inline-block}
  /* payments table */
  .ptable{width:100%;border-collapse:collapse;font-size:9px;margin-top:6px}
  .ptable th{background:#f5f5f5;padding:3px 6px;border:1px solid #ddd;text-align:left;font-weight:600}
  .ptable td{padding:3px 6px;border:1px solid #ddd}
  /* booked-by */
  .bb{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 14px;border-bottom:1px solid #ddd}
  .stamp{width:76px;height:54px;border:1px solid #bbb;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:8px;text-align:center;line-height:1.4}
  /* footer */
  .fnote{padding:6px 14px;background:#fffbe6;border-top:1px solid #ffe58f;font-size:8.5px;color:#7c5c00}
  .section-title{font-weight:700;font-size:9.5px;margin-bottom:6px;color:#4a3000;border-bottom:1px solid #e8d5a3;padding-bottom:3px}
  .green{color:#389e0d}.orange{color:#d46b08}.red{color:#cf1322}
  .terms{padding:8px 14px 8px;border-top:2px solid #C9A96E;font-size:6.5px;line-height:1.45;color:#444;direction:rtl;text-align:right}
  .terms-title{font-size:9.5px;font-weight:700;color:#8B6914;text-align:center;letter-spacing:0.03em;margin-bottom:6px}
  .terms h3{font-size:7.5px;font-weight:700;color:#4a3000;margin:6px 0 3px;border-bottom:1px solid #e8d5a3;padding-bottom:2px}
  .terms h3:first-of-type{margin-top:0}
  .terms p{margin-bottom:3px}
  .terms strong{color:#222}
  .terms .warn{color:#cf1322;font-weight:600;background:#fff1f0;border:1px solid #ffccc7;padding:3px 6px;border-radius:2px}
  .terms .bullet{margin-bottom:2px}
  .terms .accept{background:#fffbe6;border:1px solid #ffe58f;padding:5px 8px;margin-top:4px;border-radius:2px;line-height:1.45}
  .terms .close{text-align:center;margin-top:7px;font-weight:700;color:#8B6914;font-size:7.5px}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div>
      <div class="logo">Al Seef</div>
      <div class="logo-sub">LUXURY WATERFRONT LIVING</div>
      <div class="logo-dots">
        <div class="logo-dot" style="background:#C9A96E"></div>
        <div class="logo-dot" style="background:#8B6914"></div>
        <div class="logo-dot" style="background:#D4B896"></div>
        <div class="logo-dot" style="background:#A0784A"></div>
        <div class="logo-dot" style="background:#C9A96E"></div>
      </div>
    </div>
    <div class="ttl">
      <h1>Booking <span>Confirmation</span></h1>
      <p>Please present either an electronic or paper copy of this confirmation upon check-in.</p>
    </div>
  </div>

  <div class="band">${band}</div>

  <div class="body">
    <div class="lcol">
      <div class="section-title">Guest &amp; Booking Information</div>
      <div class="f"><span class="fl">Booking ID :</span><span class="fv">${b.id}</span></div>
      <div class="f"><span class="fl">Client :</span><span class="fv" style="font-size:14px">${b.guest?.name ?? '—'}</span></div>
      ${b.guest?.id_number  ? `<div class="f"><span class="fl">Civil / Passport ID :</span><span class="fv">${b.guest.id_number}</span></div>` : ''}
      ${b.guest?.nationality? `<div class="f"><span class="fl">Nationality :</span><span class="fv">${b.guest.nationality}</span></div>` : ''}
      ${b.guest?.phone      ? `<div class="f"><span class="fl">Phone :</span><span class="fv">${b.guest.phone}</span></div>` : ''}
      <div class="f" style="margin-top:10px"><span class="fl">Property :</span><span class="fv">${b.villa?.name ?? '—'}</span></div>
      ${b.villa?.category   ? `<div class="f"><span class="fl">Villa Type :</span><span class="fv">${b.villa.category}</span></div>` : ''}
      ${b.check_in_time     ? `<div class="f"><span class="fl">Check-in Time :</span><span class="fv">${b.check_in_time}</span></div>` : ''}
    </div>
    <div class="rcol">
      <div class="section-title">Stay Details</div>
      <div class="f"><span class="fl">Number of Guests :</span><span class="fv fvbox">${b.num_guests ?? 1}</span></div>
      ${b.villa?.num_rooms  ? `<div class="f"><span class="fl">Rooms :</span><span class="fv fvbox">${b.villa.num_rooms}</span></div>` : ''}
      <div class="f"><span class="fl">Nights :</span><span class="fv fvbox">${b.nights}</span></div>
      <div class="f" style="margin-top:12px"><span class="fl">Total Amount :</span><span class="fv">${omr(b.total_amount)}</span></div>
      <div class="f"><span class="fl">Amount Paid :</span><span class="fv green">${omr(b.paid_amount)}</span></div>
      <div class="f"><span class="fl">Remaining :</span><span class="fv ${rem > 0 ? 'orange' : 'green'}">${omr(rem)}</span></div>
      <div class="f" style="margin-top:8px"><span class="fl">Payment Status :</span><span class="fv">${(b.payment_status ?? '').toUpperCase()}</span></div>
    </div>
  </div>

  <div class="policy">
    <strong>Booking Status:</strong> ${(b.status ?? '').toUpperCase()}
    ${b.notes ? `&nbsp;&nbsp;&nbsp;<strong>Notes:</strong> ${b.notes}` : ''}
  </div>

  <div class="dates">
    <div class="db">
      <label>Arrival</label>
      <div class="dv">${fmt(b.check_in)}${b.check_in_time ? ' &nbsp;@&nbsp; ' + b.check_in_time : ''}</div>
    </div>
    <div class="db">
      <label>Departure</label>
      <div class="dv">${fmt(b.check_out)}</div>
    </div>
  </div>

  ${paymentsRows ? `
  <div style="padding:14px 18px;border-bottom:1px solid #ddd">
    <div class="section-title">Payments Received</div>
    <table class="ptable">
      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Recorded By</th><th>Notes</th></tr></thead>
      <tbody>${paymentsRows}</tbody>
    </table>
  </div>` : ''}

  <div class="fnote">
    <strong>Note to guest:</strong> Please present a valid photo ID upon check-in. This confirmation serves as your official booking receipt.
    For inquiries please contact the Al Seef reception.
  </div>

  <div class="terms">${termsAr}</div>

  <div class="bb">
    <div style="font-size:12px;line-height:1.8">
      <strong>Al Seef — Luxury Waterfront Living</strong><br>
      Muscat, Sultanate of Oman<br>
      <span style="color:#888;font-size:11px">Generated: ${new Date().toLocaleString()}</span>
    </div>
    <div class="stamp">Authorized<br>Stamp &amp;<br>Signature</div>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const columns = [
    { title: '#', dataIndex: 'id', width: 50 },
    { title: 'Villa', dataIndex: ['villa', 'name'], width: 110 },
    { title: 'Guest', dataIndex: ['guest', 'name'] },
    {
      title: 'Stay', key: 'stay', width: 150,
      render: (_, r) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, color: '#1f1f1f' }}>
            {dayjs(r.check_in).format('DD MMM')} → {dayjs(r.check_out).format('DD MMM')}
            {dayjs(r.check_in).isSame(dayjs(), 'day') && !r.checked_in_at && (
              <Tooltip title="Arriving today">
                <span className="arrival-badge">
                  <ArrowDownOutlined />
                </span>
              </Tooltip>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {r.check_in_time ? `${r.check_in_time} · ` : ''}{r.nights}n · {r.num_guests ?? 1} guest{(r.num_guests ?? 1) > 1 ? 's' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'In / Out', key: 'inout', width: 100,
      render: (_, r) => {
        if (r.status === 'pending') {
          return (
            <Popconfirm
              title="Confirm this booking?"
              description="Marks it as confirmed and notifies the guest & owner via WhatsApp."
              onConfirm={(e) => { e?.stopPropagation?.(); confirmBooking.mutate(r.id); }}
              onCancel={(e) => e?.stopPropagation?.()}
              okText="Confirm"
              cancelText="Cancel"
            >
              <Button
                size="small"
                type="primary"
                loading={confirmBooking.isPending && confirmBooking.variables === r.id}
                onClick={e => e.stopPropagation()}
              >
                Confirm
              </Button>
            </Popconfirm>
          );
        }
        return (
          <Space size={4}>
            <Tooltip title={r.checked_in_at ? `Checked in: ${dayjs(r.checked_in_at).format('DD MMM HH:mm')}` : 'Not yet checked in'}>
              <Tag icon={<LoginOutlined />} color={r.checked_in_at ? 'success' : 'default'} style={{ marginRight: 0, fontSize: 11, cursor: 'default' }}>
                IN
              </Tag>
            </Tooltip>
            <Tooltip title={r.checked_out_at ? `Checked out: ${dayjs(r.checked_out_at).format('DD MMM HH:mm')}` : 'Not yet checked out'}>
              <Tag icon={<LogoutOutlined />} color={r.checked_out_at ? 'error' : 'default'} style={{ marginRight: 0, fontSize: 11, cursor: 'default' }}>
                OUT
              </Tag>
            </Tooltip>
          </Space>
        );
      },
    },
    { title: 'Total', dataIndex: 'total_amount', render: v => `${Number(v).toLocaleString()} OMR` },
    {
      title: 'Remaining', key: 'remaining',
      render: (_, r) => {
        const rem = Number(r.total_amount) - Number(r.paid_amount);
        return <span style={{ color: rem > 0 ? '#fa8c16' : '#52c41a', fontWeight: 600 }}>{rem.toLocaleString()} OMR</span>;
      },
    },
   
    {
      title: 'Status',
      dataIndex: 'status',
      render: s => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    {
      title: 'Countdown', key: 'countdown', width: 150,
      render: (_, r) => {
        if (['cancelled', 'completed'].includes(r.status)) return null;
        const today = dayjs().startOf('day');
        const checkIn  = dayjs(r.check_in).startOf('day');
        const checkOut = dayjs(r.check_out).startOf('day');
        if (today.isBefore(checkIn)) {
          const days = checkIn.diff(today, 'day');
          return (
            <Tag color="blue" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
              {days === 0 ? 'Arriving today' : `${days}d to arrival`}
            </Tag>
          );
        }
        if (!today.isAfter(checkOut)) {
          const days = checkOut.diff(today, 'day');
          return (
            <Tag color="orange" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
              {days === 0 ? 'Departing today' : `${days}d to departure`}
            </Tag>
          );
        }
        return null;
      },
    },
    { title: 'Created By', dataIndex: ['user', 'name'] },
    {
      title: 'Created At', dataIndex: 'created_at', width: 130,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—',
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="list" items={[
        {
          key: 'list', label: <><UnorderedListOutlined /> List</>,
          children: (
            <Card>
              <Row gutter={12} style={{ marginBottom: 12 }} align="middle">
                <Col xs={24} sm={12} md={7}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    placeholder="Filter by guest…"
                    style={{ width: '100%' }}
                    value={filterGuest}
                    onChange={setFilterGuest}
                  >
                    {guests?.map(g => <Option key={g.id} value={g.id}>{g.name}{g.phone ? ` — ${g.phone}` : ''}</Option>)}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={7}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    placeholder="Filter by villa…"
                    style={{ width: '100%' }}
                    value={filterVilla}
                    onChange={setFilterVilla}
                  >
                    {villas?.map(v => <Option key={v.id} value={v.id}>{v.name}</Option>)}
                  </Select>
                </Col>
                <Col xs={24} sm={16} md={8}>
                  <RangePicker
                    style={{ width: '100%' }}
                    placeholder={['Check-in from', 'Check-out to']}
                    value={filterDates}
                    onChange={setFilterDates}
                  />
                </Col>
                {(filterGuest || filterVilla || filterDates) && (
                  <Col>
                    <Button onClick={() => { setFilterGuest(null); setFilterVilla(null); setFilterDates(null); }}>Clear</Button>
                  </Col>
                )}
              </Row>
              {!isLoading && data?.total != null && (
                <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>
                  <strong>{data.total}</strong> booking{data.total !== 1 ? 's' : ''} found
                </div>
              )}
              <Table
                dataSource={data?.data}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                pagination={{ total: data?.total, pageSize: 20 }}
                scroll={{ x: 800 }}
                size="small"
                onRow={r => ({
                  onClick: () => setActionRow(r),
                  style: {
                    cursor: 'pointer',
                    ...(r.id === highlightId ? { backgroundColor: '#fffbe6', transition: 'background-color 0.3s' } : {}),
                  },
                })}
              />
            </Card>
          ),
        },
        {
          key: 'calendar', label: <><CalendarOutlined /> Calendar</>,
          children: <BookingCalendar bookings={data?.data || []} />,
        },
      ]} />

      {/* Row Action Picker */}
      <Modal
        open={!!actionRow}
        onCancel={() => setActionRow(null)}
        footer={null}
        width={340}
        centered
        title={actionRow ? `Booking #${actionRow.id} — ${actionRow.villa?.name}` : ''}
        styles={{ body: { padding: '16px 24px 20px' } }}
      >
        {actionRow && (
          <>
            <div style={{ marginBottom: 16, color: '#595959', fontSize: 13 }}>
              <span>{actionRow.guest?.name}</span>
              <span style={{ margin: '0 8px', color: '#d9d9d9' }}>·</span>
              <span>{dayjs(actionRow.check_in).format('DD MMM')} → {dayjs(actionRow.check_out).format('DD MMM YYYY')}</span>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button block icon={<CalendarOutlined />} onClick={() => { setSelected(actionRow); setDetailOpen(true); setActionRow(null); }}>
                View Details
              </Button>
              <Button block icon={<UnorderedListOutlined />} style={{ color: '#8B6914', borderColor: '#C9A96E' }} onClick={() => { openConfirmation(actionRow); setActionRow(null); }}>
                View Confirmation PDF
              </Button>
              <Tooltip title={Number(actionRow?.paid_amount) > 0 ? 'This booking has payments recorded. Delete all payments first (View Details → Payment History) before editing.' : ''}>
                <Button
                  block
                  icon={<EditOutlined />}
                  disabled={Number(actionRow?.paid_amount) > 0}
                  onClick={() => { openEdit(actionRow); setActionRow(null); }}
                >
                  Edit Booking
                </Button>
              </Tooltip>
              <Button block icon={<DollarOutlined />} onClick={() => { setSelected(actionRow); setPayModalOpen(true); setActionRow(null); }}>
                Add Payment
              </Button>
              {actionRow?.status === 'pending' && (
                <Popconfirm
                  title="Confirm this booking?"
                  description="Marks it as confirmed and notifies the guest & owner via WhatsApp."
                  onConfirm={() => confirmBooking.mutate(actionRow.id)}
                  okText="Confirm"
                  cancelText="Cancel"
                >
                  <Button block type="primary" loading={confirmBooking.isPending}>
                    Confirm Booking
                  </Button>
                </Popconfirm>
              )}
              {actionRow?.status === 'confirmed' && !actionRow?.checked_in_at && (
                <Tooltip title={dayjs().startOf('day').isBefore(dayjs(actionRow?.check_in).startOf('day')) ? `Only available from the check-in date (${dayjs(actionRow.check_in).format('DD MMM YYYY')})` : ''}>
                  <Popconfirm
                    title="Confirm guest check-in?"
                    onConfirm={() => confirmArrival.mutate(actionRow.id)}
                    okText="Yes"
                    cancelText="No"
                    disabled={dayjs().startOf('day').isBefore(dayjs(actionRow?.check_in).startOf('day'))}
                  >
                    <Button
                      block
                      icon={<LoginOutlined />}
                      disabled={dayjs().startOf('day').isBefore(dayjs(actionRow?.check_in).startOf('day'))}
                      style={{ background: '#f6ffed', borderColor: '#52c41a', color: '#389e0d' }}
                    >
                      Confirm Check-in
                    </Button>
                  </Popconfirm>
                </Tooltip>
              )}
              {actionRow?.checked_in_at && !actionRow?.checked_out_at && (
                <Popconfirm
                  title="Confirm guest check-out?"
                  onConfirm={() => confirmDeparture.mutate(actionRow.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button block icon={<LogoutOutlined />} style={{ background: '#fff7e6', borderColor: '#fa8c16', color: '#d46b08' }}>
                    Confirm Check-out
                  </Button>
                </Popconfirm>
              )}
              {actionRow?.checked_in_at && !actionRow?.checked_out_at && (
                <Tooltip title={!dayjs().isSame(dayjs(actionRow?.check_out), 'day') ? 'Only available on the checkout day' : ''}>
                  <Button
                    block
                    icon={<WhatsAppOutlined />}
                    loading={sendCheckoutReminder.isPending}
                    disabled={!dayjs().isSame(dayjs(actionRow?.check_out), 'day')}
                    onClick={() => sendCheckoutReminder.mutate(actionRow.id)}
                  >
                    Send Checkout Reminder
                  </Button>
                </Tooltip>
              )}
              <Popconfirm
                title="Delete this booking?"
                onConfirm={() => { remove.mutate(actionRow.id); setActionRow(null); }}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button block danger icon={<DeleteOutlined />}>Delete Booking</Button>
              </Popconfirm>
            </Space>
          </>
        )}
      </Modal>

      {/* Booking Form Modal */}
      <Modal
        title={editing ? 'Edit Booking' : 'New Booking'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); setAvailability(null); setConflicts([]); setSelectedVillaRooms(null); }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={620}
      >
        <Form form={form} layout="vertical" onFinish={onFormFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="villa_id" label="Villa" rules={[{ required: true }]}>
                <Select placeholder="Select villa" showSearch optionFilterProp="children" onChange={handleVillaChange}>
                  {villas?.map(v => (
                    <Option key={v.id} value={v.id}>
                      {v.name}{v.num_rooms ? ` · ${v.num_rooms} rooms` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedVillaRooms && (
                <div style={{ marginTop: -12, marginBottom: 8, color: '#1677ff', fontSize: 13 }}>
                  🛏 {selectedVillaRooms} bedroom{selectedVillaRooms > 1 ? 's' : ''}
                </div>
              )}
            </Col>
            <Col span={12}>
              <Form.Item name="guest_id" label="Guest" rules={[{ required: true }]}>
                <Select placeholder="Select guest" showSearch optionFilterProp="children">
                  {guests?.map(g => <Option key={g.id} value={g.id}>{g.name}{g.phone ? ` — ${g.phone}` : ''}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="num_guests" label="Number of Guests" rules={[{ required: true }]} initialValue={1}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="check_in_time" label="Check-in Time">
                <Select placeholder="Select time" allowClear>
                  <Option value="10:00">10:00 AM</Option>
                  <Option value="11:00">11:00 AM</Option>
                  <Option value="12:00">12:00 PM</Option>
                  <Option value="13:00">01:00 PM</Option>
                  <Option value="14:00">02:00 PM (Latest)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dates" label="Check-in / Check-out" rules={[{ required: true }]}>
            <RangePicker style={{ width: '100%' }} placeholder={['Check-in', 'Check-out']} onChange={checkAvailability} />
          </Form.Item>

          {availability === true  && <Alert message="Villa is available for the selected dates ✓" type="success" style={{ marginBottom: 12 }} />}
          {availability === false && (
            <Alert
              type="error"
              style={{ marginBottom: 12 }}
              message="Villa is already booked for this period — choose different dates."
              description={conflicts.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {conflicts.map(c => (
                    <div key={c.id} style={{ fontSize: 12 }}>
                      #{c.id} — {c.guest_name ?? 'Unknown guest'} · {dayjs(c.check_in).format('DD MMM')} → {dayjs(c.check_out).format('DD MMM YYYY')}
                      <Tag color={statusColors[c.status]} style={{ marginLeft: 6 }}>{c.status}</Tag>
                    </div>
                  ))}
                </div>
              )}
            />
          )}

          <Form.Item name="status" label="Status" initialValue="confirmed">
            <Select>
              <Option value="confirmed">Confirmed</Option>
              <Option value="pending">Pending</Option>
              <Option value="cancelled">Cancelled</Option>
              <Option value="completed">Completed</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>

          {!editing && (
            <Form.Item name="is_owner" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>
                This booking is for the villa owner (no charge, no guest notification)
              </Checkbox>
            </Form.Item>
          )}

          {/* Advance payment — required when creating a new booking */}
          {!editing && (
            <>
              <Divider style={{ margin: '12px 0' }}>Advance Payment {isOwnerBooking ? '(not required)' : '(required)'}</Divider>
              <Row gutter={16} style={isOwnerBooking ? { opacity: 0.5 } : undefined}>
                <Col span={12}>
                  <Form.Item
                    name="advance_amount"
                    label="Advance Amount (OMR)"
                    rules={isOwnerBooking ? [] : [{ required: true, message: 'Please enter the amount paid' }]}
                  >
                    <InputNumber min={0.01} style={{ width: '100%' }} placeholder="0.000" disabled={isOwnerBooking} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="advance_method"
                    label="Payment Method"
                    initialValue="cash"
                    rules={isOwnerBooking ? [] : [{ required: true }]}
                  >
                    <Select disabled={isOwnerBooking}>
                      {methodOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {!editing && save.isPending && (
            <div style={{ marginTop: 12, padding: '10px 4px' }}>
              <Steps
                size="small"
                current={progressStage === 'done' ? 4 : progressStage === 'sending' ? 1 : 0}
                items={[
                  { title: 'Uploading', icon: progressStage === 'uploading' || !progressStage ? <Spin size="small" /> : undefined },
                  { title: 'Sending', icon: progressStage === 'sending' ? <Spin size="small" /> : undefined },
                  { title: 'Sent' },
                  { title: 'Booked' },
                ]}
              />
            </div>
          )}
        </Form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        title={`Add Payment — ${selected?.villa?.name}`}
        open={payModalOpen}
        onCancel={() => { setPayModalOpen(false); payForm.resetFields(); }}
        onOk={() => payForm.submit()}
        confirmLoading={addPayment.isPending}
        width={460}
      >
        {selected && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Total</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{Number(selected.total_amount).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>OMR</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Paid</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#52c41a' }}>{Number(selected.paid_amount).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>OMR</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '10px 0', background: remaining > 0 ? '#fff7e6' : '#f6ffed', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Remaining</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: remaining > 0 ? '#fa8c16' : '#52c41a' }}>{remaining.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>OMR</div>
                </div>
              </Col>
            </Row>
            <Divider style={{ margin: '8px 0' }} />
          </div>
        )}
        <Form form={payForm} layout="vertical" onFinish={(v) => addPayment.mutate({ ...v, payment_date: v.payment_date.format('YYYY-MM-DD') })}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (OMR)" rules={[{ required: true }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="method" label="Payment Method" initialValue="cash">
            <Select>
              {methodOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* WhatsApp Status Modal */}
      <Modal
        open={waModal.open}
        centered
        width={360}
        closable={waModal.owner !== null || waModal.tenant !== null || waModal.user !== null}
        onCancel={() => setWaModal({ open: false, owner: null, tenant: null, user: null })}
        footer={
          (waModal.owner !== null || waModal.tenant !== null || waModal.user !== null) ? (
            <Button type="primary" onClick={() => setWaModal({ open: false, owner: null, tenant: null, user: null })}>
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
          {[
            { key: 'owner',  label: 'Owner' },
            { key: 'tenant', label: 'Tenant' },
            { key: 'user',   label: 'You' },
          ].map(({ key, label }) => {
            const status = waModal[key];
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 8, borderRadius: 8,
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

      {/* Detail Modal */}
      <Modal
        title={`Booking #${selected?.id} Details`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              icon={<UnorderedListOutlined />}
              style={{ color: '#8B6914', borderColor: '#C9A96E' }}
              onClick={() => bookingDetail && openConfirmation(bookingDetail)}
            >
              Print Confirmation
            </Button>
            <Button onClick={() => setDetailOpen(false)}>Close</Button>
          </div>
        }
        width={720}
      >
        {bookingDetail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Villa">
                {bookingDetail.villa?.name}{bookingDetail.villa?.num_rooms ? ` · ${bookingDetail.villa.num_rooms} rooms` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Guest" span={2}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', lineHeight: 1.8 }}>
                  <span style={{ fontWeight: 600 }}>{bookingDetail.guest?.name}</span>
                  {bookingDetail.guest?.phone && <span><Text type="secondary" style={{ fontSize: 12 }}>Phone: </Text>{bookingDetail.guest.phone}</span>}
                  {bookingDetail.guest?.id_number && <span><Text type="secondary" style={{ fontSize: 12 }}>ID: </Text>{bookingDetail.guest.id_number}</span>}
                  {bookingDetail.guest?.nationality && <span><Text type="secondary" style={{ fontSize: 12 }}>Nationality: </Text>{bookingDetail.guest.nationality}</span>}
                  {bookingDetail.guest?.notes && <span style={{ width: '100%' }}><Text type="secondary" style={{ fontSize: 12 }}>Guest notes: </Text>{bookingDetail.guest.notes}</span>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Guests (count)">{bookingDetail.num_guests ?? 1}</Descriptions.Item>
              <Descriptions.Item label="Check In">
                {dayjs(bookingDetail.check_in).format('YYYY-MM-DD')}{bookingDetail.check_in_time ? ` @ ${bookingDetail.check_in_time}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Check Out">{dayjs(bookingDetail.check_out).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="Nights">{bookingDetail.nights}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[bookingDetail.status]}>{statusLabels[bookingDetail.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total">{Number(bookingDetail.total_amount).toLocaleString()} OMR</Descriptions.Item>
              <Descriptions.Item label="Paid">{Number(bookingDetail.paid_amount).toLocaleString()} OMR</Descriptions.Item>
              <Descriptions.Item label="Payment" span={2}>
                <Tag color={payColors[bookingDetail.payment_status]}>{payLabels[bookingDetail.payment_status]}</Tag>
              </Descriptions.Item>
              {bookingDetail.notes && <Descriptions.Item label="Notes" span={2}>{bookingDetail.notes}</Descriptions.Item>}
              {bookingDetail.created_at && (
                <Descriptions.Item label="Created At" span={2}>
                  {dayjs(bookingDetail.created_at).format('DD MMM YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {bookingDetail.payments?.length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>Payment History</Title>
                <Table
                  size="small"
                  dataSource={bookingDetail.payments}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: 'Amount', dataIndex: 'amount', render: v => `${Number(v).toLocaleString()} OMR` },
                    { title: 'Date', dataIndex: 'payment_date', render: d => dayjs(d).format('YYYY-MM-DD') },
                    { title: 'Method', dataIndex: 'method', render: m => methodLabels[m] ?? m },
                    { title: 'Recorded By', dataIndex: ['user', 'name'], render: v => v || '—' },
                    { title: 'Notes', dataIndex: 'notes', render: v => v || '—' },
                    {
                      title: '', key: 'actions', width: 40,
                      render: (_, p) => (
                        <Popconfirm
                          title="Delete this payment?"
                          description="This will reduce the booking's paid amount and cannot be undone."
                          onConfirm={() => deletePayment.mutate(p.id)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletePayment.isPending && deletePayment.variables === p.id}
                          />
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
