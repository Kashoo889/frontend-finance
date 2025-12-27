import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/dashboard/Dashboard';
import Saudi from '@/pages/persons/Saudi';
import Special from '@/pages/persons/Special';
import Pakistani from '@/pages/persons/Pakistani';
import TraderDetail from '@/pages/persons/TraderDetail';
import BankLedger from '@/pages/persons/BankLedger';
import Profile from '@/pages/profile/Profile';
import NotFound from '@/pages/NotFound';
import { isAuthenticated } from '@/lib/auth';

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

/**
 * Application routes configuration
 * Login is the default route, dashboard routes are protected
 */
const AppRoutes = () => {
  return (
    <Routes>
      {/* Default route - Login */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      
      {/* Protected Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Persons - Saudi Hisaab Kitaab */}
      <Route
        path="/dashboard/persons/saudi"
        element={
          <ProtectedRoute>
            <Saudi />
          </ProtectedRoute>
        }
      />
      
      {/* Persons - Special Hisaab Kitaab */}
      <Route
        path="/dashboard/persons/special"
        element={
          <ProtectedRoute>
            <Special />
          </ProtectedRoute>
        }
      />
      
      {/* Persons - Pakistani Hisaab Kitaab */}
      <Route
        path="/dashboard/persons/pakistani"
        element={
          <ProtectedRoute>
            <Pakistani />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/persons/pakistani/:traderId"
        element={
          <ProtectedRoute>
            <TraderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/persons/pakistani/:traderId/bank/:bankId"
        element={
          <ProtectedRoute>
            <BankLedger />
          </ProtectedRoute>
        }
      />
      
      {/* Profile */}
      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
