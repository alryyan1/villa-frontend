import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, theme } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  DashboardOutlined, HomeOutlined, UserOutlined, TeamOutlined,
  CalendarOutlined, BarChartOutlined, LogoutOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, FileTextOutlined, SettingOutlined, AimOutlined,
} from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { HeaderToolbarProvider, useHeaderToolbar } from '../store/HeaderToolbarContext';

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
    ],
  },
  { key: '/users', icon: <SettingOutlined />, label: 'Users' },
  { key: '/activity-logs', icon: <FileTextOutlined />, label: 'Activity Log' },
];

function AppLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { toolbar } = useHeaderToolbar();

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
            {collapsed ? '🏡' : '🏡 Villa Manager'}
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

          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Avatar style={{ background: token.colorPrimary }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Text>{user?.name}</Text>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16, padding: 16, background: token.colorBgContainer, borderRadius: token.borderRadius, overflowY: 'auto', flex: 1 }}>
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
