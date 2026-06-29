import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, theme, Tooltip, Badge } from 'antd';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined, HomeOutlined, UserOutlined, TeamOutlined,
  CalendarOutlined, BarChartOutlined, LogoutOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, FileTextOutlined, SettingOutlined, AimOutlined, ToolOutlined,
  BulbOutlined, BulbFilled, BuildOutlined,
} from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { HeaderToolbarProvider, useHeaderToolbar } from '../store/HeaderToolbarContext';
import { useTheme } from '../store/ThemeContext';
import NotificationBell from './NotificationBell';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/villas', icon: <HomeOutlined />, label: 'Villas' },
  { key: '/map', icon: <AimOutlined />, label: 'Villa Map' },
  { key: '/owners', icon: <TeamOutlined />, label: 'Owners' },
  { key: '/bookings', icon: <CalendarOutlined />, label: 'Bookings' },
  { key: '/guests', icon: <UserOutlined />, label: 'Guests' },
  {
    key: 'reports', icon: <BarChartOutlined />, label: 'Reports',
    children: [
      { key: '/reports/occupancy', label: 'Occupancy Report' },
      { key: '/reports/revenue', label: 'Revenue Report' },
      { key: '/reports/villa-performance', label: 'Villa Performance' },
      { key: '/reports/user-performance', label: 'User Performance' },
      { key: '/reports/payment-methods', label: 'Payment Methods' },
    ],
  },
  { key: '/maintenance', icon: <BuildOutlined />, label: 'Maintenance' },
  { key: '/users', icon: <SettingOutlined />, label: 'Users' },
  { key: '/activity-logs', icon: <FileTextOutlined />, label: 'Activity Log' },
  { key: '/settings', icon: <ToolOutlined />, label: 'Settings' },
];

function AppLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Enter') return;
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
      const btn = document.querySelector('.ant-modal-footer .ant-btn-primary:not([disabled]):not([loading])');
      if (btn) { e.preventDefault(); btn.click(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { toolbar } = useHeaderToolbar();
  const { isDark, toggle } = useTheme();

  const { data: waPhone } = useQuery({
    queryKey: ['whatsapp-phone-info'],
    queryFn: () => client.get('/notifications/whatsapp-phone').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const selectedKey = menuItems
    .flatMap(i => i.children ?? [i])
    .find(i => location.pathname === i.key)?.key ?? '/';

  const openKeys = location.pathname.startsWith('/reports') ? ['reports'] : [];

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout(); },
  };

  return (
    <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Text strong style={{ fontSize: collapsed ? 12 : 16 }}>
            {collapsed ? '' : ' Villa Manager'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          height: 56,
        }}>
          <span style={{ fontSize: 18, cursor: 'pointer', flexShrink: 0 }} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>

          {toolbar && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', overflow: 'hidden' }}>
              {toolbar}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {waPhone?.success && waPhone.data?.display_phone_number && (
              <Tooltip title={`WhatsApp: ${waPhone.data.verified_name ?? ''} · ${waPhone.data.quality_rating ?? ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#25D366', cursor: 'default' }}>
                  <Badge color="#25D366" />
                  <span style={{ fontWeight: 600 }}>{waPhone.data.display_phone_number}</span>
                </div>
              </Tooltip>
            )}
            <NotificationBell />
            <Tooltip title={isDark ? 'Switch to Light' : 'Switch to Dark'}>
              <span
                onClick={toggle}
                style={{ fontSize: 18, cursor: 'pointer', color: token.colorText, lineHeight: 1 }}
              >
                {isDark ? <BulbFilled style={{ color: '#fadb14' }} /> : <BulbOutlined />}
              </span>
            </Tooltip>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar style={{ background: token.colorPrimary }}>
                  {user?.name?.[0]?.toUpperCase()}
                </Avatar>
                <Text>{user?.name}</Text>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: 3, padding: 3, background: token.colorBgContainer, borderRadius: token.borderRadius, overflowY: 'auto', flex: 1 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default function AppLayout() {
  return (
    <HeaderToolbarProvider>
      <AppLayoutInner />
    </HeaderToolbarProvider>
  );
}
