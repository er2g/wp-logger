import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../../store';
import apiClient from '../../services/api/ApiClient';
import { QRCodeScanner } from './QRCodeScanner';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts';
import {
  MessageSquare, Users, Image,
  TrendingUp, Activity, HardDrive, ArrowRight, Clock, Calendar,
  Download, MessageCircle, UserCheck, ChevronRight,
} from 'lucide-react';

interface StatsData {
  totalGroups: number;
  monitoredGroups: number;
  dmCount: number;
  groupCount: number;
  totalMessages: number;
  totalMedia: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  totalStorageBytes: number;
  mediaByType: Record<string, number>;
  messagesByType: Record<string, number>;
  storageByType: Record<string, number>;
  activityByDay: Array<{ date: string; message_count: number }>;
  activityByHour: number[];
  topSenders: Array<{
    sender_name: string;
    sender_number: string;
    message_count: number;
    media_count: number;
  }>;
}

interface StatsResponse {
  success: boolean;
  data: StatsData;
  error?: string;
}

const mediaTypeColors: Record<string, string> = {
  image: '#8b5cf6',
  video: '#d946ef',
  audio: '#f59e0b',
  voice: '#f97316',
  document: '#3b82f6',
  sticker: '#ec4899',
  gif: '#10b981',
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Dashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<StatsData>({
    totalGroups: 0,
    monitoredGroups: 0,
    dmCount: 0,
    groupCount: 0,
    totalMessages: 0,
    totalMedia: 0,
    messagesToday: 0,
    messagesThisWeek: 0,
    messagesThisMonth: 0,
    totalStorageBytes: 0,
    mediaByType: {},
    messagesByType: {},
    storageByType: {},
    activityByDay: [],
    activityByHour: [],
    topSenders: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const response = await apiClient.get<StatsResponse>('/stats');
        if (!response.success) {
          throw new Error(response.error || 'Failed to load stats');
        }
        if (isMounted) {
          setStats(response.data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load stats');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const pieData = Object.entries(stats.mediaByType).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: mediaTypeColors[name] || '#94a3b8',
  }));

  const activityData = [...stats.activityByDay].reverse().slice(-14).map(item => ({
    date: new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    messages: item.message_count,
  }));

  const hourlyData = stats.activityByHour.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    messages: count,
  }));

  const statCards = [
    {
      label: 'Total Messages',
      value: stats.totalMessages,
      subValue: `+${stats.messagesToday} today`,
      icon: MessageSquare,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Active Chats',
      value: stats.monitoredGroups,
      subValue: `${stats.groupCount} groups, ${stats.dmCount} DMs`,
      icon: Users,
      gradient: 'from-fuchsia-500 to-pink-600',
      iconBg: 'bg-fuchsia-100',
      iconColor: 'text-fuchsia-600',
    },
    {
      label: 'Media Files',
      value: stats.totalMedia,
      subValue: formatBytes(stats.totalStorageBytes),
      icon: HardDrive,
      gradient: 'from-purple-500 to-indigo-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'This Week',
      value: stats.messagesThisWeek,
      subValue: `${stats.messagesThisMonth} this month`,
      icon: Calendar,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="max-w-7xl space-y-8">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <Activity className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Dashboard</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              Welcome back, <span className="gradient-text">{user?.username || 'Operator'}</span>
            </h2>
            <p className="mt-2 text-slate-500">
              Here's what's happening with your WhatsApp archive.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/messages" className="glass-button !py-2.5">
              <MessageCircle className="w-4 h-4 mr-2" />
              View Messages
            </Link>
            <Link to="/groups" className="glass-button-solid !py-2.5">
              <Users className="w-4 h-4 mr-2" />
              Manage Groups
            </Link>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 animate-slide-up">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className="stat-card hover-lift animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800">
                  {isLoading ? (
                    <span className="skeleton inline-block w-16 h-8" />
                  ) : (
                    card.value.toLocaleString()
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1">{card.subValue}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.iconBg}`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Chart - Large */}
        <div className="lg:col-span-2 glass-panel rounded-[28px] p-6 animate-slide-up delay-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Message Activity</h3>
              <p className="text-sm text-slate-500">Last 14 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <TrendingUp className="w-3 h-3" />
              <span>Live tracking</span>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="skeleton w-full h-48" />
            </div>
          ) : activityData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(91, 33, 182, 0.15)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMessages)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              No activity data available
            </div>
          )}
        </div>

        {/* WhatsApp Connection */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Connection</h3>
              <p className="text-sm text-slate-500">WhatsApp Link</p>
            </div>
          </div>
          <QRCodeScanner />
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Media Distribution */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-400">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Media Types</h3>
              <p className="text-sm text-slate-500">Distribution</p>
            </div>
            <span className="pill">{stats.totalMedia} files</span>
          </div>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="skeleton w-32 h-32 rounded-full" />
            </div>
          ) : pieData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(91, 33, 182, 0.15)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {pieData.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-600">{item.name}</span>
                    <span className="text-slate-400 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              No media data
            </div>
          )}
        </div>

        {/* Hourly Activity */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Hourly Pattern</h3>
              <p className="text-sm text-slate-500">Message distribution</p>
            </div>
            <Clock className="w-5 h-5 text-violet-400" />
          </div>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="skeleton w-full h-32" />
            </div>
          ) : hourlyData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    interval={5}
                  />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={30} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(91, 33, 182, 0.15)',
                    }}
                  />
                  <Bar dataKey="messages" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              No hourly data
            </div>
          )}
        </div>

        {/* Top Senders */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-600">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Top Senders</h3>
              <p className="text-sm text-slate-500">Most active</p>
            </div>
            <UserCheck className="w-5 h-5 text-violet-400" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          ) : stats.topSenders.length > 0 ? (
            <div className="space-y-2">
              {stats.topSenders.slice(0, 5).map((sender, index) => (
                <div
                  key={sender.sender_number || index}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-violet-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xs">
                    {sender.sender_name?.charAt(0).toUpperCase() || '#'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {sender.sender_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {sender.sender_number || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-violet-600">
                      {sender.message_count}
                    </p>
                    <p className="text-xs text-slate-400">msgs</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              No sender data
            </div>
          )}

          {stats.topSenders.length > 5 && (
            <Link
              to="/messages"
              className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-600 hover:text-violet-700"
            >
              View all senders
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-700">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/messages"
            className="glass-card !p-4 flex items-center gap-3 hover:!bg-violet-50/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-violet-100 group-hover:bg-violet-200 transition-colors">
              <MessageSquare className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Messages</p>
              <p className="text-xs text-slate-500">Browse archive</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-violet-500 transition-colors" />
          </Link>

          <Link
            to="/groups"
            className="glass-card !p-4 flex items-center gap-3 hover:!bg-fuchsia-50/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-fuchsia-100 group-hover:bg-fuchsia-200 transition-colors">
              <Users className="w-5 h-5 text-fuchsia-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Groups</p>
              <p className="text-xs text-slate-500">Manage chats</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-fuchsia-500 transition-colors" />
          </Link>

          <Link
            to="/media"
            className="glass-card !p-4 flex items-center gap-3 hover:!bg-purple-50/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
              <Image className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Media</p>
              <p className="text-xs text-slate-500">Gallery view</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-purple-500 transition-colors" />
          </Link>

          <Link
            to="/settings"
            className="glass-card !p-4 flex items-center gap-3 hover:!bg-emerald-50/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Export</p>
              <p className="text-xs text-slate-500">Download data</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-500 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
