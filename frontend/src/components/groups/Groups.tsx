import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api/ApiClient';
import { Users, Radio, Loader2, Eye, UserCheck, Circle } from 'lucide-react';

interface GroupRow {
  id: string;
  name: string;
  whatsapp_id: string;
  is_monitored: boolean;
  participant_count: number;
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

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

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

  const toggleMonitor = async (group: GroupRow) => {
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
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update group');
    } finally {
      setIsUpdating((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const monitoredCount = groups.filter((g) => g.is_monitored).length;
  const totalParticipants = groups.reduce((sum, g) => sum + g.participant_count, 0);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <Users className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Directory</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Groups</h2>
        <p className="mt-2 text-slate-500">
          Manage monitoring status for your WhatsApp groups.
        </p>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-slide-up delay-100">
        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{groups.length}</p>
            <p className="text-sm text-slate-500">Total Groups</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Eye className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{monitoredCount}</p>
            <p className="text-sm text-slate-500">Monitored</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-fuchsia-100 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-fuchsia-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-fuchsia-600">{totalParticipants}</p>
            <p className="text-sm text-slate-500">Total Members</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 animate-slide-up">
          {error}
        </div>
      )}

      {/* Groups Grid */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-200">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <p className="text-slate-500">No groups found.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group, index) => (
            <div
              key={group.id}
              className="glass-card hover-lift animate-slide-up"
              style={{ animationDelay: `${(index + 3) * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Group Info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-200/50">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{group.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 break-all">{group.whatsapp_id}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                    group.is_monitored
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {group.is_monitored ? (
                    <>
                      <Radio className="w-3 h-3" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3 h-3" />
                      <span>Idle</span>
                    </>
                  )}
                </div>
              </div>

              {/* Participants & Action */}
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(3, group.participant_count))].map((_, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                      >
                        {i + 1}
                      </div>
                    ))}
                    {group.participant_count > 3 && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-600 text-xs font-medium">
                        +{group.participant_count - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-slate-500">
                    {group.participant_count} members
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleMonitor(group)}
                  disabled={isUpdating[group.id]}
                  className={`transition-all duration-300 ${
                    group.is_monitored
                      ? 'glass-button !border-rose-200 hover:!border-rose-300 !text-rose-600'
                      : 'glass-button-solid'
                  } ${isUpdating[group.id] ? 'opacity-60' : ''}`}
                >
                  {isUpdating[group.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : group.is_monitored ? (
                    <>
                      <Circle className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 mr-2" />
                      Monitor
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Groups;
