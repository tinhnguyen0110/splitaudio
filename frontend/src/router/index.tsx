import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/components/layout/auth-layout';
import RootLayout from '@/components/layout/root-layout';
import ProtectedRoute from '@/components/common/protected-route';
import AuthPage from '@/pages/auth';
import DashboardPage from '@/pages/dashboard';
import SeparatePage from '@/pages/separate';
import HistoryPage from '@/pages/history';
import TaskDetailPage from '@/pages/task-detail';
import CreditsPage from '@/pages/credits';
import ProfilePage from '@/pages/profile';
import AdminDashboardPage from '@/pages/admin-dashboard';
import UserManagementPage from '@/pages/admin-users';
import SystemOverviewPage from '@/pages/admin-system';
import AdminTracingPage from '@/pages/admin-tracing';
import NotFoundPage from '@/pages/not-found';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [{ index: true, element: <AuthPage /> }],
  },
  {
    path: '/login',
    element: <Navigate to="/?tab=login" replace />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'separate', element: <SeparatePage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'tasks/:taskId', element: <TaskDetailPage /> },
          { path: 'credits', element: <CreditsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            path: 'admin',
            element: <ProtectedRoute requiredRole="admin" />,
            children: [
              { path: 'dashboard', element: <AdminDashboardPage /> },
              { path: 'users', element: <UserManagementPage /> },
              { path: 'system', element: <SystemOverviewPage /> },
              { path: 'tracing', element: <AdminTracingPage /> },
              // Redirects for old routes
              { path: 'logs', element: <Navigate to="/admin/tracing" replace /> },
              { path: 'traces', element: <Navigate to="/admin/tracing" replace /> },
              { path: 'traces/:taskId', element: <Navigate to="/admin/tracing" replace /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
