import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import apiClient from '../../services/api/ApiClient';
import {
  Settings as SettingsIcon, Wifi, WifiOff, RefreshCw, Shield, Clock,
  Server, Database, HardDrive, CheckCircle, AlertCircle, Info,
  Download, FileJson, FileText, FileSpreadsheet, Calendar, Filter,
  Loader2, Package, Zap, Archive, Users, UserPlus, Copy, Check,
  FileSearch, PlayCircle, XCircle, ListChecks, Sliders, Image,
  ToggleLeft, ToggleRight, CheckSquare, Square, ChevronDown, ChevronUp,
} from 'lucide-react';

interface BotStatusData {
  is_connected: boolean;
  last_connected: string | null;
  last_disconnected: string | null;
  error_message: string | null;
  phone_number: string | null;
  device_name: string | null;
}

interface BotStatusResponse {
  success: boolean;
  data: BotStatusData;
  error?: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface AdminUsersResponse {
  success: boolean;
  data: AdminUser[];
  error?: string;
}

interface OcrJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode: 'all' | 'missing' | 'failed';
  total_items: number;
  queued_items: number;
  processing_items: number;
  succeeded_items: number;
  failed_items: number;
  skipped_items: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
}

interface OcrJobListResponse {
  success: boolean;
  data: OcrJob[];
  error?: string;
}

interface OcrItem {
  id: string;
  media_id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'skipped';
  attempts: number;
  provider: string | null;
  language: string | null;
  error_message: string | null;
  file_name: string | null;
  media_type: string;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface OcrSettings {
  enabled: boolean;
  provider: string;
  fallbackProvider: string;
  language: string;
  concurrency: number;
  pollIntervalMs: number;
  maxAttempts: number;
  maxFileSizeMb: number;
}

interface OcrSettingsResponse {
  success: boolean;
  data: OcrSettings;
  error?: string;
}

interface OcrMediaItem {
  id: string;
  file_name: string | null;
  file_path: string | null;
  media_type: string;
  mime_type: string | null;
  group_id: string;
  group_name: string;
  created_at: string;
  has_ocr: boolean;
  ocr_status: string | null;
}

interface OcrMediaListResponse {
  success: boolean;
  data: OcrMediaItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

interface OcrItemsResponse {
  success: boolean;
  data: OcrItem[];
  error?: string;
}

const Settings: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [botStatus, setBotStatus] = useState<BotStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'html'>('json');
  const [exportGroup, setExportGroup] = useState<string>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportIncludeMedia, setExportIncludeMedia] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<'admin' | 'user'>('user');
  const [userIssueToken, setUserIssueToken] = useState(true);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [issuedTokenUser, setIssuedTokenUser] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [issuingTokenId, setIssuingTokenId] = useState<string | null>(null);

  // OCR state
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [ocrJobsLoading, setOcrJobsLoading] = useState(false);
  const [ocrMode, setOcrMode] = useState<'all' | 'missing' | 'failed'>('missing');
  const [selectedOcrJobId, setSelectedOcrJobId] = useState<string | null>(null);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);
  const [ocrItemsLoading, setOcrItemsLoading] = useState(false);
  const [ocrItemStatus, setOcrItemStatus] = useState<string>('all');

  // OCR Settings state
  const [ocrSettings, setOcrSettings] = useState<OcrSettings | null>(null);
  const [ocrSettingsLoading, setOcrSettingsLoading] = useState(false);
  const [ocrSettingsSaving, setOcrSettingsSaving] = useState(false);
  const [showOcrSettings, setShowOcrSettings] = useState(false);

  // OCR Media selection state
  const [ocrMediaList, setOcrMediaList] = useState<OcrMediaItem[]>([]);
  const [ocrMediaLoading, setOcrMediaLoading] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [ocrMediaGroup, setOcrMediaGroup] = useState<string>('all');
  const [ocrMediaType, setOcrMediaType] = useState<string>('all');
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  const loadBotStatus = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<BotStatusResponse>('/bot/status');
      if (response.success) {
        setBotStatus(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to load bot status');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load bot status');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: GroupOption[] }>('/groups');
      if (response.success) {
        setGroups(response.data);
      }
    } catch {
      // Ignore
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await apiClient.get<AdminUsersResponse>('/admin/users');
      if (response.success) {
        setUsers(response.data);
      }
    } catch {
      // Ignore
    } finally {
      setUsersLoading(false);
    }
  };

  const loadOcrJobs = async () => {
    setOcrJobsLoading(true);
    try {
      const response = await apiClient.get<OcrJobListResponse>('/ocr/jobs');
      if (response.success) {
        setOcrJobs(response.data);
        if (!selectedOcrJobId && response.data.length > 0) {
          setSelectedOcrJobId(response.data[0].id);
        }
      }
    } catch {
      // Ignore
    } finally {
      setOcrJobsLoading(false);
    }
  };

  const loadOcrSettings = async () => {
    setOcrSettingsLoading(true);
    try {
      const response = await apiClient.get<OcrSettingsResponse>('/ocr/settings');
      if (response.success) {
        setOcrSettings(response.data);
      }
    } catch {
      // Ignore
    } finally {
      setOcrSettingsLoading(false);
    }
  };

  const saveOcrSettings = async (updates: Partial<OcrSettings>) => {
    setOcrSettingsSaving(true);
    setError(null);
    try {
      const response = await apiClient.patch<OcrSettingsResponse>('/ocr/settings', updates);
      if (response.success) {
        setOcrSettings(response.data);
      } else {
        setError(response.error || 'Failed to update OCR settings');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update OCR settings');
    } finally {
      setOcrSettingsSaving(false);
    }
  };

  const loadOcrMedia = async () => {
    setOcrMediaLoading(true);
    try {
      const params: any = { limit: 100, ocrEligible: true };
      if (ocrMediaGroup !== 'all') {
        params.groupId = ocrMediaGroup;
      }
      if (ocrMediaType !== 'all') {
        params.mediaType = ocrMediaType;
      }
      const response = await apiClient.get<OcrMediaListResponse>('/media', params);
      if (response.success) {
        setOcrMediaList(response.data);
      }
    } catch {
      // Ignore
    } finally {
      setOcrMediaLoading(false);
    }
  };

  const handleOcrFromSelected = async () => {
    if (selectedMediaIds.size === 0) {
      setError('No media selected');
      return;
    }

    setError(null);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: { id: string; queued: number };
        error?: string;
      }>('/ocr/jobs/from-media', {
        mediaIds: Array.from(selectedMediaIds),
        mode: 'all',
      });

      if (!response.success || !response.data) {
        setError(response.error || 'Failed to start OCR job');
        return;
      }

      setSelectedMediaIds(new Set());
      setShowMediaSelector(false);
      await loadOcrJobs();
      setSelectedOcrJobId(response.data.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to start OCR job');
    }
  };

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  };

  const selectAllMedia = () => {
    setSelectedMediaIds(new Set(ocrMediaList.map((item) => item.id)));
  };

  const deselectAllMedia = () => {
    setSelectedMediaIds(new Set());
  };

  const loadOcrItems = async (jobId: string, statusFilter: string) => {
    setOcrItemsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await apiClient.get<OcrItemsResponse>(`/ocr/jobs/${jobId}/items`, params);
      if (response.success) {
        setOcrItems(response.data);
      }
    } catch {
      // Ignore
    } finally {
      setOcrItemsLoading(false);
    }
  };

  useEffect(() => {
    loadBotStatus();
    loadGroups();
    loadUsers();
    loadOcrJobs();
    loadOcrSettings();
  }, []);

  useEffect(() => {
    if (showMediaSelector) {
      loadOcrMedia();
    }
  }, [showMediaSelector, ocrMediaGroup, ocrMediaType]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOcrJobs();
      if (selectedOcrJobId) {
        loadOcrItems(selectedOcrJobId, ocrItemStatus);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedOcrJobId, ocrItemStatus]);

  useEffect(() => {
    if (selectedOcrJobId) {
      loadOcrItems(selectedOcrJobId, ocrItemStatus);
    }
  }, [selectedOcrJobId, ocrItemStatus]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    setError(null);

    try {
      const options: any = {
        format: exportFormat,
        includeMedia: exportIncludeMedia,
      };

      if (exportGroup !== 'all') {
        options.groupId = exportGroup;
      }
      if (exportStartDate) {
        options.startDate = new Date(exportStartDate);
      }
      if (exportEndDate) {
        options.endDate = new Date(exportEndDate);
      }

      const response = await apiClient.postBlob('/export', options);
      const fileName = `whatsapp-export-${Date.now()}.${exportFormat}`;
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setExportSuccess(`Export completed: ${fileName}`);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setIssuedToken(null);
    setIssuedTokenUser(null);
    setCopiedToken(false);
    setError(null);

    if (!userFormUsername.trim() || !userFormPassword.trim()) {
      setError('Username and password are required');
      return;
    }

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: { user: AdminUser; accessToken?: string };
        error?: string;
      }>('/admin/users', {
        username: userFormUsername.trim(),
        password: userFormPassword,
        role: userFormRole,
        issueToken: userIssueToken,
      });

      if (!response.success) {
        setError(response.error || 'Failed to create user');
        return;
      }

      if (response.data?.user) {
        setUsers((prev) => [response.data!.user, ...prev]);
      }

      if (response.data?.accessToken) {
        setIssuedToken(response.data.accessToken);
        setIssuedTokenUser(response.data.user.username);
      }

      setUserFormUsername('');
      setUserFormPassword('');
      setUserFormRole('user');
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    }
  };

  const handleStartOcrJob = async () => {
    setError(null);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: { id: string; queued: number };
        error?: string;
      }>('/ocr/jobs', { mode: ocrMode });

      if (!response.success || !response.data) {
        setError(response.error || 'Failed to start OCR job');
        return;
      }

      await loadOcrJobs();
      setSelectedOcrJobId(response.data.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to start OCR job');
    }
  };

  const handleCancelOcrJob = async (jobId: string) => {
    setError(null);
    try {
      const response = await apiClient.post<{ success: boolean; error?: string }>(
        `/ocr/jobs/${jobId}/cancel`
      );
      if (!response.success) {
        setError(response.error || 'Failed to cancel OCR job');
      }
      await loadOcrJobs();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel OCR job');
    }
  };

  const handleRetryOcrJob = async (jobId: string) => {
    setError(null);
    try {
      const response = await apiClient.post<{ success: boolean; error?: string }>(
        `/ocr/jobs/${jobId}/retry-failed`
      );
      if (!response.success) {
        setError(response.error || 'Failed to retry OCR job');
      }
      await loadOcrJobs();
      await loadOcrItems(jobId, ocrItemStatus);
    } catch (err: any) {
      setError(err?.message || 'Failed to retry OCR job');
    }
  };

  const handleIssueToken = async (userId: string, username: string) => {
    setIssuedToken(null);
    setIssuedTokenUser(null);
    setCopiedToken(false);
    setError(null);
    setIssuingTokenId(userId);

    try {
      const response = await apiClient.post<{
        success: boolean;
        data?: { accessToken: string };
        error?: string;
      }>(`/admin/users/${userId}/token`);

      if (!response.success || !response.data?.accessToken) {
        setError(response.error || 'Failed to issue token');
        return;
      }

      setIssuedToken(response.data.accessToken);
      setIssuedTokenUser(username);
    } catch (err: any) {
      setError(err?.message || 'Failed to issue token');
    } finally {
      setIssuingTokenId(null);
    }
  };

  const copyIssuedToken = async () => {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Ignore
    }
  };

  const activeOcrJob = selectedOcrJobId
    ? ocrJobs.find((job) => job.id === selectedOcrJobId) || null
    : null;

  const systemInfo = [
    { label: 'API Endpoint', value: apiClient.getBaseUrl(), icon: Server },
    { label: 'Session User', value: user?.username || 'Unknown', icon: Shield },
    { label: 'Session Type', value: user?.role ? user.role.toUpperCase() : 'Unknown', icon: CheckCircle },
    { label: 'Phone Number', value: botStatus?.phone_number || '-', icon: Zap },
    { label: 'Device', value: botStatus?.device_name || '-', icon: Package },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <SettingsIcon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Configuration</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Settings</h2>
        <p className="mt-2 text-slate-500">
          System status, export data, and configuration.
        </p>
      </header>

      {/* Bot Connection Status */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">WhatsApp Connection</h3>
            <p className="text-sm text-slate-500">Current bot status and health</p>
          </div>
          <button
            type="button"
            onClick={loadBotStatus}
            disabled={isLoading}
            className="glass-button !py-2"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card !p-4">
                <div className="skeleton w-24 h-4 mb-2" />
                <div className="skeleton w-32 h-6" />
              </div>
            ))}
          </div>
        ) : botStatus ? (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Connection Status */}
            <div className="glass-card !p-5">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    botStatus.is_connected ? 'bg-emerald-100' : 'bg-rose-100'
                  }`}
                >
                  {botStatus.is_connected ? (
                    <Wifi className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-7 h-7 text-rose-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-500">Connection Status</p>
                  <p
                    className={`text-xl font-bold ${
                      botStatus.is_connected ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {botStatus.is_connected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Last Connected */}
            <div className="glass-card !p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Connected</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {formatDate(botStatus.last_connected)}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {botStatus.error_message && (
              <div className="md:col-span-2 glass-card !p-5 !bg-rose-50/50 !border-rose-200">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rose-700">Last Error</p>
                    <p className="text-sm text-rose-600 mt-1">{botStatus.error_message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <p className="text-slate-500">Unable to load bot status</p>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Archive className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Export Data</h3>
            <p className="text-sm text-slate-500">Download your message archive</p>
          </div>
        </div>

        {exportSuccess && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {exportSuccess}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setExportFormat('json')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  exportFormat === 'json'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 hover:border-violet-300'
                }`}
              >
                <FileJson className="w-5 h-5" />
                <span className="text-xs font-medium">JSON</span>
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  exportFormat === 'csv'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 hover:border-violet-300'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="text-xs font-medium">CSV</span>
              </button>
              <button
                onClick={() => setExportFormat('html')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  exportFormat === 'html'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 hover:border-violet-300'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="text-xs font-medium">HTML</span>
              </button>
            </div>
          </div>

          {/* Group Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Select Chat
            </label>
            <select
              className="glass-select w-full"
              value={exportGroup}
              onChange={(e) => setExportGroup(e.target.value)}
            >
              <option value="all">All chats</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              className="glass-input w-full"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              className="glass-input w-full"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
            />
          </div>

          {/* Include Media Option */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={exportIncludeMedia}
                onChange={(e) => setExportIncludeMedia(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Include media metadata</p>
                <p className="text-xs text-slate-500">Add media file information to the export</p>
              </div>
            </label>
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="glass-button-solid !py-3 !px-6"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-250">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">User Management</h3>
            <p className="text-sm text-slate-500">Create users and issue access tokens</p>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
            <input
              type="text"
              className="glass-input w-full"
              value={userFormUsername}
              onChange={(e) => setUserFormUsername(e.target.value)}
              placeholder="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <input
              type="password"
              className="glass-input w-full"
              value={userFormPassword}
              onChange={(e) => setUserFormPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
            <select
              className="glass-select w-full"
              value={userFormRole}
              onChange={(e) => setUserFormRole(e.target.value === 'admin' ? 'admin' : 'user')}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <input
              id="issueToken"
              type="checkbox"
              checked={userIssueToken}
              onChange={(e) => setUserIssueToken(e.target.checked)}
              className="w-5 h-5 rounded-lg border-2 border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <label htmlFor="issueToken" className="text-sm text-slate-600">
              Issue access token
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="glass-button-solid !py-3 !px-6"
              disabled={usersLoading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </button>
          </div>
        </form>

        {issuedToken && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between gap-3">
            <div className="break-all">
              <span className="font-semibold mr-2">
                Token{issuedTokenUser ? ` for ${issuedTokenUser}` : ''}:
              </span>
              {issuedToken}
            </div>
            <button
              type="button"
              className="glass-button !py-2 !px-3"
              onClick={copyIssuedToken}
            >
              {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Existing Users</h4>
            <button
              type="button"
              onClick={loadUsers}
              className="glass-button !py-1.5"
              disabled={usersLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${usersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {users.length === 0 && !usersLoading ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : (
            <div className="space-y-2">
              {users.map((entry) => (
                <div key={entry.id} className="glass-card !p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{entry.username}</p>
                    <p className="text-xs text-slate-500">
                      Role: {entry.role.toUpperCase()} - {entry.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="glass-button !py-1.5 !px-3 !text-xs"
                      onClick={() => handleIssueToken(entry.id, entry.username)}
                      disabled={issuingTokenId === entry.id}
                    >
                      {issuingTokenId === entry.id ? 'Issuing...' : 'Issue token'}
                    </button>
                    <span className="text-xs text-slate-500">
                      Last login: {entry.last_login ? new Date(entry.last_login).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document OCR */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-280">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Document OCR</h3>
              <p className="text-sm text-slate-500">Scan documents and images into structured text</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowOcrSettings(!showOcrSettings)}
              className={`glass-button !py-2 ${showOcrSettings ? '!bg-blue-100 !border-blue-300' : ''}`}
            >
              <Sliders className="w-4 h-4 mr-2" />
              Settings
              {showOcrSettings ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => setShowMediaSelector(!showMediaSelector)}
              className={`glass-button !py-2 ${showMediaSelector ? '!bg-blue-100 !border-blue-300' : ''}`}
            >
              <Image className="w-4 h-4 mr-2" />
              Select Media
              {showMediaSelector ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>

        {/* OCR Settings Panel */}
        {showOcrSettings && ocrSettingsLoading && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
            <span className="text-sm text-slate-500">Loading OCR settings...</span>
          </div>
        )}
        {showOcrSettings && !ocrSettingsLoading && ocrSettings && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Performance Settings
            </h4>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Enabled Toggle */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">OCR Enabled</label>
                <button
                  type="button"
                  onClick={() => saveOcrSettings({ enabled: !ocrSettings.enabled })}
                  disabled={ocrSettingsSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                    ocrSettings.enabled
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  {ocrSettings.enabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {ocrSettings.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Concurrency */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Concurrency: {ocrSettings.concurrency}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={ocrSettings.concurrency}
                  onChange={(e) => saveOcrSettings({ concurrency: parseInt(e.target.value) })}
                  disabled={ocrSettingsSaving}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Poll Interval */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Poll Interval: {ocrSettings.pollIntervalMs / 1000}s
                </label>
                <input
                  type="range"
                  min="1000"
                  max="30000"
                  step="1000"
                  value={ocrSettings.pollIntervalMs}
                  onChange={(e) => saveOcrSettings({ pollIntervalMs: parseInt(e.target.value) })}
                  disabled={ocrSettingsSaving}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1s</span>
                  <span>30s</span>
                </div>
              </div>

              {/* Max File Size */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Max File Size: {ocrSettings.maxFileSizeMb}MB
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={ocrSettings.maxFileSizeMb}
                  onChange={(e) => saveOcrSettings({ maxFileSizeMb: parseInt(e.target.value) })}
                  disabled={ocrSettingsSaving}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1MB</span>
                  <span>100MB</span>
                </div>
              </div>

              {/* Max Attempts */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Max Attempts: {ocrSettings.maxAttempts}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={ocrSettings.maxAttempts}
                  onChange={(e) => saveOcrSettings({ maxAttempts: parseInt(e.target.value) })}
                  disabled={ocrSettingsSaving}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Language</label>
                <select
                  className="glass-select w-full !py-2"
                  value={ocrSettings.language}
                  onChange={(e) => saveOcrSettings({ language: e.target.value })}
                  disabled={ocrSettingsSaving}
                >
                  <option value="unk">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="tr">Turkish</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>

              {/* Provider Info */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-2">Provider</label>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-medium">
                    {ocrSettings.provider.toUpperCase()}
                  </span>
                  {ocrSettings.fallbackProvider && (
                    <>
                      <span className="text-slate-400">fallback:</span>
                      <span className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg">
                        {ocrSettings.fallbackProvider.toUpperCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {ocrSettingsSaving && (
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        )}

        {/* Media Selector Panel */}
        {showMediaSelector && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Select Media for OCR
            </h4>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                className="glass-select !py-2"
                value={ocrMediaGroup}
                onChange={(e) => setOcrMediaGroup(e.target.value)}
              >
                <option value="all">All groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                className="glass-select !py-2"
                value={ocrMediaType}
                onChange={(e) => setOcrMediaType(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="image">Images</option>
                <option value="document">Documents</option>
                <option value="sticker">Stickers</option>
              </select>

              <button
                type="button"
                onClick={loadOcrMedia}
                className="glass-button !py-2"
                disabled={ocrMediaLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${ocrMediaLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={selectAllMedia}
                  className="glass-button !py-2 !text-xs"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllMedia}
                  className="glass-button !py-2 !text-xs"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {ocrMediaLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading media...
              </div>
            ) : ocrMediaList.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No eligible media found.</p>
            ) : (
              <>
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {ocrMediaList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMediaSelection(item.id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition ${
                        selectedMediaIds.has(item.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      {selectedMediaIds.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {item.file_name || item.id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.media_type.toUpperCase()} · {item.group_name}
                          {item.has_ocr && (
                            <span className={`ml-2 ${item.ocr_status === 'succeeded' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              OCR: {item.ocr_status}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {selectedMediaIds.size} of {ocrMediaList.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleOcrFromSelected}
                    disabled={selectedMediaIds.size === 0}
                    className="glass-button-solid !py-2 !px-4"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    OCR Selected ({selectedMediaIds.size})
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Job Mode</label>
            <select
              className="glass-select w-full"
              value={ocrMode}
              onChange={(e) => setOcrMode(e.target.value as 'all' | 'missing' | 'failed')}
            >
              <option value="missing">Scan missing only</option>
              <option value="failed">Retry failed</option>
              <option value="all">Re-scan all</option>
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={handleStartOcrJob}
              className="glass-button-solid !py-3 !px-5"
              disabled={ocrJobsLoading}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Start OCR Job
            </button>
            <button
              type="button"
              onClick={loadOcrJobs}
              className="glass-button !py-3"
              disabled={ocrJobsLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${ocrJobsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="glass-card !p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Recent Jobs</h4>
              <span className="text-xs text-slate-400">{ocrJobs.length} total</span>
            </div>

            {ocrJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No OCR jobs yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ocrJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedOcrJobId(job.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                      selectedOcrJobId === job.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {job.mode.toUpperCase()} · {job.status.toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        <p>{job.succeeded_items}/{job.total_items} done</p>
                        <p>Queued: {job.queued_items}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card !p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Selected Job</h4>
              {activeOcrJob && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="glass-button !py-1.5 !px-3 !text-xs"
                    onClick={() => handleRetryOcrJob(activeOcrJob.id)}
                  >
                    <ListChecks className="w-3.5 h-3.5 mr-1.5" />
                    Retry Failed
                  </button>
                  <button
                    type="button"
                    className="glass-button !py-1.5 !px-3 !text-xs"
                    onClick={() => handleCancelOcrJob(activeOcrJob.id)}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {!activeOcrJob ? (
              <p className="text-sm text-slate-500">Select a job to see details.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Status: {activeOcrJob.status.toUpperCase()}</span>
                  <span>Mode: {activeOcrJob.mode.toUpperCase()}</span>
                </div>
                <div className="grid gap-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Queued</span>
                    <span>{activeOcrJob.queued_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processing</span>
                    <span>{activeOcrJob.processing_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Succeeded</span>
                    <span>{activeOcrJob.succeeded_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed</span>
                    <span>{activeOcrJob.failed_items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skipped</span>
                    <span>{activeOcrJob.skipped_items}</span>
                  </div>
                </div>
                {activeOcrJob.last_error && (
                  <p className="text-xs text-rose-500 mt-2">{activeOcrJob.last_error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {activeOcrJob && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Queue Items</h4>
              <select
                className="glass-select !py-2"
                value={ocrItemStatus}
                onChange={(e) => setOcrItemStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>

            {ocrItemsLoading ? (
              <p className="text-sm text-slate-400">Loading OCR items...</p>
            ) : ocrItems.length === 0 ? (
              <p className="text-sm text-slate-500">No items for this filter.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ocrItems.map((item) => (
                  <div key={item.id} className="glass-card !p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {item.file_name || item.media_id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.media_type.toUpperCase()} · {item.status.toUpperCase()} · Attempts: {item.attempts}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{item.provider || '-'}</span>
                    </div>
                    {item.error_message && (
                      <p className="text-xs text-rose-500 mt-2">{item.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-300">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-800">System Information</h3>
          <p className="text-sm text-slate-500">Current session and connection details</p>
        </div>

        <div className="space-y-3">
          {systemInfo.map((item) => (
            <div
              key={item.label}
              className="glass-card !p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
              <span className="text-sm text-slate-600 font-mono bg-slate-100 px-3 py-1 rounded-lg">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Info */}
      <div className="glass-panel rounded-[24px] p-6 animate-slide-up delay-400">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Storage</h3>
          <p className="text-sm text-slate-500">Media and database information</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card !p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Media Storage</p>
                <p className="text-lg font-semibold text-slate-800">Active</p>
              </div>
            </div>
          </div>

          <div className="glass-card !p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Database</p>
                <p className="text-lg font-semibold text-slate-800">PostgreSQL</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className="text-center py-4 text-sm text-slate-400 animate-slide-up delay-500">
        WP Logger v2.0.0 &middot; Message Archive System
      </div>
    </div>
  );
};

export default Settings;
