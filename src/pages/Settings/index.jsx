import { useState } from 'react';
import { Card, Tabs, Form, Input, Button, App, Switch, Descriptions, Skeleton, Space, Typography, Divider } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, PlusOutlined, DeleteOutlined, WhatsAppOutlined } from '@ant-design/icons';

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

function NotificationsTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [recipientForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => client.get('/settings').then(r => r.data),
    onSuccess: (d) => {
      recipientForm.setFieldsValue({ recipients: d?.whatsapp_recipients?.length ? d.whatsapp_recipients : [''] });
    },
  });

  // Populate form when data loads
  if (data && !recipientForm.getFieldValue('recipients')) {
    recipientForm.setFieldsValue({ recipients: data?.whatsapp_recipients?.length ? data.whatsapp_recipients : [''] });
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (values) => client.put('/settings', values).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      message.success('Settings saved.');
    },
    onError: () => message.error('Failed to save settings.'),
  });

  const saveRecipients = (vals) => {
    const numbers = (vals.recipients || []).map(p => (p || '').trim()).filter(Boolean);
    mutate({ whatsapp_recipients: numbers });
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

  const enabled = data?.whatsapp_enabled === '1';

  return (
    <div style={{ maxWidth: 520 }}>
      <Descriptions column={1} bordered>
        <Descriptions.Item
          label={
            <span>
              WhatsApp Notifications
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Send booking alerts via WhatsApp to owners, guests, and management
              </div>
            </span>
          }
        >
          <Switch
            checked={enabled}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ whatsapp_enabled: checked })}
          />
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <span>
              Owner Notifications
              <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                Notify the villa owner via WhatsApp when a booking is created, updated or cancelled
              </div>
            </span>
          }
        >
          <Switch
            checked={data?.owner_notifications_enabled !== '0'}
            loading={isPending}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(checked) => mutate({ owner_notifications_enabled: checked })}
          />
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left" style={{ marginTop: 24 }}>
        <WhatsAppOutlined style={{ marginRight: 6 }} />
        Notification Recipients
      </Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
        Phone numbers that receive booking notifications. Include country code (e.g. 96878622990).
      </Text>

      <Form form={recipientForm} onFinish={saveRecipients}>
        <Form.List name="recipients">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item {...field} noStyle rules={[{ pattern: /^\d{7,15}$/, message: 'Enter digits only, 7–15 chars' }]}>
                    <Input
                      prefix={<WhatsAppOutlined style={{ color: '#25D366' }} />}
                      placeholder="e.g. 96878622990"
                      style={{ width: 260 }}
                    />
                  </Form.Item>
                  {fields.length > 1 && (
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  )}
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} style={{ width: 260 }}>
                Add Number
              </Button>
            </>
          )}
        </Form.List>
        <Button type="primary" htmlType="submit" loading={isPending} style={{ marginTop: 16 }}>
          Save Recipients
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
];

export default function Settings() {
  usePageTitle('Settings');
  return (
    <Card title="Settings">
      <Tabs items={tabs} />
    </Card>
  );
}
