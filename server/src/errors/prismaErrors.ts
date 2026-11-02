import { AppError } from './AppError';

export function mapPrismaError(error: any): AppError | null {
  if (error?.code === 'P2002') {
    return new AppError(409, 'CONFLICT', 'A record with that value already exists.');
  }
  if (error?.code === 'P2025') {
    return new AppError(404, 'NOT_FOUND', 'Resource not found.');
  }
  if (error?.code === 'P2003') {
    return new AppError(409, 'CONFLICT', 'That change conflicts with a related record.');
  }
  return null;
}
