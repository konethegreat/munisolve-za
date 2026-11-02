import { z } from 'zod';

export const REPORT_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;

export const ROLES = ['CITIZEN', 'WORKER_SUPERVISOR', 'MUNICIPAL_ADMIN', 'SUPER_ADMIN'] as const;

export const CATEGORIES = [
  'POTHOLE',
  'WATER_LEAK',
  'ELECTRICITY_OUTAGE',
  'REFUSE_COLLECTION',
  'STREETLIGHT',
  'SEWAGE',
  'ILLEGAL_DUMPING',
  'GRAFFITI',
  'PARK_MAINTENANCE',
  'TRAFFIC_LIGHT',
  'OTHER',
] as const;

export const reportStatusSchema = z.enum(REPORT_STATUSES);
export const roleSchema = z.enum(ROLES);
export const categorySchema = z.enum(CATEGORIES);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function coordinate(min: number, max: number) {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().min(min).max(max).optional(),
  );
}
