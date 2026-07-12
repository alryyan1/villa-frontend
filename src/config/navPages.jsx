import {
  DashboardOutlined, HomeOutlined, UserOutlined, TeamOutlined,
  CalendarOutlined, BarChartOutlined, FileTextOutlined, SettingOutlined,
  AimOutlined, ToolOutlined, BuildOutlined,
} from '@ant-design/icons';

// Single source of truth for sidebar structure. Also drives the per-user
// page-permission checkboxes on the Users page (see ALL_PAGE_KEYS below),
// so every navigable page must have a unique `key` here.
export const menuItems = [
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
      { key: '/reports/owner-bookings', label: 'Owner Bookings' },
    ],
  },
  { key: '/maintenance', icon: <BuildOutlined />, label: 'Maintenance' },
  { key: '/users', icon: <SettingOutlined />, label: 'Users' },
  { key: '/activity-logs', icon: <FileTextOutlined />, label: 'Activity Log' },
  { key: '/settings', icon: <ToolOutlined />, label: 'Settings' },
];

// Flat { key, label } list of every navigable page, for the permission
// checkboxes on the Users page and for route-level access checks.
export const ALL_PAGE_KEYS = menuItems.flatMap((item) =>
  item.children ? item.children.map((c) => ({ key: c.key, label: c.label })) : [{ key: item.key, label: item.label }]
);
