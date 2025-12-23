import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import apiClient from '../../services/api/ApiClient';
import { QRCodeScanner } from './QRCodeScanner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  MessageSquare,
  Users,
  Image,
  Video,
  FileText,
  Music,
  Sticker,
  TrendingUp,
  Activity,
  HardDrive,
} from 'lucide-react';

interface StatsData {
  totalGroups: number;
  monitoredGroups: number;
  totalMessages: number;
  totalMedia: number;
  mediaByType: Record<string, number>;
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
};

const mediaTypeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
  voice: <Music className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  sticker: <Sticker className="w-4 h-4" />,
};

const Dashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<StatsData>({
    totalGroups: 0,
    monitoredGroups: 0,
    totalMessages: 0,
    totalMedia: 0,
    mediaByType: {},
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
    return () => {
      isMounted = false;
    };
  }, []);

  const pieData = Object.entries(stats.mediaByType).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: mediaTypeColors[name] || '#94a3b8',
  }));

  const statCards = [
    {
      label: 'Total Messages',
      value: stats.totalMessages,
      icon: MessageSquare,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Active Groups',
      value: stats.monitoredGroups,
      icon: Users,
      gradient: 'from-fuchsia-500 to-pink-600',
      iconBg: 'bg-fuchsia-100',
      iconColor: 'text-fuchsia-600',
    },
    {
      label: 'Media Files',
      value: stats.totalMedia,
      icon: HardDrive,
      gradient: 'from-purple-500 to-indigo-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <Activity className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Dashboard</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-800">
          Welcome back, <span className="gradient-text">{user?.username || 'Operator'}</span>
        </h2>
        <p className="mt-2 text-slate-500">
          Here's what's happening with your WhatsApp groups today.
        </p>
      </header>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 animate-slide-up">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className="stat-card hover-lift animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                <p className="text-4xl font-bold text-slate-800">
                  {isLoading ? (
                    <span className="skeleton inline-block w-20 h-10" />
                  ) : (
                    card.value.toLocaleString()
                  )}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.iconBg}`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
              <TrendingUp className="w-3 h-3" />
              <span>Live tracking</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WhatsApp Connection */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-300">
           <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Connection Status</h3>
              <p className="text-sm text-slate-500">Manage your WhatsApp link</p>
            </div>
          </div>
          <QRCodeScanner />
        </div>

        {/* Media Distribution Chart */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Media Distribution</h3>
              <p className="text-sm text-slate-500">Breakdown by file type</p>
            </div>
            <span className="pill">
              {stats.totalMedia} files
            </span>
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="skeleton w-48 h-48 rounded-full" />
            </div>
          ) : pieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
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
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              No media data available
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-600">{item.name}</span>
                <span className="text-slate-400 ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel rounded-[28px] p-6 animate-slide-up delay-400">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Quick Stats</h3>
              <p className="text-sm text-slate-500">System overview</p>
            </div>
            <span className="pill status-online">Live</span>
          </div>

          <div className="space-y-4">
            {/* Total Groups */}
            <div className="glass-card !p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Total Groups</p>
                  <p className="text-xs text-slate-500">All registered groups</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-violet-600">
                {isLoading ? '-' : stats.totalGroups}
              </p>
            </div>

            {/* Monitored Groups */}
            <div className="glass-card !p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Monitored</p>
                  <p className="text-xs text-slate-500">Actively tracking</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {isLoading ? '-' : stats.monitoredGroups}
              </p>
            </div>

            {/* Media by Type Quick View */}
            <div className="glass-card !p-4">
              <p className="text-sm font-medium text-slate-800 mb-3">Media Types</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.mediaByType).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${mediaTypeColors[type]}15`,
                      color: mediaTypeColors[type],
                    }}
                  >
                    {mediaTypeIcons[type]}
                    <span className="capitalize">{type}</span>
                    <span className="opacity-70">({count})</span>
                  </div>
                ))}
                {Object.keys(stats.mediaByType).length === 0 && !isLoading && (
                  <span className="text-slate-400 text-xs">No media yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
