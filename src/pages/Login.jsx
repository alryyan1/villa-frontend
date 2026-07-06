import { useState } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import pkg from '../../package.json';

const { Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Form panel */}
      <div style={{
        width: 460,
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 52px',
      }}>
        <div style={{ marginBottom: 40 }}>
          <h2 style={{
            margin: '0 0 6px',
            fontSize: 22,
            fontWeight: 700,
            color: '#1a1a2e',
            letterSpacing: '-0.3px',
          }}>
            Welcome back
          </h2>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>
            Sign in to your account to continue
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
        )}

        <Form onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
          <Form.Item
            name="email"
            label={<span style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>Email address</span>}
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#c4a882' }} />}
              placeholder="admin@alseef.com"
              style={{ borderRadius: 8, borderColor: '#e5e7eb', height: 44 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>Password</span>}
            rules={[{ required: true, message: 'Password is required' }]}
            style={{ marginBottom: 28 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#c4a882' }} />}
              placeholder="••••••••"
              style={{ borderRadius: 8, borderColor: '#e5e7eb', height: 44 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 46,
                borderRadius: 8,
                background: 'linear-gradient(90deg, #1a1a2e, #2d2d4e)',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                boxShadow: '0 4px 14px rgba(26, 26, 46, 0.3)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Text style={{ color: '#d1c5b4', fontSize: 12, marginTop: 44, textAlign: 'center', letterSpacing: 0.5 }}>
          © {new Date().getFullYear()} Al Seef — All rights reserved · v{pkg.version.split('.').slice(0, 2).join('.')}
        </Text>
      </div>

      {/* Branding panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #f5f0e8 0%, #ede5d6 40%, #e8dfc8 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle texture layers */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 70%, rgba(196,168,130,0.18) 0%, transparent 60%), radial-gradient(ellipse at 75% 20%, rgba(210,185,148,0.15) 0%, transparent 55%)',
        }} />

        {/* Thin horizontal accent line */}
        <div style={{
          position: 'absolute', top: '50%', left: '10%', right: '10%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(160,130,90,0.25), transparent)',
          transform: 'translateY(-72px)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '10%', right: '10%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(160,130,90,0.25), transparent)',
          transform: 'translateY(44px)',
        }} />

        {/* Main brand text */}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <h1 style={{
            margin: '0 0 16px',
            fontSize: 'clamp(52px, 6vw, 80px)',
            fontWeight: 300,
            letterSpacing: '0.22em',
            color: '#2c2418',
            fontFamily: "'Georgia', 'Times New Roman', serif",
            lineHeight: 1,
            textTransform: 'uppercase',
          }}>
            Al Seef
          </h1>

          {/* Accent underline */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginBottom: 18,
          }}>
            <div style={{ height: 1, width: 48, background: 'rgba(160,130,90,0.45)' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b8965a' }} />
            <div style={{ height: 1, width: 48, background: 'rgba(160,130,90,0.45)' }} />
          </div>

          <p style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.38em',
            color: '#8a7355',
            textTransform: 'uppercase',
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            Luxury Waterfront Living
          </p>
        </div>
      </div>
    </div>
  );
}
