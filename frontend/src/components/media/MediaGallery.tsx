import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api/ApiClient';
import {
  Image, Video, Music, FileText, Sticker, Loader2, Search,
  Grid, List, Download, X, ChevronLeft, ChevronRight, Play,
  ZoomIn, ZoomOut, HardDrive,
} from 'lucide-react';

interface MediaItem {
  id: string;
  message_id: string;
  group_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  media_type: 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document' | 'gif';
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  caption: string | null;
}

interface MediaResponse {
  success: boolean;
  data: MediaItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: string;
}

interface GroupOption {
  id: string;
  name: string;
}

const mediaTypeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Music className="w-5 h-5" />,
  voice: <Music className="w-5 h-5" />,
  sticker: <Sticker className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  gif: <Image className="w-5 h-5" />,
};

const mediaTypeColors: Record<string, string> = {
  image: 'text-violet-500 bg-violet-100',
  video: 'text-fuchsia-500 bg-fuchsia-100',
  audio: 'text-amber-500 bg-amber-100',
  voice: 'text-orange-500 bg-orange-100',
  sticker: 'text-pink-500 bg-pink-100',
  document: 'text-blue-500 bg-blue-100',
  gif: 'text-emerald-500 bg-emerald-100',
};

const formatBytes = (bytes: number | null): string => {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MediaGallery: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState<string>(searchParams.get('type') || 'all');
  const [filterGroup, setFilterGroup] = useState<string>(searchParams.get('groupId') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Groups for filter
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Load groups for filter
  useEffect(() => {
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
    loadGroups();
  }, []);

  // Load media
  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '48');
      if (filterType !== 'all') params.append('type', filterType);
      if (filterGroup !== 'all') params.append('groupId', filterGroup);

      const response = await apiClient.get<MediaResponse>(`/media?${params.toString()}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to load media');
      }
      setMedia(response.data);
      if (response.pagination) {
        setTotalPages(response.pagination.pages);
        setTotal(response.pagination.total);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load media');
    } finally {
      setIsLoading(false);
    }
  }, [page, filterType, filterGroup]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Filter by search locally
  const filteredMedia = searchQuery.trim()
    ? media.filter(m =>
        m.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.caption?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : media;

  // Lightbox navigation
  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setZoom(1);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setZoom(1);
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredMedia.length);
    setZoom(1);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredMedia.length) % filteredMedia.length);
    setZoom(1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, filteredMedia.length]);

  const downloadMedia = async (item: MediaItem) => {
    try {
      const response = await apiClient.getBlob(`/media/${item.id}/download`);
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = item.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Failed to download file');
    }
  };

  const getMediaUrl = (item: MediaItem, thumbnail = false) => {
    if (thumbnail && item.thumbnail_path) {
      return `${apiClient.getBaseUrl()}/media/${item.id}/thumbnail`;
    }
    return `${apiClient.getBaseUrl()}/media/${item.id}/stream`;
  };

  const currentItem = filteredMedia[currentIndex];

  // Stats
  const imageCount = media.filter(m => m.media_type === 'image').length;
  const videoCount = media.filter(m => m.media_type === 'video').length;
  const documentCount = media.filter(m => m.media_type === 'document').length;

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <header className="animate-slide-up">
        <div className="flex items-center gap-2 text-violet-600 mb-2">
          <Image className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Gallery</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Media Gallery</h2>
            <p className="mt-2 text-slate-500">
              Browse and manage all media files from your chats.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <HardDrive className="w-4 h-4" />
            <span>{total.toLocaleString()} files</span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up delay-100">
        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Image className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-violet-600">{imageCount}</p>
            <p className="text-xs text-slate-500">Images</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center">
            <Video className="w-5 h-5 text-fuchsia-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-fuchsia-600">{videoCount}</p>
            <p className="text-xs text-slate-500">Videos</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-blue-600">{documentCount}</p>
            <p className="text-xs text-slate-500">Documents</p>
          </div>
        </div>

        <div className="glass-card !p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{total}</p>
            <p className="text-xs text-slate-500">Total Files</p>
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
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="glass-select min-w-[130px]"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="voice">Voice</option>
              <option value="document">Documents</option>
              <option value="sticker">Stickers</option>
            </select>

            <select
              className="glass-select min-w-[150px]"
              value={filterGroup}
              onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }}
            >
              <option value="all">All chats</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex items-center border border-violet-200 rounded-lg p-1 bg-white/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-violet-100 text-violet-600' : 'text-slate-400'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-violet-100 text-violet-600' : 'text-slate-400'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMedia.length === 0 && (
        <div className="glass-panel rounded-[24px] p-12 text-center animate-slide-up">
          <Image className="w-16 h-16 text-violet-300 mx-auto mb-4" />
          <p className="text-slate-500">No media files found.</p>
        </div>
      )}

      {/* Grid View */}
      {!isLoading && filteredMedia.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-slide-up delay-200">
          {filteredMedia.map((item, index) => (
            <div
              key={item.id}
              onClick={() => ['image', 'gif', 'sticker'].includes(item.media_type) && openLightbox(index)}
              className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-violet-300 transition-all ${
                ['image', 'gif', 'sticker'].includes(item.media_type) ? 'cursor-pointer' : ''
              }`}
            >
              {/* Thumbnail */}
              {['image', 'gif', 'sticker'].includes(item.media_type) ? (
                <img
                  src={getMediaUrl(item, true)}
                  alt={item.file_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              ) : item.media_type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fuchsia-100 to-fuchsia-200">
                  <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 text-fuchsia-600 ml-0.5" />
                  </div>
                </div>
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${mediaTypeColors[item.media_type] || 'bg-slate-100'}`}>
                  {mediaTypeIcons[item.media_type] || <FileText className="w-8 h-8" />}
                </div>
              )}

              {/* Type Badge */}
              <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-semibold ${mediaTypeColors[item.media_type]} bg-opacity-90`}>
                {item.media_type}
              </div>

              {/* Duration for video/audio */}
              {item.duration && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                  {formatDuration(item.duration)}
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                <div className="p-3 w-full">
                  <p className="text-white text-xs font-medium truncate">{item.file_name}</p>
                  <p className="text-white/70 text-[10px]">{formatBytes(item.file_size)}</p>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={(e) => { e.stopPropagation(); downloadMedia(item); }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!isLoading && filteredMedia.length > 0 && viewMode === 'list' && (
        <div className="glass-panel rounded-[24px] overflow-hidden animate-slide-up delay-200">
          <div className="divide-y divide-slate-100">
            {filteredMedia.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 hover:bg-violet-50/50 transition-colors"
              >
                {/* Thumbnail */}
                <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden ${
                  ['image', 'gif', 'sticker'].includes(item.media_type) ? '' : mediaTypeColors[item.media_type]
                } flex items-center justify-center`}>
                  {['image', 'gif', 'sticker'].includes(item.media_type) ? (
                    <img
                      src={getMediaUrl(item, true)}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    mediaTypeIcons[item.media_type]
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.file_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="capitalize">{item.media_type}</span>
                    <span>{formatBytes(item.file_size)}</span>
                    {item.width && item.height && (
                      <span>{item.width}x{item.height}</span>
                    )}
                    {item.duration && (
                      <span>{formatDuration(item.duration)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => downloadMedia(item)}
                  className="glass-button !py-2 !px-3"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 animate-slide-up">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="glass-button !py-2 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-4 py-2 text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="glass-button !py-2 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && currentItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation */}
          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Image */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] overflow-auto"
          >
            <img
              src={getMediaUrl(currentItem)}
              alt={currentItem.file_name}
              className="max-w-full max-h-[85vh] object-contain transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.25)); }}
              className="p-2 rounded-lg text-white hover:bg-white/10"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)); }}
              className="p-2 rounded-lg text-white hover:bg-white/10"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/20" />
            <button
              onClick={(e) => { e.stopPropagation(); downloadMedia(currentItem); }}
              className="p-2 rounded-lg text-white hover:bg-white/10"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Info */}
          <div className="absolute bottom-4 right-4 text-white text-sm">
            {currentIndex + 1} / {filteredMedia.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
