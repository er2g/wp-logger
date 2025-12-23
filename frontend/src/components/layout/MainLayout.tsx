import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import webAuthnClient from '../../services/auth/WebAuthnClient';
import apiClient from '../../services/api/ApiClient';
import webSocketService from '../../services/websocket/WebSocketService';
import { LogOut, LayoutDashboard, MessageSquare, Users, Settings, Sparkles } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, accessToken } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      webSocketService.connect(accessToken).catch((err) => {
        console.error('Failed to connect to WebSocket:', err);
      });
    }

    return () => {
      webSocketService.disconnect();
    };
  }, [isAuthenticated, accessToken]);

  const handleLogout = async () => {
    try {
      await webAuthnClient.logout();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      apiClient.clearToken();
      dispatch(logout());
      navigate('/login');
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/15 text-violet-700 shadow-sm border border-violet-200/50'
        : 'text-slate-600 hover:bg-white/60 hover:text-violet-700 hover:translate-x-1'
    }`;

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/groups', icon: Users, label: 'Groups' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12 animate-fade-in">
      <div className="glass-panel-strong rounded-[32px] overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3rem)]">
          {/* Sidebar */}
          <aside className="lg:w-72 border-b lg:border-b-0 lg:border-r border-violet-100/50 px-6 py-8 flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-3 animate-slide-in">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">WP Logger</h1>
                <p className="text-xs text-slate-500">WhatsApp Control Center</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="mt-10 space-y-2 flex-1">
              {navItems.map((item, index) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* User Profile */}
            <div className="mt-auto pt-6 animate-slide-up delay-500">
              <div className="glass-card flex items-center justify-between gap-3 !p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-violet-200/50">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user?.username || 'Unknown'}</p>
                    <p className="text-xs text-slate-500 status-online">Online</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all duration-300"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10 overflow-auto">
            <div className="animate-slide-up">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
