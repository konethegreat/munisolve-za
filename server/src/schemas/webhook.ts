import { z } from 'zod';
import { WEBHOOK_EVENTS, parseWebhookUrl } from '../domain/webhook';

export const webhookEventSchema = z.enum([...WEBHOOK_EVENTS, '*'] as [string, ...string[]]);

export const webhookUrlSchema = z
  .string()
  .trim()
  .min(10)
  .max(500)
  .superRefine((value, context) => {
    const result = parseWebhookUrl(value);
    if ('reason' in result) {
      context.addIssue({ code: 'custom', message: `Webhook URL rejected: ${result.reason}` });
    }
  });

export const webhookCreateSchema = z.object({
  url: webhookUrlSchema,
  events: z.array(webhookEventSchema).min(1).max(6),
  description: z.string().trim().max(200).optional(),
});

export const webhookUpdateSchema = z
  .object({
    url: webhookUrlSchema.optional(),
    events: z.array(webhookEventSchema).min(1).max(6).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update.' });
