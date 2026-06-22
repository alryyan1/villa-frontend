import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, DatePicker,
  Tag, Space, Typography, Popconfirm, Card, Row, Col, App,
  Tabs, Alert, Descriptions, InputNumber, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined,
  DollarOutlined, UnorderedListOutlined, LoginOutlined, LogoutOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import BookingCalendar from './CalendarView';
import { usePageTitle } from '../../hooks/usePageTitle';

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
  const [selectedVillaRooms, setSelectedVillaRooms] = useState(null);
  const [filterGuest, setFilterGuest]   = useState(null);
  const [filterVilla, setFilterVilla]   = useState(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', filterGuest, filterVilla],
    queryFn: () => client.get('/bookings', {
      params: {
        ...(filterGuest ? { guest_id: filterGuest } : {}),
        ...(filterVilla ? { villa_id: filterVilla } : {}),
      },
    }).then(r => r.data),
  });

  const { data: villas } = useQuery({
    queryKey: ['villas-all'],
    queryFn: () => client.get('/villas', { params: { per_page: 200, is_managed: 1 } }).then(r => r.data.data),
  });

  const { data: guests } = useQuery({
    queryKey: ['guests-all'],
    queryFn: () => client.get('/guests', { params: { per_page: 200 } }).then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (vals) => editing
      ? client.put(`/bookings/${editing.id}`, vals)
      : client.post('/bookings', vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      message.success(editing ? 'Booking updated.' : 'Booking created.');
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      setAvailability(null);
    },
    onError: (e) => message.error(e.response?.data?.message || 'An error occurred.'),
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
    setAvailability(null);
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
    if (!editing && vals.advance_amount) {
      payload.advance_amount = vals.advance_amount;
      payload.advance_method = vals.advance_method ?? 'cash';
    }
    save.mutate(payload);
  };

  const remaining = selected
    ? Number(selected.total_amount) - Number(selected.paid_amount)
    : 0;

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Villa', dataIndex: ['villa', 'name'] },
    { title: 'Guest', dataIndex: ['guest', 'name'] },
    { title: 'Guests', dataIndex: 'num_guests', width: 70, render: v => v ?? 1 },
    {
      title: 'Check In', dataIndex: 'check_in',
      render: (d, r) => `${dayjs(d).format('YYYY-MM-DD')}${r.check_in_time ? ' ' + r.check_in_time : ''}`,
    },
    { title: 'Check Out', dataIndex: 'check_out', render: d => dayjs(d).format('YYYY-MM-DD') },
    { title: 'Nights', dataIndex: 'nights', width: 70 },
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
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><CalendarOutlined /> Booking Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setAvailability(null); setModalOpen(true); }}>
          New Booking
        </Button>
      </Row>

      <Tabs defaultActiveKey="list" items={[
        {
          key: 'list', label: <><UnorderedListOutlined /> List</>,
          children: (
            <Card>
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col xs={24} sm={10} md={8}>
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
                <Col xs={24} sm={10} md={8}>
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
                {(filterGuest || filterVilla) && (
                  <Col>
                    <Button onClick={() => { setFilterGuest(null); setFilterVilla(null); }}>Clear</Button>
                  </Col>
                )}
              </Row>
              <Table
                dataSource={data?.data}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                pagination={{ total: data?.total, pageSize: 20 }}
                scroll={{ x: 900 }}
                size="small"
                onRow={r => ({ onClick: () => setActionRow(r), style: { cursor: 'pointer' } })}
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
              <Button block icon={<EditOutlined />} onClick={() => { openEdit(actionRow); setActionRow(null); }}>
                Edit Booking
              </Button>
              <Button block icon={<DollarOutlined />} onClick={() => { setSelected(actionRow); setPayModalOpen(true); setActionRow(null); }}>
                Add Payment
              </Button>
              {!actionRow?.checked_in_at && !['cancelled', 'completed'].includes(actionRow?.status) && (
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
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); setAvailability(null); setSelectedVillaRooms(null); }}
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
          {availability === false && <Alert message="Villa is already booked for this period — choose different dates." type="error" style={{ marginBottom: 12 }} />}

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

          {/* Advance payment — only shown when creating a new booking */}
          {!editing && (
            <>
              <Divider style={{ margin: '12px 0' }}>Advance Payment (optional)</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="advance_amount" label="Advance Amount (OMR)">
                    <InputNumber min={0.01} style={{ width: '100%' }} placeholder="0.000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="advance_method"
                    label="Payment Method"
                    initialValue="cash"
                    rules={[{ required: false }]}
                  >
                    <Select>
                      {methodOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
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

      {/* Detail Modal */}
      <Modal
        title={`Booking #${selected?.id} Details`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={720}
      >
        {bookingDetail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Villa">
                {bookingDetail.villa?.name}{bookingDetail.villa?.num_rooms ? ` · ${bookingDetail.villa.num_rooms} rooms` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Guest">{bookingDetail.guest?.name}</Descriptions.Item>
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
