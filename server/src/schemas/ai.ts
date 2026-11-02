import { z } from 'zod';

export const aiChatSchema = z.object({
  reportId: z.coerce.number().int().positive(),
  message: z.string().trim().min(1, 'Message must be a non-empty string').max(2000, 'Message too long. Maximum 2000 characters allowed.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(20, 'History cannot contain more than 20 messages')
    .default([]),
});
