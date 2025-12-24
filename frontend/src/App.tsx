import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import MainLayout from './components/layout/MainLayout';
import Messages from './components/messages/Messages';
import Groups from './components/groups/Groups';
import Settings from './components/settings/Settings';
import MediaGallery from './components/media/MediaGallery';
import apiClient from './services/api/ApiClient';
import { loginSuccess, logout } from './store/slices/authSlice';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const RoleRoute: React.FC<{ roles: Array<'admin' | 'user'>; children: React.ReactNode }> = ({ roles, children }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    const fallback = user?.role === 'user' ? '/messages' : '/';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      try {
        const storedToken = apiClient.getTokenFromStorage();
        if (!storedToken) {
          if (isMounted) {
            dispatch(logout());
            setIsBootstrapping(false);
          }
          return;
        }

        apiClient.setToken(storedToken);

        const response = await apiClient.get<{
          success: boolean;
          data?: { id: string; username: string; role: 'admin' | 'user' };
        }>('/auth/me');

        if (response.success && response.data && isMounted) {
          dispatch(loginSuccess({
            user: {
              id: response.data.id,
              username: response.data.username,
              role: response.data.role,
            },
            accessToken: storedToken || null,
          }));
        } else if (isMounted) {
          dispatch(logout());
        }
      } catch {
        if (isMounted) {
          dispatch(logout());
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    if (!isAuthenticated) {
      bootstrap();
    } else {
      setIsBootstrapping(false);
    }

    return () => {
      isMounted = false;
    };
  }, [dispatch, isAuthenticated]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <RoleRoute roles={['admin']}>
              <Dashboard />
            </RoleRoute>
          }
        />
        <Route
          path="messages"
          element={
            <RoleRoute roles={['admin', 'user']}>
              <Messages />
            </RoleRoute>
          }
        />
        <Route
          path="groups"
          element={
            <RoleRoute roles={['admin']}>
              <Groups />
            </RoleRoute>
          }
        />
        <Route
          path="media"
          element={
            <RoleRoute roles={['admin']}>
              <MediaGallery />
            </RoleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <RoleRoute roles={['admin']}>
              <Settings />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
