import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api/ApiClient';
import {
  Users, Radio, Loader2, Eye, Circle, Search,
  MessageSquare, Image, Download,
  MessageCircle, User,
} from 'lucide-react';

interface GroupRow {
  id: string;
  name: string;
  whatsapp_id: string;
  description: string | null;
  chat_type: 'group' | 'dm' | 'broadcast' | 'status' | 'channel';
  category: string | null;
  is_monitored: boolean;
  participant_count: number;
  last_message_at: string | null;
}

interface GroupStats {
  totalMessages: number;
  totalMediaFiles: number;
  totalStorageBytes: number;
  topSenders: Array<{ sender_name: string; message_count: number }>;
}

interface GroupsResponse {
  success: boolean;
  data: GroupRow[];
  error?: string;
}

interface GroupUpdateResponse {
  success: boolean;
  data: GroupRow;
  error?: string;
}

interface GroupStatsResponse {
  success: boolean;
  data: GroupStats;
  error?: string;
}

const chatTypeLabels: Record<string, string> = {
  group: 'Group',
  dm: 'Direct Message',
  broadcast: 'Broadcast',
  status: 'Status',
  channel: 'Channel',
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonitored, setFilterMonitored] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<GroupRow | null>(null);
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadGroups = async () => {
      try {
        const response = await apiClient.get<GroupsResponse>('/groups');
        if (!response.success) {
          throw new Error(response.error || 'Failed to load groups');
        }
        if (isMounted) {
          setGroups(response.data);
          setFilteredGroups(response.data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load groups');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadGroups();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let result = [...groups];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.whatsapp_id.toLowerCase().includes(query) ||
          g.description?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((g) => g.chat_type === filterType);
    }

    // Monitored filter
    if (filterMonitored === 'monitored') {
      result = result.filter((g) => g.is_monitored);
    } else if (filterMonitored === 'idle') {
      result = result.filter((g) => !g.is_monitored);
    }

    setFilteredGroups(result);
  }, [groups, searchQuery, filterType, filterMonitored]);

  const toggleMonitor = async (group: GroupRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating((prev) => ({ ...prev, [group.id]: true }));
    try {
      const response = await apiClient.put<GroupUpdateResponse>(`/groups/${group.id}`, {
        is_monitored: !group.is_monitored,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update group');
      }
      setGroups((prev) =>
        prev.map((item) => (item.id === group.id ? response.data : item))
      );
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(response.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update group');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const selectGroup = async (group: GroupRow) => {
    setSelectedGroup(group);
    setIsLoadingStats(true);
    try {
      const response = await apiClient.get<GroupStatsResponse>(`/stats/groups/${group.id}`);
      if (response.success) {
        setGroupStats(response.data);
      }
    } catch {
      setGroupStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const exportGroup = async (group: GroupRow, format: 'json' | 'csv') => {
    try {
      const response = await apiClient.getBlob(`/export/groups/${group.id}?format=${format}`);
      const fileName = `${group.name.replace(/[^a-z0-9]/gi, '_')}-export.${format}`;
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError('Failed to export group');
    }
  };

  const monitoredCount = groups.filter((g) => g.is_monitored).length;
  const dmCount = groups.filter((g) => g.chat_type === 'dm').length;
  const groupCount = groups.filter((g) => g.chat_type === 'group').length;

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <Users className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Directory</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Groups & Chats</h2>
            <p className="mt-2 text-slate-500">
              Manage monitoring status and explore chat details.
            </p>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-slide-up delay-100">
        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{groups.length}</p>
            <p className="text-xs text-slate-500">Total Chats</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Eye className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{monitoredCount}</p>
            <p className="text-xs text-slate-500">Monitored</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-fuchsia-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-fuchsia-600">{groupCount}</p>
            <p className="text-xs text-slate-500">Groups</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-600">{dmCount}</p>
            <p className="text-xs text-slate-500">Direct Messages</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-[24px] p-5 animate-slide-up delay-150">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
            <input
              type="text"
              className="glass-input pl-11 !py-2.5 w-full"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <select
              className="glass-select min-w-[140px]"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="group">Groups</option>
              <option value="dm">Direct Messages</option>
              <option value="broadcast">Broadcasts</option>
              <option value="channel">Channels</option>
            </select>

            <select
              className="glass-select min-w-[140px]"
              value={filterMonitored}
              onChange={(e) => setFilterMonitored(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="monitored">Monitored</option>
              <option value="idle">Idle</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 animate-slide-up">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up delay-200">
        {/* Groups List */}
        <div className="lg:col-span-2 glass-panel rounded-[24px] p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          )}

          {!isLoading && filteredGroups.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-violet-300 mx-auto mb-4" />
              <p className="text-slate-500">No groups match the current filters.</p>
            </div>
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredGroups.map((group, index) => (
              <div
                key={group.id}
                onClick={() => selectGroup(group)}
                className={`glass-card !p-4 cursor-pointer transition-all hover:!bg-violet-50/50 ${
                  selectedGroup?.id === group.id ? '!border-violet-300 !bg-violet-50/50' : ''
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Group Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-200/50 flex-shrink-0">
                      {group.chat_type === 'dm' ? (
                        <User className="w-5 h-5" />
                      ) : (
                        group.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">
                          {group.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {chatTypeLabels[group.chat_type] || group.chat_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{group.participant_count} members</span>
                        <span>&middot;</span>
                        <span>{formatDate(group.last_message_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                        group.is_monitored
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {group.is_monitored ? (
                        <>
                          <Radio className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-2.5 h-2.5" />
                          <span>Idle</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={(e) => toggleMonitor(group, e)}
                      disabled={isUpdating[group.id]}
                      className={`p-2 rounded-lg transition-all ${
                        group.is_monitored
                          ? 'text-rose-500 hover:bg-rose-50'
                          : 'text-emerald-500 hover:bg-emerald-50'
                      }`}
                      title={group.is_monitored ? 'Stop monitoring' : 'Start monitoring'}
                    >
                      {isUpdating[group.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : group.is_monitored ? (
                        <Circle className="w-4 h-4" />
                      ) : (
                        <Radio className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Group Details */}
        <div className="glass-panel rounded-[24px] p-6">
          {!selectedGroup ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-violet-300 mx-auto mb-4" />
              <p className="text-slate-500">Select a group to view details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group Header */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-violet-200/50">
                  {selectedGroup.chat_type === 'dm' ? (
                    <User className="w-8 h-8" />
                  ) : (
                    selectedGroup.name.charAt(0).toUpperCase()
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mt-4">{selectedGroup.name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">{selectedGroup.whatsapp_id}</p>
                {selectedGroup.description && (
                  <p className="text-sm text-slate-600 mt-2">{selectedGroup.description}</p>
                )}
              </div>

              {/* Quick Stats */}
              {isLoadingStats ? (
                <div className="space-y-3">
                  <div className="skeleton h-16 rounded-lg" />
                  <div className="skeleton h-16 rounded-lg" />
                </div>
              ) : groupStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card !p-3 text-center">
                    <MessageSquare className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-slate-800">
                      {groupStats.totalMessages.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">Messages</p>
                  </div>
                  <div className="glass-card !p-3 text-center">
                    <Image className="w-5 h-5 text-fuchsia-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-slate-800">
                      {groupStats.totalMediaFiles.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">Media</p>
                  </div>
                </div>
              ) : null}

              {/* Info Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Type</span>
                  <span className="text-sm font-medium text-slate-800">
                    {chatTypeLabels[selectedGroup.chat_type]}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Members</span>
                  <span className="text-sm font-medium text-slate-800">
                    {selectedGroup.participant_count}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Last Activity</span>
                  <span className="text-sm font-medium text-slate-800">
                    {formatDate(selectedGroup.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">Status</span>
                  <span
                    className={`text-sm font-medium ${
                      selectedGroup.is_monitored ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  >
                    {selectedGroup.is_monitored ? 'Monitoring' : 'Idle'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Link
                  to={`/messages?groupId=${selectedGroup.id}`}
                  className="glass-button-solid w-full justify-center !py-2.5"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  View Messages
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => exportGroup(selectedGroup, 'json')}
                    className="glass-button flex-1 justify-center !py-2"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    JSON
                  </button>
                  <button
                    onClick={() => exportGroup(selectedGroup, 'csv')}
                    className="glass-button flex-1 justify-center !py-2"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Groups;
