import { useState, useEffect, useMemo } from 'react';
import { Layout, Avatar, Dropdown, Typography, theme, Tooltip, Badge } from 'antd';
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, BulbOutlined, BulbFilled,
} from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { HeaderToolbarProvider, useHeaderToolbar } from '../store/HeaderToolbarContext';
import { useTheme } from '../store/ThemeContext';
import { canAccessPage } from '../utils/permissions';
import { menuItems as allMenuItems } from '../config/navPages';
import NotificationBell from './NotificationBell';

const { Header, Content } = Layout;
const { Text } = Typography;

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

  const menuItems = useMemo(() => allMenuItems
    .map((item) => item.children
      ? { ...item, children: item.children.filter((c) => canAccessPage(user, c.key)) }
      : item)
    .filter((item) => item.children ? item.children.length > 0 : canAccessPage(user, item.key)),
  [user]);

  const selectedKey = menuItems
    .flatMap(i => i.children ?? [i])
    .find(i => location.pathname === i.key)?.key ?? '/';

  const reportsOpen = location.pathname.startsWith('/reports');

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout(); },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        collapsed={collapsed}
        width="220px"
        collapsedWidth="64px"
        backgroundColor={token.colorBgContainer}
        rootStyles={{
          border: 'none',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          userSelect: 'none',
          color: token.colorText,
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Text strong style={{ fontSize: collapsed ? 12 : 16 }}>
            {collapsed ? '' : ' Villa Manager'}
          </Text>
        </div>
        <Menu
          menuItemStyles={{
            button: ({ active }) => ({
              backgroundColor: active ? token.colorPrimaryBg : undefined,
              color: active ? token.colorPrimary : token.colorText,
              '&:hover': { backgroundColor: token.colorFillTertiary },
            }),
          }}
        >
          {menuItems.map((item) => (
            item.children ? (
              <SubMenu key={item.key} label={item.label} icon={item.icon} defaultOpen={reportsOpen}>
                {item.children.map((child) => (
                  <MenuItem
                    key={child.key}
                    active={selectedKey === child.key}
                    onClick={() => navigate(child.key)}
                  >
                    {child.label}
                  </MenuItem>
                ))}
              </SubMenu>
            ) : (
              <MenuItem
                key={item.key}
                icon={item.icon}
                active={selectedKey === item.key}
                onClick={() => navigate(item.key)}
              >
                {item.label}
              </MenuItem>
            )
          ))}
        </Menu>
      </Sidebar>

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
    </div>
  );
}

export default function AppLayout() {
  return (
    <HeaderToolbarProvider>
      <AppLayoutInner />
    </HeaderToolbarProvider>
  );
}
