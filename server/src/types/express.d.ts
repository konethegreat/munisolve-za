import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      id: string;
      validated: {
        body?: any;
        query?: any;
        params?: any;
      };
      token?: string;
      resourceType?: string;
      resourceId?: string;
      user?: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
        isActive: boolean;
      } | null;
    }
  }
}

export {};
