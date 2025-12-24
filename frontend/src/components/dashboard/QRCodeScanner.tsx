import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import webSocketService from '../../services/websocket/WebSocketService';
import apiClient from '../../services/api/ApiClient';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const QRCodeScanner: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'waiting_for_qr' | 'ready' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setStatus('waiting_for_qr');

    const fetchStatus = async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data?: {
            is_connected: boolean;
            error_message?: string | null;
            qr_code?: string | null;
          };
          error?: string;
        }>('/bot/status');

        if (!isMounted || !response.success || !response.data) {
          return;
        }

        if (response.data.is_connected) {
          setStatus('connected');
          setQrCode(null);
          setError(null);
          return;
        }

        if (response.data.qr_code) {
          setQrCode(response.data.qr_code);
          setStatus('ready');
          setError(null);
          return;
        }

        if (response.data.error_message) {
          setStatus('error');
          setError(response.data.error_message);
          return;
        }
      } catch {
        // Ignore, rely on websocket events
      }
    };

    fetchStatus();

    const handleQr = (data: { qr: string }) => {
      setQrCode(data.qr);
      setStatus('ready');
      setError(null);
    };

    const handleStatus = (data: { isConnected: boolean; error?: string }) => {
      if (data.isConnected) {
        setStatus('connected');
        setQrCode(null);
      } else {
        if (data.error) {
          setStatus('error');
          setError(data.error);
        } else {
          // Disconnected but maybe waiting for QR (re-auth flow)
          setStatus('waiting_for_qr');
        }
      }
    };

    webSocketService.on('bot:qr', handleQr);
    webSocketService.on('bot:status', handleStatus);

    return () => {
      isMounted = false;
      webSocketService.off('bot:qr', handleQr);
      webSocketService.off('bot:status', handleStatus);
    };
  }, []);

  if (status === 'connected') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-xl border border-green-100">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-green-800">WhatsApp Connected</h3>
        <p className="text-green-600 mt-2 text-center">
          The bot is successfully linked to your WhatsApp account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 max-w-sm mx-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Link WhatsApp Account</h3>
      
      <div className="relative flex items-center justify-center w-64 h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        {status === 'waiting_for_qr' && (
          <div className="flex flex-col items-center text-gray-400 animate-pulse">
            <Loader2 className="w-8 h-8 mb-2 animate-spin" />
            <span className="text-sm">Waiting for QR Code...</span>
          </div>
        )}

        {status === 'ready' && qrCode && (
          <div className="p-2 bg-white rounded-lg shadow-sm">
             <QRCodeSVG value={qrCode} size={240} level="L" includeMargin={true} />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-red-500 px-4 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Connection Error</span>
            <span className="text-xs mt-1 text-gray-500">{error || 'Failed to connect'}</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3 text-sm text-gray-600">
        <ol className="list-decimal list-inside space-y-2">
          <li>Open WhatsApp on your phone</li>
          <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
          <li>Tap on <strong>Link a Device</strong></li>
          <li>Point your phone to this screen to capture the code</li>
        </ol>
      </div>
      
      {status === 'ready' && (
        <p className="mt-4 text-xs text-center text-gray-400">
          The QR code updates automatically every few seconds.
        </p>
      )}
    </div>
  );
};
