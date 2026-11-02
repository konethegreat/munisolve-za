import { z } from 'zod';

export const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens and apostrophes');

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^(\+?27|0)[0-9]{9}$/.test(value), 'Please provide a valid South African phone number');

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol'),
  phone: z.preprocess((value) => (value === '' || value === null ? undefined : value), phoneSchema.optional()),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export const sendVerificationSchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'Code must be six digits'),
});
