import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import apiClient from '../../services/api/ApiClient';
import {
  Settings as SettingsIcon, Wifi, WifiOff, RefreshCw, Shield, Clock,
  Server, Database, HardDrive, CheckCircle, AlertCircle, Info,
  Download, FileJson, FileText, FileSpreadsheet, Calendar, Filter,
  Loader2, Package, Zap, Archive,
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

  useEffect(() => {
    loadBotStatus();
    loadGroups();
  }, []);

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

  const systemInfo = [
    { label: 'API Endpoint', value: apiClient.getBaseUrl(), icon: Server },
    { label: 'Session User', value: user?.username || 'Unknown', icon: Shield },
    { label: 'Session Type', value: 'Admin', icon: CheckCircle },
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

      {/* System Information */}
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
