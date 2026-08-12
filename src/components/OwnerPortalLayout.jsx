import { Layout, Avatar, Dropdown, Typography, theme, Menu } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LogoutOutlined, DashboardOutlined, HomeOutlined, CalendarOutlined, BulbOutlined, BulbFilled,
} from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';

const { Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { key: '/owner', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/owner/villas', icon: <HomeOutlined />, label: 'My Villas' },
  { key: '/owner/bookings', icon: <CalendarOutlined />, label: 'My Bookings' },
];

export default function OwnerPortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { isDark, toggle } = useTheme();

  const selectedKey = navItems.find(i => i.key === location.pathname)?.key
    ?? (location.pathname.startsWith('/owner/villas') ? '/owner/villas'
      : location.pathname.startsWith('/owner/bookings') ? '/owner/bookings' : '/owner');

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout(); },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: token.colorBgContainer,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Text strong style={{ fontSize: 16, flexShrink: 0 }}>Owner Portal</Text>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none', minWidth: 400 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span
            onClick={toggle}
            style={{ fontSize: 18, cursor: 'pointer', color: token.colorText, lineHeight: 1 }}
          >
            {isDark ? <BulbFilled style={{ color: '#fadb14' }} /> : <BulbOutlined />}
          </span>
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

      <Content style={{ margin: 16, padding: 20, background: token.colorBgContainer, borderRadius: token.borderRadius }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
