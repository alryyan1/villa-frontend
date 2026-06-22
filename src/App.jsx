import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider, useTheme } from './store/ThemeContext';
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
import Users from './pages/Users';
import ActivityLogs from './pages/ActivityLogs';
import VillaMap from './pages/VillaMap';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="villas" element={<Villas />} />
        <Route path="owners" element={<Owners />} />
        <Route path="guests" element={<Guests />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="reports/occupancy" element={<OccupancyReport />} />
        <Route path="reports/revenue" element={<RevenueReport />} />
        <Route path="reports/villa-performance" element={<VillaPerformance />} />
        <Route path="reports/user-performance" element={<UserPerformance />} />
        <Route path="reports/payment-methods" element={<PaymentMethodsReport />} />
        <Route path="users" element={<Users />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="map" element={<VillaMap />} />
        <Route path="settings" element={<Settings />} />
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
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
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
