import { Response } from 'express';
import { AuthRequest } from '../../types/api.types';
import { ExportOptions } from '../../types/database.types';
import messageRepository from '../../services/database/repositories/MessageRepository';
import mediaRepository from '../../services/database/repositories/MediaRepository';
import groupRepository from '../../services/database/repositories/GroupRepository';
import logger from '../../utils/logger';

export class ExportController {
  async exportMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const options = req.body as ExportOptions;
      const format = options.format || 'json';

      // Build filters
      const filters: any = {};
      if (options.groupId) {
        filters.groupId = options.groupId;
      }
      if (options.startDate) {
        filters.startDate = options.startDate.toISOString();
      }
      if (options.endDate) {
        filters.endDate = options.endDate.toISOString();
      }
      if (options.messageTypes && options.messageTypes.length > 0) {
        filters.type = options.messageTypes;
      }

      // Fetch messages with pagination (max 10000 for export)
      const result = await messageRepository.findWithPagination({
        ...filters,
        limit: '10000',
        page: '1',
      });

      // Get group info for enrichment
      const groups = await groupRepository.findAll();
      const groupMap = new Map(groups.map(g => [g.id, g]));

      // Enrich messages with group name
      const enrichedMessages = result.data.map(msg => ({
        ...msg,
        group_name: groupMap.get(msg.group_id)?.name || 'Unknown',
      }));

      // Get media if requested
      let mediaData: any[] = [];
      if (options.includeMedia) {
        const allMedia = await mediaRepository.findAll();
        const messageIds = new Set(result.data.map(m => m.id));
        mediaData = allMedia.filter(m => messageIds.has(m.message_id));
      }

      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="whatsapp-export-${Date.now()}.json"`);
          res.json({
            exportedAt: new Date().toISOString(),
            messageCount: enrichedMessages.length,
            messages: enrichedMessages,
            media: options.includeMedia ? mediaData : undefined,
          });
          break;

        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="whatsapp-export-${Date.now()}.csv"`);

          // CSV header
          const csvHeader = 'ID,Group,Sender Name,Sender Number,Content,Type,Timestamp,Has Media,Is Forwarded\n';

          // CSV rows
          const csvRows = enrichedMessages.map(msg => {
            const escapeCsv = (str: string | null) => {
              if (!str) return '';
              // Escape quotes and wrap in quotes if contains comma or newline
              const escaped = str.replace(/"/g, '""');
              if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
                return `"${escaped}"`;
              }
              return escaped;
            };

            return [
              msg.id,
              escapeCsv(msg.group_name),
              escapeCsv(msg.sender_name),
              escapeCsv(msg.sender_number),
              escapeCsv(msg.content),
              msg.message_type,
              msg.timestamp,
              msg.has_media,
              msg.is_forwarded,
            ].join(',');
          }).join('\n');

          res.send(csvHeader + csvRows);
          break;

        case 'html':
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Content-Disposition', `attachment; filename="whatsapp-export-${Date.now()}.html"`);

          const htmlContent = this.generateHtmlExport(enrichedMessages, mediaData, options);
          res.send(htmlContent);
          break;

        default:
          res.status(400).json({
            success: false,
            error: 'Invalid export format. Supported: json, csv, html',
          });
      }
    } catch (error) {
      logger.error('Export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export messages',
      });
    }
  }

  async exportGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const format = (req.query.format as string) || 'json';

      const group = await groupRepository.findById(id);
      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Group not found',
        });
        return;
      }

      const messages = await messageRepository.findByGroupId(id, 50000);
      const media = await mediaRepository.findByGroupId(id);

      const exportData = {
        exportedAt: new Date().toISOString(),
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          chatType: group.chat_type,
          participantCount: group.participant_count,
          lastMessageAt: group.last_message_at,
        },
        messageCount: messages.length,
        mediaCount: media.length,
        messages,
        media,
      };

      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${group.name.replace(/[^a-z0-9]/gi, '_')}-export-${Date.now()}.json"`
          );
          res.json(exportData);
          break;

        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${group.name.replace(/[^a-z0-9]/gi, '_')}-export-${Date.now()}.csv"`
          );

          const csvHeader = 'ID,Sender Name,Sender Number,Content,Type,Timestamp,Has Media\n';
          const csvRows = messages.map(msg => {
            const escapeCsv = (str: string | null) => {
              if (!str) return '';
              const escaped = str.replace(/"/g, '""');
              if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
                return `"${escaped}"`;
              }
              return escaped;
            };

            return [
              msg.id,
              escapeCsv(msg.sender_name),
              escapeCsv(msg.sender_number),
              escapeCsv(msg.content),
              msg.message_type,
              msg.timestamp,
              msg.has_media,
            ].join(',');
          }).join('\n');

          res.send(csvHeader + csvRows);
          break;

        default:
          res.status(400).json({
            success: false,
            error: 'Invalid format. Supported: json, csv',
          });
      }
    } catch (error) {
      logger.error('Export group failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export group',
      });
    }
  }

  private generateHtmlExport(messages: any[], media: any[], _options: ExportOptions): string {
    const mediaMap = new Map<string, any[]>();
    media.forEach(m => {
      if (!mediaMap.has(m.message_id)) {
        mediaMap.set(m.message_id, []);
      }
      mediaMap.get(m.message_id)!.push(m);
    });

    const messageHtml = messages.map(msg => {
      const msgMedia = mediaMap.get(msg.id) || [];
      const mediaHtml = msgMedia.length > 0
        ? `<div class="media">${msgMedia.map(m => `<span class="media-item">${m.file_name} (${m.media_type})</span>`).join('')}</div>`
        : '';

      return `
        <div class="message ${msg.message_type}">
          <div class="header">
            <span class="sender">${msg.sender_name || 'Unknown'}</span>
            <span class="number">${msg.sender_number || ''}</span>
            <span class="group">${msg.group_name}</span>
            <span class="time">${new Date(msg.timestamp).toLocaleString()}</span>
          </div>
          <div class="content">${msg.content || '<em>No text content</em>'}</div>
          ${mediaHtml}
          <div class="meta">
            <span class="type">${msg.message_type}</span>
            ${msg.is_forwarded ? '<span class="forwarded">Forwarded</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Export - ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #128C7E; margin-bottom: 20px; }
    .stats { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 20px; }
    .stat { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #128C7E; }
    .stat-label { font-size: 12px; color: #667781; }
    .message { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #128C7E; }
    .message.image { border-left-color: #8B5CF6; }
    .message.video { border-left-color: #D946EF; }
    .message.audio, .message.voice, .message.ptt { border-left-color: #F59E0B; }
    .message.document { border-left-color: #3B82F6; }
    .header { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; font-size: 13px; }
    .sender { font-weight: bold; color: #128C7E; }
    .number { color: #667781; font-family: monospace; }
    .group { background: #e7f8f4; color: #128C7E; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .time { color: #667781; margin-left: auto; }
    .content { color: #111b21; line-height: 1.5; white-space: pre-wrap; }
    .media { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
    .media-item { background: #f0f2f5; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .meta { margin-top: 8px; display: flex; gap: 10px; font-size: 11px; }
    .type { background: #128C7E; color: white; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; }
    .forwarded { background: #667781; color: white; padding: 2px 8px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>WhatsApp Export</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${messages.length}</div>
        <div class="stat-label">Messages</div>
      </div>
      <div class="stat">
        <div class="stat-value">${media.length}</div>
        <div class="stat-label">Media Files</div>
      </div>
      <div class="stat">
        <div class="stat-value">${new Date().toLocaleDateString()}</div>
        <div class="stat-label">Export Date</div>
      </div>
    </div>
    ${messageHtml}
  </div>
</body>
</html>
    `;
  }
}

export default new ExportController();
