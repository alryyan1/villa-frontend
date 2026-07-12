import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antTheme, Result } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider, useTheme } from './store/ThemeContext';
import { canAccessPage } from './utils/permissions';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Villas from './pages/Villas';
import Owners from './pages/Owners';
import Guests from './pages/Guests';
import Bookings from './pages/Bookings';
import OccupancyReport from './pages/Reports/OccupancyReport';
import RevenueReport from './pages/Reports/RevenueReport';
import VillaPerformance from './pages/Reports/VillaPerformance';
import UserPerformance from './pages/Reports/UserPerformance';
import PaymentMethodsReport from './pages/Reports/PaymentMethodsReport';
import OwnerBookingsReport from './pages/Reports/OwnerBookingsReport';
import Users from './pages/Users';
import ActivityLogs from './pages/ActivityLogs';
import VillaMap from './pages/VillaMap';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PageGuard({ pageKey, children }) {
  const { user } = useAuth();
  if (!canAccessPage(user, pageKey)) {
    return <Result status="403" title="Access Denied" subTitle="You don't have permission to view this page." />;
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<PageGuard pageKey="/"><Dashboard /></PageGuard>} />
        <Route path="villas" element={<PageGuard pageKey="/villas"><Villas /></PageGuard>} />
        <Route path="owners" element={<PageGuard pageKey="/owners"><Owners /></PageGuard>} />
        <Route path="guests" element={<PageGuard pageKey="/guests"><Guests /></PageGuard>} />
        <Route path="bookings" element={<PageGuard pageKey="/bookings"><Bookings /></PageGuard>} />
        <Route path="reports/occupancy" element={<PageGuard pageKey="/reports/occupancy"><OccupancyReport /></PageGuard>} />
        <Route path="reports/revenue" element={<PageGuard pageKey="/reports/revenue"><RevenueReport /></PageGuard>} />
        <Route path="reports/villa-performance" element={<PageGuard pageKey="/reports/villa-performance"><VillaPerformance /></PageGuard>} />
        <Route path="reports/user-performance" element={<PageGuard pageKey="/reports/user-performance"><UserPerformance /></PageGuard>} />
        <Route path="reports/payment-methods" element={<PageGuard pageKey="/reports/payment-methods"><PaymentMethodsReport /></PageGuard>} />
        <Route path="reports/owner-bookings" element={<PageGuard pageKey="/reports/owner-bookings"><OwnerBookingsReport /></PageGuard>} />
        <Route path="users" element={<PageGuard pageKey="/users"><Users /></PageGuard>} />
        <Route path="activity-logs" element={<PageGuard pageKey="/activity-logs"><ActivityLogs /></PageGuard>} />
        <Route path="map" element={<PageGuard pageKey="/map"><VillaMap /></PageGuard>} />
        <Route path="maintenance" element={<PageGuard pageKey="/maintenance"><Maintenance /></PageGuard>} />
        <Route path="settings" element={<PageGuard pageKey="/settings"><Settings /></PageGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function ThemedApp() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider theme={{ algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm }}>
      <AntApp>
        <HashRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
