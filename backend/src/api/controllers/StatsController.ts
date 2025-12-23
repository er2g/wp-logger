import { Response } from 'express';
import { AuthRequest, StatsQuery } from '../../types/api.types';
import groupRepository from '../../services/database/repositories/GroupRepository';
import messageRepository from '../../services/database/repositories/MessageRepository';
import fileStorageService from '../../services/storage/FileStorage';
import { pool } from '../../config/database';
import logger from '../../utils/logger';

export class StatsController {
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { groupId, startDate, endDate } = req.query as StatsQuery;

      // Build date conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (groupId) {
        conditions.push(`group_id = $${paramIndex++}`);
        params.push(groupId);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        params.push(new Date(startDate));
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        params.push(new Date(endDate));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Parallel queries for performance
      const [
        totalMessagesResult,
        totalMediaResult,
        groupsResult,
        messagesByTypeResult,
        mediaByTypeResult,
        messagesPerDayResult,
        messagesByHourResult,
        topSendersResult,
        storageStats,
      ] = await Promise.all([
        // Total messages
        pool.query(`SELECT COUNT(*) FROM messages ${whereClause}`, params),

        // Total media
        pool.query(
          `SELECT COUNT(*) FROM media m
           ${groupId ? 'WHERE m.group_id = $1' : ''}`,
          groupId ? [groupId] : []
        ),

        // Groups stats
        groupRepository.findAll(),

        // Messages by type
        pool.query(
          `SELECT message_type, COUNT(*) as count FROM messages ${whereClause} GROUP BY message_type`,
          params
        ),

        // Media by type
        pool.query(
          `SELECT media_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
           FROM media m
           ${groupId ? 'WHERE m.group_id = $1' : ''}
           GROUP BY media_type`,
          groupId ? [groupId] : []
        ),

        // Messages per day (last 30 days)
        pool.query(
          `SELECT DATE(timestamp) as date, COUNT(*) as count
           FROM messages ${whereClause}
           GROUP BY DATE(timestamp)
           ORDER BY date DESC
           LIMIT 30`,
          params
        ),

        // Messages by hour of day
        pool.query(
          `SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
           FROM messages ${whereClause}
           GROUP BY hour
           ORDER BY hour`,
          params
        ),

        // Top senders
        pool.query(
          `SELECT sender_name, sender_number, COUNT(*) as message_count,
                  SUM(CASE WHEN has_media THEN 1 ELSE 0 END) as media_count,
                  MAX(timestamp) as last_message_at
           FROM messages ${whereClause}
           GROUP BY sender_name, sender_number
           ORDER BY message_count DESC
           LIMIT 15`,
          params
        ),

        // Storage stats
        fileStorageService.getStorageStats ? fileStorageService.getStorageStats() : Promise.resolve({ totalSize: 0 }),
      ]);

      // Today and this week counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const [todayResult, weekResult, monthResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FROM messages WHERE timestamp >= $1`,
          [today]
        ),
        pool.query(
          `SELECT COUNT(*) FROM messages WHERE timestamp >= $1`,
          [weekAgo]
        ),
        pool.query(
          `SELECT COUNT(*) FROM messages WHERE timestamp >= $1`,
          [monthAgo]
        ),
      ]);

      // Process results
      const messagesByType: Record<string, number> = {};
      messagesByTypeResult.rows.forEach((row: any) => {
        messagesByType[row.message_type] = parseInt(row.count, 10);
      });

      const mediaByType: Record<string, number> = {};
      const storageByType: Record<string, number> = {};
      mediaByTypeResult.rows.forEach((row: any) => {
        mediaByType[row.media_type] = parseInt(row.count, 10);
        storageByType[row.media_type] = parseInt(row.total_size, 10) || 0;
      });

      const activityByDay = messagesPerDayResult.rows.map((row: any) => ({
        date: row.date.toISOString().split('T')[0],
        message_count: parseInt(row.count, 10),
        media_count: 0, // Would need a join to get this
      }));

      const activityByHour = new Array(24).fill(0);
      messagesByHourResult.rows.forEach((row: any) => {
        activityByHour[parseInt(row.hour, 10)] = parseInt(row.count, 10);
      });

      const topSenders = topSendersResult.rows.map((row: any) => ({
        sender_name: row.sender_name,
        sender_number: row.sender_number,
        message_count: parseInt(row.message_count, 10),
        media_count: parseInt(row.media_count, 10),
        last_message_at: row.last_message_at,
      }));

      const stats = {
        totalMessages: parseInt(totalMessagesResult.rows[0].count, 10),
        totalMedia: parseInt(totalMediaResult.rows[0].count, 10),
        totalGroups: groupsResult.length,
        monitoredGroups: groupsResult.filter((g: any) => g.is_monitored).length,
        dmCount: groupsResult.filter((g: any) => g.chat_type === 'dm').length,
        groupCount: groupsResult.filter((g: any) => g.chat_type === 'group').length,
        messagesToday: parseInt(todayResult.rows[0].count, 10),
        messagesThisWeek: parseInt(weekResult.rows[0].count, 10),
        messagesThisMonth: parseInt(monthResult.rows[0].count, 10),
        totalStorageBytes: storageStats.totalSize,
        messagesByType,
        mediaByType,
        storageByType,
        activityByDay,
        activityByHour,
        topSenders,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get stats failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  }

  async getGroupStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const group = await groupRepository.findById(id);
      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Group not found',
        });
        return;
      }

      const [
        messageStats,
        mediaCountResult,
        storageSizeResult,
        topSendersResult,
        messagesByTypeResult,
        activityResult,
      ] = await Promise.all([
        messageRepository.getStats(id),
        pool.query('SELECT COUNT(*) FROM media WHERE group_id = $1', [id]),
        pool.query('SELECT COALESCE(SUM(file_size), 0) as total FROM media WHERE group_id = $1', [id]),
        pool.query(
          `SELECT sender_name, sender_number, COUNT(*) as message_count,
                  SUM(CASE WHEN has_media THEN 1 ELSE 0 END) as media_count,
                  MAX(timestamp) as last_message_at
           FROM messages WHERE group_id = $1
           GROUP BY sender_name, sender_number
           ORDER BY message_count DESC
           LIMIT 10`,
          [id]
        ),
        pool.query(
          `SELECT message_type, COUNT(*) as count FROM messages WHERE group_id = $1 GROUP BY message_type`,
          [id]
        ),
        pool.query(
          `SELECT DATE(timestamp) as date, COUNT(*) as count
           FROM messages WHERE group_id = $1
           GROUP BY DATE(timestamp)
           ORDER BY date DESC
           LIMIT 14`,
          [id]
        ),
      ]);

      const messageTypeDistribution: Record<string, number> = {};
      messagesByTypeResult.rows.forEach((row: any) => {
        messageTypeDistribution[row.message_type] = parseInt(row.count, 10);
      });

      const stats = {
        ...group,
        totalMessages: messageStats.total,
        messagesWithMedia: messageStats.byType['image'] || 0 + messageStats.byType['video'] || 0,
        totalMediaFiles: parseInt(mediaCountResult.rows[0].count, 10),
        totalStorageBytes: parseInt(storageSizeResult.rows[0].total, 10) || 0,
        topSenders: topSendersResult.rows.map((row: any) => ({
          sender_name: row.sender_name,
          sender_number: row.sender_number,
          message_count: parseInt(row.message_count, 10),
          media_count: parseInt(row.media_count, 10),
          last_message_at: row.last_message_at,
        })),
        messageTypeDistribution,
        activityTrend: activityResult.rows.map((row: any) => ({
          date: row.date.toISOString().split('T')[0],
          message_count: parseInt(row.count, 10),
          media_count: 0,
        })),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get group stats failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get group stats',
      });
    }
  }

  async getActivityTimeline(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { days = '30', groupId } = req.query as { days?: string; groupId?: string };
      const numDays = Math.min(365, Math.max(1, parseInt(days, 10)));

      const params: any[] = [numDays];
      let groupCondition = '';
      if (groupId) {
        groupCondition = 'AND group_id = $2';
        params.push(groupId);
      }

      const result = await pool.query(
        `SELECT
           DATE(timestamp) as date,
           COUNT(*) as message_count,
           SUM(CASE WHEN has_media THEN 1 ELSE 0 END) as media_count,
           COUNT(DISTINCT sender_number) as unique_senders
         FROM messages
         WHERE timestamp >= CURRENT_DATE - INTERVAL '1 day' * $1
         ${groupCondition}
         GROUP BY DATE(timestamp)
         ORDER BY date ASC`,
        params
      );

      res.json({
        success: true,
        data: result.rows.map((row: any) => ({
          date: row.date.toISOString().split('T')[0],
          messageCount: parseInt(row.message_count, 10),
          mediaCount: parseInt(row.media_count, 10),
          uniqueSenders: parseInt(row.unique_senders, 10),
        })),
      });
    } catch (error) {
      logger.error('Get activity timeline failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activity timeline',
      });
    }
  }
}

export default new StatsController();
