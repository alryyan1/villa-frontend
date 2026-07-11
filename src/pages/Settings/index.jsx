import { useState } from 'react';
import { Card, Tabs, Form, Input, Button, App, Switch, Descriptions, Skeleton, Space, Typography, Divider, Select, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, WhatsAppOutlined, ClockCircleOutlined, FileProtectOutlined } from '@ant-design/icons';

const { Text } = Typography;
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => client.put('/me', values).then(r => r.data),
    onSuccess: (updated) => {
      updateUser(updated);
      message.success('Profile updated.');
    },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) {
        form.setFields(Object.entries(errors).map(([name, msgs]) => ({ name, errors: msgs })));
      } else {
        message.error(err.response?.data?.message ?? 'Failed to update profile.');
      }
    },
  });

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ name: user?.name, email: user?.email, phone: user?.phone ?? '' }}
      onFinish={mutate}
      style={{ maxWidth: 480 }}
    >
      <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Name is required.' }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Valid email is required.' }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Phone" name="phone">
        <Input />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isPending}>Save Changes</Button>
      </Form.Item>
    </Form>
  );
}

function PasswordTab() {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => client.put('/me/password', values).then(r => r.data),
    onSuccess: () => {
      message.success('Password changed successfully.');
      form.resetFields();
    },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) {
        form.setFields(Object.entries(errors).map(([name, msgs]) => ({ name, errors: msgs })));
      } else {
        message.error(err.response?.data?.message ?? 'Failed to change password.');
      }
    },
  });

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={mutate}
      style={{ maxWidth: 480 }}
    >
      <Form.Item label="Current Password" name="current_password" rules={[{ required: true, message: 'Enter your current password.' }]}>
        <Input.Password />
      </Form.Item>
      <Form.Item label="New Password" name="password" rules={[{ required: true, min: 8, message: 'Minimum 8 characters.' }]}>
        <Input.Password />
      </Form.Item>
      <Form.Item
        label="Confirm New Password"
        name="password_confirmation"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Please confirm your new password.' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error('Passwords do not match.'));
            },
          }),
        ]}
      >
        <Input.Password />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isPending}>Change Password</Button>
      </Form.Item>
    </Form>
  );
}

const LANG_OPTIONS = [
  { value: 'ar',    label: 'Arabic (ar)' },
  { value: 'en_US', label: 'English (en_US)' },
  { value: 'en',    label: 'English (en)' },
];

function NotificationsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [templateForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => client.get('/settings').then(r => r.data),
  });

  // Populate template form when data loads
  if (data && !templateForm.getFieldValue('owner_booking_template')) {
    templateForm.setFieldsValue({
      owner_booking_template:      data.owner_booking_template      ?? '',
      owner_booking_template_lang: data.owner_booking_template_lang ?? 'ar',
      guest_booking_template:      data.guest_booking_template      ?? '',
      guest_booking_template_lang: data.guest_booking_template_lang ?? 'ar',
      guest_pending_booking_template:      data.guest_pending_booking_template      ?? '',
      guest_pending_booking_template_lang: data.guest_pending_booking_template_lang ?? 'ar',
      user_booking_template:       data.user_booking_template       ?? '',
      user_booking_template_lang:  data.user_booking_template_lang  ?? 'ar',
      owner_self_booking_template:      data.owner_self_booking_template      ?? '',
      owner_self_booking_template_lang: data.owner_self_booking_template_lang ?? 'ar',
      reception_phone_1:           data.reception_phone_1           ?? '76767769',
      reception_phone_2:           data.reception_phone_2           ?? '76767768',
      guest_checkout_reminder_template:      data.guest_checkout_reminder_template      ?? '',
      guest_checkout_reminder_template_lang: data.guest_checkout_reminder_template_lang ?? 'ar',
      owner_booking_template_has_button: data.owner_booking_template_has_button === '1',
      guest_booking_template_has_button: data.guest_booking_template_has_button === '1',
      guest_pending_booking_template_has_button: data.guest_pending_booking_template_has_button === '1',
      user_booking_template_has_button: data.user_booking_template_has_button === '1',
      owner_self_booking_template_has_button: data.owner_self_booking_template_has_button === '1',
    });
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => client.put('/settings', values).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      message.success('Settings saved.');
    },
    onError: () => message.error('Failed to save settings.'),
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

  return (
    <div style={{ maxWidth: 540 }}>
      <Descriptions column={1} bordered>
        <Descriptions.Item
          label={
            <span>
              Owner Notifications
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Send booking alerts via WhatsApp to owners
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.whatsapp_enabled === '1'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ whatsapp_enabled: checked })}
          />
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <span>
              Tenant Notifications
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Send the tenant template when a booking is created
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.tenant_notifications_enabled !== '0'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ tenant_notifications_enabled: checked })}
          />
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <span>
              Booking Confirmation Notifications
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Send WhatsApp to guest &amp; owner when a pending booking is confirmed
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.booking_confirmation_notify_enabled !== '0'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ booking_confirmation_notify_enabled: checked })}
          />
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <span>
              Firebase PDF Upload
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Generate the confirmation PDF and upload it to Firebase Storage on create/update/confirm. Disable to speed up booking saves if this isn't needed.
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.firebase_upload_enabled !== '0'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ firebase_upload_enabled: checked })}
          />
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left" style={{ marginTop: 24 }}>
        <WhatsAppOutlined style={{ marginRight: 6 }} />
        Booking Templates
      </Divider>

      <Form
        form={templateForm}
        layout="vertical"
        onFinish={(vals) => mutate(vals)}
        style={{ maxWidth: 480 }}
      >
        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <UserOutlined style={{ marginRight: 6 }} />Owner Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Params: <Text code>{'{{1}}'}</Text> booking ID, <Text code>{'{{2}}'}</Text> villa,{' '}
          <Text code>{'{{3}}'}</Text> check-in, <Text code>{'{{4}}'}</Text> check-out,{' '}
          <Text code>{'{{5}}'}</Text> total, <Text code>{'{{6}}'}</Text> commission, <Text code>{'{{7}}'}</Text> net.
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="owner_booking_template" label="Template Name">
              <Input placeholder="e.g. villa_booking_owner" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="owner_booking_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="owner_booking_template_has_button" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch checkedChildren="Has Download PDF button" unCheckedChildren="No Download PDF button" />
        </Form.Item>

        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <UserOutlined style={{ color: '#8B6914', marginRight: 6 }} />Owner Self-Booking Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Sent to the owner instead of the regular Owner Template above when they book their own villa (no price/commission).{' '}
          Params: <Text code>{'{{1}}'}</Text> booking ID, <Text code>{'{{2}}'}</Text> villa,{' '}
          <Text code>{'{{3}}'}</Text> check-in, <Text code>{'{{4}}'}</Text> check-out, <Text code>{'{{5}}'}</Text> value.
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="owner_self_booking_template" label="Template Name">
              <Input placeholder="e.g. owner_booking" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="owner_self_booking_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="owner_self_booking_template_has_button" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch checkedChildren="Has Download PDF button" unCheckedChildren="No Download PDF button" />
        </Form.Item>

        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <WhatsAppOutlined style={{ color: '#25D366', marginRight: 6 }} />Guest Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Params: <Text code>{'{{1}}'}</Text> booking ID, <Text code>{'{{2}}'}</Text> villa,{' '}
          <Text code>{'{{3}}'}</Text> check-in, <Text code>{'{{4}}'}</Text> check-out,{' '}
          <Text code>{'{{5}}'}</Text> total, <Text code>{'{{6}}'}</Text> reception phone 1, <Text code>{'{{7}}'}</Text> reception phone 2.
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="guest_booking_template" label="Template Name">
              <Input placeholder="e.g. villa_booking_guest" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="guest_booking_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="guest_booking_template_has_button" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch checkedChildren="Has Download PDF button" unCheckedChildren="No Download PDF button" />
        </Form.Item>

        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <WhatsAppOutlined style={{ color: '#fa8c16', marginRight: 6 }} />Pending Booking Guest Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Sent instead of the Guest Template above when the booking is created with status <Text code>pending</Text>.{' '}
          Params: <Text code>{'{{1}}'}</Text> booking ID, <Text code>{'{{2}}'}</Text> villa,{' '}
          <Text code>{'{{3}}'}</Text> check-in, <Text code>{'{{4}}'}</Text> check-out,{' '}
          <Text code>{'{{5}}'}</Text> total, <Text code>{'{{6}}'}</Text> reception phone 1, <Text code>{'{{7}}'}</Text> reception phone 2.
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="guest_pending_booking_template" label="Template Name">
              <Input placeholder="e.g. villa_booking_guest_pending" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="guest_pending_booking_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="guest_pending_booking_template_has_button" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch checkedChildren="Has Download PDF button" unCheckedChildren="No Download PDF button" />
        </Form.Item>

        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <UserOutlined style={{ color: '#1677ff', marginRight: 6 }} />User (Staff) Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Sent to the staff member who created the booking, regardless of confirmed/pending status.{' '}
          Params: <Text code>{'{{1}}'}</Text> villa, <Text code>{'{{2}}'}</Text> booking ID,{' '}
          <Text code>{'{{3}}'}</Text> guest phone, <Text code>{'{{4}}'}</Text> booking date,{' '}
          <Text code>{'{{5}}'}</Text> nights, <Text code>{'{{6}}'}</Text> remaining amount.
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="user_booking_template" label="Template Name">
              <Input placeholder="e.g. villa_booking_user" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="user_booking_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="user_booking_template_has_button" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch checkedChildren="Has Download PDF button" unCheckedChildren="No Download PDF button" />
        </Form.Item>

        <Text strong style={{ display: 'block', marginBottom: 4 }}>
          <ClockCircleOutlined style={{ color: '#fa8c16', marginRight: 6 }} />Checkout Reminder Template
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Params: <Text code>{'{{1}}'}</Text> guest name, <Text code>{'{{2}}'}</Text> villa. Sent manually per booking (fixed 10:15 AM wording).
        </Text>
        <Row gutter={12}>
          <Col span={15}>
            <Form.Item name="guest_checkout_reminder_template" label="Template Name">
              <Input placeholder="e.g. guest_checkout_reminder" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="guest_checkout_reminder_template_lang" label="Language">
              <Select options={LANG_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Text strong style={{ display: 'block', marginBottom: 8 }}>Reception Phones (used in guest template)</Text>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="reception_phone_1" label="Reception Phone 1">
              <Input placeholder="e.g. 76767769" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reception_phone_2" label="Reception Phone 2">
              <Input placeholder="e.g. 76767768" />
            </Form.Item>
          </Col>
        </Row>

        <Button type="primary" htmlType="submit" loading={isPending}>
          Save Templates
        </Button>
      </Form>

      <Divider orientation="left" style={{ marginTop: 24 }}>
        <WhatsAppOutlined style={{ marginRight: 6 }} />
        Test Connection
      </Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
        Send a <Text code>hello_world</Text> template to verify your WhatsApp Cloud API is working.
      </Text>
      <TestWhatsApp />
    </div>
  );
}

function BookingRulesTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => client.get('/settings').then(r => r.data),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => client.put('/settings', values).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      message.success('Settings saved.');
    },
    onError: () => message.error('Failed to save settings.'),
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 2 }} />;

  return (
    <div style={{ maxWidth: 540 }}>
      <Descriptions column={1} bordered>
        <Descriptions.Item
          label={
            <span>
              Enforce Contract End Date
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Block bookings whose checkout date is after the villa's management contract end date
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.enforce_contract_end_date !== '0'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ enforce_contract_end_date: checked })}
          />
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}

function TestWhatsApp() {
  const { message } = App.useApp();
  const [phone, setPhone] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (p) => client.post('/notifications/whatsapp-test', { phone: p }).then(r => r.data),
    onSuccess: () => message.success('Test message sent — check your WhatsApp.'),
    onError: (e) => message.error(e.response?.data?.error ?? 'Failed to send test message.'),
  });

  return (
    <Space.Compact style={{ width: 320 }}>
      <Input
        prefix={<WhatsAppOutlined style={{ color: '#25D366' }} />}
        placeholder="Phone number (e.g. 96878622990)"
        value={phone}
        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
        onPressEnter={() => phone && mutate(phone)}
        maxLength={15}
      />
      <Button
        type="primary"
        loading={isPending}
        disabled={!phone || phone.length < 7}
        onClick={() => mutate(phone)}
      >
        Send Test
      </Button>
    </Space.Compact>
  );
}

const tabs = [
  { key: 'profile',       label: <span><UserOutlined /> Profile</span>,           children: <ProfileTab /> },
  { key: 'password',      label: <span><LockOutlined /> Change Password</span>,   children: <PasswordTab /> },
  { key: 'notifications', label: <span><BellOutlined /> Notifications</span>,     children: <NotificationsTab /> },
  { key: 'booking-rules', label: <span><FileProtectOutlined /> Booking Rules</span>, children: <BookingRulesTab /> },
];

export default function Settings() {
  usePageTitle('Settings');
  return (
    <Card title="Settings">
      <Tabs items={tabs} />
    </Card>
  );
}
