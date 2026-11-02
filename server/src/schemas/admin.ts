import { z } from 'zod';
import { categorySchema, paginationSchema, reportStatusSchema, roleSchema } from './common';

export const adminReportsQuerySchema = paginationSchema.extend({
  status: reportStatusSchema.optional(),
  category: categorySchema.optional(),
  municipality: z.string().trim().min(2).max(120).optional(),
});

export const adminUsersQuerySchema = paginationSchema.extend({
  role: roleSchema.optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const adminActivityLogsQuerySchema = paginationSchema.extend({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entity: z.string().trim().min(1).max(50).optional(),
});

export const adminUserRoleSchema = z.object({
  role: roleSchema,
});

export const adminUserStatusSchema = z.object({
  isActive: z.boolean().optional(),
});
