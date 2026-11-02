import { z } from 'zod';
import {
  categorySchema,
  coordinate,
  paginationSchema,
  reportStatusSchema,
} from './common';

const reportFields = {
  title: z.string().trim().min(10, 'Title must be between 10 and 200 characters').max(200),
  description: z.string().trim().min(20, 'Description must be between 20 and 2000 characters').max(2000),
  category: categorySchema,
  municipality: z.string().trim().min(2, 'Municipality is required').max(120),
  address: z.string().trim().min(5, 'Address must be between 5 and 200 characters').max(200).optional(),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
};

export const createReportSchema = z.object(reportFields);

export const updateReportSchema = z
  .object(reportFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const reportStatusBodySchema = z.object({
  status: reportStatusSchema,
  note: z.string().trim().max(500).optional(),
});

export const reportListQuerySchema = paginationSchema.extend({
  status: reportStatusSchema.optional(),
  category: categorySchema.optional(),
  municipality: z.string().trim().min(2).max(120).optional(),
});
