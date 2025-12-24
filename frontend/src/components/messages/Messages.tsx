import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import apiClient from '../../services/api/ApiClient';
import webSocketService from '../../services/websocket/WebSocketService';
import {
  Download,
  Eye,
  MessageSquare,
  Search,
  X,
  Image,
  Video,
  Music,
  FileText,
  MapPin,
  User,
  Mic,
  Sticker,
  LayoutGrid,
  List,
  Copy,
  Check,
} from 'lucide-react';

interface MessageRow {
  id: string;
  group_id: string;
  sender_name: string | null;
  sender_number: string | null;
  content: string | null;
  message_type: string;
  timestamp: string;
  has_media: boolean;
}

interface GroupRow {
  id: string;
  name: string;
  whatsapp_id: string;
  participant_count: number;
  is_monitored: boolean;
}

interface MediaRow {
  id: string;
  message_id: string;
  file_name: string;
  file_size: string | number | null;
  mime_type: string | null;
  media_type: string;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}

interface MessagesResponse {
  success: boolean;
  data: MessageRow[];
  error?: string;
}

interface GroupsResponse {
  success: boolean;
  data: GroupRow[];
  error?: string;
}

interface MediaResponse {
  success: boolean;
  data: MediaRow[];
  error?: string;
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getRelativeDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatSize = (size: string | number | null) => {
  if (!size) return 'Unknown size';
  const bytes = typeof size === 'string' ? Number(size) : size;
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
};

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  text: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  image: { icon: <Image className="w-3.5 h-3.5" />, color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-200' },
  video: { icon: <Video className="w-3.5 h-3.5" />, color: 'text-fuchsia-700', bg: 'bg-fuchsia-100', border: 'border-fuchsia-200' },
  audio: { icon: <Music className="w-3.5 h-3.5" />, color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' },
  voice: { icon: <Mic className="w-3.5 h-3.5" />, color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
  ptt: { icon: <Mic className="w-3.5 h-3.5" />, color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
  document: { icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' },
  sticker: { icon: <Sticker className="w-3.5 h-3.5" />, color: 'text-pink-700', bg: 'bg-pink-100', border: 'border-pink-200' },
  contact: { icon: <User className="w-3.5 h-3.5" />, color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-200' },
  location: { icon: <MapPin className="w-3.5 h-3.5" />, color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
};

const Messages: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'admin';

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewMessage, setPreviewMessage] = useState<MessageRow | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [mediaCache, setMediaCache] = useState<Record<string, MediaRow[]>>({});
  const [mediaLoadingByMessage, setMediaLoadingByMessage] = useState<Record<string, boolean>>({});
  const [downloadLoadingByMedia, setDownloadLoadingByMedia] = useState<Record<string, boolean>>({});
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({});
  
  // New State for UI Enhancements
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>(isAdmin ? 'list' : 'list');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const subscribedGroupIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const messagesResponse = await apiClient.get<MessagesResponse>('/messages');
        if (!messagesResponse.success) {
          throw new Error(messagesResponse.error || 'Failed to load messages');
        }
        let groupData: GroupRow[] = [];
        if (isAdmin) {
          const groupsResponse = await apiClient.get<GroupsResponse>('/groups');
          if (!groupsResponse.success) {
            throw new Error(groupsResponse.error || 'Failed to load groups');
          }
          groupData = groupsResponse.data;
        }
        if (isMounted) {
          setMessages(messagesResponse.data);
          setGroups(groupData);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load messages');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    const monitoredGroupIds = groups
      .filter((group) => group.is_monitored)
      .map((group) => group.id);

    const applySubscriptions = () => {
      const current = subscribedGroupIdsRef.current;
      const next = new Set(monitoredGroupIds);

      const toSubscribe = monitoredGroupIds.filter((id) => !current.has(id));
      const toUnsubscribe = Array.from(current).filter((id) => !next.has(id));

      if (toSubscribe.length > 0) {
        webSocketService.subscribe(toSubscribe);
      }

      if (toUnsubscribe.length > 0) {
        webSocketService.unsubscribe(toUnsubscribe);
      }

      subscribedGroupIdsRef.current = next;
    };

    if (webSocketService.isConnected()) {
      applySubscriptions();
      return;
    }

    const handleAuthenticated = () => {
      applySubscriptions();
    };

    webSocketService.on('authenticated', handleAuthenticated);

    return () => {
      webSocketService.off('authenticated', handleAuthenticated);
    };
  }, [groups]);

  useEffect(() => {
    const handleNewMessage = (data: any) => {
      const newMessage: MessageRow = {
        id: data.id || data.whatsappMessageId,
        group_id: data.groupId,
        sender_name: data.senderName,
        sender_number: data.senderNumber,
        content: data.content,
        message_type: data.messageType,
        timestamp: data.timestamp,
        has_media: data.hasMedia,
      };

      setMessages((prev) => [newMessage, ...prev]);
    };

    webSocketService.on('message:new', handleNewMessage);

    return () => {
      webSocketService.off('message:new', handleNewMessage);
    };
  }, []);

  const groupLookup = useMemo(() => {
    return groups.reduce<Record<string, GroupRow>>((acc, group) => {
      acc[group.id] = group;
      return acc;
    }, {});
  }, [groups]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (selectedGroupId !== 'all' && message.group_id !== selectedGroupId) {
        return false;
      }
      if (selectedType !== 'all' && message.message_type !== selectedType) {
        return false;
      }
      // In gallery mode, only show messages with media
      if (viewMode === 'gallery' && !message.has_media) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const search = searchQuery.toLowerCase();
      const content = message.content?.toLowerCase() || '';
      const sender = message.sender_name?.toLowerCase() || '';
      const number = message.sender_number?.toLowerCase() || '';
      return content.includes(search) || sender.includes(search) || number.includes(search);
    });
  }, [messages, selectedGroupId, selectedType, searchQuery, viewMode]);

  // Group messages by Date for List View
  const messagesByDate = useMemo(() => {
    return filteredMessages.reduce<Record<string, MessageRow[]>>((acc, message) => {
      const dateKey = getRelativeDate(message.timestamp);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(message);
      return acc;
    }, {});
  }, [filteredMessages]);

  const mediaBaseUrl = apiClient.getBaseUrl();

  const extractFileName = (contentDisposition?: string): string | null => {
    if (!contentDisposition) return null;
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return match ? match[1] : null;
  };

  const downloadMediaFile = async (media: MediaRow) => {
    if (!isAdmin) {
      return;
    }
    setDownloadLoadingByMedia((prev) => ({ ...prev, [media.id]: true }));
    try {
      const response = await apiClient.getBlob('/media/' + media.id + '/download');
      const headerName = extractFileName(response.headers['content-disposition']);
      const fileName = headerName || media.file_name || 'attachment-' + media.id;
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download media:', err);
    } finally {
      setDownloadLoadingByMedia((prev) => ({ ...prev, [media.id]: false }));
    }
  };

  const fetchMediaForMessage = async (messageId: string) => {
    if (!isAdmin) {
      return [];
    }
    if (mediaCache[messageId]) {
      return mediaCache[messageId];
    }

    setMediaLoadingByMessage((prev) => ({ ...prev, [messageId]: true }));
    try {
      const response = await apiClient.get<MediaResponse>('/media', { messageId });
      if (!response.success) {
        throw new Error(response.error || 'Failed to load media');
      }
      setMediaCache((prev) => ({ ...prev, [messageId]: response.data }));
      return response.data;
    } catch (err) {
      setMediaCache((prev) => ({ ...prev, [messageId]: [] }));
      return [];
    } finally {
      setMediaLoadingByMessage((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const toggleAttachments = async (message: MessageRow) => {
    if (!isAdmin) {
      return;
    }
    const isExpanded = Boolean(expandedMessageIds[message.id]);
    if (isExpanded) {
      setExpandedMessageIds((prev) => ({ ...prev, [message.id]: false }));
      return;
    }

    await fetchMediaForMessage(message.id);
    setExpandedMessageIds((prev) => ({ ...prev, [message.id]: true }));
  };

  const openPreview = async (message: MessageRow) => {
    if (!isAdmin) {
      return;
    }
    setPreviewMessage(message);
    setPreviewLoading(true);
    try {
      const media = await fetchMediaForMessage(message.id);
      setPreviewMedia(media);
    } catch (err) {
      setPreviewMedia([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewMessage(null);
    setPreviewMedia([]);
  };

  const downloadTextMessage = (message: MessageRow) => {
    const payload = {
      id: message.id,
      sender: message.sender_name,
      senderNumber: message.sender_number,
      content: message.content,
      messageType: message.message_type,
      timestamp: message.timestamp,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `message-${message.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getTypeConfig = (type: string) => typeConfig[type] || typeConfig.text;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Archive</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Messages</h2>
            <p className="mt-2 text-slate-500">
              Browse, search, and download messages from all monitored groups.
            </p>
          </div>
          
          {/* View Mode Toggle */}
          {isAdmin && (
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center">
               <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list' 
                      ? 'bg-violet-100 text-violet-700 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="List View"
               >
                 <List className="w-5 h-5" />
               </button>
               <button
                  onClick={() => setViewMode('gallery')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'gallery' 
                      ? 'bg-violet-100 text-violet-700 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Gallery View"
               >
                 <LayoutGrid className="w-5 h-5" />
               </button>
            </div>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="glass-panel rounded-[24px] p-5 animate-slide-up delay-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Group Pills */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`pill transition-all duration-300 ${
                  selectedGroupId === 'all'
                    ? '!bg-violet-500 !text-white !border-violet-500'
                    : 'hover:border-violet-300'
                }`}
                onClick={() => setSelectedGroupId('all')}
              >
                All groups
              </button>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`pill transition-all duration-300 ${
                    selectedGroupId === group.id
                      ? '!bg-violet-500 !text-white !border-violet-500'
                      : 'hover:border-violet-300'
                  }`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}

          {/* Search & Type Filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <select
                className="glass-select min-w-[140px]"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="all">All types</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="voice">Voice</option>
                <option value="ptt">Voice note</option>
                <option value="document">Document</option>
                <option value="sticker">Sticker</option>
                <option value="location">Location</option>
                <option value="contact">Contact</option>
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
              <input
                type="text"
                className="glass-input pl-11 !py-2.5 min-w-[220px]"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 animate-slide-up">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="glass-panel rounded-[24px] p-8 text-center">
          <div className="skeleton w-32 h-6 mx-auto mb-4" />
          <div className="skeleton w-48 h-4 mx-auto" />
        </div>
      )}

      {/* No Messages */}
      {!isLoading && filteredMessages.length === 0 && (
        <div className="glass-panel rounded-[24px] p-12 text-center animate-slide-up">
          {viewMode === 'gallery' ? (
             <Image className="w-12 h-12 text-violet-300 mx-auto mb-4" />
          ) : (
             <MessageSquare className="w-12 h-12 text-violet-300 mx-auto mb-4" />
          )}
          <p className="text-slate-500">
            {viewMode === 'gallery' ? 'No media found matching current filters.' : 'No messages match the current filters.'}
          </p>
        </div>
      )}

      {/* GALLERY VIEW */}
      {!isLoading && viewMode === 'gallery' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-slide-up">
          {filteredMessages.map((message) => {
             const config = getTypeConfig(message.message_type);
             return (
               <div 
                 key={message.id} 
                 className="glass-card group relative cursor-pointer overflow-hidden !p-0 aspect-square flex flex-col items-center justify-center bg-white hover:shadow-lg transition-all"
                 onClick={() => openPreview(message)}
               >
                 <div className={`absolute top-2 right-2 z-10 p-1.5 rounded-full ${config.bg} ${config.color} text-xs shadow-sm`}>
                   {config.icon}
                 </div>
                 
                 {/* Placeholder for thumbnail since we fetch media on demand. 
                     In a real optimized app, we'd fetch thumbnails in batch. 
                     For now, we show the type icon prominently. */}
                 <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <div className={`p-4 rounded-full ${config.bg} ${config.color}`}>
                      {config.icon}
                    </div>
                    <span className="text-xs font-medium text-slate-600 truncate w-full px-2">
                       {message.sender_name || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTime(message.timestamp)}
                    </span>
                 </div>
                 
                 <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 bg-white text-violet-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                      View
                    </span>
                 </div>
               </div>
             );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {!isLoading && viewMode === 'list' && (
        <div className="space-y-8">
          {Object.entries(messagesByDate).map(([dateLabel, dateMessages], index) => (
            <section
              key={dateLabel}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Date Sticky Header */}
              <div className="sticky top-0 z-10 py-4 flex items-center justify-center pointer-events-none">
                 <span className="bg-slate-100/90 backdrop-blur-sm border border-slate-200 text-slate-500 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                   {dateLabel}
                 </span>
              </div>

              <div className="space-y-2">
                {dateMessages.map((message) => {
                  const config = getTypeConfig(message.message_type);
                  return (
                    <div
                      key={message.id}
                      className="glass-card !p-3 hover:!bg-white/90 group transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Sender Info */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xs shadow-md shadow-violet-200">
                            {message.sender_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">
                                {message.sender_name || 'Unknown'}
                              </p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                {groupLookup[message.group_id]?.name || (isAdmin ? 'Unknown Group' : 'Group')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-slate-500 font-mono">{message.sender_number || ''}</p>
                              {message.sender_number && (
                                <button
                                  onClick={() => copyToClipboard(message.sender_number!, `number-${message.id}`)}
                                  className="text-slate-300 hover:text-violet-500 transition-colors"
                                  title="Copy Number"
                                >
                                  {copiedId === `number-${message.id}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Type Badge & Time */}
                        <div className="flex flex-col items-end gap-1">
                          <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${config.bg} ${config.color} ${config.border}`}
                          >
                            {config.icon}
                            <span className="capitalize">{message.message_type}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mt-2 pl-[44px] relative">
                        {message.content && (
                          <button
                            onClick={() => copyToClipboard(message.content!, 'content-' + message.id)}
                            className="absolute -left-7 top-0 p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="Copy Message"
                          >
                            {copiedId === 'content-' + message.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {message.content ? (
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 italic text-xs bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 w-fit">
                            {message.has_media ? 'Media attached' : 'No text content'}
                          </div>
                        )}

                        {isAdmin && message.has_media && (
                          <div className="mt-2">
                            <button
                              type="button"
                              className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                              onClick={() => toggleAttachments(message)}
                            >
                              {expandedMessageIds[message.id] ? 'Hide attachments' : 'Show attachments'}
                              {mediaCache[message.id]?.length ? ' (' + mediaCache[message.id].length + ')' : ''}
                            </button>

                            {expandedMessageIds[message.id] && (
                              <div className="mt-2 space-y-2">
                                {mediaLoadingByMessage[message.id] && (
                                  <p className="text-xs text-slate-400">Loading attachments...</p>
                                )}
                                {!mediaLoadingByMessage[message.id] && (mediaCache[message.id] || []).length === 0 && (
                                  <p className="text-xs text-slate-400">No attachments found.</p>
                                )}
                                {!mediaLoadingByMessage[message.id] && (mediaCache[message.id] || []).map((media) => (
                                  <div key={media.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-700 truncate" title={media.file_name}>
                                        {media.file_name}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {formatSize(media.file_size)} - {media.media_type}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className="glass-button !py-1 !px-2 !text-[11px]"
                                      onClick={() => downloadMediaFile(media)}
                                      disabled={downloadLoadingByMedia[media.id]}
                                    >
                                      {downloadLoadingByMedia[media.id] ? 'Downloading...' : 'Download'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-3 pl-[44px] flex items-center justify-between border-t border-slate-100/50 pt-2">
                        <div className="flex items-center gap-2">
                          {isAdmin && message.has_media && (
                            <button
                              type="button"
                              className="glass-button !py-1.5 !px-3 !text-xs bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                              onClick={() => openPreview(message)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              View Media
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="glass-button !py-1.5 !px-3 !text-xs"
                            onClick={() => downloadTextMessage(message)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            JSON
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Preview Modal (Unchanged logic, just keeping it here) */}
      {previewMessage && (
        <div className="modal-overlay animate-fade-in" onClick={closePreview}>
          <div
            className="glass-panel-strong rounded-[28px] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-violet-600 mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Media Preview</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  {previewMessage.sender_name || 'Unknown'}
                </h3>
                <p className="text-sm text-slate-500">{new Date(previewMessage.timestamp).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Content in Modal */}
            {previewMessage.content && (
              <div className="glass-card !p-4 mb-6 bg-slate-50/50">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{previewMessage.content}</p>
              </div>
            )}

            {/* Media Loading */}
            {previewLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              </div>
            )}

            {/* No Media */}
            {!previewLoading && previewMedia.length === 0 && (
              <div className="text-center py-12">
                <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No media attached to this message.</p>
              </div>
            )}

            {/* Media Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {previewMedia.map((media) => {
                
                const streamUrl = `${mediaBaseUrl}/media/${media.id}/stream`;
                const thumbUrl = `${mediaBaseUrl}/media/${media.id}/thumbnail`;
                const isImage = media.media_type === 'image' || media.mime_type?.startsWith('image/');
                const isVideo = media.media_type === 'video';
                const isAudio = media.media_type === 'audio' || media.media_type === 'voice';
                const isSticker = media.media_type === 'sticker';

                return (
                  <div key={media.id} className="glass-card !p-4">
                    {/* Media Info */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]" title={media.file_name}>
                          {media.file_name}
                        </p>
                        <p className="text-xs text-slate-500">{formatSize(media.file_size)}</p>
                      </div>
                      <span className={`pill ${getTypeConfig(media.media_type).bg} ${getTypeConfig(media.media_type).color}`}>
                        {media.media_type}
                      </span>
                    </div>

                    {/* Media Preview */}
                    <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      {(isImage || isSticker) && (
                        <img
                          src={thumbUrl}
                          alt={media.file_name}
                          className="w-full h-48 object-contain bg-slate-50/50 cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => downloadMediaFile(media)}
                        />
                      )}
                      {isVideo && (
                        <video
                          className="w-full h-48 object-cover"
                          controls
                          src={streamUrl}
                          poster={thumbUrl}
                        />
                      )}
                      {isAudio && (
                        <div className="p-4 flex items-center gap-4 h-48 justify-center flex-col">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
                            <Music className="w-6 h-6 text-white" />
                          </div>
                          <audio className="w-full max-w-[200px]" controls src={streamUrl} />
                        </div>
                      )}
                      {!isImage && !isVideo && !isAudio && !isSticker && (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400">
                          <FileText className="w-10 h-10 mb-2" />
                          <p className="text-sm">Preview not available</p>
                        </div>
                      )}
                    </div>

                    {/* Download Button */}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="glass-button-solid !py-2 !px-4 !text-sm w-full justify-center"
                        onClick={() => downloadMediaFile(media)}
                        disabled={downloadLoadingByMedia[media.id]}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {downloadLoadingByMedia[media.id] ? 'Downloading...' : 'Download'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
