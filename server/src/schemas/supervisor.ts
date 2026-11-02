import { z } from 'zod';
import { coordinate, paginationSchema } from './common';

export const triageQuerySchema = paginationSchema.extend({
  category: z.string().trim().min(2).max(120).optional(),
  municipality: z.string().trim().min(2).max(120).optional(),
});

export const activeReportsQuerySchema = paginationSchema.extend({
  status: z.enum(['ASSIGNED', 'IN_PROGRESS']).optional(),
  teamId: z.coerce.number().int().positive().optional(),
});

export const teamsQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

const teamFields = {
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100),
  specialization: z.string().trim().min(2, 'Specialization must be at least 2 characters').max(100),
  municipality: z.string().trim().min(2).max(120).optional(),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
};

export const teamCreateSchema = z.object({
  ...teamFields,
  isActive: z.boolean().optional(),
});

export const teamUpdateSchema = z
  .object({
    ...teamFields,
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });
