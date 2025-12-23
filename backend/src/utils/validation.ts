import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(255, 'Username must be at most 255 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const messageFilterSchema = paginationSchema.extend({
  groupId: z.string().uuid().optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'voice', 'ptt']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().max(500).optional(),
});

export const mediaFilterSchema = paginationSchema.extend({
  groupId: z.string().uuid().optional(),
  type: z.enum(['image', 'video', 'audio', 'document']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const groupUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  is_monitored: z.boolean().optional(),
});

export function validateRequest<T>(schema: z.Schema<T>, data: unknown): T {
  return schema.parse(data);
}
