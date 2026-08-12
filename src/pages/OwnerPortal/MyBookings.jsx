import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker,
  Tag, Space, Card, Row, Col, App, Typography, Descriptions, Alert,
} from 'antd';
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import { usePageTitle } from '../../hooks/usePageTitle';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const statusColors = { confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue' };
const statusLabels = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };
const paymentColors = { paid: 'green', partial: 'orange', unpaid: 'red' };

export default function OwnerMyBookings() {
  usePageTitle('My Bookings');
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);
  // Guests created inline via "Add Guest" this session — the /owner/guests list
  // only returns guests with a prior booking at one of this owner's villas (to
  // avoid leaking other owners' tenants), so a brand-new guest with zero
  // bookings would otherwise vanish from the dropdown right after being added.
  const [newlyAddedGuests, setNewlyAddedGuests] = useState([]);
  const [availability, setAvailability] = useState(null); // true | false | null
  const [conflicts, setConflicts] = useState([]);
  const [form] = Form.useForm();
  const [guestForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['owner-bookings'],
    queryFn: () => client.get('/owner/bookings').then(r => r.data),
  });

  const { data: villas } = useQuery({
    queryKey: ['owner-villas-for-form'],
    queryFn: () => client.get('/owner/villas').then(r => r.data),
  });

  const { data: guests } = useQuery({
    queryKey: ['owner-guests'],
    queryFn: () => client.get('/owner/guests').then(r => r.data),
  });

  const createGuest = useMutation({
    mutationFn: (vals) => client.post('/owner/guests', vals).then(r => r.data),
    onSuccess: (guest) => {
      setNewlyAddedGuests((prev) => [...prev, guest]);
      form.setFieldValue('guest_id', guest.id);
      setGuestModalOpen(false);
      guestForm.resetFields();
      message.success('Guest added.');
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to add guest.'),
  });

  const guestOptions = [
    ...newlyAddedGuests,
    ...(guests ?? []).filter((g) => !newlyAddedGuests.some((ng) => ng.id === g.id)),
  ];

  const createBooking = useMutation({
    mutationFn: (vals) => client.post('/owner/bookings', vals).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-bookings'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Booking request submitted, awaiting team confirmation.');
    },
    onError: (err) => message.error(err.response?.data?.message || 'Failed to create booking.'),
  });

  const checkAvailability = async () => {
    const { villa_id, dates } = form.getFieldsValue(['villa_id', 'dates']);
    if (!villa_id || !dates?.[0] || !dates?.[1]) return;
    try {
      const res = await client.post('/owner/bookings/check-availability', {
        villa_id,
        check_in: dayjs(dates[0]).format('YYYY-MM-DD'),
        check_out: dayjs(dates[1]).format('YYYY-MM-DD'),
      });
      setAvailability(res.data.available);
      setConflicts(res.data.conflicts ?? []);
    } catch {
      setAvailability(null);
      setConflicts([]);
    }
  };

  const onFormFinish = (vals) => {
    createBooking.mutate({
      villa_id:      vals.villa_id,
      guest_id:      vals.guest_id,
      num_guests:    vals.num_guests,
      check_in_time: vals.check_in_time,
      check_in:      dayjs(vals.dates[0]).format('YYYY-MM-DD'),
      check_out:     dayjs(vals.dates[1]).format('YYYY-MM-DD'),
      notes:         vals.notes,
    });
  };

  const rows = data?.data ?? [];

  const columns = [
    { title: 'Villa', dataIndex: ['villa', 'name'] },
    { title: 'Guest', dataIndex: ['guest', 'name'], render: v => v ?? '—' },
    { title: 'Check-in', dataIndex: 'check_in', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Check-out', dataIndex: 'check_out', render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Nights', dataIndex: 'nights', width: 80 },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={statusColors[s]}>{statusLabels[s] ?? s}</Tag> },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      render: v => `OMR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}`,
    },
    { title: 'Payment', dataIndex: 'payment_status', render: s => <Tag color={paymentColors[s]}>{s}</Tag> },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>My Bookings</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setAvailability(null); setConflicts([]); setModalOpen(true); }}
        >
          New Booking
        </Button>
      </Row>

      <Card>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={r => ({ onClick: () => setDetailBooking(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Booking detail with full commission breakdown */}
      <Modal
        title={`Booking #${detailBooking?.id ?? ''}`}
        open={!!detailBooking}
        onCancel={() => setDetailBooking(null)}
        footer={null}
        width={560}
      >
        {detailBooking && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Villa">{detailBooking.villa?.name}</Descriptions.Item>
              <Descriptions.Item label="Guest">{detailBooking.guest?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Check-in">{dayjs(detailBooking.check_in).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Check-out">{dayjs(detailBooking.check_out).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Nights">{detailBooking.nights}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[detailBooking.status]}>{statusLabels[detailBooking.status] ?? detailBooking.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                OMR {Number(detailBooking.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
              </Descriptions.Item>
              <Descriptions.Item label="Commission (5%)">
                OMR {Number(detailBooking.commission_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
              </Descriptions.Item>
              <Descriptions.Item label="Net">
                OMR {Number(detailBooking.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={paymentColors[detailBooking.payment_status]}>{detailBooking.payment_status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Paid">
                OMR {Number(detailBooking.payments_sum_amount || detailBooking.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 3 })}
              </Descriptions.Item>
              {detailBooking.notes && <Descriptions.Item label="Notes">{detailBooking.notes}</Descriptions.Item>}
            </Descriptions>
            {detailBooking.is_owner && (
              <Alert style={{ marginTop: 12 }} type="info" showIcon message="Your own villa, no commission." />
            )}
          </>
        )}
      </Modal>

      {/* New booking form */}
      <Modal
        title="New Booking"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setAvailability(null); setConflicts([]); }}
        onOk={() => form.submit()}
        confirmLoading={createBooking.isPending}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onFormFinish}>
          <Form.Item name="villa_id" label="Villa" rules={[{ required: true }]}>
            <Select placeholder="Select villa" showSearch optionFilterProp="children" onChange={checkAvailability}>
              {villas?.map(v => <Option key={v.id} value={v.id}>{v.name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="Guest" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="guest_id" noStyle rules={[{ required: true, message: 'Select a guest' }]}>
                <Select
                  placeholder="Select guest"
                  showSearch
                  optionFilterProp="children"
                  style={{ width: 'calc(100% - 40px)' }}
                  notFoundContent="No guests yet — click + to add one"
                >
                  {guestOptions.map(g => <Option key={g.id} value={g.id}>{g.name}{g.phone ? ` — ${g.phone}` : ''}</Option>)}
                </Select>
              </Form.Item>
              <Button icon={<UserAddOutlined />} onClick={() => setGuestModalOpen(true)} />
            </Space.Compact>
          </Form.Item>

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

          {availability === true && (
            <Alert message="Villa is available for the selected dates ✓" type="success" style={{ marginBottom: 12 }} showIcon />
          )}
          {availability === false && (
            <Alert
              type="error"
              style={{ marginBottom: 12 }}
              showIcon
              message="Villa is already booked for this period — choose different dates."
              description={conflicts.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {conflicts.map(c => (
                    <div key={c.id} style={{ fontSize: 12 }}>
                      {dayjs(c.check_in).format('DD MMM')} → {dayjs(c.check_out).format('DD MMM YYYY')} ({c.status})
                    </div>
                  ))}
                </div>
              )}
            />
          )}

          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>

          <Alert type="info" showIcon message="Your booking will be created as Pending until confirmed by our team." />
        </Form>
      </Modal>

      {/* Quick add-guest form */}
      <Modal
        title="Add Guest"
        open={guestModalOpen}
        onCancel={() => setGuestModalOpen(false)}
        onOk={() => guestForm.submit()}
        confirmLoading={createGuest.isPending}
      >
        <Form form={guestForm} layout="vertical" onFinish={(vals) => createGuest.mutate(vals)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="id_number" label="ID Number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nationality" label="Nationality">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
